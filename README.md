# MarketQuack

The market is loud. We make it make sense.

MarketQuack is a Next.js MVP for searching a stock ticker and viewing live Finnhub quote data, daily movement, recent company-related news, source links, and a simple local watchlist.

## Current Stage

- Next.js App Router with TypeScript
- Tailwind CSS UI
- Server API route at `/api/stock?ticker=AAPL`
- Server API route at `/api/explain`
- Server API route at `/api/history?symbol=AAPL&range=1M`
- Finnhub quote, company profile, and 7-day company news data
- Twelve Data historical chart data
- OpenAI structured explanation using only the cleaned quote and news data
- Supabase Auth login/signup
- Authenticated Practice Portfolio with virtual cash and fake holdings
- Local browser watchlist
- `.env.local` holds API keys and public Supabase Auth config

## Run Locally

1. Install Node.js 20 or newer.
2. Open a terminal in this folder:

   ```bash
   cd "/Users/declanmulcahey/Documents/New project"
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Add your API keys and public Supabase Auth config to `.env.local` in the project root:

   ```bash
   FINNHUB_API_KEY=your_finnhub_api_key_here
   OPENAI_API_KEY=your_openai_api_key_here
   TWELVE_DATA_API_KEY=your_twelve_data_api_key_here
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   # Or use the newer public key name instead:
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key_here
   ```

5. Start the dev server:

   ```bash
   npm run dev
   ```

6. Open the app:

   ```text
   http://localhost:3000
   ```

Try `AAPL`, `MSFT`, or `NVDA`. The API route returns an error when Finnhub has no quote data for a ticker.

## Supabase Auth Setup

1. Create a Supabase project at `https://supabase.com`.
2. In Supabase, open Project Settings, then API.
3. Copy the Project URL into `NEXT_PUBLIC_SUPABASE_URL`. The value should be the URL only, such as `https://your-project-ref.supabase.co`.
4. Copy the anon public key into `NEXT_PUBLIC_SUPABASE_ANON_KEY`, or copy the newer publishable key into `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
5. Add `NEXT_PUBLIC_SUPABASE_URL` and one public key variable to `.env.local` for local development.
6. Add the same values to Vercel project environment variables before deploying.

Do not use the Supabase service role key or any `sb_secret_...` key in frontend code, `.env.local` values prefixed with `NEXT_PUBLIC_`, or Vercel public environment variables. MarketQuack only accepts public Supabase keys that start with `sb_publishable_` or legacy anon JWT keys that start with `eyJ`.

## Practice Portfolio Setup

Practice Portfolio stores virtual portfolios and fake holdings in Supabase. It does not connect to a brokerage, place trades, move money, or provide financial advice.

Run the SQL in `supabase/practice-portfolio.sql` from the Supabase SQL editor before using `/portfolio`. It creates:

- `practice_portfolios`
- `practice_holdings`
- `practice_transactions`

The SQL enables Row Level Security and policies so authenticated users can only access their own practice portfolio data.
