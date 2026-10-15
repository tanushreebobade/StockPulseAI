# Stock Price Simulation & Streaming Feature Guide

This guide details the implementation of the real-time stock price simulation engine, caching setup, and the streaming architecture that broadcasts live ticks to the frontend.

---

## 1. Overview
* **Problem**: Simulating real-time financial market movements on a dashboard without hitting rate-limited external financial APIs or WebSocket servers.
* **Why**: To populate the stock watchlist with dynamic, real-time data ticks (updates every 2 seconds) and draw sparklines in the browser.
* **High-Level Workflow**:
  - The background price simulator (`stockService.js`) updates 10 stock prices every 2 seconds.
  - Prices are cached in Redis `HASH` structures and published to a Redis Pub/Sub channel (`stock_updates`).
  - The main Express server subscribes to the channel and broadcasts price updates to the React client via Socket.io.
  - The React frontend receives price ticks, flashes cards to show positive/negative direction, and stores history to draw SVG sparklines.

---

## 2. Requirements

### Functional
* Update stock prices for 10 active tickers (`AAPL`, `TSLA`, `GOOGL`, etc.) every 2 seconds.
* Cache the latest price and timestamp for initial loads.
* Broadcast updates instantly to all connected clients.
* Animate direction shifts (green flash for price increases, red flash for decreases) in the UI.
* Maintain a scrolling history of the latest 30 ticks to draw sparkline charts in the UI.

### Non-Functional
* Price updates must have sub-second latency.
* Client updates must use efficient web sockets instead of HTTP polling.
* Read operations on initial load must be $O(1)$ to avoid slowing down database connections.

### Edge Cases
* **Missing Cache on Boot**: If the server restarts, initial loads fetch blank states until the first tick. Resolved by running the price simulator immediately on server startup.
* **Connection Drops**: If the WebSocket disconnects, the client shows a status badge and reconnects automatically.

---

## 3. Design Decisions

### A. Redis Pub/Sub vs Direct WebSockets in Simulators
* **Decision**: Simulator writes to a Redis channel, and the Express HTTP server acts as a subscriber to emit WebSocket events.
* **Alternative**: Binding Socket.io directly to the stock simulator loop.
* **Reason for Rejection**: Directly binding Socket.io to the stock simulation logic tightly couples the business logic with the transport layer, making it difficult to scale the API server horizontally. By routing ticks through Redis Pub/Sub, we can run multiple API server instances behind a load balancer, and they will all receive the same price feed from the Redis channel.

### B. Redis Hashes (`HSET`) for Stock Price Cache
* **Decision**: Storing each stock's latest status in its own Redis Hash `stock:<TICKER>:latest`.
* **Alternative**: Storing as a stringified JSON key `stock:<TICKER>`.
* **Reason for Rejection**: Retrieving specific fields (price or timestamp) from a string requires parsing the entire JSON payload. A Redis Hash allows updating and fetching sub-fields atomically and efficiently.

---

## 4. Architecture

```text
[Simulator Loop] 
      │ (Calculates new price)
      ├──> [Redis Hash HSET] (Persists latest state)
      └──> [Redis Pub/Sub Channel] (Publishes stock_updates)
                │
                v
       [Express Server] (Subscribed to stock_updates channel)
                │
                v (Emits price_update)
        [Socket.io WS]
                │
                v
         [React Client] (Receives tick, flashes UI, updates sparkline state)
```

### Execution Sequence
1. The server boots and executes `startStockSimulation(redis)`.
2. A `setInterval` runs every 2 seconds.
3. For each of the 10 tickers, a random fluctuation ($\pm 0.5\%$) is applied.
4. The new price is saved to Redis using `HSET` and published to channel `stock_updates`.
5. The Redis subscriber in `index.js` receives the message and triggers `io.emit("price_update", data)`.
6. The React client receives the update, calculates direction, triggers flash CSS animations, and adds the price to the sparkline array.

---

## 5. Files Involved

### 1. `backend/src/services/stockService.js`
* **Purpose**: Simulates price fluctuations and manages Redis writes.
* **Responsibilities**: Defines the 10 core stock assets, runs the interval loop, updates HSET cache, and publishes Pub/Sub ticks.

### 2. `backend/src/index.js`
* **Purpose**: Hosts HTTP server and initializes socket.io.
* **Responsibilities**: Boots database connection, sets up Redis Pub/Sub listeners, and runs WebSocket event dispatches.

### 3. `frontend/src/App.js`
* **Purpose**: Renders UI dashboard.
* **Responsibilities**: Mounts Socket.io listeners, triggers visual flash animations, and stores tick arrays.

---

## 6. Important Code Explained

### The Price Simulator Loop (`stockService.js`)
```javascript
export function startStockSimulation(redisClient) {
  // Run loop every 2 seconds
  setInterval(async () => {
    for (const ticker of tickers) {
      const currentPrice = currentPrices[ticker];
      
      // Calculate random price fluctuation (-0.5% to +0.5%)
      const percentageChange = (Math.random() - 0.5) * 0.01;
      const priceDelta = currentPrice * percentageChange;
      const newPrice = Math.max(0.01, parseFloat((currentPrice + priceDelta).toFixed(2)));
      
      currentPrices[ticker] = newPrice;
      const timestamp = new Date().toISOString();

      // 1. Cache latest values in a Redis Hash
      await redisClient.hset(`stock:${ticker}:latest`, {
        price: newPrice,
        timestamp
      });

      // 2. Publish the tick to Redis Pub/Sub channel
      await redisClient.publish("stock_updates", JSON.stringify({
        ticker,
        price: newPrice,
        timestamp
      }));
    }
  }, 2000);
}
```
* **Why it exists**: It generates the core tick data.
* **How it works**: By saving to HSET *and* publishing to the channel, we ensure new connections immediately get the last cached price, while active sessions receive the real-time stream.

---

## 7. Important APIs

### A. Fetch Stock Initial Prices
* **Method**: `GET`
* **Route**: `/api/stocks`
* **Response (Success - 200)**:
  ```json
  {
    "success": true,
    "data": [
      { "ticker": "AAPL", "price": 178.43, "timestamp": "2026-07-02T12:00:00.000Z" }
    ]
  }
  ```
* **Error Handling**: Wraps the Redis connection call in a `try/catch` and returns a `500` status on failure.

---

## 8. Database Changes
* **Redis Structures**:
  - `stock:<TICKER>:latest` (Hash): Stores fields `price` and `timestamp`.
  - Pub/Sub Channel: `stock_updates`.

---

## 9. External Libraries

### `socket.io` & `socket.io-client`
* **Purpose**: Establishes WebSockets between MERN server and browser.
* **Important Functions**: `io.on('connection')`, `socket.emit()`, `socket.on()`.

### `ioredis`
* **Purpose**: Accesses Redis commands.
* **Important Functions**: `hset()`, `hgetall()`, `publish()`, `subscribe()`.

---

## 10. Revision Notes
* **Summary**: Stocks generate updates every 2 seconds $\rightarrow$ written to Redis HSET & Published $\rightarrow$ Express Subscriber receives tick $\rightarrow$ Socket.io pushes to React client $\rightarrow$ UI flashes green/red.

---

## 11. Interview Questions

### Basic
* **Question**: Why did you use WebSockets instead of HTTP polling to display price updates?
* **Answer**: HTTP polling creates massive network overhead because the client must repeatedly send headers to the server every 2 seconds. WebSockets establish a single persistent connection, allowing the server to push updates instantly with sub-millisecond overhead.

### Intermediate
* **Question**: If you run multiple instances of the Express backend in production, how will the WebSocket clients receive the price updates if the simulator is only running on one backend instance?
* **Answer**: We use **Redis Pub/Sub**. The simulator publishes updates to a Redis channel. Every Express API instance subscribes to this channel. When an update is published, Redis broadcasts it to all Express subscribers, which in turn push it to their locally connected clients.

### Advanced
* **Question**: How would you handle backpressure if the stock ticks were generated at 1,000 messages per second instead of 0.5 per second?
* **Answer**: We would implement **client-side batching and throttling**. Instead of pushing every single tick over the WebSocket, the server would accumulate ticks and send them in batches (e.g., every 100ms), or the client would throttle rendering to avoid overloading the browser's DOM paint cycles.
