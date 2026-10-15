import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import cors from 'cors';
import { startStockSimulation } from './services/stockService.js';
import { newsQueue } from './queues/queueSetup.js'; 
import { Sentiment } from './models/Sentiment.js';
import { recalculateDecayedScores } from './services/decayService.js';
import { startNewsFetcher } from './services/newsFetcher.js';
import { startPriceFetcher } from './services/priceIngestionService.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

// Conditionally spawn worker in the same process if configured (defaults to true)
if (process.env.RUN_WORKER_IN_PROCESS !== 'false') {
  import('../worker.js').catch(err => console.error("Worker in-process start error:", err));
}

const app = express();
const server = http.createServer(app);

const allowedOrigin = process.env.CORS_ORIGIN || "*";
const corsConfig = {
  origin: allowedOrigin === '*' ? '*' : allowedOrigin.split(','),
  methods: ["GET", "POST"]
};

const io = new Server(server, { cors: corsConfig });

app.use(cors(corsConfig));
app.use(express.json());

// 1. Initialize Redis Connection
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redisOptions = {
  maxRetriesPerRequest: null
};

if (redisUrl.startsWith('rediss://')) {
  redisOptions.tls = {
    rejectUnauthorized: false
  };
}

const redis = new Redis(redisUrl, redisOptions);
const subscriber = new Redis(redisUrl, redisOptions);

redis.on('connect', () => {
  console.log('Connected to Redis successfully');
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

// Socket.io connection & Redis Subscription
io.on('connection', (socket) => {
  console.log('🔗 Client connected to socket');
});

// Listen to Redis channels and emit to Socket.io
subscriber.subscribe("stock_updates");
subscriber.subscribe("stock_updates_batch");
subscriber.subscribe("sentiment_updates");
subscriber.on("message", (channel, message) => {
  try {
    const data = JSON.parse(message);
    if (channel === "stock_updates") {
      io.emit("price_update", data);
    } else if (channel === "stock_updates_batch") {
      io.emit("price_batch_update", data);
    } else if (channel === "sentiment_updates") {
      io.emit("sentiment_update", data);
    }
  } catch (err) {
    console.error("❌ Redis subscriber message error:", err);
  }
});

// 2. Initialize MongoDB Connection
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URL || 'mongodb://localhost:27017/stockpulse_db';
    await mongoose.connect(mongoUri);
    console.log(`Connected to MongoDB: ${mongoose.connection.name}`);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// 3. Health Check Endpoint
// This ensures both databases are active before we start building heavy logic.
app.get('/health', async (req, res) => {
  try {
    // We send a heartbeat to Redis to get a "PONG" response
    const redisPing = await redis.ping();
    
    // Check MongoDB connection state (1 means connected)
    const mongoState = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';

    res.status(200).json({
      status: 'Healthy',
      redis: redisPing === 'PONG' ? 'Connected (PONG)' : 'Disconnected',
      mongo: mongoState,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Database connection failed' });
  }
});


// 4. Initial Load Endpoint (Fetching the HSET Cache)
// When the React app opens, it calls this to prevent the "Blank Screen"
app.get('/api/stocks', async (req, res) => {
  try {
    const tickers = ['AAPL', 'TSLA', 'GOOGL', 'AMZN', 'MSFT', 'NVDA', 'META', 'NFLX', 'AMD', 'COIN'];
    const stockData = [];

    // We fetch the latest cached data for each stock in O(1) time
    for (const ticker of tickers) {
      // HGETALL pulls the entire Hash object for this specific ticker
      const data = await redis.hgetall(`stock:${ticker}:latest`);
      
      // If the key exists, Redis returns the object. If not, it returns an empty object {}
      if (data && data.price) {
        stockData.push({
          ticker,
          price: parseFloat(data.price),
          timestamp: data.timestamp
        });
      }
    }

    res.status(200).json({
      success: true,
      data: stockData
    });
  } catch (error) {
    console.error("Error fetching stocks:", error);
    res.status(500).json({ error: 'Failed to fetch live prices' });
  }
});



// 5. Submit News for AI Analysis Endpoint (The Producer)
// This drops a job into BullMQ and responds instantly.
app.post('/api/analyze', async (req, res) => {
  try {
    const { ticker, headline } = req.body;

    if (!ticker || !headline) {
      return res.status(400).json({ error: "Please provide 'ticker' and 'headline'" });
    }

    // Add job to BullMQ
    const job = await newsQueue.add("analyze_headline", {
      ticker,
      headline
    });

    res.status(202).json({
      success: true,
      message: "Headline queued for AI analysis",
      jobId: job.id
    });
  } catch (error) {
    console.error("Error queueing job:", error);
    res.status(500).json({ error: 'Failed to queue analysis' });
  }
});



// 6. Get the Live Sentiment Leaderboard (Sorted Sets)
// This fetches the pre-calculated time-decayed scores from the Redis ZSET.
app.get('/api/leaderboard', async (req, res) => {
  try {
    // ZREVRANGE fetches elements from highest to lowest score.
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
    console.error("Error fetching leaderboard:", error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// 7. Get historical news sentiment log (Capped to 30 items)
app.get('/api/news', async (req, res) => {
  try {
    const news = await Sentiment.find().sort({ timestamp: -1 }).limit(30);
    res.status(200).json({
      success: true,
      data: news
    });
  } catch (error) {
    console.error("Error fetching news:", error);
    res.status(500).json({ error: 'Failed to fetch news history' });
  }
});



// 4. Start the Server
const PORT = process.env.PORT || 5000;

server.listen(PORT, async () => {
  await connectDB(); // Connect to Mongo right before the server starts listening

  // 1. Initial calculation of time-decayed stock scores on boot
  await recalculateDecayedScores(redis);

  // 2. Schedule background recalculation every 5 minutes
  setInterval(() => {
    recalculateDecayedScores(redis).catch(err => console.error("Cron decay calculation error:", err));
  }, 5 * 60 * 1000);

  // Start our live price engine, passing in our active Redis connection!
  startStockSimulation(redis); 

  // Initialize and start the real stock price ingestion feed!
  startPriceFetcher(redis);

  // Initialize and start the News Ingestion Scout!
  startNewsFetcher(redis);

  console.log(`StockPulse API running on http://localhost:${PORT}`);
});

// Graceful shutdown handling
const handleShutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}. Gracefully shutting down server...`);
  server.close(async () => {
    try {
      await mongoose.connection.close();
      await redis.quit();
      await subscriber.quit();
      console.log('✅ Databases and sockets closed cleanly. Exiting.');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));