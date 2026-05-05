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
import type { ChartHistoryResponse, ChartPoint, ChartRange } from "@/types/market";

type StockLineChartProps = {
  symbol: string;
};

type ChartDatum = ChartPoint & {
  label: string;
};

const chartUnavailableMessage = "Chart data is temporarily unavailable. Please try again later.";
const green = "#00e676";
const red = "#ff5c5c";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency",
});

export function StockLineChart({ symbol }: StockLineChartProps) {
  const [selectedRange, setSelectedRange] = useState<ChartRange>("1M");
  const [rawData, setRawData] = useState<ChartPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [chartError, setChartError] = useState(chartUnavailableMessage);

  useEffect(() => {
    const controller = new AbortController();

    async function loadHistory() {
      setIsLoading(true);
      setChartError("");
      setRawData([]);

      try {
        const response = await fetch(
          `/api/history?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(
            selectedRange,
          )}`,
          { signal: controller.signal },
        );
        const payload = (await response.json()) as ChartHistoryResponse | { error?: string };

        if (!response.ok || !isValidHistoryPayload(payload)) {
          setChartError(getChartErrorMessage(payload));
          return;
        }

        setRawData(payload.points);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setChartError(chartUnavailableMessage);
      } finally {
        setIsLoading(false);
      }
    }

    void loadHistory();

    return () => {
      controller.abort();
    };
  }, [selectedRange, symbol]);

  const chartData = useMemo(
    () =>
      rawData.map((point) => ({
        ...point,
        label: formatAxisDate(point.date, selectedRange),
      })),
    [rawData, selectedRange],
  );
  const firstPrice = chartData[0]?.price ?? 0;
  const lastPrice = chartData[chartData.length - 1]?.price ?? 0;
  const chartColor = lastPrice >= firstPrice ? green : red;
  const gradientId = `marketquack-chart-${symbol.replace(
    /[^a-z0-9]/gi,
    "-",
  )}-${selectedRange.toLowerCase()}`;
  const shouldShowChart = !isLoading && !chartError && chartData.length > 0;

  return (
    <section className="mt-6 rounded-lg border border-line bg-paper p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-black tracking-tight text-ink">Price Chart</h3>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Chart time range">
          {chartRanges.map((range) => {
            const isActive = range === selectedRange;

            return (
              <button
                className={
                  isActive
                    ? "rounded-md border border-pulse-green bg-pulse-green px-2.5 py-1.5 text-xs font-black text-black"
                    : "rounded-md border border-line bg-panel px-2.5 py-1.5 text-xs font-black text-neutral-300 transition hover:border-pulse-green hover:text-pulse-green"
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

      <div className="mt-4 h-72 rounded-md border border-line bg-black/45 p-3">
        {isLoading ? <UnavailableChartMessage message="Loading accurate chart data..." /> : null}
        {!isLoading && !shouldShowChart ? (
          <UnavailableChartMessage message={chartUnavailableMessage} />
        ) : null}
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
                width={72}
              />
              <Tooltip
                content={<ChartTooltip range={selectedRange} />}
                cursor={{ stroke: chartColor, strokeOpacity: 0.45 }}
              />
              <Area
                activeDot={{ fill: "#050607", r: 4, stroke: chartColor, strokeWidth: 2 }}
                dataKey="price"
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
    </section>
  );
}

function UnavailableChartMessage({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center text-center">
      <p className="max-w-sm text-sm font-semibold leading-6 text-neutral-400">{message}</p>
    </div>
  );
}

function ChartTooltip({
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
      <p className="mt-1 font-black text-ink">{currencyFormatter.format(datum.price)}</p>
    </div>
  );
}

function isValidHistoryPayload(
  payload: ChartHistoryResponse | { error?: string },
): payload is ChartHistoryResponse {
  if (!("points" in payload) || !Array.isArray(payload.points) || payload.points.length < 2) {
    return false;
  }

  return payload.points.every((point) => {
    const date = new Date(point.date);

    return (
      typeof point.date === "string" &&
      !Number.isNaN(date.getTime()) &&
      typeof point.price === "number" &&
      Number.isFinite(point.price) &&
      point.price > 0
    );
  });
}

function getChartErrorMessage(payload: ChartHistoryResponse | { error?: string }) {
  return typeof payload.error === "string" && payload.error
    ? payload.error
    : chartUnavailableMessage;
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

  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
  });
}

function formatTooltipDate(value: string, range: ChartRange) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  if (range === "1D") {
    return date.toLocaleString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      month: "short",
      day: "numeric",
    });
  }

  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
