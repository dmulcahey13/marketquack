import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About | MarketQuack",
  description:
    "Learn how MarketQuack helps beginners understand stock movement with market data, recent articles, and plain-English AI explanations.",
};

export default function AboutPage() {
  return (
    <main className="px-4 py-10 text-ink sm:px-6">
      <section className="mx-auto grid w-full max-w-3xl gap-6 rounded-lg border border-line bg-panel p-6 shadow-soft sm:p-8">
        <div className="grid gap-3">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-pulse-green">
            The market is loud. We make it make sense.
          </p>
          <h1 className="text-4xl font-black tracking-tight text-ink">
            About Market<span className="text-pulse-green">Quack</span>
          </h1>
        </div>

        <div className="grid gap-4 text-base leading-7 text-neutral-300">
          <p>
            MarketQuack helps beginners understand why stocks may be moving by combining market
            data, recent articles, and AI-generated plain-English explanations.
          </p>
          <p>
            The app is designed to make stock movement easier to read at a glance: search a ticker,
            review the latest price change, scan related articles, and see a cautious summary of
            what the available data may suggest.
          </p>
          <p className="rounded-md border border-line bg-paper p-4 text-sm font-semibold leading-6 text-neutral-300">
            MarketQuack is educational only and is not financial advice. It does not recommend
            buying, selling, or holding any security.
          </p>
        </div>
      </section>
    </main>
  );
}
