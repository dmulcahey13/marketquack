import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stock Basics | MarketQuack",
  description:
    "Simple beginner-friendly explanations of stocks, shares, tickers, and why stock prices move.",
};

const basics = [
  {
    title: "What is a stock?",
    body:
      "A stock is a small ownership piece of a company. If a company like Apple or Nike is public, people can buy and sell pieces of ownership in that company.",
  },
  {
    title: "What is a share?",
    body:
      "A share is one unit of a stock. If you buy one share of a company, you own a very small piece of that company.",
  },
  {
    title: "Why do stock prices go up and down?",
    body:
      "Stock prices move when buyers and sellers disagree about what a company is worth. News, earnings, interest rates, product updates, and the overall market can all affect that price.",
  },
  {
    title: "What is a stock market?",
    body:
      "A stock market is a place where people buy and sell stocks. Today this usually happens through electronic exchanges instead of a physical trading floor.",
  },
  {
    title: "What is a ticker symbol?",
    body:
      "A ticker symbol is a short code for a stock. For example, Apple uses AAPL and Tesla uses TSLA. It helps investors search for the right company quickly.",
  },
  {
    title: "What does buying a stock mean?",
    body:
      "Buying a stock means you are buying a small piece of ownership in a public company. The value of that piece can rise or fall, and there is no guaranteed outcome.",
  },
  {
    title: "Why should beginners be careful?",
    body:
      "Stocks can change value quickly, and headlines can be confusing. Beginners should learn the basics, compare sources, avoid rushed decisions, and understand that losing money is possible.",
  },
];

export default function StockBasicsPage() {
  return (
    <main className="px-4 py-10 text-ink sm:px-6">
      <div className="mx-auto grid w-full max-w-5xl gap-6">
        <section className="rounded-lg border border-line bg-panel p-6 shadow-soft sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-pulse-green">
            Beginner Guide
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-ink">
            Stock Basics
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-neutral-300">
            Simple answers to common stock market questions, written in plain English. MarketQuack
            is educational and does not provide financial advice.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {basics.map((item) => (
            <article
              className="rounded-lg border border-line bg-panel p-5 shadow-soft"
              key={item.title}
            >
              <h2 className="text-lg font-black tracking-tight text-ink">{item.title}</h2>
              <p className="mt-3 text-sm leading-6 text-neutral-300">{item.body}</p>
            </article>
          ))}
        </section>

        <section className="rounded-lg border border-pulse-green/30 bg-paper p-5">
          <h2 className="text-lg font-black tracking-tight text-pulse-green">
            Educational Only
          </h2>
          <p className="mt-3 text-sm leading-6 text-neutral-300">
            MarketQuack can help you understand market data and recent articles, but it does not
            tell you what to buy, sell, or hold. Always do your own research before making
            investment decisions.
          </p>
        </section>
      </div>
    </main>
  );
}
