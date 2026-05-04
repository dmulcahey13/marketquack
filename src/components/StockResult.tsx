import type {
  ExplanationResponse,
  ExplanationSource,
  LatestNewsItem,
  StockResponse,
} from "@/types/market";

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

type VisibleArticle = ExplanationSource & {
  datetime?: string;
  summary?: string;
};

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
      <section className="rounded-lg border border-line bg-panel p-5 shadow-soft sm:p-6">
        <p className="font-bold">Loading {activeTicker || "ticker"}...</p>
        <div className="mt-5 grid gap-3">
          <span className="h-5 w-1/2 rounded-md bg-panel-soft" />
          <span className="h-5 w-1/3 rounded-md bg-panel-soft" />
          <span className="h-32 rounded-md bg-panel-soft" />
        </div>
      </section>
    );
  }

  if (!stock) {
    return (
      <section className="rounded-lg border border-line bg-panel p-5 shadow-soft sm:p-6">
        <p className="font-bold">Try a ticker</p>
        <p className="mt-1 text-sm leading-6 text-neutral-400">
          Start with a familiar company, then add favorites to your watchlist.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {["TSLA", "AAPL", "MSFT", "NVDA"].map((symbol) => (
            <button
              className="rounded-md border border-line bg-paper px-3 py-2 text-sm font-bold text-neutral-100 transition hover:-translate-y-0.5 hover:border-pulse-green hover:text-pulse-green"
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
    <section className="rounded-lg border border-line bg-panel p-5 shadow-soft sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight">{stock.companyName}</h2>
          <p className="mt-1 text-sm font-bold uppercase text-pulse-green">{stock.symbol}</p>
        </div>
        <div className="rounded-md border border-line bg-paper px-3 py-2 text-sm text-neutral-400">
          Previous close: <span className="font-bold text-ink">{currencyFormatter.format(stock.previousClose)}</span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <p className="text-4xl font-black leading-none tracking-tight sm:text-5xl">
          {currencyFormatter.format(stock.currentPrice)}
        </p>
        <p className={`rounded-md bg-paper px-3 py-2 text-lg font-black ${movementClass}`}>
          {signedChange} / {signedPercent}
        </p>
      </div>

      <MiniChartPlaceholder positive={isPositive} />

      <section className="mt-6 border-t border-line pt-5">
        <h3 className="text-xl font-black tracking-tight">AI Explanation</h3>
        {isExplaining ? (
          <LoadingLines />
        ) : explanation ? (
          <p className="mt-3 text-base leading-7 text-neutral-300">"{explanation.summary}"</p>
        ) : explanationError ? (
          <p className="mt-3 rounded-md border border-pulse-red/40 bg-pulse-red/10 p-3 text-sm leading-6 text-pulse-red">
            {explanationError}
          </p>
        ) : (
          <p className="mt-3 text-base leading-7 text-neutral-300">
            "AI explanation will appear after the quote and news load."
          </p>
        )}
      </section>

      <section className="mt-6">
        <h3 className="text-xl font-black tracking-tight">Key Drivers</h3>
        {isExplaining ? (
          <LoadingLines />
        ) : explanationError ? (
          <ul className="mt-3 list-disc space-y-2 pl-5 text-base leading-7 text-neutral-300">
            <li>AI key drivers are temporarily unavailable.</li>
            <li>Stock price data and recent news are still shown below.</li>
            <li>Try again after confirming API billing, quota, and server configuration.</li>
          </ul>
        ) : (
          <ul className="mt-3 list-disc space-y-2 pl-5 text-base leading-7 text-neutral-300 marker:text-pulse-green">
            {getKeyDrivers(explanation, stock).map((driver) => (
              <li key={driver}>{driver}</li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-6 text-base">
        <span className="font-bold">Confidence:</span>{" "}
        <span className="capitalize">{explanation?.confidence ?? "low"}</span>
      </p>

      <section className="mt-6 border-t border-line pt-5">
        <h3 className="text-xl font-black tracking-tight">Related Articles</h3>
        {visibleSources.length > 0 ? (
          <div className="mt-3 grid gap-3">
            {visibleSources.map((source) => (
              <a
                className="grid gap-2 rounded-md border border-line bg-paper p-4 transition hover:-translate-y-0.5 hover:border-pulse-green hover:bg-black"
                href={source.url}
                key={source.url}
                rel="noreferrer"
                target="_blank"
              >
                <span className="text-sm font-bold text-pulse-green">[{source.source}]</span>
                <span className="font-bold leading-6">{source.title}</span>
                {source.summary ? (
                  <span className="text-sm leading-6 text-neutral-400">{source.summary}</span>
                ) : null}
              </a>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-neutral-400">No sources cited.</p>
        )}
      </section>

      <p className="mt-6 rounded-md border border-line bg-paper p-3 text-sm leading-6 text-neutral-300">
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
        className={positive ? "h-32 w-full text-pulse-green" : "h-32 w-full text-pulse-red"}
        preserveAspectRatio="none"
        role="img"
        viewBox="0 0 320 110"
      >
        <path d="M0 88 H320 M0 56 H320 M0 24 H320" stroke="currentColor" strokeOpacity="0.12" />
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
      <span className="h-4 w-11/12 rounded-md bg-panel-soft" />
      <span className="h-4 w-3/4 rounded-md bg-panel-soft" />
      <span className="h-4 w-2/3 rounded-md bg-panel-soft" />
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
): VisibleArticle[] {
  if (explanation?.sources.length) {
    return explanation.sources.map((source) => addNewsDetails(source, stock.latestNews));
  }

  return stock.latestNews.slice(0, 3).map((article) => ({
    datetime: article.datetime,
    source: article.source,
    summary: article.summary,
    title: article.title,
    url: article.url,
  }));
}

function addNewsDetails(source: ExplanationSource, latestNews: LatestNewsItem[]): VisibleArticle {
  const matchingArticle = latestNews.find((article) => article.url === source.url);

  return {
    ...source,
    datetime: matchingArticle?.datetime,
    summary: matchingArticle?.summary,
  };
}
