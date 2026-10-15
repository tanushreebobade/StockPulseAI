import { Sentiment } from '../models/Sentiment.js';

export async function recalculateDecayedScores(redisClient) {
  try {
    console.log("🔄 Recalculating time-decayed stock sentiment scores...");
    const tickers = ['AAPL', 'TSLA', 'GOOGL', 'AMZN', 'MSFT', 'NVDA', 'META', 'NFLX', 'AMD', 'COIN'];
    const scores = {};
    tickers.forEach(t => scores[t] = 0);

    // 7 days ago timestamp
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    // Fetch all headlines from MongoDB within the last 7 days
    const headlines = await Sentiment.find({ timestamp: { $gte: sevenDaysAgo } });
    
    const now = Date.now();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

    headlines.forEach(h => {
      if (scores[h.ticker] !== undefined) {
        const ageMs = now - new Date(h.timestamp).getTime();
        // Linear decay: Weight goes from 1.0 (brand new) down to 0.0 (7 days old)
        const weight = Math.max(0, 1 - (ageMs / SEVEN_DAYS_MS));
        scores[h.ticker] += h.score * weight;
      }
    });

    // Sync the pre-calculated decayed scores to the Redis Sorted Set in a single atomic batch
    const zaddArgs = [];
    for (const [ticker, score] of Object.entries(scores)) {
      const roundedScore = parseFloat(score.toFixed(2));
      zaddArgs.push(roundedScore, ticker);
    }
    if (zaddArgs.length > 0) {
      await redisClient.zadd("stocks:sentiment:leaderboard", ...zaddArgs);
    }
    
    console.log("✅ Time-decayed scores successfully synced to Redis ZSET:", scores);
    return scores;
  } catch (err) {
    console.error("❌ Error in recalculateDecayedScores:", err);
    throw err;
  }
}
