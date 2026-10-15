# Real Stock Price Ingestion & Hybrid Tick Simulator Feature Guide

This guide details the implementation of our real stock price ingestion feed via Finnhub, the Ornstein-Uhlenbeck Mean Reversion wiggles loop, and the step-delta transition smoothing interval.

---

## 1. Overview
* **Problem**: Free stock APIs have strict rate limits (e.g., Finnhub restricts free accounts to 60 calls/minute). Fetching stock prices for 10 stocks every 2 seconds requires 300 calls/minute, triggering immediate `429 Too Many Requests` bans.
* **Why**: To display real-world market prices on the dashboard without hitting API blocks, while preserving real-time UI wiggles, flashing directions, and animating chart coordinates.
* **High-Level Workflow**:
  - **The Scout (`priceIngestionService.js`)** wakes up every **2 minutes** to poll current quotes sequentially (1-second delay between tickers) from Finnhub.
  - It writes the retrieved real prices into Redis HASH structures (`stock:<TICKER>:latest`) and triggers the simulator re-anchoring function.
  - **The Simulator (`stockService.js`)** wiggles simulated prices every 2 seconds, but applies a **Mean Reversion** formula that acts like a magnet, pulling the simulated ticks back toward the last real-world anchor.
  - When the 2-minute interval delivers a new real price quote, the simulator executes **Step-Delta Transition Smoothing** (3 steps spaced 500ms apart) to merge the price gap without a visible snap or "teleportation" glitch.

---

## 2. Requirements

### Functional
* Retrieve actual stock price quotes for 10 assets from Finnhub.
* Space API calls by 1 second during fetching cycles to prevent rate limit spikes.
* Run price fetches once every 2 minutes.
* Run high-frequency price updates every 2 seconds.
* Maintain wiggles centered around the real fetched price (Mean Reversion).
* Smooth price transitions over 3 intermediate steps spaced 500ms apart (Step-Delta Smoothing) when a new real anchor resolves.
* Fall back to the pure mock generator if no Finnhub API Key is present in the configuration.

### Non-Functional
* The API scraper must run in the background.
* Transition ticks must use WebSockets to sync browser states.

### Edge Cases
* **Finnhub Connection Failures**: If the API fails or returns invalid quotes, the system ignores the quote and continues wiggling from the current price, preventing crashes.
* **Closed Markets**: If the market is closed and prices do not fluctuate, the simulator still applies micro-wiggles to keep the charts active, while re-anchoring to the static closing quote.

---

## 3. Design Decisions

### A. The Hybrid Tick Simulator
* **Decision**: Fetch real quotes on a slow schedule (2 minutes) and simulate wiggles at a high frequency (2 seconds) in between, re-anchoring on each API cycle.
* **Alternative**: Updating the UI prices purely once every 2 minutes.
* **Reason for Rejection**: A 2-minute static update interval renders the dashboard lifeless. Real-time wiggles keep visual animations active while representing actual market values.

### B. Ornstein-Uhlenbeck Mean Reversion Math
* **Decision**: Calculate wiggles with a 5% pull ($0.05 \times (P_{\text{anchor}} - P_{\text{current}})$) back to the anchor on each tick.
* **Alternative**: A simple random walk ($\pm0.1\%$).
* **Reason for Rejection**: A pure random walk drifts away from the starting value over time. Without mean reversion, the simulated price would drift far from the real stock price before the next 2-minute fetch cycle, causing a huge, jarring jump during re-anchoring.

### C. Backend Step-Delta Sub-ticks
* **Decision**: Closing the price gap over 3 steps spaced 500ms apart on the backend.
* **Alternative**: Implementing transition animations on the React frontend.
* **Reason for Rejection**: Doing it on the backend keeps the frontend codebase clean and decoupled. The React client simply renders whatever WebSocket ticks it receives, whether they are standard wiggles or transition frames.

---

## 4. Architecture

```text
       [Cron Interval: 2 Minutes]
                   │
                   ▼ (Fetches ticker quotes sequentially)
         [Finnhub REST API]
                   │
                   ▼ (Updates Redis Hash & invokes setNewAnchorPrice)
    [setNewAnchorPrice Step-Delta Loop] (Fires 3 times, every 500ms)
                   │
                   ▼ (Updates currentPrices & publishes to Redis)
         [Redis Pub/Sub Channel] 
                   │
                   ▼ (Reads price ticks)
            [Express Server] ──> [Socket.io Client] ──> [React App UI]
            
       [Local Oscillator: 2 Seconds]
                   │
                   ▼ (Calculates mean-reverting wiggle tick)
        [Updates currentPrices] ──> [Redis Pub/Sub] ──> [React App UI]
```

---

## 5. Files Created/Modified

### 1. `backend/src/services/priceIngestionService.js` [NEW]
* **Purpose**: Implements the background quote fetcher.
* **Responsibilities**: Executes fetch loops, spaces requests by 1 second, and triggers re-anchoring hook.

### 2. `backend/src/services/stockService.js` [MODIFY]
* **Purpose**: Simulates wiggles and transitions.
* **Responsibilities**: Runs the 2-second mean-reversion interval and executes the 500ms step-delta transition interval.

### 3. `backend/src/index.js` [MODIFY]
* **Purpose**: Boots API and background processes.
* **Responsibilities**: Initializes `startPriceFetcher` inside the startup listener.

---

## 6. Important Code Explained

### Mean Reversion Logic (`stockService.js`)
```javascript
const theta = 0.05;
// Pull pulls currentPrice toward anchorPrice by 5% of their difference
const meanReversionPull = theta * (anchorPrice - currentPrice);

// Wiggle introduces standard market noise (+/- 0.075%)
const wigglePercentage = (Math.random() - 0.5) * 0.0015;
const randomWiggle = currentPrice * wigglePercentage;

const newPrice = Math.max(0.01, parseFloat((currentPrice + meanReversionPull + randomWiggle).toFixed(2)));
```
* **Why it exists**: Prevents simulated wiggles from drifting away from real stock coordinates.
* **How it works**: Pulls the price toward the anchor, then overlays random noise.

### Step-Delta Transition Smoothing (`stockService.js`)
```javascript
const stepsCount = 3;
const stepDelta = gap / stepsCount;
let currentStep = 0;

const transitionInterval = setInterval(async () => {
  currentStep++;
  if (currentStep >= stepsCount) {
    currentPrices[ticker] = realPrice;
    clearInterval(transitionInterval);
  } else {
    currentPrices[ticker] = parseFloat((currentPrices[ticker] + stepDelta).toFixed(2));
  }
  // Cache and broadcast intermediate tick...
}, 500);
```
* **Why it exists**: Prevents teleportation glitches.
* **How it works**: Divides the gap into 3 steps and steps the price over 1.5 seconds.

---

## 7. Important APIs
* **Internal Action**: Does not expose an external REST API. Runs entirely in the background to update Redis and emit WebSocket signals.

---

## 8. Database Changes
* **Redis Update**: Overwrites HSET `stock:<TICKER>:latest` with real/transition prices.
* **Pub/Sub Channel**: Broadcasts ticks via `stock_updates`.

---

## 9. External Libraries

### `fetch` (Node native)
* **Purpose**: Standard HTTP requests.

---

## 10. Revision Notes
* **Summary**: Real quotes fetched every **2 minutes** $\rightarrow$ sequential 1-second delay $\rightarrow$ wiggles run every **2 seconds** with **5% Mean Reversion pull** $\rightarrow$ gaps closed smoothly over **3 sub-ticks spaced 500ms apart**.

---

## 11. Interview Questions

### Basic
* **Question**: Why can't we fetch stock prices directly from Finnhub every 2 seconds?
* **Answer**: Free accounts are restricted to 60 requests per minute. Fetching quotes for 10 stocks every 2 seconds requires 300 requests per minute, which triggers rate limits and blocks the server.

### Intermediate
* **Question**: What is Mean Reversion in price simulation, and how does it prevent random walk drift?
* **Answer**: A pure random walk drifts away from its starting value over time. Mean reversion adds a mathematical "pull" toward a central mean (in this case, the last real-world anchor). If the price drifts too far, this pull increases, dragging it back.

### Advanced
* **Question**: Explain how the Step-Delta transition smoothing handles potential race conditions if a new anchor arrives while a transition is already in progress.
* **Answer**: If a new anchor arrives during a transition, we clear the previous interval timer to prevent competing step increments, and start a new interval from the current price toward the new anchor.
