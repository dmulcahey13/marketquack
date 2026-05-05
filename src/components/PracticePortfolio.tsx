"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { PortfolioPerformanceChart } from "@/components/PortfolioPerformanceChart";
import { getSupabaseBrowserClient, getSupabaseConfigError } from "@/lib/supabase/client";
import type { ExplanationResponse, StockResponse } from "@/types/market";

type PortfolioStatus = "checking" | "setup" | "dashboard" | "database-error" | "config-error" | "signed-out";
type AddMode = "amount" | "shares";
type PriceSource = "live" | "estimated";

type PortfolioUser = {
  email: string;
  id: string;
};

type PracticePortfolioRow = {
  cash_balance: number | string;
  created_at: string;
  id: string;
  starting_balance: number | string;
  updated_at: string;
  user_id: string;
};

type PracticeHoldingRow = {
  avg_price: number | string;
  created_at: string;
  id: string;
  portfolio_id: string;
  shares: number | string;
  ticker: string;
  updated_at: string;
  user_id: string;
};

type PriceQuote = {
  companyName?: string;
  price: number;
  source: PriceSource;
};

type HoldingSummary = {
  avgPrice: number;
  costBasis: number;
  currentPrice: number;
  gainLoss: number;
  gainLossPercent: number;
  holding: PracticeHoldingRow;
  marketValue: number;
  priceSource: PriceSource;
  shares: number;
};

const startingBalances = [10000, 25000, 100000];
const disclaimer = "Practice portfolio only. No real money is used. MarketQuack does not provide financial advice.";

export function PracticePortfolio() {
  const router = useRouter();
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [user, setUser] = useState<PortfolioUser | null>(null);
  const [portfolio, setPortfolio] = useState<PracticePortfolioRow | null>(null);
  const [holdings, setHoldings] = useState<PracticeHoldingRow[]>([]);
  const [prices, setPrices] = useState<Record<string, PriceQuote>>({});
  const [status, setStatus] = useState<PortfolioStatus>("checking");
  const [message, setMessage] = useState("");
  const [selectedStartingBalance, setSelectedStartingBalance] = useState(startingBalances[0]);
  const [isCreating, setIsCreating] = useState(false);
  const [isSavingHolding, setIsSavingHolding] = useState(false);
  const [isSellingHolding, setIsSellingHolding] = useState(false);
  const [isRefreshingPrices, setIsRefreshingPrices] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>("amount");
  const [addTicker, setAddTicker] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [addShares, setAddShares] = useState("");
  const [addPurchasePrice, setAddPurchasePrice] = useState("");
  const [addFormMessage, setAddFormMessage] = useState("");
  const [isFetchingAddPrice, setIsFetchingAddPrice] = useState(false);
  const [sellHoldingId, setSellHoldingId] = useState("");
  const [sellShares, setSellShares] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [sellMessage, setSellMessage] = useState("");
  const [explanationTicker, setExplanationTicker] = useState("");
  const [explanation, setExplanation] = useState<ExplanationResponse | null>(null);
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);
  const [explanationMessage, setExplanationMessage] = useState("");

  useEffect(() => {
    let unsubscribe = () => {};
    let isMounted = true;

    async function boot() {
      setStatus("checking");

      const client = await getSupabaseBrowserClient();

      if (!isMounted) {
        return;
      }

      if (!client) {
        setMessage(await getSupabaseConfigError());
        setStatus("config-error");
        return;
      }

      const {
        data: { session },
      } = await client.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (!session?.user) {
        setStatus("signed-out");
        router.replace("/login");
        return;
      }

      const currentUser = {
        email: session.user.email ?? "Account",
        id: session.user.id,
      };

      setSupabase(client);
      setUser(currentUser);
      await loadPortfolio(client, currentUser.id);

      const {
        data: { subscription },
      } = client.auth.onAuthStateChange((_event, nextSession) => {
        if (!nextSession?.user) {
          setUser(null);
          setStatus("signed-out");
          router.replace("/login");
          return;
        }

        setUser({
          email: nextSession.user.email ?? "Account",
          id: nextSession.user.id,
        });
      });

      unsubscribe = () => subscription.unsubscribe();
    }

    void boot();

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [router]);

  const holdingSummaries = useMemo(
    () =>
      holdings.map((holding): HoldingSummary => {
        const shares = toNumber(holding.shares);
        const avgPrice = toNumber(holding.avg_price);
        const quote = prices[holding.ticker];
        const currentPrice = quote?.price ?? avgPrice;
        const marketValue = shares * currentPrice;
        const costBasis = shares * avgPrice;
        const gainLoss = marketValue - costBasis;
        const gainLossPercent = costBasis > 0 ? gainLoss / costBasis : 0;

        return {
          avgPrice,
          costBasis,
          currentPrice,
          gainLoss,
          gainLossPercent,
          holding,
          marketValue,
          priceSource: quote?.source ?? "estimated",
          shares,
        };
      }),
    [holdings, prices],
  );

  const cashBalance = portfolio ? toNumber(portfolio.cash_balance) : 0;
  const startingBalance = portfolio ? toNumber(portfolio.starting_balance) : selectedStartingBalance;
  const totalMarketValue = holdingSummaries.reduce((total, summary) => total + summary.marketValue, 0);
  const portfolioValue = cashBalance + totalMarketValue;
  const totalGainLoss = portfolioValue - startingBalance;
  const totalReturn = startingBalance > 0 ? totalGainLoss / startingBalance : 0;
  const hasEstimatedPrices = holdingSummaries.some((summary) => summary.priceSource === "estimated");
  const selectedSellHolding = holdingSummaries.find((summary) => summary.holding.id === sellHoldingId);
  const portfolioChartHoldings = useMemo(
    () =>
      holdings.map((holding) => ({
        shares: toNumber(holding.shares),
        ticker: holding.ticker,
      })),
    [holdings],
  );

  async function loadPortfolio(client: SupabaseClient, userId: string) {
    setMessage("");

    const { data: portfolioData, error: portfolioError } = await client
      .from("practice_portfolios")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (portfolioError) {
      setMessage(getDatabaseSetupMessage(portfolioError.message));
      setStatus("database-error");
      return;
    }

    if (!portfolioData) {
      setPortfolio(null);
      setHoldings([]);
      setPrices({});
      setStatus("setup");
      return;
    }

    const nextPortfolio = portfolioData as PracticePortfolioRow;

    const { data: holdingsData, error: holdingsError } = await client
      .from("practice_holdings")
      .select("*")
      .eq("portfolio_id", nextPortfolio.id)
      .eq("user_id", userId)
      .order("ticker", { ascending: true });

    if (holdingsError) {
      setMessage(getDatabaseSetupMessage(holdingsError.message));
      setStatus("database-error");
      return;
    }

    const nextHoldings = (holdingsData ?? []) as PracticeHoldingRow[];
    setPortfolio(nextPortfolio);
    setHoldings(nextHoldings);
    setStatus("dashboard");
    await refreshCurrentPrices(nextHoldings);
  }

  async function refreshCurrentPrices(nextHoldings = holdings) {
    const symbols = Array.from(new Set(nextHoldings.map((holding) => holding.ticker)));

    if (symbols.length === 0) {
      setPrices({});
      return;
    }

    setIsRefreshingPrices(true);

    const nextPrices: Record<string, PriceQuote> = {};

    await Promise.all(
      symbols.map(async (symbol) => {
        const holding = nextHoldings.find((item) => item.ticker === symbol);

        try {
          const quote = await fetchStockQuote(symbol);
          nextPrices[symbol] = {
            companyName: quote.companyName,
            price: quote.currentPrice,
            source: "live",
          };
        } catch {
          nextPrices[symbol] = {
            price: holding ? toNumber(holding.avg_price) : 0,
            source: "estimated",
          };
        }
      }),
    );

    setPrices(nextPrices);
    setIsRefreshingPrices(false);
  }

  async function handleCreatePortfolio() {
    if (!supabase || !user) {
      return;
    }

    setIsCreating(true);
    setMessage("");

    const { error } = await supabase
      .from("practice_portfolios")
      .insert({
        cash_balance: selectedStartingBalance,
        starting_balance: selectedStartingBalance,
        user_id: user.id,
      })
      .select("*")
      .single();

    setIsCreating(false);

    if (error) {
      setMessage(getDatabaseSetupMessage(error.message));
      return;
    }

    await loadPortfolio(supabase, user.id);
  }

  async function autofillPurchasePrice() {
    const symbol = addTicker.trim().toUpperCase();

    if (!symbol) {
      return;
    }

    setIsFetchingAddPrice(true);
    setAddFormMessage("");

    try {
      const quote = await fetchStockQuote(symbol);
      setAddPurchasePrice(formatInputPrice(quote.currentPrice));
      setAddFormMessage(`Current quote found for ${quote.symbol}. You can edit the purchase price.`);
    } catch {
      setAddFormMessage("Current quote unavailable. Enter a purchase price manually.");
    } finally {
      setIsFetchingAddPrice(false);
    }
  }

  async function handleAddHolding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !user || !portfolio) {
      return;
    }

    const symbol = addTicker.trim().toUpperCase();
    const purchasePrice = Number(addPurchasePrice);
    const amount = Number(addAmount);
    const requestedShares = Number(addShares);

    setAddFormMessage("");

    if (!symbol) {
      setAddFormMessage("Ticker symbol is required.");
      return;
    }

    if (!Number.isFinite(purchasePrice) || purchasePrice <= 0) {
      setAddFormMessage("Purchase price must be positive.");
      return;
    }

    const sharesToAdd = addMode === "amount" ? amount / purchasePrice : requestedShares;
    const totalCost = addMode === "amount" ? amount : requestedShares * purchasePrice;

    if (!Number.isFinite(sharesToAdd) || sharesToAdd <= 0 || !Number.isFinite(totalCost) || totalCost <= 0) {
      setAddFormMessage("Enter a positive dollar amount or number of shares.");
      return;
    }

    if (totalCost > cashBalance + 0.0001) {
      setAddFormMessage("You do not have enough virtual cash for that fake holding.");
      return;
    }

    setIsSavingHolding(true);

    const existingHolding = holdings.find((holding) => holding.ticker === symbol);
    const nextCash = cashBalance - totalCost;
    let mutationError: { message: string } | null = null;

    if (existingHolding) {
      const existingShares = toNumber(existingHolding.shares);
      const existingCost = existingShares * toNumber(existingHolding.avg_price);
      const nextShares = existingShares + sharesToAdd;
      const nextAveragePrice = (existingCost + totalCost) / nextShares;
      const { error } = await supabase
        .from("practice_holdings")
        .update({
          avg_price: nextAveragePrice,
          shares: nextShares,
        })
        .eq("id", existingHolding.id)
        .eq("user_id", user.id);

      mutationError = error;
    } else {
      const { error } = await supabase.from("practice_holdings").insert({
        avg_price: purchasePrice,
        portfolio_id: portfolio.id,
        shares: sharesToAdd,
        ticker: symbol,
        user_id: user.id,
      });

      mutationError = error;
    }

    if (!mutationError) {
      const { error } = await supabase
        .from("practice_portfolios")
        .update({ cash_balance: nextCash })
        .eq("id", portfolio.id)
        .eq("user_id", user.id);

      mutationError = error;
    }

    if (!mutationError) {
      await supabase.from("practice_transactions").insert({
        portfolio_id: portfolio.id,
        price: purchasePrice,
        shares: sharesToAdd,
        ticker: symbol,
        total_value: totalCost,
        transaction_type: "buy",
        user_id: user.id,
      });
    }

    setIsSavingHolding(false);

    if (mutationError) {
      setAddFormMessage(getDatabaseSetupMessage(mutationError.message));
      return;
    }

    setAddTicker("");
    setAddAmount("");
    setAddShares("");
    setAddPurchasePrice("");
    setAddFormMessage("Fake holding added.");
    await loadPortfolio(supabase, user.id);
  }

  async function handleSellHolding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !user || !portfolio || !selectedSellHolding) {
      return;
    }

    const sharesToSell = Number(sellShares);
    const price = Number(sellPrice);

    setSellMessage("");

    if (!Number.isFinite(sharesToSell) || sharesToSell <= 0) {
      setSellMessage("Shares to sell must be positive.");
      return;
    }

    if (sharesToSell > selectedSellHolding.shares + 0.000001) {
      setSellMessage("You cannot sell more shares than you own.");
      return;
    }

    if (!Number.isFinite(price) || price <= 0) {
      setSellMessage("Sale price must be positive.");
      return;
    }

    setIsSellingHolding(true);

    const proceeds = sharesToSell * price;
    const nextCash = cashBalance + proceeds;
    const remainingShares = selectedSellHolding.shares - sharesToSell;
    let mutationError: { message: string } | null = null;

    if (remainingShares <= 0.000001) {
      const { error } = await supabase
        .from("practice_holdings")
        .delete()
        .eq("id", selectedSellHolding.holding.id)
        .eq("user_id", user.id);

      mutationError = error;
    } else {
      const { error } = await supabase
        .from("practice_holdings")
        .update({ shares: remainingShares })
        .eq("id", selectedSellHolding.holding.id)
        .eq("user_id", user.id);

      mutationError = error;
    }

    if (!mutationError) {
      const { error } = await supabase
        .from("practice_portfolios")
        .update({ cash_balance: nextCash })
        .eq("id", portfolio.id)
        .eq("user_id", user.id);

      mutationError = error;
    }

    if (!mutationError) {
      await supabase.from("practice_transactions").insert({
        portfolio_id: portfolio.id,
        price,
        shares: sharesToSell,
        ticker: selectedSellHolding.holding.ticker,
        total_value: proceeds,
        transaction_type: "sell",
        user_id: user.id,
      });
    }

    setIsSellingHolding(false);

    if (mutationError) {
      setSellMessage(getDatabaseSetupMessage(mutationError.message));
      return;
    }

    setSellHoldingId("");
    setSellShares("");
    setSellPrice("");
    await loadPortfolio(supabase, user.id);
  }

  async function handleResetPortfolio() {
    if (!supabase || !user || !portfolio) {
      return;
    }

    const confirmed = window.confirm(
      "Reset your practice portfolio? This removes fake holdings and restores virtual cash to the starting balance.",
    );

    if (!confirmed) {
      return;
    }

    setMessage("");
    await supabase.from("practice_transactions").delete().eq("portfolio_id", portfolio.id).eq("user_id", user.id);
    await supabase.from("practice_holdings").delete().eq("portfolio_id", portfolio.id).eq("user_id", user.id);

    const { error } = await supabase
      .from("practice_portfolios")
      .update({ cash_balance: toNumber(portfolio.starting_balance) })
      .eq("id", portfolio.id)
      .eq("user_id", user.id);

    if (error) {
      setMessage(getDatabaseSetupMessage(error.message));
      return;
    }

    await loadPortfolio(supabase, user.id);
  }

  async function handleViewExplanation(symbol: string) {
    setExplanationTicker(symbol);
    setExplanation(null);
    setExplanationMessage("");
    setIsLoadingExplanation(true);

    try {
      const stock = await fetchStockQuote(symbol);
      const response = await fetch("/api/explain", {
        body: JSON.stringify(stock),
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
      setExplanationMessage(
        caughtError instanceof Error ? caughtError.message : "Unable to load this explanation right now.",
      );
    } finally {
      setIsLoadingExplanation(false);
    }
  }

  if (status === "checking") {
    return <PortfolioShell>{renderStatusCard("Checking your account...", "Practice Portfolio is getting your session ready.")}</PortfolioShell>;
  }

  if (status === "signed-out") {
    return (
      <PortfolioShell>
        {renderStatusCard("Redirecting to log in...", "Practice Portfolio is connected to your account.")}
      </PortfolioShell>
    );
  }

  if (status === "config-error" || status === "database-error") {
    return (
      <PortfolioShell>
        <section className="rounded-lg border border-pulse-red/40 bg-pulse-red/10 p-5 text-sm leading-6 text-neutral-200 shadow-soft">
          <h1 className="text-2xl font-black text-ink">Practice Portfolio needs setup</h1>
          <p className="mt-2 text-neutral-300">{message}</p>
          {status === "database-error" ? (
            <p className="mt-3 text-neutral-400">
              Run <span className="font-mono text-pulse-green">supabase/practice-portfolio.sql</span> in
              the Supabase SQL editor to create the tables and Row Level Security policies.
            </p>
          ) : null}
        </section>
      </PortfolioShell>
    );
  }

  if (status === "setup") {
    return (
      <PortfolioShell>
        <section className="rounded-lg border border-line bg-panel p-5 shadow-soft sm:p-7">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-pulse-green">Practice Portfolio</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-ink">Create your practice portfolio</h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-neutral-300">
            Test investment ideas with virtual money before risking real cash.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {startingBalances.map((balance) => (
              <button
                className={`rounded-lg border px-4 py-4 text-left transition ${
                  selectedStartingBalance === balance
                    ? "border-pulse-green bg-pulse-green/10 shadow-glow"
                    : "border-line bg-paper hover:border-pulse-green"
                }`}
                key={balance}
                onClick={() => setSelectedStartingBalance(balance)}
                type="button"
              >
                <span className="block text-sm font-semibold text-neutral-400">Starting balance</span>
                <span className="mt-1 block text-2xl font-black text-ink">{formatCurrency(balance, 0)}</span>
              </button>
            ))}
          </div>

          {message ? (
            <p className="mt-4 rounded-md border border-pulse-red/40 bg-pulse-red/10 p-3 text-sm font-semibold text-pulse-red">
              {message}
            </p>
          ) : null}

          <button
            className="mt-6 min-h-12 rounded-md bg-pulse-green px-5 font-black text-black shadow-glow transition hover:-translate-y-0.5 hover:bg-white disabled:cursor-not-allowed disabled:bg-neutral-600 disabled:text-neutral-300 disabled:hover:translate-y-0"
            disabled={isCreating}
            onClick={handleCreatePortfolio}
            type="button"
          >
            {isCreating ? "Creating..." : "Create portfolio"}
          </button>

          <p className="mt-4 text-sm font-semibold text-neutral-400">Practice only. No real money is used. Not financial advice.</p>
        </section>
      </PortfolioShell>
    );
  }

  return (
    <PortfolioShell>
      <div className="grid gap-6">
        <section className="grid gap-4 rounded-lg border border-line bg-panel p-5 shadow-soft sm:p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-pulse-green">Practice Portfolio</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-ink">Test ideas with virtual money</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-300">
                Signed in as {user?.email}. Add fake positions, track estimated performance, and learn from
                your decisions before real money is involved.
              </p>
            </div>
            <button
              className="self-start rounded-md border border-line px-3 py-2 text-sm font-bold text-neutral-300 transition hover:border-pulse-red hover:text-pulse-red"
              onClick={handleResetPortfolio}
              type="button"
            >
              Reset portfolio
            </button>
          </div>

          <p className="rounded-md border border-line bg-paper p-3 text-sm font-semibold text-neutral-300">
            {disclaimer}
          </p>

          {hasEstimatedPrices ? (
            <p className="rounded-md border border-pulse-green/30 bg-pulse-green/10 p-3 text-sm font-semibold text-neutral-200">
              Some current prices are estimated from average buy price because live quotes were unavailable.
            </p>
          ) : null}

          {message ? (
            <p className="rounded-md border border-pulse-red/40 bg-pulse-red/10 p-3 text-sm font-semibold text-pulse-red">
              {message}
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <SummaryCard label="Starting balance" value={formatCurrency(startingBalance)} />
            <SummaryCard label="Current portfolio value" value={formatCurrency(portfolioValue)} />
            <SummaryCard label="Cash available" value={formatCurrency(cashBalance)} />
            <SummaryCard label="Total gain/loss" tone={getTone(totalGainLoss)} value={formatCurrency(totalGainLoss)} />
            <SummaryCard label="Total return" tone={getTone(totalGainLoss)} value={formatPercent(totalReturn)} />
          </div>
        </section>

        <PortfolioPerformanceChart cashBalance={cashBalance} holdings={portfolioChartHoldings} />

        <section className="grid gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
          <div className="grid gap-6">
            <section className="rounded-lg border border-line bg-panel p-5 shadow-soft">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-black text-ink">Add fake holding</h2>
                <span className="rounded-md border border-pulse-green/40 px-2.5 py-1 text-xs font-bold text-pulse-green">
                  Practice only
                </span>
              </div>

              <form className="mt-5 grid gap-4" onSubmit={handleAddHolding}>
                <label className="grid gap-2 text-sm font-bold text-neutral-200" htmlFor="portfolio-ticker">
                  Ticker symbol
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <input
                      autoComplete="off"
                      className="min-h-11 rounded-md border border-line bg-paper px-3 text-base font-bold uppercase text-ink outline-none transition placeholder:font-normal placeholder:normal-case placeholder:text-neutral-500 focus:border-pulse-green focus:bg-black"
                      id="portfolio-ticker"
                      maxLength={10}
                      onBlur={() => void autofillPurchasePrice()}
                      onChange={(event) => setAddTicker(event.target.value.toUpperCase())}
                      placeholder="AAPL"
                      value={addTicker}
                    />
                    <button
                      className="rounded-md border border-line px-3 py-2 text-sm font-bold text-neutral-200 transition hover:border-pulse-green hover:text-pulse-green disabled:cursor-not-allowed disabled:text-neutral-600"
                      disabled={isFetchingAddPrice || !addTicker.trim()}
                      onClick={() => void autofillPurchasePrice()}
                      type="button"
                    >
                      {isFetchingAddPrice ? "Checking..." : "Use quote"}
                    </button>
                  </div>
                </label>

                <div className="grid grid-cols-2 gap-2 rounded-md border border-line bg-paper p-1">
                  <button
                    className={`rounded px-3 py-2 text-sm font-black transition ${
                      addMode === "amount" ? "bg-pulse-green text-black" : "text-neutral-300 hover:bg-panel-soft"
                    }`}
                    onClick={() => setAddMode("amount")}
                    type="button"
                  >
                    Dollar amount
                  </button>
                  <button
                    className={`rounded px-3 py-2 text-sm font-black transition ${
                      addMode === "shares" ? "bg-pulse-green text-black" : "text-neutral-300 hover:bg-panel-soft"
                    }`}
                    onClick={() => setAddMode("shares")}
                    type="button"
                  >
                    Shares
                  </button>
                </div>

                {addMode === "amount" ? (
                  <NumberField
                    id="portfolio-amount"
                    label="Dollar amount to invest"
                    onChange={setAddAmount}
                    placeholder="500"
                    value={addAmount}
                  />
                ) : (
                  <NumberField
                    id="portfolio-shares"
                    label="Number of shares"
                    onChange={setAddShares}
                    placeholder="2"
                    value={addShares}
                  />
                )}

                <NumberField
                  id="portfolio-purchase-price"
                  label="Purchase price"
                  onChange={setAddPurchasePrice}
                  placeholder="Auto-filled when available"
                  value={addPurchasePrice}
                />

                {addFormMessage ? (
                  <p className="rounded-md border border-line bg-paper p-3 text-sm font-semibold text-neutral-300">
                    {addFormMessage}
                  </p>
                ) : null}

                <button
                  className="min-h-11 rounded-md bg-pulse-green px-5 font-black text-black shadow-glow transition hover:-translate-y-0.5 hover:bg-white disabled:cursor-not-allowed disabled:bg-neutral-600 disabled:text-neutral-300 disabled:hover:translate-y-0"
                  disabled={isSavingHolding}
                  type="submit"
                >
                  {isSavingHolding ? "Adding..." : "Add holding"}
                </button>
              </form>
            </section>

            {selectedSellHolding ? (
              <section className="rounded-lg border border-line bg-panel p-5 shadow-soft">
                <h2 className="text-xl font-black text-ink">Sell fake holding</h2>
                <p className="mt-2 text-sm text-neutral-400">
                  Selling {selectedSellHolding.holding.ticker}. You own {formatShares(selectedSellHolding.shares)} shares.
                </p>

                <form className="mt-5 grid gap-4" onSubmit={handleSellHolding}>
                  <NumberField
                    id="portfolio-sell-shares"
                    label="Shares to sell"
                    onChange={setSellShares}
                    placeholder="1"
                    value={sellShares}
                  />
                  <NumberField
                    id="portfolio-sell-price"
                    label="Sale price"
                    onChange={setSellPrice}
                    placeholder="Current price"
                    value={sellPrice}
                  />

                  {sellMessage ? (
                    <p className="rounded-md border border-pulse-red/40 bg-pulse-red/10 p-3 text-sm font-semibold text-pulse-red">
                      {sellMessage}
                    </p>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <button
                      className="min-h-11 rounded-md bg-pulse-green px-5 font-black text-black shadow-glow transition hover:-translate-y-0.5 hover:bg-white disabled:cursor-not-allowed disabled:bg-neutral-600 disabled:text-neutral-300 disabled:hover:translate-y-0"
                      disabled={isSellingHolding}
                      type="submit"
                    >
                      {isSellingHolding ? "Selling..." : "Sell holding"}
                    </button>
                    <button
                      className="min-h-11 rounded-md border border-line px-4 font-bold text-neutral-300 transition hover:border-pulse-green hover:text-pulse-green"
                      onClick={() => {
                        setSellHoldingId("");
                        setSellShares("");
                        setSellPrice("");
                        setSellMessage("");
                      }}
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </section>
            ) : null}
          </div>

          <section className="rounded-lg border border-line bg-panel p-5 shadow-soft">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-ink">Holdings</h2>
                <p className="mt-1 text-sm text-neutral-400">
                  Values use current MarketQuack quote data when available.
                </p>
              </div>
              <button
                className="self-start rounded-md border border-line px-3 py-2 text-sm font-bold text-neutral-300 transition hover:border-pulse-green hover:text-pulse-green disabled:cursor-not-allowed disabled:text-neutral-600"
                disabled={isRefreshingPrices || holdings.length === 0}
                onClick={() => void refreshCurrentPrices()}
                type="button"
              >
                {isRefreshingPrices ? "Refreshing..." : "Refresh prices"}
              </button>
            </div>

            <div className="mt-5 overflow-x-auto">
              {holdingSummaries.length > 0 ? (
                <table className="w-full min-w-[820px] border-separate border-spacing-y-2 text-left text-sm">
                  <thead className="text-xs uppercase tracking-[0.12em] text-neutral-500">
                    <tr>
                      <th className="px-3 py-2">Ticker</th>
                      <th className="px-3 py-2">Shares</th>
                      <th className="px-3 py-2">Average buy price</th>
                      <th className="px-3 py-2">Current price</th>
                      <th className="px-3 py-2">Market value</th>
                      <th className="px-3 py-2">Gain/loss</th>
                      <th className="px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holdingSummaries.map((summary) => (
                      <tr className="bg-paper" key={summary.holding.id}>
                        <td className="rounded-l-md border-y border-l border-line px-3 py-3">
                          <span className="font-black text-ink">{summary.holding.ticker}</span>
                        </td>
                        <td className="border-y border-line px-3 py-3 text-neutral-200">
                          {formatShares(summary.shares)}
                        </td>
                        <td className="border-y border-line px-3 py-3 text-neutral-200">
                          {formatCurrency(summary.avgPrice)}
                        </td>
                        <td className="border-y border-line px-3 py-3 text-neutral-200">
                          {formatCurrency(summary.currentPrice)}
                          {summary.priceSource === "estimated" ? (
                            <span className="ml-2 rounded border border-line px-1.5 py-0.5 text-xs text-neutral-500">
                              estimated
                            </span>
                          ) : null}
                        </td>
                        <td className="border-y border-line px-3 py-3 text-neutral-200">
                          {formatCurrency(summary.marketValue)}
                        </td>
                        <td className={`border-y border-line px-3 py-3 font-bold ${getToneClass(summary.gainLoss)}`}>
                          {formatCurrency(summary.gainLoss)} ({formatPercent(summary.gainLossPercent)})
                        </td>
                        <td className="rounded-r-md border-y border-r border-line px-3 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              className="rounded-md border border-line px-2.5 py-1.5 font-bold text-neutral-300 transition hover:border-pulse-green hover:text-pulse-green"
                              onClick={() => {
                                setSellHoldingId(summary.holding.id);
                                setSellShares(formatInputShares(summary.shares));
                                setSellPrice(formatInputPrice(summary.currentPrice));
                                setSellMessage("");
                              }}
                              type="button"
                            >
                              Sell
                            </button>
                            <button
                              className="rounded-md border border-line px-2.5 py-1.5 font-bold text-neutral-300 transition hover:border-pulse-green hover:text-pulse-green"
                              onClick={() => void handleViewExplanation(summary.holding.ticker)}
                              type="button"
                            >
                              View explanation
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="rounded-lg border border-dashed border-line bg-paper p-6 text-center">
                  <h3 className="text-lg font-black text-ink">No fake holdings yet</h3>
                  <p className="mt-2 text-sm leading-6 text-neutral-400">
                    Add a ticker and a virtual dollar amount to start learning how portfolio math works.
                  </p>
                </div>
              )}
            </div>
          </section>
        </section>

        {explanationTicker ? (
          <section className="rounded-lg border border-line bg-panel p-5 shadow-soft">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-pulse-green">Ticker explanation</p>
                <h2 className="mt-2 text-2xl font-black text-ink">{explanationTicker}</h2>
              </div>
              <Link
                className="self-start rounded-md border border-line px-3 py-2 text-sm font-bold text-neutral-300 transition hover:border-pulse-green hover:text-pulse-green"
                href="/"
              >
                Search on home
              </Link>
            </div>

            {isLoadingExplanation ? (
              <p className="mt-4 text-sm font-semibold text-neutral-300">Loading explanation...</p>
            ) : null}

            {explanationMessage ? (
              <p className="mt-4 rounded-md border border-pulse-red/40 bg-pulse-red/10 p-3 text-sm font-semibold text-pulse-red">
                {explanationMessage}
              </p>
            ) : null}

            {explanation ? (
              <div className="mt-4 grid gap-4 text-sm leading-6 text-neutral-300">
                <p>{explanation.summary}</p>
                {explanation.keyDrivers.length > 0 ? (
                  <ul className="grid gap-2">
                    {explanation.keyDrivers.map((driver) => (
                      <li className="rounded-md border border-line bg-paper p-3" key={driver}>
                        {driver}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="font-semibold text-neutral-400">{explanation.disclaimer}</p>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </PortfolioShell>
  );
}

function PortfolioShell({ children }: { children: ReactNode }) {
  return (
    <main className="px-4 py-8 text-ink sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </main>
  );
}

function SummaryCard({ label, tone = "neutral", value }: { label: string; tone?: "gain" | "loss" | "neutral"; value: string }) {
  const toneClass =
    tone === "gain" ? "text-pulse-green" : tone === "loss" ? "text-pulse-red" : "text-ink";

  return (
    <div className="rounded-lg border border-line bg-paper p-4">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">{label}</p>
      <p className={`mt-2 text-2xl font-black ${toneClass}`}>{value}</p>
    </div>
  );
}

function NumberField({
  id,
  label,
  onChange,
  placeholder,
  value,
}: {
  id: string;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-neutral-200" htmlFor={id}>
      {label}
      <input
        className="min-h-11 rounded-md border border-line bg-paper px-3 text-base text-ink outline-none transition placeholder:text-neutral-500 focus:border-pulse-green focus:bg-black"
        id={id}
        min="0"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        step="any"
        type="number"
        value={value}
      />
    </label>
  );
}

function renderStatusCard(title: string, copy: string) {
  return (
    <section className="rounded-lg border border-line bg-panel p-5 shadow-soft">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-pulse-green">Practice Portfolio</p>
      <h1 className="mt-3 text-2xl font-black text-ink">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-neutral-300">{copy}</p>
    </section>
  );
}

async function fetchStockQuote(symbol: string) {
  const response = await fetch(`/api/stock?ticker=${encodeURIComponent(symbol)}`);
  const payload = (await response.json()) as StockResponse | { error?: string };

  if (!response.ok || !("currentPrice" in payload) || !Number.isFinite(payload.currentPrice)) {
    throw new Error("Unable to load current stock price.");
  }

  return payload;
}

function getDatabaseSetupMessage(message: string) {
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes("relation") ||
    lowerMessage.includes("schema cache") ||
    lowerMessage.includes("does not exist")
  ) {
    return "Practice Portfolio tables are not set up yet.";
  }

  return message || "Unable to load Practice Portfolio right now.";
}

function getTone(value: number) {
  if (value > 0) {
    return "gain";
  }

  if (value < 0) {
    return "loss";
  }

  return "neutral";
}

function getToneClass(value: number) {
  if (value > 0) {
    return "text-pulse-green";
  }

  if (value < 0) {
    return "text-pulse-red";
  }

  return "text-neutral-300";
}

function toNumber(value: number | string) {
  return typeof value === "number" ? value : Number(value);
}

function formatCurrency(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits,
    minimumFractionDigits: maximumFractionDigits === 0 ? 0 : 2,
    style: "currency",
  }).format(value);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "percent",
  }).format(value);
}

function formatShares(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 6,
    minimumFractionDigits: 0,
  }).format(value);
}

function formatInputPrice(value: number) {
  return value.toFixed(2);
}

function formatInputShares(value: number) {
  return Number(value.toFixed(6)).toString();
}
