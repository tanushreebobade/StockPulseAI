import dotenv from 'dotenv';
import { setNewAnchorPrice } from './stockService.js';

dotenv.config();

const tickers = ['AAPL', 'TSLA', 'GOOGL', 'AMZN', 'MSFT', 'NVDA', 'META', 'NFLX', 'AMD', 'COIN'];
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function fetchStockPrices(redisClient) {
  const apiKey = process.env.FINNHUB_API_KEY;
  const isMock = process.env.DATA_SOURCE === 'MOCK' || !apiKey || apiKey === 'YOUR_FINNHUB_API_KEY';

  console.log(`\n📡 [Price Ingestion] Fetching latest stock price quotes...`);

  for (const ticker of tickers) {
    let price = null;
    const timestamp = new Date().toISOString();

    if (!isMock) {
      try {
        console.log(`🌐 [Price Ingestion] Querying Finnhub for ${ticker}...`);
        const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${apiKey}`);
        const data = await response.json();

        // "c" represents the current market price in Finnhub's response object
        if (data && typeof data.c === 'number' && data.c > 0) {
          price = data.c;
          console.log(`📈 [Price Ingestion] Finnhub returned ${ticker}: $${price}`);
        } else {
          console.warn(`⚠️ [Price Ingestion] Invalid Finnhub response for ${ticker}. Using current cache.`);
        }
      } catch (err) {
        console.error(`❌ [Price Ingestion] Failed to fetch quote for ${ticker}:`, err.message);
      }
    }

    if (price !== null) {
      // 1. Cache latest real price values in a Redis Hash
      await redisClient.hset(`stock:${ticker}:latest`, {
        price,
        timestamp
      });

      // 2. Smoothly transition the simulator to this new real price anchor
      setNewAnchorPrice(ticker, price);
    }

    // Spacing requests by 1 second to respect Finnhub burst limits
    if (!isMock) {
      await sleep(1000);
    }
  }
  console.log(`📡 [Price Ingestion] Ingestion cycle complete.`);
}

export function startPriceFetcher(redisClient) {
  const apiKey = process.env.FINNHUB_API_KEY;
  const isMock = process.env.DATA_SOURCE === 'MOCK' || !apiKey || apiKey === 'YOUR_FINNHUB_API_KEY';

  if (isMock) {
    console.log(`🔌 [Price Ingestion] Running in MOCK price mode. Finnhub fetches skipped.`);
    return;
  }

  // Initial fetch 2 seconds after boot
  setTimeout(() => {
    fetchStockPrices(redisClient).catch(err => console.error("❌ Initial price fetch failed:", err));
  }, 2000);

  // Poll actual stock quotes every 2 minutes
  setInterval(() => {
    fetchStockPrices(redisClient).catch(err => console.error("❌ Cron price fetch failed:", err));
  }, 2 * 60 * 1000);

  console.log(`📡 Price Ingestion scheduler initialized. Fetch interval set to 2 minutes.`);
}
