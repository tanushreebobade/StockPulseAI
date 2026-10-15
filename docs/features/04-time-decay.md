# Time-Decay Sentiment Algorithm Feature Guide

This guide details the implementation of the linear time-decay sentiment algorithm, which dampens historical stock sentiment scores over a rolling 7-day window.

---

## 1. Overview
* **Problem**: Financial sentiment is temporary. A highly positive news headline from 5 days ago should not carry the same weight as a headline released 5 minutes ago.
* **Why**: To ensure our sentiment scores reflect recent market events by systematically decaying historical scores down to zero over a rolling 7-day period.
* **High-Level Workflow**:
  - The system calculates score weights using a linear formula: $Weight = 1 - \frac{AgeInHours}{168}$.
  - Any headline older than 168 hours (7 days) receives a weight of `0` (ignored).
  - The decay service runs automatically on server boot and is scheduled to recalculate scores every 5 minutes in the background.
  - Recalculated scores are cached back into the Redis ZSET leaderboard.

---

## 2. Requirements

### Functional
* Calculate the age of each news log relative to the current time.
* Apply a linear decay weight to each score over a 7-day period.
* Aggregate decayed scores for each stock.
* Update scores in the Redis ZSET leaderboard automatically.
* Recalculate scores in the background every 5 minutes.

### Non-Functional
* The decay calculation must run in the background without blocking Express API threads.
* Decayed scores must be rounded to two decimal places for UI consistency.

### Edge Cases
* **Future Timestamps**: If an article's timestamp is slightly ahead of the server time, its age is treated as 0 (no decay), preventing negative ages from inflating scores.
* **No News logs**: If a stock has no news history, its sentiment score is set to 0.

---

## 3. Design Decisions

### A. Linear Decay vs Exponential Decay
* **Decision**: We implement a **linear decay formula** over 168 hours:
  $$\text{Score} = \text{RawScore} \times \left(1 - \frac{\text{AgeInHours}}{168}\right)$$
* **Alternative**: Exponential decay formula like $e^{-\lambda t}$.
* **Reason for Rejection**: While exponential decay is realistic, linear decay is easier to calculate, interpret, and explain during system reviews, while still accurately dropping a headline's impact to zero at the 7-day mark.

### B. Pull vs Push Recalculation
* **Decision**: Recalculate all stock scores in a batch every 5 minutes using `setInterval` and on new headline arrivals.
* **Alternative**: Calculating decay dynamically inside the `/api/leaderboard` read endpoint.
* **Reason for Rejection**: Calculating decay on every read request consumes CPU cycles and slows down API responses. Calculating in the background separates write-side logic from read-side access.

---

## 4. Architecture

```text
       [Express index.js Boot]
                  │
                  ▼ (Triggers initial calculation)
        [recalculateDecayedScores]
                  │
                  ├──> [MongoDB] (Reads news logs from the past 7 days)
                  ├──> [Mathematical Decay Loop] (Applies formula)
                  └──> [Redis ZSET] (Updates stock scores)
                  
       [Express index.js Event loop]
                  │
                  ▼ (Every 5 minutes)
     [setInterval background trigger] ──> [recalculateDecayedScores]
```

---

## 5. Files Involved

### 1. `backend/src/services/decayService.js`
* **Purpose**: Hosts the decay calculation engine.
* **Responsibilities**: Fetches MongoDB headlines, calculates linear decay weights, aggregates scores, and updates Redis ZSET.

### 2. `backend/src/index.js`
* **Purpose**: Runs background processes.
* **Responsibilities**: Executes the initial calculation on boot and sets up the 5-minute interval loop.

---

## 6. Important Code Explained

### Recalculate Decayed Scores (`decayService.js`)
```javascript
export async function recalculateDecayedScores(redisClient) {
  const tickers = ['AAPL', 'TSLA', 'GOOGL', 'AMZN', 'MSFT', 'NVDA', 'META', 'NFLX', 'AMD', 'COIN'];
  
  // 1. Fetch news headlines from the past 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const news = await Sentiment.find({ timestamp: { $gte: sevenDaysAgo } });

  // 2. Loop through each ticker and aggregate scores
  for (const ticker of tickers) {
    const tickerNews = news.filter(n => n.ticker === ticker);
    
    if (tickerNews.length === 0) {
      await redisClient.zadd("stocks:sentiment:leaderboard", 0, ticker);
      continue;
    }

    let aggregatedScore = 0;
    
    for (const item of tickerNews) {
      const ageInMs = Date.now() - new Date(item.timestamp).getTime();
      const ageInHours = Math.max(0, ageInMs / (1000 * 60 * 60));
      
      // Linear decay formula
      const weight = Math.max(0, 1 - ageInHours / 168);
      aggregatedScore += item.score * weight;
    }

    // 3. Save the aggregated score to Redis Sorted Set
    await redisClient.zadd("stocks:sentiment:leaderboard", aggregatedScore, ticker);
  }
}
```
* **Why it exists**: It updates the leaderboard cache.
* **How it works**: It isolates articles within a 7-day range. For each matching article, it computes a time-decay weight, aggregates the weighted scores, and caches the result in Redis.

---

## 7. Important APIs
* **Internal Action**: Does not expose an external API. This service runs purely in the background to refresh the Redis cache.

---

## 8. Database Changes
* **Redis Update**: Modifies scores in `stocks:sentiment:leaderboard`.
* **MongoDB Query**: Reads from the `sentiments` collection.

---

## 9. External Libraries
* **None**: Built entirely using native JavaScript `Math` and standard Mongoose/Redis operations.

---

## 10. Revision Notes
* **Summary**: Calculates score weight using $1 - \frac{AgeInHours}{168}$ $\rightarrow$ Articles older than 7 days get 0 weight $\rightarrow$ Runs on boot and every 5 minutes in the background $\rightarrow$ Updates Redis ZSET leaderboard.

---

## 11. Interview Questions

### Basic
* **Question**: Why does the decay service only fetch news from the past 7 days?
* **Answer**: Because any headline older than 7 days (168 hours) receives a decay weight of `0` in our formula. Limiting the database query to the past 7 days prevents loading unnecessary documents, saving memory and processing time.

### Intermediate
* **Question**: What is the difference between CPU-bound and I/O-bound tasks, and which one is this decay service?
* **Answer**: CPU-bound tasks rely primarily on processor speed (like encryption or heavy math). I/O-bound tasks rely on input/output operations (like database queries or network calls). The decay service is **hybrid**: it is I/O-bound while fetching logs from MongoDB, and CPU-bound during the math calculations loop.

### Advanced
* **Question**: If you have multiple background workers and server instances running, how do you prevent them from conflicting when running this cron job simultaneously?
* **Answer**: Running scheduled cron jobs on multiple server instances can cause race conditions. We can resolve this by using a **distributed lock** (like Redlock via Redis) to ensure only one instance executes the recalculation at a time, or by running the scheduler on a single dedicated worker instance.
