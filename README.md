# StockPulse AI — Onboarding & Setup Guide

Welcome to **StockPulse AI**! This MERN stack application provides real-time stock price tracking, live updates via Socket.io, headline queueing using BullMQ, and AI-powered sentiment analysis with Google Gemini. 

---

## 📈 System Architecture

Here is the data and event flow between MERN modules and backing services:

```mermaid
graph TD
    subgraph Client View
        ReactApp[React Client :3000]
    end

    subgraph Backend Core
        ExpressAPI[Express API Server :5000]
        BullMQWorker[BullMQ Worker Process]
        GeminiSDK[Google Gemini AI SDK]
    end

    subgraph Datastores & Queues
        RedisDB[(Redis Cache & ZSET)]
        MongoDB[(MongoDB Persistent Store)]
    end

    ReactApp <-->|Socket.io Live Price Stream| ExpressAPI
    ReactApp -->|1. Submit News Headline| ExpressAPI
    ExpressAPI -->|2. Enqueue Job| RedisDB
    RedisDB -->|3. Dequeue Job| BullMQWorker
    BullMQWorker -->|4. Analyze Content| GeminiSDK
    BullMQWorker -->|5. Save Headline Logs| MongoDB
    BullMQWorker -->|6. Cache Sentiment Score| RedisDB
    ExpressAPI -->|Read Leaderboard cache| RedisDB
    ExpressAPI -->|Read History logs| MongoDB
```

---

## 🛠️ Prerequisites

Before launching the project, ensure you have the following installed on your machine:
* **Node.js** (v18.0.0 or higher)
* **npm** (v9.0.0 or higher)
* **Docker Desktop** (or standalone Docker & Docker Compose)

---

## 🚀 Step-by-Step Setup

### 1. Clone & Set Up Directory
Clone the repository to your local machine:
```bash
git clone https://github.com/your-username/StockPulseAI.git
cd StockPulseAI
```

---

### 2. Launch Backing Services (Docker)
We use Docker Compose to run **MongoDB** and **Redis** containers. Ensure Docker Desktop is active, then spin up the services from the project root:
```bash
docker compose up -d
```
This launches:
* **Redis** (Port `6379`): Handles live price stream queues and caches the Sentiment Leaderboard.
* **MongoDB** (Port `27017`): Stores news articles, logs, and historical sentiment weights.

To verify containers are active:
```bash
docker ps
```

---

### 3. Configure Backend Environment
Navigate to the `backend/` folder:
```bash
cd backend
npm install
```

Create a `.env` file inside the `backend/` directory and configure the environment variables:
```ini
# Backend API Port
PORT=5000

# Redis Database Connection String
REDIS_URL=redis://localhost:6379

# MongoDB Connection String
MONGO_URL=mongodb://localhost:27017/stockpulse_db

# Google Gemini API Key (Required for AI Sentiment processing)
GEMINI_API_KEY=YOUR_GOOGLE_GEMINI_API_KEY_HERE

# NewsAPI API Key (Required for Live News Ingestion)
NEWSAPI_API_KEY=YOUR_NEWSAPI_API_KEY_HERE

# Finnhub API Key (Required for Live Stock Prices)
FINNHUB_API_KEY=YOUR_FINNHUB_API_KEY_HERE

# Price feed simulator source (MOCK / LIVE)
DATA_SOURCE=MOCK
```

> [!TIP]
> You can acquire a free Google Gemini API key by visiting Google AI Studio.

---

### 4. Seed Initial Sentiment Data (Optional)
To seed initial news analysis logs and calculate starting scores, run the seed script:
```bash
node seedHeadlines.js
```

---

### 5. Start Backend Services
You will need to open **two terminal windows** inside the `backend/` folder to run the API and worker processes concurrently.

* **Terminal 1: Start Express API Server**
  ```bash
  node src/index.js
  ```
  *(Server runs on port `5000`)*

* **Terminal 2: Start BullMQ Worker**
  ```bash
  node worker.js
  ```
  *(Listens to headline queues and parses Gemini responses)*

---

### 6. Launch Frontend Client
Open a new terminal window, navigate to the `frontend/` folder, install packages, and start the development server:
```bash
cd frontend
npm install
npm start
```
The React application will launch in your default browser at `http://localhost:3000`.

---

## 📁 Repository Layout

```text
StockPulseAI/
├── backend/
│   ├── src/
│   │   ├── models/        # Mongoose Schema Definitions (Sentiment, etc.)
│   │   ├── queues/        # BullMQ config and Redis client initialization
│   │   ├── services/      # Simulation Services & Decay Calculations
│   │   └── index.js       # Main Express API and Socket.io setup
│   ├── worker.js          # Background BullMQ processing script
│   ├── seedHeadlines.js   # Initial DB seeder utility
│   ├── package.json
│   └── .env               # Secrets configuration (DO NOT COMMIT)
├── frontend/
│   ├── src/
│   │   ├── App.js         # Main Dashboard React component
│   │   ├── index.css      # Core Tailwind styling overrides
│   │   └── index.js
│   ├── package.json
│   └── README.md
├── docs/                  # System & Feature Documentation
│   ├── project-architecture.md # Overall system architecture
│   └── features/          # Onboarding & Revision Guides (01-06)
├── docker-compose.yml     # Backing MongoDB & Redis containers
└── README.md              # Onboarding documentation
```

---

## 📚 Onboarding & Revision Guides

We have compiled detailed system design, request flow, database, and interview prep guides for all major features inside the `docs/` folder:

* **[Project Architecture Overview](docs/project-architecture.md)**: Global layout mapping MERN, Redis ZSETs, BullMQ queue daemons, and Socket.io Pub/Sub channels.
* **[01. Real-time Price Streaming](docs/features/01-realtime-price-stream.md)**: WebSockets and Redis Pub/Sub streaming structure for stock cards.
* **[02. AI Headline Analysis](docs/features/02-ai-headline-analysis.md)**: BullMQ background queues and Google Gemini structural JSON parsing.
* **[03. Sentiment Leaderboard](docs/features/03-sentiment-leaderboard.md)**: Pre-caching ranking scores in Redis Sorted Sets (ZSET).
* **[04. Time-Decay Sentiment Algorithm](docs/features/04-time-decay.md)**: Mathematical 7-day linear decay wiggler calculations.
* **[05. Scheduled Ingestion & Deduplication](docs/features/05-news-fetching.md)**: Automated news fetching, Redis SHA-256 caching, MongoDB TTLs, and API capping.
* **[06. Real Price Ingestion & Smoothing](docs/features/06-real-price-feed.md)**: Finnhub API sequential fetch, Ornstein-Uhlenbeck Mean Reversion wiggles, and step-delta transition wiggler intervals.

