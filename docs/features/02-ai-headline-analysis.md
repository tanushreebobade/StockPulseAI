# Asynchronous AI Headline Analysis Feature Guide

This guide details the implementation of our background job processing pipeline, which queues financial headlines and uses Google Gemini to analyze sentiment in real time.

---

## 1. Overview
* **Problem**: Calling external LLM APIs (like Google Gemini) is slow and takes 2-3 seconds per request. If done synchronously inside HTTP cycles, it blocks server performance and causes request timeouts.
* **Why**: To offload heavy AI processing workloads into background workers, ensuring the API server remains fast and responsive.
* **High-Level Workflow**:
  - The user submits a financial headline for a stock on the React client.
  - The Express backend endpoint `/api/analyze` receives the request and adds a job to a BullMQ Redis queue, responding to the client immediately with `202 Accepted`.
  - A dedicated background worker process (`worker.js`) dequeues the job.
  - The worker calls the Google Gemini API to analyze the sentiment score (from -5 to +5) and get an explanation.
  - The worker stores the result in MongoDB and broadcasts it to the frontend via Socket.io.

---

## 2. Requirements

### Functional
* Provide a submission form to submit headlines for any of the 10 supported stocks.
* Queue jobs reliably, ensuring no headlines are lost if the worker restarts.
* Analyze sentiment on a scale from -5 (bearish) to +5 (bullish).
* Provide a structured AI explanation of the sentiment analysis.
* Store analyzed headline details (ticker, text, score, explanation, timestamp) in MongoDB.
* Push completed analyses in real time to the logs feed in the UI.

### Non-Functional
* The HTTP submission endpoint must respond in under 50ms.
* API key secrets must be kept out of the codebase.
* The AI engine must return structured, machine-readable JSON data.

### Edge Cases
* **Gemini API Failures**: If the Gemini API rate limit is exceeded or throws an error, the BullMQ job is marked as "failed" and can be retried automatically.
* **Bad JSON Output**: If the model output cannot be parsed, the worker catches the JSON error and logs it without crashing the process.

---

## 3. Design Decisions

### A. BullMQ + Redis Queue vs In-Memory Arrays
* **Decision**: We use **BullMQ** backed by Redis to manage job states.
* **Alternative**: Storing queued jobs in an in-memory JavaScript array.
* **Reason for Rejection**: An in-memory queue exists only in the RAM of the running process. If the server crashes, restarts, or undergoes deployment, all queued headlines are lost. Redis persists job states, so jobs are retained until successfully processed.

### B. Gemini JSON Schema Mode
* **Decision**: Configure the Gemini model with `responseMimeType: "application/json"`.
* **Alternative**: Traditional parsing using regex or string splitting on the output.
* **Reason for Rejection**: LLMs are non-deterministic and occasionally return conversational text like "Here is your JSON..." which breaks traditional parsers. JSON Mode forces the model to return syntactically valid JSON matching our expected structure.

---

## 4. Architecture

```text
[React Client Form]
       │
       ▼ (HTTP POST /api/analyze)
[Express API Server]
       │
       ▼ (newsQueue.add)
   [Redis Queue]  (Holds jobs in a queue state)
       │
       ▼ (Asynchronous Dequeue)
[BullMQ worker.js]
       │
       ├──> [Google Gemini API] (Generates structured JSON)
       │
       ├──> [MongoDB Model] (Saves persistent record)
       │
       └──> [Redis Pub/Sub] ──> [Express Subscriber] ──> [Socket.io Client]
```

---

## 5. Files Involved

### 1. `backend/src/queues/queueSetup.js`
* **Purpose**: Creates the BullMQ instance.
* **Responsibilities**: Establishes a Redis connection and exports the queue instance `newsQueue`.

### 2. `backend/src/index.js`
* **Purpose**: Hosts the REST endpoint.
* **Responsibilities**: Serves `/api/analyze` and adds jobs to the queue.

### 3. `backend/worker.js`
* **Purpose**: Background daemon process.
* **Responsibilities**: Listens for jobs, communicates with Gemini, saves records to MongoDB, and broadcasts updates.

### 4. `backend/src/models/Sentiment.js`
* **Purpose**: Mongoose schema.
* **Responsibilities**: Maps sentiment objects to the MongoDB collection.

---

## 6. Important Code Explained

### Queue Producer Endpoint (`index.js`)
```javascript
app.post('/api/analyze', async (req, res) => {
  try {
    const { ticker, headline } = req.body;
    
    // Add job to the Redis queue asynchronously
    const job = await newsQueue.add("analyze_headline", { ticker, headline });

    // Respond immediately with 202 Accepted status
    res.status(202).json({
      success: true,
      message: "Headline queued for AI analysis",
      jobId: job.id
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to queue analysis' });
  }
});
```

### Worker Loop & Gemini Call (`worker.js`)
```javascript
const worker = new Worker("news_analysis_queue", async (job) => {
  const { ticker, headline } = job.data;
  
  const prompt = `
    Analyze the following headline for ticker: ${ticker}.
    HEADLINE: "${headline}"
    You MUST return a JSON object with this exact schema:
    {
      "score": number, // integer between -5 and 5
      "explanation": "string"
    }
  `;

  // Request structured JSON response
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const analysis = JSON.parse(response.text().trim());

  // Save the result to MongoDB
  const newSentiment = await Sentiment.create({
    ticker,
    headline,
    score: parseInt(analysis.score) || 0,
    explanation: analysis.explanation
  });

  // Recalculate decayed scores and broadcast
  await recalculateDecayedScores(redisClient);
  await redisClient.publish("sentiment_updates", JSON.stringify(newSentiment));
}, { connection });
```

---

## 7. Important APIs

### Submit Headline for Analysis
* **Method**: `POST`
* **Route**: `/api/analyze`
* **Request Body**:
  ```json
  {
    "ticker": "AAPL",
    "headline": "Apple launches revolutionary spatial computing device."
  }
  ```
* **Response (Accepted - 202)**:
  ```json
  {
    "success": true,
    "message": "Headline queued for AI analysis",
    "jobId": "12"
  }
  ```

---

## 8. Database Changes
* **Collection**: `sentiments`
* **Schema**:
  ```javascript
  const SentimentSchema = new mongoose.Schema({
    ticker: { type: String, required: true },
    headline: { type: String, required: true },
    score: { type: Number, required: true },
    explanation: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  });
  ```

---

## 9. External Libraries

### `bullmq`
* **Purpose**: Ingests, queues, and processes async tasks.
* **Important Functions**: `Queue()`, `Worker()`, `queue.add()`.

### `@google/generative-ai`
* **Purpose**: Accesses Gemini models.
* **Important Functions**: `GoogleGenerativeAI()`, `model.generateContent()`.

---

## 10. Revision Notes
* **Summary**: User submits headline $\rightarrow$ backend adds job to BullMQ $\rightarrow$ returns `202` $\rightarrow$ background `worker.js` pulls job $\rightarrow$ asks Gemini for JSON output $\rightarrow$ saves to Mongo $\rightarrow$ ZSET updates $\rightarrow$ Socket.io pushes to React client.

---

## 11. Interview Questions

### Basic
* **Question**: Why does the post request return a `202` status code instead of a `200` or `201`?
* **Answer**: The `202 Accepted` status code indicates that the request has been accepted for processing, but the processing is not yet complete. Since Gemini API calls take seconds, we offload them to a queue and respond immediately.

### Intermediate
* **Question**: What happens to jobs in BullMQ if the worker process crashes midway through analyzing a headline?
* **Answer**: BullMQ tracks job states using Redis keys. If a worker crashes, the job is moved from `active` back to `failed` or `delayed` after a visibility timeout. When the worker restarts, it can pick the job up again.

### Advanced
* **Question**: How would you handle a spike in traffic where 100,000 headlines are submitted in a minute?
* **Answer**: BullMQ acts as a buffer. The Express API will queue all 100,000 jobs in Redis in a few seconds. The worker pool will process them at a controlled rate (throttled by the rate-limiter configurations), preventing the database or external APIs from being overloaded.
