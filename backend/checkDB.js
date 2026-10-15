import mongoose from 'mongoose';
import { Sentiment } from './src/models/Sentiment.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config();

const mongoUri = process.env.MONGO_URL || 'mongodb://localhost:27017/stockpulse_db';
mongoose.connect(mongoUri)
  .then(async () => {
    const count = await Sentiment.countDocuments();
    console.log(`\n📊 Total news items in MongoDB: ${count}`);
    
    if (count > 0) {
      const items = await Sentiment.find().sort({ timestamp: -1 }).limit(3);
      console.log("🔍 Latest items in database:");
      console.log(JSON.stringify(items, null, 2));
    } else {
      console.log("ℹ️ No news items found in the database yet.");
    }
    process.exit(0);
  })
  .catch(err => {
    console.error("Connection error:", err);
    process.exit(1);
  });
