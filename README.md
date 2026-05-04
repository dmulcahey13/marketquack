# MarketQuack

The market is loud. We make it make sense.

MarketQuack is a Next.js MVP for searching a stock ticker and viewing live Finnhub quote data, daily movement, recent company-related news, source links, and a simple local watchlist.

## Current Stage

- Next.js App Router with TypeScript
- Tailwind CSS UI
- Server API route at `/api/stock?ticker=AAPL`
- Server API route at `/api/explain`
- Finnhub quote, company profile, and 7-day company news data
- OpenAI structured explanation using only the cleaned quote and news data
- Local browser watchlist with no authentication and no Supabase yet
- `.env.local` holds `FINNHUB_API_KEY` and `OPENAI_API_KEY`
- Optional `OPENAI_MODEL` can override the default low-cost explanation model, `gpt-4.1-nano`

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

4. Add your Finnhub API key to `.env.local` in the project root:

   ```bash
   FINNHUB_API_KEY=your_finnhub_api_key_here
   OPENAI_API_KEY=your_openai_api_key_here
   OPENAI_MODEL=
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
