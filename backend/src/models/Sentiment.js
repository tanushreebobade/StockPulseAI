import mongoose from 'mongoose';

const SentimentSchema = new mongoose.Schema({
  ticker: { 
    type: String, 
    required: true, 
    index: true 
  },
  headline: { 
    type: String, 
    required: true 
  },
  score: { 
    type: Number, 
    required: true 
  },
  explanation: { 
    type: String, 
    required: true 
  },
  timestamp: { 
    type: Date, 
    default: Date.now, 
    index: true,
    expires: '7d' 
  }
});

// Create compound index for instant timelines inside stock drawers
SentimentSchema.index({ ticker: 1, timestamp: -1 });

export const Sentiment = mongoose.model('Sentiment', SentimentSchema);
