"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { chartRanges } from "@/lib/stockChart";
import type { ChartRange } from "@/types/market";

type PortfolioChartHolding = {
  shares: number;
  ticker: string;
};

type PortfolioChartPoint = {
  date: string;
  value: number;
};

type PortfolioPerformanceChartProps = {
  cashBalance: number;
  holdings: PortfolioChartHolding[];
};

type ChartDatum = PortfolioChartPoint & {
  label: string;
};

const green = "#00e676";
const red = "#ff5c5c";
const unavailableMessage = "Portfolio performance data is temporarily unavailable. Please try again later.";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency",
});

export function PortfolioPerformanceChart({ cashBalance, holdings }: PortfolioPerformanceChartProps) {
  const [selectedRange, setSelectedRange] = useState<ChartRange>("1M");
  const [points, setPoints] = useState<PortfolioChartPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const holdingsKey = useMemo(
    () =>
      holdings
        .map((holding) => `${holding.ticker}:${holding.shares}`)
        .sort()
        .join("|"),
    [holdings],
  );

  useEffect(() => {
    const controller = new AbortController();

    async function loadPortfolioHistory() {
      if (holdings.length === 0) {
        setPoints([]);
        setError("");
        return;
      }

      setIsLoading(true);
      setError("");
      setPoints([]);

      try {
        const response = await fetch("/api/portfolio-history", {
          body: JSON.stringify({
            cashBalance,
            holdings,
            range: selectedRange,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
          signal: controller.signal,
        });
        const payload = (await response.json()) as PortfolioChartPoint[] | { error?: string };

        if (!response.ok || !isValidHistoryPayload(payload)) {
          setError(getErrorMessage(payload));
          return;
        }

        setPoints(payload);
      } catch (caughtError) {
        if (caughtError instanceof DOMException && caughtError.name === "AbortError") {
          return;
        }

        setError(unavailableMessage);
      } finally {
        setIsLoading(false);
      }
    }

    void loadPortfolioHistory();

    return () => {
      controller.abort();
    };
  }, [cashBalance, holdings, holdingsKey, selectedRange]);

  const chartData = useMemo(
    () =>
      points.map((point) => ({
        ...point,
        label: formatAxisDate(point.date, selectedRange),
      })),
    [points, selectedRange],
  );
  const firstValue = chartData[0]?.value ?? 0;
  const lastValue = chartData[chartData.length - 1]?.value ?? 0;
  const chartColor = lastValue >= firstValue ? green : red;
  const gradientId = `marketquack-portfolio-performance-${selectedRange.toLowerCase()}`;
  const shouldShowChart = !isLoading && !error && chartData.length > 0;

  return (
    <section className="rounded-lg border border-line bg-panel p-5 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-ink">Portfolio performance</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-400">
            See how your fake investments would have moved together over time.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Portfolio chart time range">
          {chartRanges.map((range) => {
            const isActive = range === selectedRange;

            return (
              <button
                className={
                  isActive
                    ? "rounded-md border border-pulse-green bg-pulse-green px-2.5 py-1.5 text-xs font-black text-black"
                    : "rounded-md border border-line bg-black/35 px-2.5 py-1.5 text-xs font-black text-neutral-300 transition hover:border-pulse-green hover:text-pulse-green"
                }
                key={range}
                onClick={() => setSelectedRange(range)}
                type="button"
              >
                {range}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 h-72 rounded-md border border-line bg-black/45 p-3">
        {holdings.length === 0 ? (
          <ChartMessage message="Add a fake holding to generate your portfolio performance chart." />
        ) : null}
        {holdings.length > 0 && isLoading ? <ChartMessage message="Loading portfolio performance..." /> : null}
        {holdings.length > 0 && !isLoading && error ? <ChartMessage message={error} /> : null}
        {shouldShowChart ? (
          <ResponsiveContainer height="100%" width="100%">
            <AreaChart data={chartData} margin={{ bottom: 4, left: 0, right: 4, top: 12 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={chartColor} stopOpacity={0.22} />
                  <stop offset="72%" stopColor={chartColor} stopOpacity={0.05} />
                  <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#2a343a" strokeOpacity={0.48} vertical={false} />
              <XAxis
                axisLine={false}
                dataKey="label"
                interval="preserveStartEnd"
                minTickGap={28}
                tick={{ fill: "#9ca3af", fontSize: 11, fontWeight: 700 }}
                tickLine={false}
              />
              <YAxis
                axisLine={false}
                domain={["dataMin", "dataMax"]}
                orientation="right"
                tick={{ fill: "#9ca3af", fontSize: 11, fontWeight: 700 }}
                tickFormatter={(value: number) => currencyFormatter.format(value)}
                tickLine={false}
                width={76}
              />
              <Tooltip
                content={<PortfolioChartTooltip range={selectedRange} />}
                cursor={{ stroke: chartColor, strokeOpacity: 0.45 }}
              />
              <Area
                activeDot={{ fill: "#050607", r: 4, stroke: chartColor, strokeWidth: 2 }}
                dataKey="value"
                fill={`url(#${gradientId})`}
                isAnimationActive={false}
                stroke={chartColor}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                type="linear"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : null}
      </div>

      <div className="mt-4 grid gap-2 text-xs font-semibold leading-5 text-neutral-500">
        <p>Estimated using historical close prices. Practice only. Not financial advice.</p>
        <p>Practice portfolio only. No real money is used.</p>
        <p>Chart assumes your current fake holdings were held across the displayed period.</p>
      </div>
    </section>
  );
}

function ChartMessage({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center text-center">
      <p className="max-w-sm text-sm font-semibold leading-6 text-neutral-400">{message}</p>
    </div>
  );
}

function PortfolioChartTooltip({
  active,
  payload,
  range,
}: {
  active?: boolean;
  payload?: Array<{ payload?: ChartDatum; value?: number }>;
  range: ChartRange;
}) {
  const datum = payload?.[0]?.payload;

  if (!active || !datum) {
    return null;
  }

  return (
    <div className="rounded-md border border-line bg-black/90 px-3 py-2 text-xs shadow-soft">
      <p className="font-bold text-neutral-300">{formatTooltipDate(datum.date, range)}</p>
      <p className="mt-1 font-black text-ink">{currencyFormatter.format(datum.value)}</p>
    </div>
  );
}

function isValidHistoryPayload(
  payload: PortfolioChartPoint[] | { error?: string },
): payload is PortfolioChartPoint[] {
  if (!Array.isArray(payload) || payload.length < 2) {
    return false;
  }

  return payload.every((point) => {
    const date = new Date(point.date);

    return (
      typeof point.date === "string" &&
      !Number.isNaN(date.getTime()) &&
      typeof point.value === "number" &&
      Number.isFinite(point.value) &&
      point.value >= 0
    );
  });
}

function getErrorMessage(payload: PortfolioChartPoint[] | { error?: string }) {
  return !Array.isArray(payload) && typeof payload.error === "string" && payload.error
    ? payload.error
    : unavailableMessage;
}

function formatAxisDate(value: string, range: ChartRange) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  if (range === "1D") {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  if (range === "5D") {
    return date.toLocaleString("en-US", {
      day: "numeric",
      hour: "numeric",
      month: "short",
    });
  }

  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
  });
}

function formatTooltipDate(value: string, range: ChartRange) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  if (range === "1D" || range === "5D") {
    return date.toLocaleString("en-US", {
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
