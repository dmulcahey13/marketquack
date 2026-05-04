"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { StockResult } from "@/components/StockResult";
import type { ExplanationResponse, StockResponse } from "@/types/market";

const WATCHLIST_KEY = "marketquack-watchlist";

export function MarketQuackApp() {
  const [ticker, setTicker] = useState("");
  const [activeTicker, setActiveTicker] = useState("");
  const [stock, setStock] = useState<StockResponse | null>(null);
  const [explanation, setExplanation] = useState<ExplanationResponse | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [hasLoadedWatchlist, setHasLoadedWatchlist] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isExplaining, setIsExplaining] = useState(false);
  const [error, setError] = useState("");
  const [explanationError, setExplanationError] = useState("");

  useEffect(() => {
    try {
      const savedWatchlist = window.localStorage.getItem(WATCHLIST_KEY);

      if (savedWatchlist) {
        const parsedWatchlist = JSON.parse(savedWatchlist);

        if (Array.isArray(parsedWatchlist)) {
          setWatchlist(parsedWatchlist.filter((item): item is string => typeof item === "string"));
        }
      }
    } catch {
      setWatchlist([]);
    } finally {
      setHasLoadedWatchlist(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedWatchlist) {
      return;
    }

    window.localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
  }, [hasLoadedWatchlist, watchlist]);

  const normalizedTicker = useMemo(() => ticker.trim().toUpperCase(), [ticker]);
  const currentTicker = stock?.symbol;
  const isInWatchlist = currentTicker ? watchlist.includes(currentTicker) : false;

  async function searchTicker(nextTicker: string) {
    const symbol = nextTicker.trim().toUpperCase();

    if (!symbol) {
      setError("Enter a ticker symbol to search.");
      return;
    }

    setIsLoading(true);
    setIsExplaining(false);
    setError("");
    setExplanation(null);
    setExplanationError("");
    setActiveTicker(symbol);
    let stockPayload: StockResponse | null = null;

    try {
      const response = await fetch(`/api/stock?ticker=${encodeURIComponent(symbol)}`);
      const payload = (await response.json()) as StockResponse | { error?: string };

      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : "Unable to load stock data.");
      }

      stockPayload = payload as StockResponse;
      setStock(stockPayload);
    } catch (caughtError) {
      setStock(null);
      setError(caughtError instanceof Error ? caughtError.message : "Unable to load stock data.");
      return;
    } finally {
      setIsLoading(false);
    }

    if (!stockPayload) {
      return;
    }

    setIsExplaining(true);

    try {
      const response = await fetch("/api/explain", {
        body: JSON.stringify(stockPayload),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json()) as ExplanationResponse | { error?: string };

      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : "Unable to generate explanation.");
      }

      setExplanation(payload as ExplanationResponse);
    } catch (caughtError) {
      setExplanationError(
        caughtError instanceof Error ? caughtError.message : "Unable to generate explanation.",
      );
    } finally {
      setIsExplaining(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void searchTicker(normalizedTicker);
  }

  function toggleWatchlist() {
    if (!currentTicker) {
      return;
    }

    setWatchlist((items) =>
      items.includes(currentTicker)
        ? items.filter((item) => item !== currentTicker)
        : [currentTicker, ...items],
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 text-ink sm:px-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <header className="grid gap-2">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-semibold">MarketQuack</h1>
            <span className="text-xs font-semibold uppercase text-neutral-500">
              The market is loud. We make it make sense.
            </span>
          </div>
          <p className="text-sm leading-6 text-neutral-600">
            Search any stock and get a simple explanation of why it may be moving, backed by
            recent news and source links.
          </p>
        </header>

        <section className="rounded-lg border border-line bg-white p-4 shadow-soft">
          <form
            className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
            onSubmit={handleSubmit}
          >
            <label className="font-semibold" htmlFor="ticker">
              Search:
            </label>
            <input
              autoComplete="off"
              className="min-h-11 min-w-0 rounded-md border border-line bg-paper px-4 text-base font-semibold uppercase outline-none placeholder:font-normal placeholder:normal-case placeholder:text-neutral-500"
              id="ticker"
              maxLength={10}
              onChange={(event) => setTicker(event.target.value)}
              placeholder="TSLA"
              value={ticker}
            />
            <button
              className="min-h-11 rounded-md bg-ink px-5 font-semibold text-paper transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-400"
              disabled={isLoading || isExplaining}
              type="submit"
            >
              Go
            </button>
          </form>

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-sm">
            <span className="font-semibold text-neutral-600">Watchlist:</span>
            {watchlist.length > 0 ? (
              watchlist.map((symbol) => (
                <button
                  className="rounded-md border border-line bg-paper px-2.5 py-1.5 font-semibold transition hover:border-ink"
                  key={symbol}
                  onClick={() => {
                    setTicker(symbol);
                    void searchTicker(symbol);
                  }}
                  type="button"
                >
                  {symbol}
                </button>
              ))
            ) : (
              <span className="text-neutral-500">None</span>
            )}
            {currentTicker ? (
              <button
                className="ml-auto rounded-md border border-line px-2.5 py-1.5 font-semibold transition hover:border-ink"
                onClick={toggleWatchlist}
                type="button"
              >
                {isInWatchlist ? "Remove" : "Add"}
              </button>
            ) : null}
          </div>
        </section>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        <StockResult
          activeTicker={activeTicker}
          explanation={explanation}
          explanationError={explanationError}
          isExplaining={isExplaining}
          isLoading={isLoading}
          onAddExample={(symbol) => {
            setTicker(symbol);
            void searchTicker(symbol);
          }}
          stock={stock}
        />
      </div>
    </main>
  );
}
