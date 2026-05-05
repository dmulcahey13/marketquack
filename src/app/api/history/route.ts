import { NextResponse } from "next/server";

import { chartRanges } from "@/lib/stockChart";
import type { ChartHistoryResponse, ChartPoint, ChartRange } from "@/types/market";

const tickerPattern = /^[A-Z][A-Z0-9.-]{0,9}$/;
const twelveDataTimeSeriesUrl = "https://api.twelvedata.com/time_series";
const missingKeyMessage = "Chart data is temporarily unavailable. Missing chart API key.";
const unavailableMessage = "Chart data is temporarily unavailable. Please try again later.";

export const dynamic = "force-dynamic";

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

type RangeRequest = {
  interval: string;
  outputsize: number;
};

const rangeRequests: Record<Exclude<ChartRange, "YTD">, RangeRequest> = {
  "1D": { interval: "5min", outputsize: 78 },
  "5D": { interval: "30min", outputsize: 65 },
  "1M": { interval: "1day", outputsize: 30 },
  "6M": { interval: "1day", outputsize: 126 },
  "1Y": { interval: "1day", outputsize: 252 },
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.trim().toUpperCase() ?? "";
  const range = searchParams.get("range")?.trim().toUpperCase() ?? "";

  if (!symbol || !tickerPattern.test(symbol)) {
    return NextResponse.json({ error: "Invalid symbol." }, { status: 400 });
  }

  if (!isChartRange(range)) {
    return NextResponse.json({ error: "Invalid chart range." }, { status: 400 });
  }

  const apiKey = process.env.TWELVE_DATA_API_KEY?.trim();

  if (!apiKey) {
    return createUnavailableResponse(symbol, range, missingKeyMessage);
  }

  const rangeRequest = getRangeRequest(range);
  const url = new URL(twelveDataTimeSeriesUrl);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", rangeRequest.interval);
  url.searchParams.set("outputsize", String(rangeRequest.outputsize));
  url.searchParams.set("apikey", apiKey);

  let response: Response;

  try {
    response = await fetch(url, { cache: "no-store" });
  } catch {
    return createUnavailableResponse(symbol, range, unavailableMessage);
  }

  if (!response.ok) {
    return createUnavailableResponse(symbol, range, unavailableMessage);
  }

  let payload: TwelveDataResponse;

  try {
    payload = (await response.json()) as TwelveDataResponse;
  } catch {
    return createUnavailableResponse(symbol, range, unavailableMessage);
  }

  if (payload.status === "error" || payload.code || !Array.isArray(payload.values)) {
    return createUnavailableResponse(symbol, range, unavailableMessage);
  }

  const points = normalizeTwelveDataValues(payload.values, range);

  if (points.length < 2) {
    return createUnavailableResponse(symbol, range, unavailableMessage);
  }

  const result: ChartHistoryResponse = {
    symbol,
    range,
    points,
  };

  return NextResponse.json(result);
}

function getRangeRequest(range: ChartRange): RangeRequest {
  if (range === "YTD") {
    return {
      interval: "1day",
      outputsize: getYearToDateOutputSize(),
    };
  }

  return rangeRequests[range];
}

function normalizeTwelveDataValues(values: TwelveDataValue[], range: ChartRange): ChartPoint[] {
  const points = values
    .map((value) => {
      const date = normalizeDateTime(value.datetime);
      const price = Number(value.close);

      if (!date || !Number.isFinite(price) || price <= 0) {
        return null;
      }

      return { date, price };
    })
    .filter((point): point is ChartPoint => point !== null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (range !== "YTD") {
    return points;
  }

  const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();

  return points.filter((point) => new Date(point.date).getTime() >= yearStart);
}

function normalizeDateTime(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  const normalizedValue = value.trim().replace(" ", "T");
  const date = new Date(normalizedValue);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString();
}

function getYearToDateOutputSize() {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const dayOfYear =
    Math.floor((now.getTime() - yearStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;

  return Math.min(260, Math.max(30, dayOfYear + 10));
}

function createUnavailableResponse(symbol: string, range: ChartRange, error: string) {
  const payload: ChartHistoryResponse = {
    symbol,
    range,
    points: [],
    error,
  };

  return NextResponse.json(payload, { status: 503 });
}

function isChartRange(value: string): value is ChartRange {
  return chartRanges.includes(value as ChartRange);
}
