import { Worker } from "bullmq";
import Redis from "ioredis";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Sentiment } from "./src/models/Sentiment.js";
import { recalculateDecayedScores } from "./src/services/decayService.js";

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config();

// Connect to MongoDB
const mongoUri = process.env.MONGO_URL || "mongodb://localhost:27017/stockpulse_db";
mongoose.connect(mongoUri)
  .then(() => console.log("👷 Worker connected to MongoDB successfully"))
  .catch(err => console.error("❌ Worker MongoDB connection error:", err));

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const redisOptions = {
  maxRetriesPerRequest: null,
};

if (redisUrl.startsWith('rediss://')) {
  redisOptions.tls = {
    rejectUnauthorized: false
  };
}

const connection = new Redis(redisUrl, redisOptions);
const redisClient = new Redis(redisUrl, redisOptions);

// Initialize Gemini with structured JSON mode
const geminiApiKey = process.env.GEMINI_API_KEY;
const isGeminiAvailable = Boolean(
  geminiApiKey && 
  geminiApiKey !== 'YOUR_GOOGLE_GEMINI_API_KEY_HERE' && 
  geminiApiKey.trim() !== ''
);

const geminiModelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";
let genAI = null;
let model = null;

if (isGeminiAvailable) {
  try {
    genAI = new GoogleGenerativeAI(geminiApiKey);
    model = genAI.getGenerativeModel({ 
      model: geminiModelName,
      generationConfig: { responseMimeType: "application/json" }
    });
    console.log(`👷 AI Worker initialized with Google Gemini (${geminiModelName}).`);
  } catch (err) {
    console.warn(`⚠️ Failed to initialize Gemini model (${err.message}). Falling back to heuristic sentiment.`);
  }
} else {
  console.log(`🔌 AI Worker running in simulated heuristic sentiment mode (No GEMINI_API_KEY provided).`);
}

function analyzeHeuristic(articles) {
  const positiveWords = ['surges', 'boost', 'growth', 'record', 'unveils', 'expansion', 'high', 'beats', 'launches', 'profit', 'partners', 'upgrade', 'spikes'];
  const negativeWords = ['drops', 'probe', 'scrutiny', 'regulatory', 'pressures', 'lawsuit', 'slumps', 'decline', 'loss', 'falls', 'cut', 'warning', 'breach'];

  return articles.map(art => {
    const text = `${art.title || ''} ${art.description || ''}`.toLowerCase();
    let score = 0;
    positiveWords.forEach(w => { if (text.includes(w)) score += 2; });
    negativeWords.forEach(w => { if (text.includes(w)) score -= 2; });

    if (score === 0) {
      score = Math.floor(Math.random() * 5) - 2;
    }
    score = Math.max(-5, Math.min(5, score));

    const direction = score > 0 ? "bullish" : score < 0 ? "bearish" : "neutral";
    return {
      ticker: art.ticker,
      headline: art.title,
      score,
      explanation: `Automated sentiment analysis detected ${direction} market drivers based on headline cues for ${art.ticker}.`
    };
  });
}

const worker = new Worker(
  "news_analysis_queue",
  async (job) => {
    let articles = [];
    if (job.data.articles) {
      articles = job.data.articles;
    } else if (job.data.ticker && job.data.headline) {
      articles = [{
        ticker: job.data.ticker,
        title: job.data.headline,
        description: "",
        url: ""
      }];
    }

    if (articles.length === 0) {
      return { success: false, error: "Empty batch payload" };
    }

    console.log(`\n📥 [Job ${job.id}] Batch Analyzing ${articles.length} news articles`);

    let results = [];

    if (model) {
      try {
        const prompt = `
          You are an expert financial analyst. Analyze the following list of news headlines.
          For each news item:
          1. Determine if this news is likely to cause the stock price of that ticker to increase or drop.
          2. Assign a sentiment score on a scale from -5 (Bearish/Negative) to +5 (Bullish/Positive).
          3. Provide a clear, detailed, 1-2 sentence explanation of why the price will increase or drop based on the news details.
          
          HEADLINES:
          ${articles.map((art, idx) => `${idx + 1}. [Ticker: ${art.ticker}] Headline: "${art.title}"`).join('\n')}
          
          You MUST return a JSON array of objects matching this exact schema:
          [
            {
              "ticker": "string",
              "headline": "string",
              "score": number,
              "explanation": "string"
            }
          ]
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const textOutput = response.text().trim();
        results = JSON.parse(textOutput);
        console.log(`✅ [Job ${job.id}] Gemini (${geminiModelName}) analyzed batch of ${results.length} items`);
      } catch (err) {
        console.warn(`⚠️ Gemini API error in job ${job.id} (${err.message}). Using heuristic analysis.`);
        results = analyzeHeuristic(articles);
      }
    } else {
      results = analyzeHeuristic(articles);
    }

    for (const item of results) {
      const sentimentScore = parseInt(item.score) || 0;
      const explanation = item.explanation || "No explanation provided.";

      console.log(`📊 AI Score for ${item.ticker}: ${sentimentScore}`);
      console.log(`💡 Rationale: ${explanation}`);

      // 1. Save the analyzed news to MongoDB
      const newSentiment = await Sentiment.create({
        ticker: item.ticker,
        headline: item.headline,
        score: sentimentScore,
        explanation
      });

      // 2. Broadcast the rich update to Redis Pub/Sub channel
      const broadcastPayload = JSON.stringify({
        id: newSentiment._id,
        ticker: item.ticker,
        headline: item.headline,
        score: sentimentScore,
        explanation,
        timestamp: newSentiment.timestamp
      });
      await redisClient.publish("sentiment_updates", broadcastPayload);
    }

    // 3. Trigger instant recalculation of time-decayed scores in Redis ZSET
    await recalculateDecayedScores(redisClient);

    return { success: true, count: results.length };
  },
  { connection }
);

worker.on("completed", (job) => console.log(`🏁 Job ${job.id} completed!`));
worker.on("failed", (job, err) => console.error(`❌ Job ${job.id} failed:`, err));