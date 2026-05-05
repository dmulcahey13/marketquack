import { NextResponse } from "next/server";

import type { LatestNewsItem, StockResponse } from "@/types/market";

const tickerPattern = /^[A-Z][A-Z0-9.-]{0,9}$/;
const finnhubBaseUrl = "https://finnhub.io/api/v1";
const newsLimit = 8;

export const dynamic = "force-dynamic";

type FinnhubQuote = {
  c?: number;
  d?: number | null;
  dp?: number | null;
  pc?: number;
};

type FinnhubCompanyProfile = {
  description?: string;
  name?: string;
  ticker?: string;
};

type FinnhubNewsArticle = {
  datetime?: number;
  headline?: string;
  source?: string;
  summary?: string;
  url?: string;
};

type KeywordProfile = {
  companyKeywords: string[];
  marketKeywords: string[];
};

type ScoredNewsArticle = LatestNewsItem & {
  relevanceLabel: "company" | "market";
  relevanceScore: number;
};

class RouteError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ticker = searchParams.get("ticker")?.trim().toUpperCase();

    if (!ticker) {
      throw new RouteError("Missing required ticker query parameter.", 400);
    }

    if (!tickerPattern.test(ticker)) {
      throw new RouteError(
        "Ticker must be 1-10 characters using letters, numbers, dots, or hyphens.",
        400,
      );
    }

    const apiKey = process.env.FINNHUB_API_KEY?.trim();

    if (!apiKey) {
      throw new RouteError("FINNHUB_API_KEY is not configured on the server.", 500);
    }

    const { from, to } = getNewsDateRange();
    const [quote, profile, news] = await Promise.all([
      fetchFinnhub<FinnhubQuote>("/quote", { symbol: ticker }, apiKey),
      fetchFinnhub<FinnhubCompanyProfile>("/stock/profile2", { symbol: ticker }, apiKey),
      fetchFinnhub<FinnhubNewsArticle[]>(
        "/company-news",
        { from, symbol: ticker, to },
        apiKey,
      ),
    ]);

    if (!hasQuoteData(quote)) {
      throw new RouteError(`No quote data found for ticker ${ticker}.`, 404);
    }

    const currentPrice = quote.c;
    const previousClose = quote.pc;
    const priceChange = toFiniteNumber(quote.d) ?? currentPrice - previousClose;
    const percentChange =
      toFiniteNumber(quote.dp) ??
      (previousClose === 0 ? 0 : ((currentPrice - previousClose) / previousClose) * 100);
    const companyName = cleanText(profile.name) || cleanText(profile.ticker) || ticker;
    const symbol = cleanText(profile.ticker) || ticker;
    const cleanedNews = cleanNews(news, symbol, companyName);
    const companyDescription = createCompanyDescription(profile, symbol);

    const payload: StockResponse = {
      symbol,
      companyName,
      companyDescription,
      currentPrice,
      priceChange,
      percentChange,
      previousClose,
      latestNews: cleanedNews,
    };

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof RouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "Unable to load stock data from Finnhub." },
      { status: 502 },
    );
  }
}

async function fetchFinnhub<T>(
  path: string,
  params: Record<string, string>,
  apiKey: string,
): Promise<T> {
  const url = new URL(`${finnhubBaseUrl}${path}`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  url.searchParams.set("token", apiKey);

  let response: Response;

  try {
    response = await fetch(url, { cache: "no-store" });
  } catch {
    throw new RouteError("Finnhub request failed. Check network connectivity.", 502);
  }

  if (!response.ok) {
    throw new RouteError(getFinnhubStatusMessage(response.status), getProxyStatus(response.status));
  }

  const payload = (await response.json()) as T | { error?: string };

  if (isFinnhubError(payload)) {
    throw new RouteError(`Finnhub error: ${payload.error}`, 502);
  }

  return payload as T;
}

function isFinnhubError(payload: unknown): payload is { error: string } {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof (payload as { error?: unknown }).error === "string"
  );
}

function getFinnhubStatusMessage(status: number) {
  if (status === 401) {
    return (
      "Finnhub rejected FINNHUB_API_KEY with status 401. " +
      "Check that .env.local contains a valid Finnhub API key, then restart npm run dev."
    );
  }

  if (status === 403) {
    return "Finnhub returned status 403. This API key may not have access to the requested endpoint.";
  }

  if (status === 429) {
    return "Finnhub rate limit reached. Wait a moment and try again.";
  }

  return `Finnhub request failed with status ${status}.`;
}

function getProxyStatus(status: number) {
  return status === 401 || status === 403 || status === 429 ? status : 502;
}

function hasQuoteData(quote: FinnhubQuote): quote is FinnhubQuote & { c: number; pc: number } {
  return isFiniteNumber(quote.c) && quote.c > 0 && isFiniteNumber(quote.pc);
}

function createCompanyDescription(profile: FinnhubCompanyProfile, symbol: string) {
  const profileDescription = cleanCompanyDescription(profile.description);

  if (profileDescription) {
    return profileDescription;
  }

  return knownCompanyDescriptions[symbol.toUpperCase()] || "Company overview is currently unavailable.";
}

const knownCompanyDescriptions: Record<string, string> = {
  AAPL:
    "Apple designs and sells consumer technology products including the iPhone, Mac, iPad, Apple Watch, and services like the App Store and Apple Music.",
  AMZN:
    "Amazon runs an online marketplace, cloud computing services, streaming entertainment, digital advertising, and logistics operations.",
  GOOGL:
    "Alphabet is the parent company of Google. It operates products and services including Search, YouTube, Android, Google Cloud, advertising tools, and other technology projects.",
  JPM:
    "JPMorgan Chase is a large financial services company. It provides banking, credit cards, lending, investing, payments, and wealth management services.",
  META:
    "Meta builds social media, messaging, virtual reality, and advertising products. Its apps include Facebook, Instagram, WhatsApp, Messenger, and Threads.",
  MSFT:
    "Microsoft makes software, cloud services, devices, and business tools. Its products include Windows, Microsoft 365, Azure, Xbox, and LinkedIn.",
  NFLX:
    "Netflix is a streaming entertainment company. It offers movies, TV shows, documentaries, and games through a paid subscription service.",
  NVDA:
    "NVIDIA designs graphics processing units, AI chips, and software used in data centers, gaming, high-performance computing, and automotive technology.",
  SPY:
    "SPY is an exchange-traded fund that tracks the S&P 500 index. It gives investors exposure to a broad group of large U.S. companies.",
  TSLA:
    "Tesla designs and sells electric vehicles, battery products, and energy storage systems. It is also involved in charging networks and self-driving technology.",
};

function cleanCompanyDescription(value: unknown) {
  const description = cleanText(value).replace(/\s+/g, " ");

  if (!description) {
    return "";
  }

  return description
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .join(" ");
}

function cleanNews(
  news: FinnhubNewsArticle[],
  symbol: string,
  companyName: string,
): LatestNewsItem[] {
  if (!Array.isArray(news)) {
    return [];
  }

  const keywords = createKeywordProfile(symbol, companyName);
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();

  const scoredArticles = news
    .map((article) => cleanNewsArticle(article))
    .filter((article): article is LatestNewsItem => article !== null)
    .filter((article) => {
      const urlKey = normalizeComparableText(article.url);
      const titleKey = normalizeComparableText(article.title);

      if (seenUrls.has(urlKey) || seenTitles.has(titleKey)) {
        return false;
      }

      seenUrls.add(urlKey);
      seenTitles.add(titleKey);

      return true;
    })
    .map((article) => scoreNewsArticle(article, keywords))
    .filter((article): article is ScoredNewsArticle => article !== null);

  const companyArticles = sortNewsByRelevance(scoredArticles.filter(
    (article) => article.relevanceLabel === "company",
  ));
  const marketArticles = sortNewsByRelevance(scoredArticles.filter(
    (article) => article.relevanceLabel === "market",
  ));

  if (companyArticles.length >= 5) {
    return companyArticles.slice(0, newsLimit);
  }

  return [...companyArticles, ...marketArticles].slice(0, newsLimit);
}

function cleanNewsArticle(article: FinnhubNewsArticle): LatestNewsItem | null {
  const title = cleanText(article.headline);
  const url = cleanText(article.url);

  if (!title || !isValidArticleUrl(url)) {
    return null;
  }

  return {
    title,
    source: cleanText(article.source) || "Unknown source",
    summary: cleanText(article.summary),
    url,
    datetime: unixSecondsToIso(article.datetime),
  };
}

function scoreNewsArticle(
  article: LatestNewsItem,
  keywords: KeywordProfile,
): ScoredNewsArticle | null {
  const title = normalizeSearchText(article.title);
  const summary = normalizeSearchText(article.summary);
  const source = normalizeSearchText(article.source);
  const url = normalizeSearchText(article.url);
  const companyScore = scoreAgainstKeywords(
    { source, summary, title, url },
    keywords.companyKeywords,
    { source: 1, summary: 3, title: 7, url: 2 },
  );
  const marketScore = scoreAgainstKeywords(
    { source, summary, title, url },
    keywords.marketKeywords,
    { source: 1, summary: 1, title: 3, url: 0 },
  );

  if (companyScore >= 5) {
    return {
      ...article,
      relevanceLabel: "company",
      relevanceScore: companyScore,
    };
  }

  if (marketScore >= 3) {
    return {
      ...article,
      relevanceLabel: "market",
      relevanceScore: marketScore,
    };
  }

  return null;
}

function scoreAgainstKeywords(
  fields: Record<"source" | "summary" | "title" | "url", string>,
  keywords: string[],
  weights: Record<"source" | "summary" | "title" | "url", number>,
) {
  return keywords.reduce((score, keyword) => {
    if (!keyword) {
      return score;
    }

    const normalizedKeyword = normalizeSearchText(keyword);
    const keywordBoost = normalizedKeyword.length > 8 ? 1 : 0;

    return (
      score +
      (containsKeyword(fields.title, normalizedKeyword) ? weights.title + keywordBoost : 0) +
      (containsKeyword(fields.summary, normalizedKeyword) ? weights.summary : 0) +
      (containsKeyword(fields.source, normalizedKeyword) ? weights.source : 0) +
      (containsKeyword(fields.url, normalizedKeyword) ? weights.url : 0)
    );
  }, 0);
}

function sortNewsByRelevance<T extends LatestNewsItem & { relevanceScore: number }>(
  articles: T[],
) {
  return [...articles].sort((a, b) => {
    if (b.relevanceScore !== a.relevanceScore) {
      return b.relevanceScore - a.relevanceScore;
    }

    return getArticleTime(b.datetime) - getArticleTime(a.datetime);
  });
}

function createKeywordProfile(symbol: string, companyName: string): KeywordProfile {
  const normalizedSymbol = symbol.toUpperCase();
  const companyKeywords = new Set([
    normalizedSymbol,
    companyName,
    ...createCompanyNameKeywords(companyName),
    ...(companyKeywordMap[normalizedSymbol] ?? []),
  ]);

  return {
    companyKeywords: [...companyKeywords].map(normalizeSearchText).filter(Boolean),
    marketKeywords: marketContextKeywords.map(normalizeSearchText),
  };
}

function createCompanyNameKeywords(companyName: string) {
  const suffixes = new Set([
    "adr",
    "class",
    "co",
    "company",
    "corp",
    "corporation",
    "inc",
    "incorporated",
    "and",
    "limited",
    "llc",
    "ltd",
    "ordinary",
    "plc",
    "shares",
    "the",
    "trust",
  ]);
  const normalizedCompanyName = normalizeSearchText(companyName);
  const words = normalizedCompanyName
    .split(" ")
    .filter((word) => word.length > 2 && !suffixes.has(word));

  return [normalizedCompanyName, ...words];
}

function containsKeyword(value: string, keyword: string) {
  if (!keyword) {
    return false;
  }

  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(^|[^a-z0-9])${escapedKeyword}([^a-z0-9]|$)`, "i");

  return pattern.test(value);
}

function isValidArticleUrl(value: string) {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function getArticleTime(value: string) {
  const time = Date.parse(value);

  return Number.isFinite(time) ? time : 0;
}

function normalizeComparableText(value: string) {
  return normalizeSearchText(value).replace(/[^a-z0-9]+/g, "");
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const companyKeywordMap: Record<string, string[]> = {
  AAPL: [
    "apple",
    "apple inc",
    "app store",
    "iphone",
    "ipad",
    "ios",
    "icloud",
    "mac",
    "macbook",
    "tim cook",
    "vision pro",
  ],
  NVDA: [
    "nvidia",
    "ai chip",
    "ai chips",
    "blackwell",
    "cuda",
    "data center",
    "data centers",
    "gb200",
    "gpu",
    "gpus",
    "jensen huang",
    "semiconductor",
    "semiconductors",
  ],
  SPY: [
    "spy",
    "spdr",
    "spdr s and p 500",
    "s and p 500",
    "sp 500",
    "s p 500",
    "index fund",
    "etf",
  ],
  TSLA: [
    "tesla",
    "cybertruck",
    "deliveries",
    "electric vehicle",
    "electric vehicles",
    "elon musk",
    "ev",
    "evs",
    "gigafactory",
    "model 3",
    "model y",
    "robotaxi",
    "supercharger",
    "tesla semi",
  ],
};

const marketContextKeywords = [
  "bond yields",
  "dow",
  "earnings season",
  "federal reserve",
  "fed",
  "inflation",
  "interest rates",
  "jobs report",
  "market rally",
  "market selloff",
  "nasdaq",
  "s and p 500",
  "sector",
  "stock market",
  "stocks",
  "treasury yields",
  "wall street",
];

function getNewsDateRange() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 7);

  return {
    from: formatDate(from),
    to: formatDate(to),
  };
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function unixSecondsToIso(value: unknown) {
  if (!isFiniteNumber(value)) {
    return "";
  }

  return new Date(value * 1000).toISOString();
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toFiniteNumber(value: unknown) {
  return isFiniteNumber(value) ? value : null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
