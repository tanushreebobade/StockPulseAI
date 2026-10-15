# Real-Time AI Sentiment Leaderboard Feature Guide

This guide details the implementation of the AI Sentiment Leaderboard, which ranks stocks based on historical sentiment scores and is cached in Redis for fast access.

---

## 1. Overview
* **Problem**: Aggregating hundreds of database records to calculate average sentiment scores and ranking stocks on every page load causes significant database load and slow response times.
* **Why**: To serve pre-calculated stock ranks in sub-milliseconds ($O(1)$ read speed) using a Redis caching structure.
* **High-Level Workflow**:
  - Whenever a new headline is analyzed, the worker recalculates the decayed sentiment score for the stock.
  - The worker updates the score inside a **Redis Sorted Set (ZSET)**.
  - The frontend polls or receives real-time updates and calls the `/api/leaderboard` endpoint.
  - The Express backend calls `ZREVRANGE` on Redis to instantly retrieve stocks sorted by score.

---

## 2. Requirements

### Functional
* Rank stocks based on their aggregate sentiment scores.
* Display the leaderboard in descending order (highest score at the top, lowest at the bottom).
* Refresh rankings in real time as news headlines are processed.
* Render the list as cards showing the ticker symbol, company name, score, and progress bar.

### Non-Functional
* Reading leaderboard statistics must take less than 10ms.
* Prevent database lookups during ranking fetches.

### Edge Cases
* **Empty Leaderboard**: If no sentiment logs exist, the leaderboard displays a fallback message without throwing an error.
* **Tied Scores**: If two stocks have identical scores, Redis sorts them lexicographically by ticker symbol.

---

## 3. Design Decisions

### A. Redis Sorted Set (ZSET) vs MySQL/MongoDB Sorting
* **Decision**: We store stock scores in a **Redis Sorted Set** using the key `stocks:sentiment:leaderboard`.
* **Alternative**: Performing an aggregate search in MongoDB:
  `db.sentiments.aggregate([{ $group: { _id: "$ticker", avgScore: { $avg: "$score" } } }])`.
* **Reason for Rejection**: Running MongoDB aggregations on every page load scans the entire collection, which degrades performance as the dataset grows. Redis ZSET automatically keeps elements sorted in memory, so retrieving the leaderboard takes $O(\log(N) + M)$ time (where $N$ is 10 stocks, making it virtually instantaneous).

---

## 4. Architecture

```text
[BullWorker / Decay Service]
             │
             ▼ (ZADD stocks:sentiment:leaderboard score ticker)
     [Redis Sorted Set] (Maintains sorted list in memory)
             │
             ▼ (Express queries ZREVRANGE)
      [Express API]
             │
             ▼ (REST JSON payload)
     [React Frontend] (Renders ranked list cards)
```

---

## 5. Files Involved

### 1. `backend/src/services/decayService.js`
* **Purpose**: Performs math logic.
* **Responsibilities**: Iterates through database headlines, calculates decayed scores, and updates the ZSET cache.

### 2. `backend/src/index.js`
* **Purpose**: Hosts API endpoints.
* **Responsibilities**: Serves `/api/leaderboard`, reads from Redis ZSET, and returns the formatted response.

### 3. `frontend/src/App.js`
* **Purpose**: Displays the UI.
* **Responsibilities**: Renders stock cards with bidirectional progress bars.

---

## 6. Important Code Explained

### Fetching Leaderboard ranks (`index.js`)
```javascript
app.get('/api/leaderboard', async (req, res) => {
  try {
    // ZREVRANGE fetches elements from highest to lowest score.
    // 0 and -1 denote start and stop indices (all members)
    // WITHSCORES returns both the member (ticker) and the score
    const rawLeaderboard = await redis.zrevrange("stocks:sentiment:leaderboard", 0, -1, "WITHSCORES");
    
    const formattedLeaderboard = [];
    for (let i = 0; i < rawLeaderboard.length; i += 2) {
      formattedLeaderboard.push({
        ticker: rawLeaderboard[i],
        score: parseFloat(parseFloat(rawLeaderboard[i + 1]).toFixed(2))
      });
    }

    res.status(200).json({
      success: true,
      data: formattedLeaderboard
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});
```
* **Why it exists**: It serves the leaderboard data.
* **How it works**: Since Redis stores members and scores sequentially in the output array, the code iterates by `i += 2`, mapping array indices to `{ ticker, score }` objects.

---

## 7. Important APIs

### Fetch Leaderboard
* **Method**: `GET`
* **Route**: `/api/leaderboard`
* **Response (Success - 200)**:
  ```json
  {
    "success": true,
    "data": [
      { "ticker": "NVDA", "score": 4.24 },
      { "ticker": "TSLA", "score": 3.71 },
      { "ticker": "NFLX", "score": -1.43 }
    ]
  }
  ```

---

## 8. Database Changes
* **Redis Key**: `stocks:sentiment:leaderboard` (Sorted Set)
  - Member: Ticker symbol (e.g. `AAPL`)
  - Score: Decayed sentiment score (e.g. `2.19`)

---

## 9. External Libraries

### `ioredis`
* **Purpose**: Accesses Redis commands.
* **Important Functions**: `zrevrange()`, `zadd()`.

---

## 10. Revision Notes
* **Summary**: Stock scores are stored in a **Redis ZSET** key `stocks:sentiment:leaderboard` $\rightarrow$ Updated by the worker/decay service $\rightarrow$ Read by Express using `ZREVRANGE` $\rightarrow$ Returned as JSON $\rightarrow$ Displayed in a wrapping grid on the frontend.

---

## 11. Interview Questions

### Basic
* **Question**: What is a Redis Sorted Set (ZSET) and how does it differ from a standard Set?
* **Answer**: A Redis Sorted Set is a collection of unique string members, similar to a regular Set. However, every member in a ZSET is associated with a floating-point numerical score. This score is used to keep the elements sorted.

### Intermediate
* **Question**: Why is using `ZREVRANGE` faster than sorting data in SQL using `ORDER BY score DESC`?
* **Answer**: SQL sorting typically runs at $O(N \log N)$ complexity at query time unless indexed. Even with indexes, database sorting uses disk and buffer space. Redis ZSET stores elements sorted in memory, so retrieving ranked lists runs at $O(\log(N) + M)$ complexity.

### Advanced
* **Question**: How does a Sorted Set handle score conflicts, and how would you customize the tie-breaking logic?
* **Answer**: By default, members with equal scores are sorted lexicographically (using binary comparison of the strings). If we want custom tie-breaking logic (e.g. prioritizing stocks with higher trade volumes), we can combine both metrics into a single compound score in the ZSET.
