import type {
  ExplanationResponse,
  LatestNewsItem,
  StockResponse,
} from "@/types/market";
import { StockLineChart } from "@/components/StockLineChart";

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

type VisibleArticle = LatestNewsItem;

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
  const relatedArticles = getRelatedArticles(stock.latestNews);
  const companyArticles = relatedArticles.filter(
    (article) => article.relevanceLabel !== "market",
  );
  const marketArticles = relatedArticles.filter(
    (article) => article.relevanceLabel === "market",
  );

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

      <section className="mt-5 rounded-md border border-line bg-paper p-4">
        <h3 className="text-sm font-black uppercase tracking-[0.16em] text-pulse-green">
          Company Snapshot
        </h3>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-neutral-300">
          {stock.companyDescription || "Company overview is currently unavailable."}
        </p>
      </section>

      <StockLineChart
        symbol={stock.symbol}
      />

      <section className="mt-6 min-w-0 border-t border-line pt-5">
        <h3 className="text-xl font-black tracking-tight">AI Overview</h3>
        {isExplaining ? (
          <LoadingLines />
        ) : explanation ? (
          <p className="mt-3 whitespace-pre-wrap break-words text-base leading-7 text-neutral-300">
            "{explanation.summary}"
          </p>
        ) : explanationError ? (
          <p className="mt-3 whitespace-pre-wrap break-words rounded-md border border-pulse-red/40 bg-pulse-red/10 p-3 text-sm leading-6 text-pulse-red">
            {explanationError}
          </p>
        ) : (
          <p className="mt-3 whitespace-pre-wrap break-words text-base leading-7 text-neutral-300">
            "AI explanation will appear after the quote and news load."
          </p>
        )}
      </section>

      <section className="mt-6 min-w-0">
        <h3 className="text-xl font-black tracking-tight">Key Drivers</h3>
        {isExplaining ? (
          <LoadingLines />
        ) : explanationError ? (
          <ul className="mt-3 list-disc space-y-2 break-words pl-5 text-base leading-7 text-neutral-300">
            <li>AI key drivers are temporarily unavailable.</li>
            <li>Stock price data and recent news are still shown below.</li>
            <li>Try again after confirming API billing, quota, and server configuration.</li>
          </ul>
        ) : (
          <ul className="mt-3 list-disc space-y-2 break-words pl-5 text-base leading-7 text-neutral-300 marker:text-pulse-green">
            {getKeyDrivers(explanation, stock).map((driver) => (
              <li className="whitespace-normal break-words" key={driver}>
                {driver}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 border-t border-line pt-5">
        <h3 className="text-xl font-black tracking-tight">Related Articles</h3>
        {relatedArticles.length > 0 ? (
          <div className="mt-3 grid gap-4">
            {companyArticles.length > 0 ? <ArticleList articles={companyArticles} /> : null}
            {marketArticles.length > 0 ? (
              <div className="grid gap-3">
                <h4 className="text-sm font-black uppercase tracking-[0.16em] text-neutral-500">
                  Broader Market Context
                </h4>
                <ArticleList articles={marketArticles} />
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-neutral-400">
            No clearly related articles found right now.
          </p>
        )}
      </section>

      <p className="mt-6 whitespace-pre-wrap break-words rounded-md border border-line bg-paper p-3 text-sm leading-6 text-neutral-300">
        {explanation?.disclaimer || "This is not financial advice."}
      </p>
    </section>
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

function ArticleList({ articles }: { articles: VisibleArticle[] }) {
  return (
    <div className="grid gap-3">
      {articles.map((article) => (
        <a
          className="grid gap-2 rounded-md border border-line bg-paper p-4 transition hover:-translate-y-0.5 hover:border-pulse-green hover:bg-black"
          href={article.url}
          key={article.url}
          rel="noreferrer"
          target="_blank"
        >
          <span className="text-sm font-bold text-pulse-green">[{article.source}]</span>
          <span className="font-bold leading-6">{article.title}</span>
          {article.summary ? (
            <span className="text-sm leading-6 text-neutral-400">{article.summary}</span>
          ) : null}
        </a>
      ))}
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

function getRelatedArticles(latestNews: LatestNewsItem[]): VisibleArticle[] {
  return latestNews.slice(0, 8);
}
