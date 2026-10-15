import crypto from 'crypto';
import dotenv from 'dotenv';
import { newsQueue } from '../queues/queueSetup.js';

dotenv.config();

const tickerKeywords = {
  AAPL: ['apple', 'iphone', 'ipad', 'macbook', 'tim cook', 'app store'],
  TSLA: ['tesla', 'elon musk', 'cybertruck', 'gigafactory', 'model 3', 'model y'],
  GOOGL: ['google', 'alphabet', 'sundar pichai', 'youtube', 'gemini ai', 'deepmind'],
  AMZN: ['amazon', 'jeff bezos', 'aws', 'prime video', 'kindle'],
  MSFT: ['microsoft', 'windows', 'azure', 'satya nadella', 'xbox', 'openai'],
  NVDA: ['nvidia', 'jensen huang', 'blackwell', 'gpus', 'h100', 'ai chip'],
  META: ['meta', 'facebook', 'mark zuckerberg', 'instagram', 'whatsapp', 'llama'],
  NFLX: ['netflix', 'squid game', 'stranger things', 'streaming growth'],
  AMD: ['amd', 'lisa su', 'ryzen', 'radeon', 'epyc'],
  COIN: ['coinbase', 'crypto exchange', 'bitcoin trading', 'ethereum listing', 'brian armstrong']
};

const mockTemplates = [
  { ticker: 'AAPL', title: 'Apple unveils next-generation M-series processors with 35% speed boost', url: 'https://finance.yahoo.com/news/apple-processors' },
  { ticker: 'AAPL', title: 'App Store revenue surges in Europe following developer policy changes', url: 'https://bloomberg.com/news/apple-app-store' },
  { ticker: 'TSLA', title: 'Tesla Cybertruck production hits record high at Giga Texas', url: 'https://reuters.com/news/tesla-cybertruck' },
  { ticker: 'TSLA', title: 'Tesla drops vehicle prices in Europe and China amid margin pressures', url: 'https://wsj.com/news/tesla-prices' },
  { ticker: 'GOOGL', title: 'Google launches advanced Gemini AI models for enterprise cloud users', url: 'https://techcrunch.com/news/google-gemini' },
  { ticker: 'GOOGL', title: 'Antitrust regulators probe Google search monetization strategies', url: 'https://nytimes.com/news/google-probe' },
  { ticker: 'AMZN', title: 'Amazon AWS announces $10 billion cloud datacenter expansion in Ohio', url: 'https://bloomberg.com/news/amazon-aws' },
  { ticker: 'MSFT', title: 'Microsoft Azure cloud growth beats Wall Street forecasts in Q3 report', url: 'https://reuters.com/news/microsoft-azure' },
  { ticker: 'NVDA', title: 'Nvidia Blackwell AI chip shipments reach record targets amid surging demand', url: 'https://wsj.com/news/nvidia-blackwell' },
  { ticker: 'META', title: 'Meta launches open-source LLaMA-4 model challenging proprietary systems', url: 'https://techcrunch.com/news/meta-llama' },
  { ticker: 'NFLX', title: 'Netflix subscriber growth exceeds targets following password sharing checks', url: 'https://nytimes.com/news/netflix-growth' },
  { ticker: 'AMD', title: 'AMD Ryzen processors gain desktop market share over rival architectures', url: 'https://techcrunch.com/news/amd-ryzen' },
  { ticker: 'COIN', title: 'Coinbase trading volume spikes as Bitcoin reaches new institutional highs', url: 'https://bloomberg.com/news/coinbase-crypto' }
];

function generateMockNews() {
  const count = Math.floor(Math.random() * 3) + 3; // 3 to 5 articles
  const selected = [];
  const templatesCopy = [...mockTemplates];
  
  for (let i = 0; i < count; i++) {
    if (templatesCopy.length === 0) break;
    const idx = Math.floor(Math.random() * templatesCopy.length);
    const item = templatesCopy.splice(idx, 1)[0];
    
    selected.push({
      ticker: item.ticker,
      title: `${item.title} (Update #${Math.floor(Math.random() * 900 + 100)})`,
      description: `Detailed report on how ${item.ticker} is navigating these developments.`,
      url: `${item.url}-${Date.now()}-${i}`
    });
  }
  return selected;
}

export async function fetchAndAnalyzeNews(redisClient) {
  console.log(`\n📥 [The Scout] Waking up to fetch news...`);
  
  let rawArticles = [];
  const apiKey = process.env.NEWSAPI_API_KEY;

  if (apiKey) {
    try {
      const query = encodeURIComponent('(Apple OR Tesla OR Google OR Amazon OR Microsoft OR Nvidia OR Meta OR Netflix OR AMD OR Coinbase) AND (stock OR market OR finance OR earnings)');
      const url = `https://newsapi.org/v2/everything?q=${query}&language=en&sortBy=publishedAt&pageSize=40&apiKey=${apiKey}`;
      
      console.log(`🌐 [The Scout] Querying NewsAPI...`);
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'ok' && Array.isArray(data.articles)) {
        rawArticles = data.articles;
        console.log(`✅ [The Scout] Fetched ${rawArticles.length} raw articles from NewsAPI`);
      } else {
        console.warn(`⚠️ [The Scout] NewsAPI returned error or empty. Falling back to mock news. Status: ${data.status || 'unknown'}`);
        rawArticles = generateMockNews();
      }
    } catch (err) {
      console.error(`❌ [The Scout] NewsAPI fetch failed. Falling back to mock news:`, err.message);
      rawArticles = generateMockNews();
    }
  } else {
    console.log(`🔌 [The Scout] Running in MOCK mode. Generating simulated news...`);
    rawArticles = generateMockNews();
  }

  const processedArticles = [];

  for (const article of rawArticles) {
    const title = article.title || '';
    const description = article.description || '';
    const textToMatch = `${title} ${description}`.toLowerCase();
    
    const matchedTickers = [];
    for (const [ticker, keywords] of Object.entries(tickerKeywords)) {
      const matchesKeyword = keywords.some(kw => textToMatch.includes(kw));
      if (matchesKeyword) {
        matchedTickers.push(ticker);
      }
    }

    if (matchedTickers.length === 0 && article.ticker) {
      matchedTickers.push(article.ticker);
    }

    for (const ticker of matchedTickers) {
      processedArticles.push({
        ticker,
        title,
        description,
        url: article.url || title
      });
    }
  }

  console.log(`📊 [The Scout] Keyword matcher resolved ${processedArticles.length} stock-matched articles.`);

  const uniqueArticles = [];

  for (const article of processedArticles) {
    const hash = crypto
      .createHash('sha256')
      .update(`${article.title}-${article.url}`)
      .digest('hex');

    const dedupeKey = `dedupe:news:${hash}`;
    const isUnique = await redisClient.set(dedupeKey, '1', 'NX', 'EX', 172800);

    if (isUnique === 'OK') {
      uniqueArticles.push(article);
    } else {
      console.log(`⏭️ [The Scout] Skipping duplicate: "${article.title.substring(0, 40)}..."`);
    }
  }

  console.log(`✨ [The Scout] Deduplication filtered down to ${uniqueArticles.length} brand-new articles.`);

  if (uniqueArticles.length === 0) {
    console.log(`😴 [The Scout] No new articles to process. Going back to sleep.`);
    return;
  }

  console.log(`📦 [The Scout] Enqueueing conveyor belt job with batch of ${uniqueArticles.length} articles...`);
  await newsQueue.add("analyze_news_batch", {
    articles: uniqueArticles
  });
}

export function startNewsFetcher(redisClient) {
  setTimeout(() => {
    fetchAndAnalyzeNews(redisClient).catch(err => console.error("❌ Initial news fetch failed:", err));
  }, 5000);

  setInterval(() => {
    fetchAndAnalyzeNews(redisClient).catch(err => console.error("❌ Cron news fetch failed:", err));
  }, 60 * 60 * 1000);

  console.log(`🕵️‍♂️ News Ingestion Scout initialized. Polling interval set to 1 hour.`);
}
