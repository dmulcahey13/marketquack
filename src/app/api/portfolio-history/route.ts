import { NextResponse } from "next/server";

import { chartRanges } from "@/lib/stockChart";
import type { ChartRange } from "@/types/market";

const twelveDataTimeSeriesUrl = "https://api.twelvedata.com/time_series";
const tickerPattern = /^[A-Z][A-Z0-9.-]{0,9}$/;
const missingKeyMessage = "Portfolio performance data is temporarily unavailable. Missing chart API key.";
const unavailableMessage = "Portfolio performance data is temporarily unavailable. Please try again later.";

export const dynamic = "force-dynamic";

type PortfolioHistoryRequest = {
  cashBalance?: unknown;
  holdings?: unknown;
  range?: unknown;
};

type PortfolioHistoryHolding = {
  shares: number;
  ticker: string;
};

type TwelveDataValue = {
  close?: string;
  datetime?: string;
};

type TwelveDataResponse = {
  code?: number;
  message?: string;
  status?: string;
  values?: TwelveDataValue[];
};

type HistoricalPriceMap = Map<string, number>;

type RangeRequest = {
  interval: string;
  outputsize: number;
};

const rangeRequests: Record<Exclude<ChartRange, "YTD">, RangeRequest[]> = {
  "1D": [
    { interval: "5min", outputsize: 78 },
    { interval: "15min", outputsize: 26 },
    { interval: "30min", outputsize: 13 },
  ],
  "5D": [
    { interval: "30min", outputsize: 65 },
    { interval: "1h", outputsize: 40 },
    { interval: "1day", outputsize: 5 },
  ],
  "1M": [{ interval: "1day", outputsize: 30 }],
  "6M": [{ interval: "1day", outputsize: 180 }],
  "1Y": [{ interval: "1day", outputsize: 365 }],
};

export async function POST(request: Request) {
  let payload: PortfolioHistoryRequest;

  try {
    payload = (await request.json()) as PortfolioHistoryRequest;
  } catch {
    return NextResponse.json({ error: "Invalid portfolio history request." }, { status: 400 });
  }

  const cashBalance = Number(payload.cashBalance);
  const holdings = normalizeHoldings(payload.holdings);
  const range = normalizeRange(payload.range);

  if (!range) {
    return NextResponse.json({ error: "Invalid portfolio chart range." }, { status: 400 });
  }

  if (!Number.isFinite(cashBalance) || cashBalance < 0) {
    return NextResponse.json({ error: "Invalid cash balance." }, { status: 400 });
  }

  if (holdings.length === 0) {
    return NextResponse.json([]);
  }

  if (holdings.length > 12) {
    return NextResponse.json(
      { error: "Portfolio performance supports up to 12 tickers for now." },
      { status: 400 },
    );
  }

  const apiKey = process.env.TWELVE_DATA_API_KEY?.trim();

  if (!apiKey) {
    return NextResponse.json({ error: missingKeyMessage }, { status: 503 });
  }

  let priceMaps: Array<{ prices: HistoricalPriceMap; shares: number; ticker: string }>;

  try {
    const rangeRequestOptions = getRangeRequestOptions(range);
    priceMaps = await Promise.all(
      holdings.map(async (holding) => ({
        prices: await fetchTickerHistory(holding.ticker, apiKey, range, rangeRequestOptions),
        shares: holding.shares,
        ticker: holding.ticker,
      })),
    );
  } catch {
    return NextResponse.json({ error: unavailableMessage }, { status: 503 });
  }

  if (priceMaps.some((item) => item.prices.size < 2)) {
    return NextResponse.json({ error: unavailableMessage }, { status: 503 });
  }

  const sharedDates = getSharedDates(priceMaps.map((item) => item.prices));

  if (sharedDates.length < 2) {
    return NextResponse.json({ error: unavailableMessage }, { status: 503 });
  }

  // TODO: Later, use practice_transactions to reconstruct true portfolio value by fake buy/sell date.
  // This first version assumes the current fake holdings existed for the full displayed period.
  const points = sharedDates.map((date) => {
    const value = priceMaps.reduce((total, item) => {
      const closePrice = item.prices.get(date) ?? 0;
      return total + item.shares * closePrice;
    }, cashBalance);

    return {
      date,
      value: Math.round(value * 100) / 100,
    };
  });

  return NextResponse.json(points);
}

function normalizeHoldings(value: unknown): PortfolioHistoryHolding[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const aggregated = new Map<string, number>();

  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const rawTicker = "ticker" in item ? item.ticker : "";
    const rawShares = "shares" in item ? item.shares : 0;
    const ticker = typeof rawTicker === "string" ? rawTicker.trim().toUpperCase() : "";
    const shares = Number(rawShares);

    if (!tickerPattern.test(ticker) || !Number.isFinite(shares) || shares <= 0) {
      continue;
    }

    aggregated.set(ticker, (aggregated.get(ticker) ?? 0) + shares);
  }

  return Array.from(aggregated.entries()).map(([ticker, shares]) => ({ shares, ticker }));
}

async function fetchTickerHistory(
  ticker: string,
  apiKey: string,
  range: ChartRange,
  rangeRequestOptions: RangeRequest[],
) {
  for (const rangeRequest of rangeRequestOptions) {
    try {
      const prices = await fetchTickerHistoryForRequest(ticker, apiKey, range, rangeRequest);

      if (prices.size >= 2) {
        return prices;
      }
    } catch {
      // Try the next allowed interval before showing the user the unavailable state.
    }
  }

  throw new Error("Twelve Data returned unavailable data.");
}

async function fetchTickerHistoryForRequest(
  ticker: string,
  apiKey: string,
  range: ChartRange,
  rangeRequest: RangeRequest,
) {
  const url = new URL(twelveDataTimeSeriesUrl);
  url.searchParams.set("symbol", ticker);
  url.searchParams.set("interval", rangeRequest.interval);
  url.searchParams.set("outputsize", String(rangeRequest.outputsize));
  url.searchParams.set("apikey", apiKey);

  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Twelve Data request failed.");
  }

  const payload = (await response.json()) as TwelveDataResponse;

  if (payload.status === "error" || payload.code || !Array.isArray(payload.values)) {
    throw new Error("Twelve Data returned unavailable data.");
  }

  const prices = new Map<string, number>();

  for (const value of payload.values) {
    const date = normalizeDateTime(value.datetime);
    const close = Number(value.close);

    if (date && Number.isFinite(close) && close > 0) {
      prices.set(date, close);
    }
  }

  return filterPricesByRange(prices, range);
}

function getSharedDates(priceMaps: HistoricalPriceMap[]) {
  const [firstMap, ...remainingMaps] = priceMaps;

  if (!firstMap) {
    return [];
  }

  return Array.from(firstMap.keys())
    .filter((date) => remainingMaps.every((map) => map.has(date)))
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
}

function normalizeDateTime(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  const date = new Date(value.trim().replace(" ", "T"));

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString();
}

function filterPricesByRange(prices: HistoricalPriceMap, range: ChartRange) {
  if (range === "1D") {
    return keepLatestTradingDay(prices);
  }

  const cutoff = getRangeCutoff(range);

  if (!cutoff) {
    return prices;
  }

  return new Map(
    Array.from(prices.entries()).filter(([date]) => new Date(date).getTime() >= cutoff.getTime()),
  );
}

function keepLatestTradingDay(prices: HistoricalPriceMap) {
  const sortedDates = Array.from(prices.keys()).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime(),
  );
  const latestDate = sortedDates.at(-1);

  if (!latestDate) {
    return prices;
  }

  const latestDay = latestDate.slice(0, 10);

  return new Map(Array.from(prices.entries()).filter(([date]) => date.slice(0, 10) === latestDay));
}

function getRangeRequestOptions(range: ChartRange): RangeRequest[] {
  if (range === "YTD") {
    return [
      {
        interval: "1day",
        outputsize: getYearToDateOutputSize(),
      },
    ];
  }

  return rangeRequests[range];
}

function getRangeCutoff(range: ChartRange) {
  const now = new Date();

  if (range === "1M") {
    return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  }

  if (range === "6M") {
    return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
  }

  if (range === "YTD") {
    return new Date(now.getFullYear(), 0, 1);
  }

  if (range === "1Y") {
    return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  }

  return null;
}

function getYearToDateOutputSize() {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const dayOfYear =
    Math.floor((now.getTime() - yearStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;

  return Math.min(370, Math.max(30, dayOfYear + 10));
}

function normalizeRange(value: unknown): ChartRange | null {
  const range = typeof value === "string" ? value.trim().toUpperCase() : "1M";

  return chartRanges.includes(range as ChartRange) ? (range as ChartRange) : null;
}
