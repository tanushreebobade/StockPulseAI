import mongoose from 'mongoose';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Sentiment } from './src/models/Sentiment.js';
import { recalculateDecayedScores } from './src/services/decayService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config();

const redisOptions = {
  maxRetriesPerRequest: null,
};

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
if (redisUrl.startsWith('rediss://')) {
  redisOptions.tls = {
    rejectUnauthorized: false
  };
}
const redisClient = new Redis(redisUrl, redisOptions);

const headlines = [
  // APPLE (AAPL)
  {
    ticker: 'AAPL',
    headline: 'Apple launches high-end AR glasses with cutting-edge optical displays, beating competitor release schedules.',
    score: 4,
    explanation: 'The successful release of high-end AR glasses establishes Apple as a leader in spatial computing, driving new hardware revenue streams.',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000) // 4 hours ago
  },
  {
    ticker: 'AAPL',
    headline: 'Apple iPhone 16 sales surge in Asian markets, exceeding holiday quarter analyst expectations by 12%.',
    score: 3,
    explanation: 'Strong smartphone demand in key global markets sustains Apple\'s core revenue driver and increases consumer ecosystem lock-in.',
    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
  },
  {
    ticker: 'AAPL',
    headline: 'Apple faces regulatory scrutiny in Europe over App Store dominance and anti-steering policies.',
    score: -3,
    explanation: 'European antitrust investigations present legal and financial risks, potentially forcing Apple to lower lucrative App Store fees.',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
  },
  {
    ticker: 'AAPL',
    headline: 'Apple display panel suppliers report production delays due to component shortages.',
    score: -2,
    explanation: 'Display panel shortages threaten hardware delivery schedules and could impact short-term unit sales metrics.',
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
  },

  // TESLA (TSLA)
  {
    ticker: 'TSLA',
    headline: 'Tesla reports blowout quarterly vehicle delivery numbers, up 25% year-over-year, beating Wall Street expectations.',
    score: 5,
    explanation: 'Surpassing vehicle delivery expectations highlights strong global demand and operating efficiency, directly driving revenue growth.',
    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
  },
  {
    ticker: 'TSLA',
    headline: 'Tesla secures full regulatory approval for Autopilot driver assist software expansion in China.',
    score: 4,
    explanation: 'Entering the competitive Chinese market with high-margin software subscriptions opens massive recurring revenue streams.',
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
  },
  {
    ticker: 'TSLA',
    headline: 'Tesla delays Cybertruck production expansion due to 4680 battery pack assembly constraints.',
    score: -2,
    explanation: 'Battery supply bottlenecks delay scaling of a high-profile vehicle line, threatening short-term production growth and margin targets.',
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
  },
  {
    ticker: 'TSLA',
    headline: 'Tesla suspends Gigafactory Berlin assembly lines temporarily to perform factory retooling.',
    score: -1,
    explanation: 'Retooling assembly lines causes minor delivery delays, though it sets up the plant for higher long-term production efficiencies.',
    timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) // 6 days ago
  },

  // GOOGLE (GOOGL)
  {
    ticker: 'GOOGL',
    headline: 'Google Cloud secures multi-billion dollar AI infrastructure hosting contract with global banking alliance.',
    score: 4,
    explanation: 'Securing massive enterprise AI hosting contracts accelerates Google Cloud growth and increases its competitive moat against competitors.',
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000) // 6 hours ago
  },
  {
    ticker: 'GOOGL',
    headline: 'Google DeepMind releases next-generation medical AI model capable of diagnosing complex imaging results.',
    score: 5,
    explanation: 'Pioneering specialized medical AI models cements Google as an industry-first leader, creating massive licensing opportunities.',
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
  },
  {
    ticker: 'GOOGL',
    headline: 'DoJ antitrust trial against Google\'s ad technology division officially begins.',
    score: -4,
    explanation: 'Federal antitrust lawsuits create significant regulatory overhead and risk a potential court-ordered breakup of Google\'s core advertising business.',
    timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) // 4 days ago
  },
  {
    ticker: 'GOOGL',
    headline: 'Google software engineering groups threaten strikes over return-to-office mandate policies.',
    score: -1,
    explanation: 'Employee labor disputes present minor operational disruptions and reputational friction inside engineering divisions.',
    timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) // 6 days ago
  },

  // AMAZON (AMZN)
  {
    ticker: 'AMZN',
    headline: 'Amazon Prime Day sales break all historical records, totaling an estimated $14.2 billion globally.',
    score: 4,
    explanation: 'Record-breaking consumer spending volumes lift retail margins and demonstrate strong retail marketplace health.',
    timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000) // 12 hours ago
  },
  {
    ticker: 'AMZN',
    headline: 'Amazon Web Services launches new ultra-efficient custom AI chips for cloud computing.',
    score: 3,
    explanation: 'Custom silicon reduces chip dependency and energy overhead, improving margins and attracting budget-conscious AI cloud customers.',
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
  },
  {
    ticker: 'AMZN',
    headline: 'Amazon faces safety citations and fines from federal warehouse labor regulators.',
    score: -2,
    explanation: 'Safety investigations invite negative publicity and could raise operating and fulfillment insurance costs over time.',
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
  },
  {
    ticker: 'AMZN',
    headline: 'FTC files expanded antitrust lawsuit targeting Amazon\'s merchant pricing policies.',
    score: -3,
    explanation: 'Federal marketplace lawsuits threaten Amazon\'s seller commissions structures, presenting risk to services margins.',
    timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) // 6 days ago
  },

  // MICROSOFT (MSFT)
  {
    ticker: 'MSFT',
    headline: 'Microsoft integrates advanced co-pilot features across office suites, boosting enterprise subscriber ARPU.',
    score: 4,
    explanation: 'Expanding premium AI tooling driving enterprise subscription upgrades, immediately boosting monthly recurring revenue.',
    timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000) // 12 hours ago
  },
  {
    ticker: 'MSFT',
    headline: 'Microsoft announces expanded multi-billion dollar capital partnership with OpenAI to build data centers.',
    score: 5,
    explanation: 'Solidifying backend access to leading AI tech maintains Azure\'s hyper-scale developer appeal and drives cloud computing contracts.',
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
  },
  {
    ticker: 'MSFT',
    headline: 'Microsoft Azure cloud services report localized service outages affecting corporate customers.',
    score: -3,
    explanation: 'Cloud infrastructure outages disrupt enterprise operations, raising SLA refund risks and creating reputational friction.',
    timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) // 4 days ago
  },
  {
    ticker: 'MSFT',
    headline: 'Microsoft Surface hardware division reports 15% decline in personal computing sales.',
    score: -2,
    explanation: 'Hardware volume declines represent secular weakness in consumer PC markets, though Microsoft remains heavily software-focused.',
    timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) // 6 days ago
  },

  // NVIDIA (NVDA)
  {
    ticker: 'NVDA',
    headline: 'Nvidia next-gen Blackwell GPU architecture reports sold out capacity for the next three quarters.',
    score: 5,
    explanation: 'Extremely high demand and backlog for AI processing chips guarantees sustained record revenue and margin dominance.',
    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
  },
  {
    ticker: 'NVDA',
    headline: 'Nvidia data center segment exceeds estimates, driven by hyper-scale enterprise infrastructure builds.',
    score: 4,
    explanation: 'Robust data center hardware orders confirm sustained enterprise spend on AI infrastructure pipelines.',
    timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000) // 12 hours ago
  },
  {
    ticker: 'NVDA',
    headline: 'Competitor AMD launches rival server accelerators undercutting Nvidia pricing guidelines.',
    score: -2,
    explanation: 'New market competition from AMD could squeeze pricing premiums, though Nvidia holds a massive developer platform moat.',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
  },
  {
    ticker: 'NVDA',
    headline: 'Federal trade regulators expand export licensing rules for advanced graphics chips to Middle East regions.',
    score: -3,
    explanation: 'Geopolitical export restrictions reduce addressable market volumes for ultra-high-end AI hardware accelerators.',
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
  },

  // META (META)
  {
    ticker: 'META',
    headline: 'Meta releases open-source Llama 4 models, claiming parity with proprietary frontier systems.',
    score: 3,
    explanation: 'Leading open-source AI development positions Meta as a default framework choice, reducing proprietary API dependencies.',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
  },
  {
    ticker: 'META',
    headline: 'Meta Instagram and Facebook advertising revenues exceed consensus, rising 18% year-over-year.',
    score: 4,
    explanation: 'Strong ad engagement metrics and video monetization tools sustain Meta\'s core cash flow machine.',
    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
  },
  {
    ticker: 'META',
    headline: 'Meta lowers internal hardware shipment targets for its high-end VR consumer headsets.',
    score: -2,
    explanation: 'Lower virtual reality consumer interest delays Meta\'s plans to expand its hardware platform sales base.',
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
  },
  {
    ticker: 'META',
    headline: 'EU privacy watchdogs fine Meta over user data transfer compliance structures.',
    score: -3,
    explanation: 'European regulatory penalties present financial liabilities and highlight complex global user tracking policy changes.',
    timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) // 6 days ago
  },

  // NETFLIX (NFLX)
  {
    ticker: 'NFLX',
    headline: 'Netflix subscriber growth slows down in mature markets as password-sharing crackdown benefits tap out.',
    score: -2,
    explanation: 'Decelerating user growth forces reliance on price hikes or ad tiers, creating pressure on short-term valuation multiples.',
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
  },
  {
    ticker: 'NFLX',
    headline: 'Netflix releases record-breaking hit series, driving massive global user signups.',
    score: 3,
    explanation: 'Pop culture content wins confirm Netflix\'s strong production capability and maintain low user cancelation rates.',
    timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000) // 12 hours ago
  },
  {
    ticker: 'NFLX',
    headline: 'Netflix password-sharing crackdown benefits begin to flatten out.',
    score: -1,
    explanation: 'Fewer easy growth drivers force focus on advertising tier expansion to sustain metrics.',
    timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) // 4 days ago
  },
  {
    ticker: 'NFLX',
    headline: 'Netflix advertising tier membership doubles in user volume since last quarter report.',
    score: 4,
    explanation: 'Sustained user growth inside ad tiers creates high-value ad inventory, expanding non-subscriber revenues.',
    timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) // 6 days ago
  },

  // AMD (AMD)
  {
    ticker: 'AMD',
    headline: 'AMD signs new custom processor contracts for next-generation consumer console hardware.',
    score: 3,
    explanation: 'Sustained custom chip design wins secure baseline revenue volumes and solidifies AMDs gaming segment leadership.',
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
  },
  {
    ticker: 'AMD',
    headline: 'AMD launches competitor AI server chip, actively challenging competitor data center models.',
    score: 4,
    explanation: 'Offering capable AI hardware chips positions AMD as a key secondary enterprise chip choice.',
    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
  },
  {
    ticker: 'AMD',
    headline: 'Consumer PC processor segments report minor shipment deceleration.',
    score: -2,
    explanation: 'Slowing client PC sales volume restricts consumer chip earnings metrics.',
    timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) // 6 days ago
  },
  {
    ticker: 'AMD',
    headline: 'AMD secures enterprise Epyc processor design wins at hyper-scale hosting partners.',
    score: 3,
    explanation: 'Steadily increasing corporate server processor shares expands high-margin product segment revenues.',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
  },

  // COINBASE (COIN)
  {
    ticker: 'COIN',
    headline: 'Coinbase records highest daily trading volumes of the year amid high cryptocurrency volatility.',
    score: 4,
    explanation: 'Increased trading volume directly boosts transaction commission revenue and retail platform engagement levels.',
    timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000) // 18 hours ago
  },
  {
    ticker: 'COIN',
    headline: 'Coinbase wins operating licenses in key European jurisdictions, expanding its retail footprint.',
    score: 3,
    explanation: 'Regulatory approvals in European markets open up high-value demographics under standardized frameworks.',
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
  },
  {
    ticker: 'COIN',
    headline: 'Coinbase institutional custody vaults report 100% expansion in digital assets under storage.',
    score: 4,
    explanation: 'Large institutional custody deposits increase sticky asset bases, boosting recurrent storage fees metrics.',
    timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) // 6 days ago
  },
  {
    ticker: 'COIN',
    headline: 'SEC dispute over decentralized staking products remains unresolved in federal courts.',
    score: -3,
    explanation: 'Ongoing lawsuits create regulatory overhead and threaten secondary staking commissions revenues.',
    timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) // 4 days ago
  }
];

async function seed() {
  try {
    const mongoUri = process.env.MONGO_URL || 'mongodb://localhost:27017/stockpulse_db';
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB...");
    
    // Clear old records to start fresh
    await Sentiment.deleteMany({});
    console.log("Cleared old sentiments.");

    // Insert new headlines
    await Sentiment.insertMany(headlines);
    console.log(`Inserted ${headlines.length} mock headlines.`);

    // Recalculate decayed scores and write to Redis ZSET
    await recalculateDecayedScores(redisClient);

    console.log("Seeding complete! Refresh your dashboard.");
    process.exit(0);
  } catch (err) {
    console.error("Seeding failed:", err);
    process.exit(1);
  }
}

seed();
