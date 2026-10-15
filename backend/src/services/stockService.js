const startPrices = {
  AAPL: 180.50,
  TSLA: 220.30,
  GOOGL: 145.80,
  AMZN: 175.20,
  MSFT: 420.60,
  NVDA: 850.10,
  META: 490.40,
  NFLX: 610.90,
  AMD: 170.20,
  COIN: 245.50
};

const anchorPrices = { ...startPrices };
const currentPrices = { ...startPrices };
let globalRedisClient = null;

// The step-delta transition function (Closes jumps smoothly over 3 steps spaced 500ms apart)
export function setNewAnchorPrice(ticker, realPrice) {
  // Update base anchor coordinate
  anchorPrices[ticker] = realPrice;
  
  const currentPrice = currentPrices[ticker];
  const gap = realPrice - currentPrice;
  
  // If the gap is insignificant, snap immediately and skip interval overhead
  if (Math.abs(gap) < 0.05) {
    currentPrices[ticker] = realPrice;
    return;
  }
  
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
    
    const timestamp = new Date().toISOString();
    const priceString = currentPrices[ticker].toFixed(2);
    
    if (globalRedisClient) {
      // 1. Cache intermediate price step in Redis HASH
      await globalRedisClient.hset(`stock:${ticker}:latest`, {
        price: priceString,
        timestamp
      });
      
      // 2. Broadcast the smooth intermediate tick
      await globalRedisClient.publish("stock_updates", JSON.stringify({
        ticker,
        price: parseFloat(priceString),
        timestamp
      }));
    }
  }, 500);
}

export function startStockSimulation(redisClient) {
  globalRedisClient = redisClient;
  console.log("🧪 Running Mean-Reverting Stock Price Simulator...");

  setInterval(async () => {
    const batchUpdates = [];

    for (const ticker of Object.keys(currentPrices)) {
      const currentPrice = currentPrices[ticker];
      const anchorPrice = anchorPrices[ticker];
      
      // 1. Ornstein-Uhlenbeck Pull: 5% gravity back toward the anchor coordinate
      const theta = 0.05;
      const meanReversionPull = theta * (anchorPrice - currentPrice);
      
      // 2. Random Market Noise: wiggles within +/-0.075% of current price
      const wigglePercentage = (Math.random() - 0.5) * 0.0015;
      const randomWiggle = currentPrice * wigglePercentage;
      
      // 3. Apply formula and round
      const newPrice = Math.max(0.01, parseFloat((currentPrice + meanReversionPull + randomWiggle).toFixed(2)));
      currentPrices[ticker] = newPrice;
      const timestamp = new Date().toISOString();

      // Cache latest simulated values
      await redisClient.hset(`stock:${ticker}:latest`, {
        price: newPrice.toFixed(2),
        timestamp
      });

      // Add to batch payload
      batchUpdates.push({
        ticker,
        price: newPrice,
        timestamp
      });
    }

    // Broadcast the entire watchlist updates together in a single Redis message
    await redisClient.publish("stock_updates_batch", JSON.stringify(batchUpdates));
  }, 2000);
}