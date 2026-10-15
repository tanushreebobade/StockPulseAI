# Scheduled News Ingestion & Gemini Batch Ingestion Feature Guide

This guide details the implementation of our automated scheduled news fetching and AI batch sentiment analysis systems, including database pruning and caching optimizations.

---

## 1. Overview
* **Problem**: Storing and processing financial news headlines incurs significant API request footprints, computational decay loads, and API pricing overheads.
* **Why**: To build a robust, scalable ingestion engine that polls external feeds, filters duplicate stories, aggregates sentiment calculations, and maintains a lean database.
* **High-Level Workflow**:
  - **The Scout (`newsFetcher.js`)** wakes up on a schedule every **1 hour**.
  - It pulls recent articles from NewsAPI (or runs a mock generator).
  - It matches keywords in title/description to map articles to our 10 stock assets.
  - It calculates a SHA-256 fingerprint for each article and checks Redis to verify if it has been seen in the last **48 hours**.
  - It bundles all unique articles into a single job payload and enqueues it on **The Conveyor Belt (BullMQ)**.
  - **The Analyst (`worker.js`)** dequeues the batch job and calls Gemini *once* to parse all articles in the batch, returning a JSON array.
  - The analyst writes individual sentiment logs to MongoDB, updates the Redis ZSET leaderboard, and broadcasts to clients via Socket.io.

---

## 2. Requirements

### Functional
* Poll NewsAPI (with simulated fallback data) every **1 hour** for stock news.
* Perform keyword matching to map news to the 10 watchlisted stocks.
* Check Redis cache to deduplicate identical headlines within a **48-hour** rolling window.
* Batch up to 15 articles in a single Gemini request.
* Display sentiment results and explanations in the global feed and drawers in real time.
* Auto-delete logs older than **7 days** in MongoDB to maintain database storage limits.
* Limit API queries on `/api/news` to a maximum of **30** items.

### Non-Functional
* The news scraper and Gemini batch calls must run asynchronously in background workers, without blocking the Express thread.
* Database timelines must fetch records with $O(1)$ efficiency.

### Edge Cases
* **Duplicate Articles Across Sources**: Handled by hashing title + URL.
* **No New Articles Found**: If all headlines are duplicates, the Scout skips the BullMQ enqueue step.
* **Gemini Offline**: Retried automatically by BullMQ job handlers.

---

## 3. Design Decisions

### A. The 48-Hour Redis Deduplication Cache
* **Decision**: Generate a SHA-256 hash of `title + url` and execute `SETNX key "1" EX 172800` in Redis.
* **Alternative**: Checking MongoDB to see if the title exists before queueing.
* **Reason for Rejection**: Checking MongoDB requires a disk-bound index search per article. A Redis `SETNX` call is an atomic in-memory operation that checks and locks the signature in sub-milliseconds, saving database resources.

### B. Gemini Batch Processing (JSON Array Mode)
* **Decision**: Bundle multiple headlines and call Gemini once, requesting a JSON response array.
* **Alternative**: Queuing each headline as an individual BullMQ job that calls Gemini independently.
* **Reason for Rejection**: Individual requests would call Gemini up to 20 times per cycle, hitting RPM rate limits on the free tier. Batching reduces this to a single API call per cycle, saving 95% of API credits.

### C. MongoDB TTL Purging
* **Decision**: Set the schema timestamp index to `expires: '7d'`.
* **Alternative**: Writing a daily Node.js cleanup script to delete old entries: `db.sentiments.deleteMany({ timestamp: { $lt: sevenDaysAgo } })`.
* **Reason for Rejection**: A custom script requires scheduling and maintenance, and it can cause CPU spikes during deletion runs. MongoDB's native TTL feature manages deletions in a background thread once every minute.

---

## 4. Architecture

```text
       [The Scout: newsFetcher.js] (Wakes up every 1 hour)
                   │
                   ▼ (Fetches articles & matches keywords)
       [Deduplication: Redis SETNX] (48-hour signature check)
                   │
                   ▼ (Enqueues batch job)
    [The Conveyor Belt: BullMQ Queue]
                   │
                   ▼ (Pulls batch job)
      [The Analyst: worker.js]
                   │
                   ▼ (Sends batch list to Google Gemini 1.5 Flash)
      [Gemini API JSON response array]
                   │
                   ├──> [MongoDB Model] (Saves individual logs; TTL 7 days)
                   ├──> [Redis ZSET] (Updates leaderboard decayed scores)
                   └──> [Redis Pub/Sub] ──> [Socket.io Client] (Real-time updates)
```

---

## 5. Files Created/Modified

### 1. `backend/src/services/newsFetcher.js` [NEW]
* **Purpose**: Implements the scheduled news ingestion engine.
* **Responsibilities**: Executes fetches, maps keyword lists to tickers, performs Redis deduplication, and enqueues batch jobs.

### 2. `backend/src/models/Sentiment.js` [MODIFY]
* **Purpose**: Defines the MongoDB model.
* **Responsibilities**: Implements the `expires: '7d'` TTL config and defines the compound index `{ ticker: 1, timestamp: -1 }`.

### 3. `backend/worker.js` [MODIFY]
* **Purpose**: Background daemon process.
* **Responsibilities**: Receives batch jobs, calls Gemini JSON model, saves documents, and publishes Pub/Sub events.

### 4. `backend/src/index.js` [MODIFY]
* **Purpose**: Boots API and background processes.
* **Responsibilities**: Schedules Scout boot/intervals and caps the `/api/news` route to a maximum of 30 items.

---

## 6. Important Code Explained

### Redis Deduplication Hashing (`newsFetcher.js`)
```javascript
const hash = crypto
  .createHash('sha256')
  .update(`${article.title}-${article.url}`)
  .digest('hex');

const dedupeKey = `dedupe:news:${hash}`;
// Only set if key does not exist; expire in 48 hours (172800s)
const isUnique = await redisClient.set(dedupeKey, '1', 'NX', 'EX', 172800);
if (isUnique === 'OK') {
  uniqueArticles.push(article);
}
```
* **Why it exists**: Saves Gemini tokens and avoids database clutter.
* **How it works**: Uses `NX` to ensure the key is only created if it doesn't already exist, and `EX` to expire the signature in 2 days.

### Gemini Batch Parsing Prompt (`worker.js`)
```javascript
const prompt = `
  Analyze the following list of news headlines.
  For each news item, provide a score (-5 to 5) and a 1-2 sentence explanation.
  
  HEADLINES:
  ${articles.map((art, idx) => `${idx + 1}. [Ticker: ${art.ticker}] Headline: "${art.title}"`).join('\n')}
  
  You MUST return a JSON array matching this schema:
  [
    { "ticker": "string", "headline": "string", "score": number, "explanation": "string" }
  ]
`;
```
* **Why it exists**: It bundles articles for efficient processing.
* **How it works**: Enforces structural outputs from Gemini, returning an array of parsed sentiment scores in a single request.

---

## 7. Important APIs

### Get Historical News (Capped to 30)
* **Method**: `GET`
* **Route**: `/api/news`
* **Response (Success - 200)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "ticker": "AAPL",
        "headline": "Apple Silicon processor news",
        "score": 3,
        "explanation": "Increased performance expectations...",
        "timestamp": "2026-07-02T18:00:00.000Z"
      }
    ]
  }
  ```

---

## 8. Database Changes

### MongoDB Schema (`Sentiment.js`)
* **Index**: `{ ticker: 1, timestamp: -1 }` (optimizes stock timelines).
* **TTL Config**: `timestamp` field expires in `7d` (auto-deletes old documents).

### Redis Structures
* **Key**: `dedupe:news:<SHA-256>` (String, value `"1"`, expires in 48 hours).
* **Queue**: `news_analysis_queue` (BullMQ jobs metadata).

---

## 9. External Libraries

### `crypto` (Node native)
* **Purpose**: Generates hash fingerprints.
* **Important Functions**: `createHash()`.

---

## 10. Revision Notes
* **Summary**: Ingestion scheduled every **1 hour** $\rightarrow$ checks Redis **48-Hour dedupe signature** $\rightarrow$ enqueues batch in BullMQ $\rightarrow$ Gemini processes batch as a single request $\rightarrow$ splits results to write individual MongoDB logs with a **7-Day TTL** $\rightarrow$ `/api/news` caps responses at **30** logs.

---

## 11. Interview Questions

### Basic
* **Question**: What is a TTL index in MongoDB and how does it clean up data?
* **Answer**: A TTL (Time-To-Live) index is a special single-field index that MongoDB uses to automatically remove documents from a collection after a set time. MongoDB runs a background daemon thread once every minute to identify and delete expired records.

### Intermediate
* **Question**: Why did you use Redis to deduplicate headlines instead of querying MongoDB?
* **Answer**: Querying MongoDB requires a disk-bound index search for each incoming headline, which increases query latency and database load. Redis operates entirely in memory, so checking and locking a headline signature via `SETNX` takes sub-milliseconds.

### Advanced
* **Question**: How does batching headlines inside a single Gemini API request improve performance and prevent rate limiting?
* **Answer**: It minimizes HTTP connection overhead by consolidating 15 requests into a single round-trip. It also counts as only 1 request against the Gemini API's 15 Requests-Per-Minute (RPM) rate limit, preventing the server from being blocked under heavy news cycles.
