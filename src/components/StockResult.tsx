import type { ExplanationResponse, ExplanationSource, StockResponse } from "@/types/market";

type StockResultProps = {
  activeTicker: string;
  explanation: ExplanationResponse | null;
  explanationError: string;
  isExplaining: boolean;
  isLoading: boolean;
  onAddExample: (ticker: string) => void;
  stock: StockResponse | null;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  style: "currency",
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "percent",
});

export function StockResult({
  activeTicker,
  explanation,
  explanationError,
  isExplaining,
  isLoading,
  onAddExample,
  stock,
}: StockResultProps) {
  if (isLoading) {
    return (
      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <p className="font-semibold">Loading {activeTicker || "ticker"}...</p>
        <div className="mt-5 grid gap-3">
          <span className="h-5 w-1/2 rounded-md bg-neutral-200" />
          <span className="h-5 w-1/3 rounded-md bg-neutral-200" />
          <span className="h-28 rounded-md bg-neutral-200" />
        </div>
      </section>
    );
  }

  if (!stock) {
    return (
      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <p className="font-semibold">Examples</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {["TSLA", "AAPL", "MSFT", "NVDA"].map((symbol) => (
            <button
              className="rounded-md border border-line bg-paper px-3 py-2 text-sm font-semibold transition hover:border-ink"
              key={symbol}
              onClick={() => onAddExample(symbol)}
              type="button"
            >
              {symbol}
            </button>
          ))}
        </div>
      </section>
    );
  }

  const isPositive = stock.priceChange >= 0;
  const signedPercent = `${isPositive ? "+" : ""}${percentFormatter.format(
    stock.percentChange / 100,
  )}`;
  const signedChange = `${isPositive ? "+" : ""}${currencyFormatter.format(stock.priceChange)}`;
  const movementClass = isPositive ? "text-pulse-green" : "text-pulse-red";
  const visibleSources = getVisibleSources(explanation, stock);

  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">{stock.companyName}</h2>
          <p className="mt-1 text-sm font-semibold uppercase text-neutral-500">{stock.symbol}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <p className="text-4xl font-semibold leading-none">
          {currencyFormatter.format(stock.currentPrice)}
        </p>
        <p className={`text-lg font-semibold ${movementClass}`}>
          {signedChange} / {signedPercent}
        </p>
      </div>

      <MiniChartPlaceholder positive={isPositive} />

      <section className="mt-6 border-t border-line pt-5">
        <h3 className="text-xl font-semibold">AI Explanation</h3>
        {isExplaining ? (
          <LoadingLines />
        ) : explanation ? (
          <p className="mt-3 text-base leading-7 text-neutral-700">"{explanation.summary}"</p>
        ) : explanationError ? (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700">
            {explanationError}
          </p>
        ) : (
          <p className="mt-3 text-base leading-7 text-neutral-700">
            "AI explanation will appear after the quote and news load."
          </p>
        )}
      </section>

      <section className="mt-6">
        <h3 className="text-xl font-semibold">Key Drivers</h3>
        {isExplaining ? (
          <LoadingLines />
        ) : explanationError ? (
          <ul className="mt-3 list-disc space-y-2 pl-5 text-base leading-7 text-neutral-700">
            <li>AI key drivers are temporarily unavailable.</li>
            <li>Stock price data and recent news are still shown below.</li>
            <li>Try again after confirming API billing, quota, and server configuration.</li>
          </ul>
        ) : (
          <ul className="mt-3 list-disc space-y-2 pl-5 text-base leading-7 text-neutral-700">
            {getKeyDrivers(explanation, stock).map((driver) => (
              <li key={driver}>{driver}</li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-6 text-base">
        <span className="font-semibold">Confidence:</span>{" "}
        <span className="capitalize">{explanation?.confidence ?? "low"}</span>
      </p>

      <section className="mt-6 border-t border-line pt-5">
        <h3 className="text-xl font-semibold">Sources</h3>
        {visibleSources.length > 0 ? (
          <div className="mt-3 grid gap-3">
            {visibleSources.map((source) => (
              <a
                className="grid gap-1 rounded-md border border-line bg-paper p-3 transition hover:border-ink"
                href={source.url}
                key={source.url}
                rel="noreferrer"
                target="_blank"
              >
                <span className="text-sm font-semibold text-pulse-teal">[{source.source}]</span>
                <span className="font-semibold leading-6">{source.title}</span>
              </a>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-neutral-600">No sources cited.</p>
        )}
      </section>

      <p className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
        {explanation?.disclaimer || "This is not financial advice."}
      </p>
    </section>
  );
}

function MiniChartPlaceholder({ positive }: { positive: boolean }) {
  return (
    <div className="mt-5 rounded-md border border-line bg-paper p-4">
      <svg
        aria-label="Mini chart placeholder"
        className={positive ? "h-28 w-full text-pulse-green" : "h-28 w-full text-pulse-red"}
        preserveAspectRatio="none"
        role="img"
        viewBox="0 0 320 110"
      >
        <path
          d="M0 74 C32 70 42 85 70 62 S118 38 154 51 207 82 246 55 286 28 320 33"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="4"
        />
      </svg>
    </div>
  );
}

function LoadingLines() {
  return (
    <div className="mt-4 grid gap-3">
      <span className="h-4 w-11/12 rounded-md bg-neutral-200" />
      <span className="h-4 w-3/4 rounded-md bg-neutral-200" />
      <span className="h-4 w-2/3 rounded-md bg-neutral-200" />
    </div>
  );
}

function getKeyDrivers(
  explanation: ExplanationResponse | null,
  stock: StockResponse,
): string[] {
  if (explanation?.keyDrivers.length) {
    return explanation.keyDrivers;
  }

  if (stock.latestNews.length === 0) {
    return ["There is not enough evidence in the provided data."];
  }

  return stock.latestNews.slice(0, 3).map((article) => article.title);
}

function getVisibleSources(
  explanation: ExplanationResponse | null,
  stock: StockResponse,
): ExplanationSource[] {
  if (explanation?.sources.length) {
    return explanation.sources;
  }

  return stock.latestNews.slice(0, 3).map((article) => ({
    source: article.source,
    title: article.title,
    url: article.url,
  }));
}
