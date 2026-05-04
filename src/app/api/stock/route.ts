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
    const cleanedNews = cleanNews(news);
    const companyName = cleanText(profile.name) || cleanText(profile.ticker) || ticker;

    const payload: StockResponse = {
      symbol: cleanText(profile.ticker) || ticker,
      companyName,
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

function cleanNews(news: FinnhubNewsArticle[]): LatestNewsItem[] {
  if (!Array.isArray(news)) {
    return [];
  }

  return news
    .filter((article) => cleanText(article.headline) && cleanText(article.url))
    .slice(0, newsLimit)
    .map((article) => ({
      title: cleanText(article.headline),
      source: cleanText(article.source) || "Unknown source",
      summary: cleanText(article.summary),
      url: cleanText(article.url),
      datetime: unixSecondsToIso(article.datetime),
    }));
}

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
