import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, 
  Newspaper, 
  CheckCircle2, 
  XCircle,
  RefreshCw, 
  ChevronUp, 
  ChevronDown, 
  Brain,
  History,
  TrendingUp,
  TrendingDown,
  Layers,
  Coins,
  BarChart3,
  Clock,
  Gauge
} from 'lucide-react';

const socket = io(process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000');
const API_BASE = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const companyNames = {
  AAPL: 'Apple Inc.',
  TSLA: 'Tesla Inc.',
  GOOGL: 'Alphabet Inc.',
  AMZN: 'Amazon Inc.',
  MSFT: 'Microsoft Corp.',
  NVDA: 'Nvidia Corp.',
  META: 'Meta Platforms',
  NFLX: 'Netflix Inc.',
  AMD: 'Advanced Micro Devices',
  COIN: 'Coinbase Global'
};

// SVG Sparkline Component (Upgraded styling)
function Sparkline({ history, isUp }) {
  if (!history || history.length < 2) {
    return (
      <div className="h-6 flex items-center justify-center text-[10px] text-premium-textMuted font-mono font-medium">
        Awaiting ticks
      </div>
    );
  }
  
  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max - min === 0 ? 1 : max - min;
  
  const points = history.map((price, idx) => {
    const x = (idx * (100 / (history.length - 1))).toFixed(1);
    const y = (26 - ((price - min) / range) * 18 - 4).toFixed(1);
    return `${x},${y}`;
  }).join(' ');
  
  const strokeColor = isUp ? '#10b981' : '#f43f5e';

  return (
    <svg className="w-full h-7 overflow-visible" viewBox="0 0 100 26" preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        style={{ filter: isUp ? 'drop-shadow(0 0 3px rgba(16, 185, 129, 0.6))' : 'drop-shadow(0 0 3px rgba(244, 63, 94, 0.6))' }}
      />
    </svg>
  );
}

// Detailed Area Chart Component (Upgraded styling with drop-shadow and gradients)
function DetailedChart({ history, isUp }) {
  if (!history || history.length < 2) {
    return (
      <div className="h-44 flex items-center justify-center text-xs text-premium-textMuted font-mono font-medium border border-premium-border rounded-[14px] bg-[#101015]/30">
        Awaiting live ticks to draw chart...
      </div>
    );
  }
  
  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max - min === 0 ? 1 : max - min;
  
  const points = history.map((price, idx) => {
    const x = (idx * (300 / (history.length - 1))).toFixed(1);
    const y = (120 - ((price - min) / range) * 94 - 13).toFixed(1);
    return `${x},${y}`;
  }).join(' ');
  
  const strokeColor = isUp ? '#10b981' : '#f43f5e';
  const fillColorId = isUp ? 'chart-fill-green' : 'chart-fill-red';
  const fillPoints = `0,120 ${points} 300,120`;

  return (
    <svg className="w-full h-44 overflow-visible" viewBox="0 0 300 120" preserveAspectRatio="none">
      <defs>
        <linearGradient id="chart-fill-green" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.18"/>
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.00"/>
        </linearGradient>
        <linearGradient id="chart-fill-red" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.18"/>
          <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.00"/>
        </linearGradient>
      </defs>
      
      {/* Gridlines */}
      <line x1="0" y1="20" x2="300" y2="20" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" strokeDasharray="3,3" />
      <line x1="0" y1="50" x2="300" y2="50" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" strokeDasharray="3,3" />
      <line x1="0" y1="80" x2="300" y2="80" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" strokeDasharray="3,3" />
      <line x1="0" y1="110" x2="300" y2="110" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" strokeDasharray="3,3" />
      
      {/* Subtle Area Gradient Under the Curve */}
      <polygon fill={`url(#${fillColorId})`} points={fillPoints} />
      
      {/* Line polyline */}
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

// TradingView-style Technical Analysis Gauge Widget
function TechnicalGauge({ score }) {
  // Score is on a scale of -5 to +5
  // Map -5 to -90 degrees, 0 to 0 degrees, and +5 to +90 degrees
  const rotation = (score / 5) * 90;

  // Determine Recommendation Label
  let label = 'NEUTRAL';
  let colorClass = 'text-slate-400';
  
  if (score > 1.8) {
    label = 'STRONG BUY';
    colorClass = 'text-[#10b981]';
  } else if (score > 0.3) {
    label = 'BUY';
    colorClass = 'text-[#10b981]/80';
  } else if (score < -1.8) {
    label = 'STRONG SELL';
    colorClass = 'text-[#f43f5e]';
  } else if (score < -0.3) {
    label = 'SELL';
    colorClass = 'text-[#f43f5e]/80';
  }

  return (
    <div className="py-6 flex flex-col items-center justify-center border border-premium-border rounded-lg bg-white/[0.01] transition-all duration-300">
      <div className="relative w-44 h-22 overflow-hidden flex items-end justify-center select-none">
        {/* Semi-circle Gauge Arc */}
        <svg className="w-full h-full absolute top-0 left-0" viewBox="0 0 100 50">
          <defs>
            <linearGradient id="gauge-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#f43f5e" />     {/* Strong Sell */}
              <stop offset="35%" stopColor="#f59e0b" />     {/* Sell */}
              <stop offset="50%" stopColor="#64748b" />     {/* Neutral */}
              <stop offset="65%" stopColor="#10b981" />     {/* Buy */}
              <stop offset="100%" stopColor="#059669" />    {/* Strong Buy */}
            </linearGradient>
          </defs>
          <path
            d="M 10,50 A 40,40 0 0,1 90,50"
            fill="none"
            stroke="url(#gauge-grad)"
            strokeWidth="7"
            strokeLinecap="round"
            opacity="0.8"
          />
        </svg>
        
        {/* Needle */}
        <div 
          style={{ transform: `rotate(${rotation}deg)` }}
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-16 origin-bottom transition-transform duration-1000 ease-out flex flex-col items-center justify-end"
        >
          {/* Pointer indicator */}
          <div className="w-1 h-14 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.75)]"></div>
          {/* Hub center circle */}
          <div className="w-4 h-4 bg-white rounded-full -mb-2 border border-zinc-950 z-10 shadow-md"></div>
        </div>
      </div>

      {/* Analysis Details Panel */}
      <div className="text-center mt-3.5 space-y-1">
        <span className="text-[10px] text-premium-textMuted uppercase font-bold tracking-widest block">Market recommendation</span>
        <h4 className={`text-[17px] font-black tracking-tight ${colorClass} leading-none`}>
          {label}
        </h4>
        <span className="text-[11px] font-mono text-premium-textMuted block font-semibold">
          AI Score: {score > 0 ? '+' : ''}{score.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

// Material Design Step-Style Leaderboard Podium Icon Component (MdLeaderboard)
function LeaderboardIcon({ className }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" 
      fill="currentColor" 
      aria-hidden="true"
    >
      <path d="M7.5 21H2V9h5.5v12zm7.25-18h-5.5v18h5.5V3zM22 11h-5.5v10H22V11z"/>
    </svg>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedStock, setSelectedStock] = useState(null);
  
  // Truncation states for tables / lists
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [showAllDrawerNews, setShowAllDrawerNews] = useState(false);
  
  // Active Theme Manager State ('onyx', 'nebula', 'emerald')
  // eslint-disable-next-line no-unused-vars
  const [theme, setTheme] = useState('onyx');

  const [stocks, setStocks] = useState({});
  const [priceHistory, setPriceHistory] = useState({
    AAPL: [], TSLA: [], GOOGL: [], AMZN: [], MSFT: [], NVDA: [], META: [], NFLX: [], AMD: [], COIN: []
  });
  const [flashStates, setFlashStates] = useState({});
  const [leaderboard, setLeaderboard] = useState([]);
  
  // Real-time simulated volumes state
  const [volumes, setVolumes] = useState({
    AAPL: 580000, TSLA: 890000, GOOGL: 420000, AMZN: 640000, MSFT: 590000, NVDA: 1350000, META: 510000, NFLX: 330000, AMD: 740000, COIN: 920000
  });

  // Headline Submissions
  const [headline, setHeadline] = useState('');
  const [ticker, setTicker] = useState('AAPL');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [headlineLogs, setHeadlineLogs] = useState([]);
  
  // Connections Health Check
  const [socketConnected, setSocketConnected] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [dbHealth, setDbHealth] = useState({ api: 'checking', redis: 'checking', mongo: 'checking' });

  // Reset drawer truncation state when selected stock changes
  useEffect(() => {
    setShowAllDrawerNews(false);
  }, [selectedStock]);

  // Programmatically lock background body scrolling when stock detail drawer is open
  useEffect(() => {
    if (selectedStock) {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    } else {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    }
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, [selectedStock]);

  // Sync theme with HTML data-theme attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const fetchLeaderboard = () => {
    fetch(`${API_BASE}/api/leaderboard`)
      .then(res => res.json())
      .then(res => setLeaderboard(res.data || []))
      .catch(err => console.error("Error fetching leaderboard:", err));
  };

  const checkHealth = () => {
    fetch(`${API_BASE}/health`)
      .then(res => res.json())
      .then(data => {
        setDbHealth({
          api: 'healthy',
          redis: data.redis ? 'healthy' : 'error',
          mongo: data.mongo ? 'healthy' : 'error'
        });
      })
      .catch(() => {
        setDbHealth({ api: 'error', redis: 'error', mongo: 'error' });
      });
  };

  useEffect(() => {
    // 1. Fetch initial states
    fetch(`${API_BASE}/api/stocks`)
      .then(res => res.json())
      .then(res => {
        const initialPrices = {};
        const initialHistory = {};
        res.data.forEach(s => {
          initialPrices[s.ticker] = s.price;
          initialHistory[s.ticker] = [s.price];
        });
        setStocks(initialPrices);
        setPriceHistory(prev => {
          const updated = { ...prev };
          Object.keys(initialHistory).forEach(t => {
            updated[t] = initialHistory[t];
          });
          return updated;
        });
      })
      .catch(err => console.error("Error fetching initial stocks:", err));

    // 2. Fetch initial leaderboard
    fetchLeaderboard();

    // 3. Fetch initial news history log
    fetch(`${API_BASE}/api/news`)
      .then(res => res.json())
      .then(res => {
        const historyData = (res.data || []).map(item => ({
          ...item,
          id: item._id || item.id,
          status: 'completed'
        }));
        setHeadlineLogs(historyData);
      })
      .catch(err => console.error("Error fetching news history:", err));

    // 4. Check health and setup polling
    checkHealth();
    const healthInterval = setInterval(checkHealth, 15000);

    // 5. Socket connection states
    socket.on('connect', () => {
      console.log('⚡ Socket connected successfully to backend server!');
      setSocketConnected(true);
    });
    socket.on('disconnect', (reason) => {
      console.warn('🔌 Socket disconnected from backend server:', reason);
      setSocketConnected(false);
    });
    socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error on frontend:', error);
    });
    if (socket.connected) {
      console.log('⚡ Socket already connected on initialization');
      setSocketConnected(true);
    }

    // 6. Listen to real-time stock updates
    socket.on('price_update', (data) => {
      const currentPrice = parseFloat(data.price);
      
      setStocks(prev => {
        const prevPrice = prev[data.ticker];
        if (prevPrice !== undefined) {
          const direction = currentPrice > prevPrice ? 'up' : currentPrice < prevPrice ? 'down' : null;
          if (direction) {
            setFlashStates(prevFlash => ({
              ...prevFlash,
              [data.ticker]: { direction, timestamp: Date.now() }
            }));
          }
        }
        return { ...prev, [data.ticker]: currentPrice };
      });

      setPriceHistory(prev => {
        const history = prev[data.ticker] || [];
        const updated = history.length === 0 ? [currentPrice] : [...history, currentPrice].slice(-30);
        return { ...prev, [data.ticker]: updated };
      });

      // Increment simulated volume on price ticks
      setVolumes(prev => ({
        ...prev,
        [data.ticker]: (prev[data.ticker] || 0) + Math.floor(Math.random() * 38000 + 8000)
      }));
    });

    socket.on('price_batch_update', (batch) => {
      const timestamp = Date.now();

      setStocks(prev => {
        const nextStocks = { ...prev };
        const nextFlashes = {};

        batch.forEach(item => {
          const prevPrice = prev[item.ticker];
          const currentPrice = parseFloat(item.price);

          if (prevPrice !== undefined) {
            const direction = currentPrice > prevPrice ? 'up' : currentPrice < prevPrice ? 'down' : null;
            if (direction) {
              nextFlashes[item.ticker] = { direction, timestamp };
            }
          }
          nextStocks[item.ticker] = currentPrice;
        });

        // Trigger flash updates in a single batch
        setFlashStates(prevFlash => ({
          ...prevFlash,
          ...nextFlashes
        }));

        return nextStocks;
      });

      setPriceHistory(prev => {
        const nextHistory = { ...prev };
        batch.forEach(item => {
          const history = prev[item.ticker] || [];
          nextHistory[item.ticker] = history.length === 0
            ? [parseFloat(item.price)]
            : [...history, parseFloat(item.price)].slice(-30);
        });
        return nextHistory;
      });

      // Increment simulated volume in batch
      setVolumes(prev => {
        const nextVolumes = { ...prev };
        batch.forEach(item => {
          nextVolumes[item.ticker] = (prev[item.ticker] || 0) + Math.floor(Math.random() * 38000 + 8000);
        });
        return nextVolumes;
      });
    });

    // 7. Listen to real-time sentiment updates
    socket.on('sentiment_update', (data) => {
      setHeadlineLogs(prev => {
        const index = prev.findIndex(log => log.headline === data.headline && log.ticker === data.ticker && log.status !== 'completed');
        if (index !== -1) {
          const updated = [...prev];
          updated[index] = { ...updated[index], ...data, status: 'completed' };
          return updated;
        }
        const alreadyExists = prev.some(log => log.id === data.id || log._id === data.id || (log.headline === data.headline && log.ticker === data.ticker));
        if (alreadyExists) return prev;

        return [{ ...data, status: 'completed' }, ...prev].slice(0, 25);
      });

      // Instantly refresh the leaderboard
      fetchLeaderboard();
    });

    // 8. Poll leaderboard every 5 seconds
    const leaderboardInterval = setInterval(fetchLeaderboard, 5000);

    return () => {
      socket.off('price_update');
      socket.off('price_batch_update');
      socket.off('sentiment_update');
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      clearInterval(leaderboardInterval);
      clearInterval(healthInterval);
    };
  }, []);

  const analyzeNews = async (e) => {
    e.preventDefault();
    if (!headline.trim()) return;

    setIsAnalyzing(true);
    const submissionId = Date.now();
    const newLog = {
      id: submissionId,
      ticker,
      headline,
      timestamp: new Date().toISOString(),
      status: 'analyzing'
    };

    setHeadlineLogs(prev => [newLog, ...prev]);

    try {
      const response = await fetch(`${API_BASE}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, headline })
      });
      const data = await response.json();
      
      if (data.success) {
        setHeadlineLogs(prev => prev.map(log => 
          log.id === submissionId ? { ...log, status: 'queued', jobId: data.jobId } : log
        ));
      } else {
        setHeadlineLogs(prev => prev.map(log => 
          log.id === submissionId ? { ...log, status: 'failed' } : log
        ));
      }
    } catch (err) {
      console.error(err);
      setHeadlineLogs(prev => prev.map(log => 
        log.id === submissionId ? { ...log, status: 'failed' } : log
      ));
    } finally {
      setHeadline('');
      setIsAnalyzing(false);
    }
  };

  const maxAbsScore = Math.max(...leaderboard.map(item => Math.abs(item.score)), 5);

  // Volatility calculation (Standard Deviation)
  const getVolatility = (history) => {
    if (!history || history.length < 2) return '0.00';
    const n = history.length;
    const mean = history.reduce((a, b) => a + b, 0) / n;
    const variance = history.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1);
    return Math.sqrt(variance).toFixed(2);
  };

  // Sentiment ratio details
  const getSentimentStats = (ticker) => {
    const logs = headlineLogs.filter(log => log.ticker === ticker && log.status === 'completed');
    if (logs.length === 0) return { ratio: '50% Bullish', count: 0, textClass: 'text-gray-400', rawValue: 0 };
    const positiveCount = logs.filter(log => log.score > 0).length;
    const neutralCount = logs.filter(log => log.score === 0).length;
    const total = logs.length;
    const percentage = Math.round(((positiveCount + (neutralCount * 0.5)) / total) * 100);
    
    // Convert percentage (0-100) to a scaled score (-5 to +5) for technical gauge mapping
    const gaugeValue = ((percentage - 50) / 50) * 5;

    let textClass = 'text-[#10b981]';
    if (percentage < 45) textClass = 'text-[#f43f5e]';
    else if (percentage >= 45 && percentage <= 55) textClass = 'text-gray-400';

    return { ratio: `${percentage}% Bullish`, count: total, textClass, rawValue: gaugeValue };
  };

  // Deep-dive drawer values
  const drawerHistory = selectedStock ? priceHistory[selectedStock] : [];
  const drawerStockPrice = selectedStock ? stocks[selectedStock] : null;
  const drawerFirstPrice = drawerHistory[0] || drawerStockPrice;
  const drawerChange = drawerStockPrice && drawerFirstPrice ? drawerStockPrice - drawerFirstPrice : 0;
  const drawerPercentChange = drawerFirstPrice ? ((drawerChange / drawerFirstPrice) * 100).toFixed(2) : '0.00';
  const drawerIsUp = drawerChange >= 0;
  const drawerNews = headlineLogs.filter(log => log.ticker === selectedStock);
  const drawerVolatility = getVolatility(drawerHistory);
  const drawerVolume = selectedStock ? volumes[selectedStock] : 0;
  const drawerSentiment = selectedStock ? getSentimentStats(selectedStock) : null;
  const drawerMax = drawerHistory.length > 0 ? Math.max(...drawerHistory) : drawerStockPrice;
  const drawerMin = drawerHistory.length > 0 ? Math.min(...drawerHistory) : drawerStockPrice;

  // Custom scrolling Ticker Tape Component
  const renderTickerTape = () => {
    if (Object.keys(stocks).length === 0) return null;
    const tickerItems = [...Object.entries(stocks), ...Object.entries(stocks)];
    return (
      <div className="w-full bg-[#08080c]/80 border-b border-premium-border backdrop-blur-md overflow-hidden py-2 text-xs select-none sticky top-[81px] z-20">
        <div className="animate-ticker">
          {tickerItems.map(([t, price], idx) => {
            const history = priceHistory[t] || [];
            const firstPrice = history[0] || price;
            const change = price - firstPrice;
            const percentChange = firstPrice !== 0 ? ((change / firstPrice) * 100).toFixed(2) : '0.00';
            const isUp = change >= 0;
            return (
              <div 
                key={`${t}-${idx}`} 
                onClick={() => setSelectedStock(t)}
                className="flex items-center gap-2.5 px-6 border-r border-[rgba(255,255,255,0.05)] cursor-pointer hover:bg-white/5 transition-colors py-0.5"
              >
                <span className="font-bold text-premium-textTitle tracking-tight">{t}</span>
                <span className="font-mono text-white/95">${price.toFixed(2)}</span>
                <span className={`flex items-center gap-0.5 font-bold ${isUp ? 'text-[#10b981]' : 'text-[#f43f5e]'}`}>
                  {isUp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {percentChange}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // AI Sentiment Leaderboard Component
  const renderLeaderboard = () => {
    const getRankBadge = (index) => {
      if (index === 0) {
        return (
          <div className="w-7 h-7 rounded-md bg-transparent border-2 border-amber-500 text-amber-400 font-black text-[11px] flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.5)]">
            1st
          </div>
        );
      }
      if (index === 1) {
        return (
          <div className="w-7 h-7 rounded-md bg-transparent border-2 border-slate-300 text-slate-200 font-black text-[11px] flex items-center justify-center shadow-[0_0_15px_rgba(203,213,225,0.4)]">
            2nd
          </div>
        );
      }
      if (index === 2) {
        return (
          <div className="w-7 h-7 rounded-md bg-transparent border-2 border-orange-500 text-orange-400 font-black text-[11px] flex items-center justify-center shadow-[0_0_15px_rgba(249,115,22,0.4)]">
            3rd
          </div>
        );
      }
      return (
        <div className="w-7 h-7 rounded-md bg-transparent border border-premium-accent/50 text-premium-accent font-bold text-[11px] flex items-center justify-center shadow-[0_0_10px_rgba(99,102,241,0.3)]">
          {index + 1}
        </div>
      );
    };

    const containerVariants = {
      hidden: { opacity: 0 },
      show: {
        opacity: 1,
        transition: { staggerChildren: 0.05 }
      }
    };

    const itemVariants = {
      hidden: { opacity: 0, x: -10 },
      show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 120, damping: 14 } }
    };

    return (
      <div className="w-full border-b border-premium-border pb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[18px] font-extrabold uppercase tracking-wide text-premium-textTitle flex items-center gap-2.5">
            <LeaderboardIcon className="text-premium-accent w-[18px] h-[18px]" /> AI Sentiment Leaderboard
          </h2>
          <span className="text-[11px] font-bold text-premium-textMuted uppercase tracking-wider bg-white/5 px-2.5 py-1 rounded-md">
            7-Day Decayed
          </span>
        </div>

        {leaderboard.length === 0 ? (
          <div className="py-8 text-center text-premium-textMuted text-sm font-medium">
            No sentiment data yet. Submit headlines!
          </div>
        ) : (
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="w-full"
          >
            {leaderboard.map((item, index) => {
              const score = item.score;
              const isPositive = score > 0;
              const isNegative = score < 0;
              
              const barWidth = Math.min(100, (Math.abs(score) / maxAbsScore) * 100);
              
              const rowBorderAccent = isPositive
                ? 'hover:border-l-[#10b981]'
                : isNegative
                  ? 'hover:border-l-[#f43f5e]'
                  : 'hover:border-l-slate-400';

               return (
                <div key={item.ticker} className="mb-4">
                  <motion.div 
                    variants={itemVariants}
                    onClick={() => setSelectedStock(item.ticker)}
                    className={`grid grid-cols-12 items-center px-6 py-5 hover:bg-zinc-900/50 transition-all duration-300 cursor-pointer select-none group border-b border-premium-border border-l-3 border-l-transparent ${rowBorderAccent}`}
                  >
                    {/* Left Side: Rank Badge & Symbol */}
                    <div className="col-span-7 md:col-span-5 flex items-center gap-4">
                      {getRankBadge(index)}
                      <div className="flex items-baseline gap-2">
                        <span className="text-[15.5px] font-extrabold text-white group-hover:text-premium-accent transition-colors">
                          {item.ticker}
                        </span>
                        <span className="text-[11.5px] text-premium-textMuted hidden sm:inline">
                          {companyNames[item.ticker]}
                        </span>
                      </div>
                    </div>

                    {/* Middle: Progress Bar with accurate capsule bars & inline percentage indicators */}
                    <div className="hidden md:flex col-span-4 items-center gap-3.5 w-full mx-0">
                      <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden flex relative border border-white/[0.01]">
                        <div className="absolute inset-y-0 left-1/2 w-[1.5px] bg-[#1a1a24] z-10"></div>
                        
                        {/* Left (Bearish Capsule) */}
                        <div className="w-1/2 flex justify-end">
                          {isNegative && (
                            <div 
                              style={{ width: `${barWidth}%` }} 
                              className="h-full bg-gradient-to-l from-[#f43f5e] to-[#ef4444] rounded-l-full shadow-[0_0_8px_#f43f5e]"
                            ></div>
                          )}
                        </div>

                        {/* Right (Bullish Capsule) */}
                        <div className="w-1/2">
                          {isPositive && (
                            <div 
                              style={{ width: `${barWidth}%` }} 
                              className="h-full bg-gradient-to-r from-[#10b981] to-[#059669] rounded-r-full shadow-[0_0_8px_#10b981]"
                            ></div>
                          )}
                        </div>
                      </div>

                      <span className={`text-sm font-bold font-mono tracking-tight w-14 text-left ${isPositive ? 'text-[#10b981]' : isNegative ? 'text-[#f43f5e]' : 'text-slate-400'}`}>
                        {barWidth.toFixed(1)}%
                      </span>
                    </div>

                    {/* Right Side: Score & Label */}
                    <div className="col-span-5 md:col-span-3 flex items-center justify-end gap-6 justify-self-end">
                      <span className={`text-[11px] px-2 py-0.5 rounded font-extrabold uppercase tracking-wider shadow-[0_0_8px_rgba(255,255,255,0.02)] ${
                        isPositive ? 'bg-[#10b981]/15 text-[#10b981]' :
                        isNegative ? 'bg-[#f43f5e]/15 text-[#f43f5e]' :
                        'bg-white/10 text-slate-400'
                      }`}>
                        {score > 1.5 ? 'Strong Bull' : score > 0 ? 'Bull' : score < -1.5 ? 'Strong Bear' : score < 0 ? 'Bear' : 'Neutral'}
                      </span>
                      <span className={`text-[14.5px] font-extrabold font-mono w-16 text-right ${
                        isPositive ? 'text-[#10b981]' :
                        isNegative ? 'text-[#f43f5e]' :
                        'text-slate-400'
                      }`}>
                        {isPositive ? '+' : ''}{score.toFixed(2)}
                      </span>
                    </div>
                  </motion.div>
                </div>
              );
            })}
          </motion.div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-premium-bg text-[#eaebed] relative transition-colors duration-400">
      

      
      {/* Sticky header and ticker container */}
      <div className="sticky top-0 z-30 w-full bg-[#040406]/85 backdrop-blur-md border-b border-white/10 select-none">
        {/* Top Professional Navigation Bar */}
        <header className="flex items-center justify-between max-w-[1680px] mx-auto px-6 md:px-8 py-4 bg-transparent">
          <div className="flex items-center gap-8 md:gap-12">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <svg 
                className="w-6 h-6" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="url(#logo-silver-metallic)" 
                strokeWidth="2.5"
                style={{ filter: 'drop-shadow(0px 0px 3px rgba(255, 255, 255, 0.15))', color: '#FFFFFF' }}
              >
                <defs>
                  <linearGradient id="logo-silver-metallic" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#FFFFFF" />
                    <stop offset="100%" stopColor="#D1D5DB" />
                  </linearGradient>
                </defs>
                <path d="M3 17l6-6 4 4 8-8" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="21" cy="7" r="1.5" fill="url(#logo-silver-metallic)"/>
              </svg>
              <span style={{ display: 'inline-block', fontWeight: '900', fontSize: '1.65rem', color: '#F8FAFC' }}>StockPulse AI</span>
            </div>
            
            {/* Nav Tabs */}
            <nav className="flex items-center gap-6 md:gap-8 text-[14.5px] font-bold">
              <button 
                onClick={() => { setActiveTab('dashboard'); setSelectedStock(null); }}
                className={`pb-1 transition-all duration-200 border-b-2 hover:text-white ${
                  activeTab === 'dashboard' 
                    ? 'text-white border-premium-accent shadow-[0_12px_12px_-5px_var(--accent-color)]' 
                    : 'text-premium-textMuted border-transparent'
                }`}
              >
                Dashboard
              </button>
              <button 
                onClick={() => { setActiveTab('news'); setSelectedStock(null); }}
                className={`pb-1 transition-all duration-200 border-b-2 hover:text-white ${
                  activeTab === 'news' 
                    ? 'text-white border-premium-accent shadow-[0_12px_12px_-5px_var(--accent-color)]' 
                    : 'text-premium-textMuted border-transparent'
                }`}
              >
                AI News Center
              </button>
            </nav>
          </div>

          {/* Right side controls: Theme Manager + Connection Badges */}
          <div className="flex items-center gap-6 md:gap-8">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-[10px] py-[4px] rounded-full bg-white/5 text-[11.5px] font-bold text-premium-textMuted border border-white/[0.02]" title={socketConnected ? "Connection is live" : "Connection offline"}>
                <span className={`w-1.5 h-1.5 rounded-full ${socketConnected ? 'bg-[#10b981] animate-pulse shadow-[0_0_8px_#10b981]' : 'bg-[#f43f5e]'}`}></span>
                <span>LIVE</span>
              </div>
            </div>
          </div>
        </header>

        {/* Scrolling Ticker Tape Tape */}
        {renderTickerTape()}
      </div>

      {/* Main Container */}
      <main className="w-full px-4 md:px-8 py-8 max-w-[1680px] mx-auto transition-all animate-fade-in">
        {activeTab === 'dashboard' ? (
          /* ================================================================= */
          /* DASHBOARD VIEW                                                    */
          /* ================================================================= */
          <div className="space-y-8">
            {/* Realtime Market Summary & Overview cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-b border-premium-border">
              <div className="p-8 border-r border-premium-border flex items-center justify-between hover:bg-white/[0.01] transition-colors duration-200">
                <div className="space-y-1.5">
                  <span className="text-[11px] text-premium-textMuted uppercase tracking-wider font-bold">WebSocket Connection</span>
                  <h4 className="text-[22px] font-extrabold text-white tracking-tight">System Stream Status</h4>
                  <p className="text-[12px] text-premium-textMuted">Real-time WebSocket data stream active</p>
                </div>
                <div className="w-11 h-11 rounded-full bg-premium-accent/5 flex items-center justify-center text-premium-accent animate-pulse">
                  <Activity className="w-5.5 h-5.5" />
                </div>
              </div>

              <div className="p-8 border-r border-premium-border flex items-center justify-between hover:bg-white/[0.01] transition-colors duration-200">
                <div className="space-y-1.5">
                  <span className="text-[11px] text-premium-textMuted uppercase tracking-wider font-bold">Aggregated Bullish sentiment</span>
                  <h4 className="text-[22px] font-extrabold text-[#10b981] tracking-tight">
                    {leaderboard.length > 0 ? (leaderboard.filter(l => l.score > 0).length / leaderboard.length * 100).toFixed(0) : '50'}%
                  </h4>
                  <p className="text-[12px] text-premium-textMuted">Bullish headlines dominate the index</p>
                </div>
                <div className="w-11 h-11 rounded-full bg-[#10b981]/5 flex items-center justify-center text-[#10b981]">
                  <TrendingUp className="w-5.5 h-5.5" />
                </div>
              </div>

              <div className="p-8 flex items-center justify-between hover:bg-white/[0.01] transition-colors duration-200">
                <div className="space-y-1.5">
                  <span className="text-[11px] text-premium-textMuted uppercase tracking-wider font-bold">Heavily Shorted Index Asset</span>
                  <h4 className="text-[22px] font-extrabold text-[#f43f5e] tracking-tight">
                    {leaderboard.length > 0 ? [...leaderboard].sort((a,b) => a.score - b.score)[0]?.ticker : 'NFLX'}
                  </h4>
                  <p className="text-[12px] text-premium-textMuted">Lowest overall AI sentiment score</p>
                </div>
                <div className="w-11 h-11 rounded-full bg-[#f43f5e]/5 flex items-center justify-center text-[#f43f5e]">
                  <TrendingDown className="w-5.5 h-5.5" />
                </div>
              </div>
            </div>

            {/* 10-Stock WATCHLIST grid */}
            <div className="py-8 border-b border-premium-border">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-[17px] font-extrabold uppercase tracking-wider text-premium-textTitle flex items-center gap-2">
                  <TrendingUp className="text-premium-accent w-5 h-5" /> MARKET WATCHLIST
                </h2>
                
                <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-[#10b981] tracking-wider">
                  <span className="w-1.5 h-1.5 bg-[#10b981] rounded-full animate-pulse shadow-[0_0_6px_#10b981]"></span>
                  <span>LIVE STREAMING</span>
                </div>
              </div>

              <div 
                className="grid grid-cols-1 md:grid-cols-3 gap-0 border-t border-premium-border"
              >
                {Object.entries(stocks).map(([t, price], index) => {
                  const history = priceHistory[t] || [];
                  const firstPrice = history[0] || price;
                  const change = price - firstPrice;
                  const percentChange = firstPrice !== 0 ? ((change / firstPrice) * 100).toFixed(2) : '0.00';
                  const isUp = change >= 0;
                  const flash = flashStates[t];
                  const flashClass = flash && (Date.now() - flash.timestamp < 1200)
                    ? (flash.direction === 'up' ? 'animate-flash-up' : 'animate-flash-down')
                    : '';

                  return (
                    <div 
                      key={t} 
                      onClick={() => setSelectedStock(t)}
                      className={`p-6 md:p-8 flex flex-col justify-between cursor-pointer transition-colors duration-200 relative select-none hover:bg-white/[0.01] border-b border-premium-border overflow-hidden ${
                        index % 3 !== 2 ? 'md:border-r border-premium-border' : ''
                      } ${flashClass}`}
                    >


                      <div className="relative z-10 w-full flex flex-col justify-between h-full">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-[16px] font-bold text-white tracking-tight">{t}</span>
                            <span className="text-[11.5px] text-premium-textMuted font-medium block mt-0.5">{companyNames[t] || 'Asset'}</span>
                          </div>
                          
                          <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm text-[10.5px] font-extrabold border ${
                            isUp 
                              ? 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30 shadow-[0_0_8px_rgba(16,185,129,0.25)]' 
                              : 'bg-[#f43f5e]/15 text-[#f43f5e] border-[#f43f5e]/30 shadow-[0_0_8px_rgba(244,63,94,0.25)]'
                          }`}>
                            {isUp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            <span>{isUp ? '+' : ''}{percentChange}%</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-6">
                          <span className="text-[28px] md:text-[32px] font-extrabold text-white tracking-tight font-mono leading-none">
                            ${price.toFixed(2)}
                          </span>
                          
                          <div className="w-24 md:w-28 opacity-80 group-hover:opacity-100 transition-opacity">
                            <Sparkline history={history} isUp={isUp} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* ================================================================= */
          /* AI NEWS CENTER VIEW (Premium Layout with framer-motion list)      */
          /* ================================================================= */
          <div className="space-y-8 max-w-[1540px] mx-auto">
            
            {/* Horizontal Leaderboard strip at the top */}
            {renderLeaderboard()}

            {/* Submission Form as AI Analyst desk */}
            <div className="py-8 border-b border-premium-border relative overflow-hidden">
              <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-premium-accent/5 rounded-full blur-3xl"></div>
              
              <div className="relative z-10">
                <h2 className="text-[19px] font-extrabold uppercase tracking-wide text-[#eaebed] mb-2 flex items-center gap-2.5">
                  <Newspaper className="text-premium-accent w-5.5 h-5.5" /> AI Financial Analyst Desk
                </h2>
                <p className="text-[12.5px] text-premium-textMuted mb-8 max-w-2xl font-medium">
                  Queue financial headlines below. Our real-time sentiment processor uses LLM evaluation models to deliver precise sentiment ratings (-5 to +5), and log updates.
                </p>

                <form onSubmit={analyzeNews} className="space-y-4">
                  <div className="flex flex-col md:flex-row gap-4">
                    {/* Ticker Selector */}
                    <div className="relative md:w-56 flex-shrink-0">
                      <select 
                        className="w-full bg-zinc-900 border border-premium-border text-white px-4 py-3.5 rounded-lg focus:outline-none focus:border-premium-accent text-sm font-semibold appearance-none cursor-pointer hover:bg-zinc-800 transition-colors"
                        value={ticker} 
                        onChange={e => setTicker(e.target.value)}
                      >
                        {Object.keys(companyNames).map(t => (
                          <option key={t} value={t} className="bg-zinc-900 text-white">{t} - {companyNames[t]}</option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-premium-textMuted">
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>

                    {/* Headline input */}
                    <input 
                      type="text"
                      className="flex-1 bg-white/[0.02] border border-premium-border text-white placeholder-premium-textMuted px-4 py-3.5 rounded-lg focus:outline-none focus:border-premium-accent text-sm transition-colors" 
                      placeholder="e.g. 'Apple unveils breakthrough M4 Studio chips with integrated neural processors beating estimates.'" 
                      value={headline} 
                      onChange={e => setHeadline(e.target.value)}
                      disabled={isAnalyzing}
                    />

                    {/* Submit Button */}
                    <button 
                      type="submit"
                      className="bg-premium-accent text-white font-bold text-sm px-6 py-3.5 rounded-lg hover:bg-premium-accent/90 active:scale-98 focus:outline-none transition-all disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap border-none cursor-pointer"
                      disabled={isAnalyzing || !headline.trim()}
                    >
                      {isAnalyzing ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <LeaderboardIcon className="w-[14px] h-[14px]" />
                          Evaluate Sentiment
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Global submissions feed with Framer Motion AnimatePresence */}
            <div className="py-8">
              <h2 className="text-[18px] font-extrabold uppercase tracking-wide text-[#eaebed] mb-6 flex items-center gap-2.5">
                <History className="text-premium-accent w-5.5 h-5.5" /> Recent Sentiment Analysis Logs
              </h2>

              {headlineLogs.length === 0 ? (
                <div className="py-12 text-center text-premium-textMuted text-sm font-semibold">
                  No submissions have been recorded yet.
                </div>
              ) : (
                <div className="border border-premium-border divide-y divide-premium-border">
                  <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0 divide-y md:divide-y-0 divide-premium-border" layout>
                    <AnimatePresence initial={false}>
                      {(showAllLogs ? headlineLogs : headlineLogs.slice(0, 6)).map((log) => {
                        const isCompleted = log.status === 'completed';
                        const showScore = isCompleted && log.score !== undefined;
                        const score = log.score;
                        const isPositive = score > 0;
                        const isNegative = score < 0;

                        return (
                          <motion.div 
                            layout
                            key={log.id || log._id}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ type: "spring", stiffness: 350, damping: 26 }}
                            className="py-6 px-6 hover:bg-white/[0.02] transition-all duration-200 flex flex-col justify-between gap-4 group"
                          >
                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2.5">
                                  <span className="text-[11px] font-bold text-white bg-white/5 border border-white/[0.06] px-2 py-0.5 rounded">
                                    {log.ticker}
                                  </span>
                                  <span className="text-[10px] text-premium-textMuted font-mono">
                                    {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'Just now'}
                                  </span>
                                </div>
                                
                                {log.status === 'analyzing' && (
                                  <span className="text-premium-accent text-xs flex items-center gap-1 font-bold">
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Analyzing...
                                  </span>
                                )}
                                {log.status === 'queued' && (
                                  <span className="text-amber-500 text-xs flex items-center gap-1 font-bold animate-pulse">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" /> Queued for AI
                                  </span>
                                )}
                                {log.status === 'failed' && (
                                  <span className="text-[#f43f5e] text-xs flex items-center gap-1 font-bold">
                                    <XCircle className="w-3.5 h-3.5 text-[#f43f5e]" /> Failed
                                  </span>
                                )}
                                {isCompleted && showScore && (
                                  <span className={`px-2 py-0.5 rounded font-black text-xs font-mono tracking-wide ${
                                    isPositive ? 'bg-[#10b981]/15 text-[#10b981]' :
                                    isNegative ? 'bg-[#f43f5e]/15 text-[#f43f5e]' :
                                    'bg-white/10 text-slate-400'
                                  }`}>
                                    {isPositive ? '+' : ''}{score}
                                  </span>
                                )}
                              </div>
                              
                              <p className="text-[14.5px] font-bold text-white/95 leading-relaxed">
                                "{log.headline}"
                              </p>
                            </div>

                            {isCompleted && log.explanation && (
                              <div className="bg-white/[0.01] p-4 rounded border border-white/[0.03]">
                                <p className="text-premium-textMuted text-[12.5px] leading-relaxed">
                                  <span className="text-premium-accent font-extrabold flex items-center gap-1 mb-1">
                                    <Brain className="w-4 h-4" /> AI Explanation:
                                  </span> 
                                  {log.explanation}
                                </p>
                              </div>
                            )}
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </motion.div>
                  
                  {headlineLogs.length > 6 && (
                    <div className="flex justify-center py-4 bg-white/[0.005]">
                      <button 
                        onClick={() => setShowAllLogs(!showAllLogs)}
                        className="text-xs font-bold text-premium-accent hover:text-premium-accent/80 transition-colors uppercase tracking-wider bg-transparent border-none cursor-pointer flex items-center gap-1.5 py-2 px-4 rounded hover:bg-white/5"
                      >
                        {showAllLogs ? "Show Less" : `See All (${headlineLogs.length})`}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        )}
      </main>

      {/* Backdrop for closing drawer when clicking outside */}
      {selectedStock && (
        <div 
          onClick={() => setSelectedStock(null)}
          className="fixed inset-0 bg-black/75 z-40 transition-opacity"
        />
      )}

      {/* Slide-out Stock Deep-Dive Drawer with technical gauge */}
      <div 
        className={`fixed top-0 right-0 h-full w-full md:w-[480px] bg-[#0c0c0e] border-l border-premium-border shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${
          selectedStock ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ overscrollBehavior: 'contain' }}
      >
        {selectedStock && (
          <>
            {/* Drawer Header */}
            <div className="p-6 border-b border-premium-border flex items-center justify-between bg-black/25" style={{ overscrollBehavior: 'contain' }}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-[15px] text-white bg-white/5 border border-white/[0.06] px-2 py-0.5 rounded leading-none">{selectedStock}</span>
                  <span className="text-[13px] text-premium-textMuted font-bold leading-none">{companyNames[selectedStock]}</span>
                </div>
                <div className="flex items-baseline gap-2.5 mt-3">
                  <span className="text-[32px] font-extrabold text-white tracking-tight leading-none font-mono">
                    ${stocks[selectedStock]?.toFixed(2) || '0.00'}
                  </span>
                  <span className={`text-[13.5px] font-extrabold flex items-center gap-0.5 leading-none ${
                    drawerIsUp ? 'text-[#10b981]' : 'text-[#f43f5e]'
                  }`}>
                    {drawerIsUp ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    {drawerPercentChange}%
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedStock(null)}
                className="text-premium-textMuted hover:text-white p-1.5 rounded-full hover:bg-white/5 transition-all cursor-pointer border-none"
              >
                <XCircle className="w-7 h-7" />
              </button>
            </div>

            {/* Drawer Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6" style={{ overscrollBehavior: 'contain' }}>
              
              {/* Detailed Performance Chart */}
              <div className="py-6 border-b border-premium-border">
                <h3 className="text-[12.5px] font-extrabold uppercase tracking-wider text-premium-textMuted mb-4 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-premium-accent" /> Live Price Chart
                </h3>
                <DetailedChart history={drawerHistory} isUp={drawerIsUp} />
                
                <div className="grid grid-cols-2 gap-4 text-[11px] font-mono text-premium-textMuted mt-4 border-t border-white/[0.04] pt-4">
                  <div>Session Min: <span className="text-white font-bold">${drawerMin?.toFixed(2)}</span></div>
                  <div className="text-right">Session Max: <span className="text-white font-bold">${drawerMax?.toFixed(2)}</span></div>
                </div>
              </div>

              {/* TradingView technical indicator gauge */}
              {drawerSentiment && (
                <div className="py-6 border-b border-premium-border space-y-3">
                  <h3 className="text-[12.5px] font-extrabold uppercase tracking-wider text-premium-textMuted flex items-center gap-1.5">
                    <Gauge className="w-4 h-4 text-premium-accent" /> Technical Gauges
                  </h3>
                  <TechnicalGauge score={drawerSentiment.rawValue} />
                </div>
              )}

              {/* Upgraded Premium Stats Grid */}
              <div className="py-6 border-b border-premium-border">
                <div className="grid grid-cols-2 gap-0 border-t border-l border-premium-border">
                  <div className="p-4 border-r border-b border-premium-border flex flex-col justify-between gap-1 hover:bg-white/[0.01] transition-colors">
                    <span className="text-[10px] text-premium-textMuted uppercase font-bold tracking-wider flex items-center gap-1.5">
                      <BarChart3 className="w-3.5 h-3.5" /> Volatility
                    </span>
                    <span className="text-[16px] font-extrabold font-mono text-white">
                      {drawerVolatility}
                    </span>
                  </div>

                  <div className="p-4 border-r border-b border-premium-border flex flex-col justify-between gap-1 hover:bg-white/[0.01] transition-colors">
                    <span className="text-[10px] text-premium-textMuted uppercase font-bold tracking-wider flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5" /> Trade Volume
                    </span>
                    <span className="text-[16px] font-extrabold font-mono text-white">
                      {(drawerVolume / 1000).toFixed(0)}k <span className="text-[10px] text-premium-textMuted font-normal">shares</span>
                    </span>
                  </div>

                  <div className="p-4 border-r border-b border-premium-border flex flex-col justify-between gap-1 hover:bg-white/[0.01] transition-colors">
                    <span className="text-[10px] text-premium-textMuted uppercase font-bold tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" /> Sentiment Ratio
                    </span>
                    <span className={`text-[16px] font-black ${drawerSentiment?.textClass}`}>
                      {drawerSentiment?.ratio}
                    </span>
                  </div>

                  <div className="p-4 border-r border-b border-premium-border flex flex-col justify-between gap-1 hover:bg-white/[0.01] transition-colors">
                    <span className="text-[10px] text-premium-textMuted uppercase font-bold tracking-wider flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Data Refresh
                    </span>
                    <span className="text-[15.5px] font-bold text-white flex items-center gap-1">
                      2.00s <span className="text-[9px] text-[#10b981] font-bold animate-pulse">● LIVE</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Stock-specific AI sentiment list */}
              <div className="py-6">
                <h3 className="text-[13px] font-extrabold uppercase tracking-wider text-premium-textMuted mb-4 flex items-center gap-1.5">
                  <Brain className="w-4 h-4 text-premium-accent" /> AI Sentiment Timeline
                </h3>
                
                {drawerNews.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-premium-border rounded-lg text-premium-textMuted text-xs">
                    No sentiment news recorded for {selectedStock} yet.
                  </div>
                ) : (
                  <div className="border border-premium-border divide-y divide-premium-border">
                    {(showAllDrawerNews ? drawerNews : drawerNews.slice(0, 3)).map((log) => {
                      const isPositive = log.score > 0;
                      const isNegative = log.score < 0;
                      return (
                        <div key={log.id || log._id} className="p-4 hover:bg-white/[0.01] transition-colors space-y-3.5">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-premium-textMuted font-mono">
                              {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'Just now'}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[11px] font-black font-mono tracking-wide ${
                              isPositive ? 'bg-[#10b981]/15 text-[#10b981]' :
                              isNegative ? 'bg-[#f43f5e]/15 text-[#f43f5e]' :
                              'bg-white/10 text-slate-400'
                            }`}>
                              {isPositive ? '+' : ''}{log.score}
                            </span>
                          </div>
                          <p className="text-[14.5px] font-bold text-white/95 leading-relaxed">
                            "{log.headline}"
                          </p>
                          {log.explanation && (
                            <p className="text-premium-textMuted text-[12.5px] border-t border-white/[0.04] pt-2 leading-relaxed">
                              <span className="text-premium-accent font-extrabold block mb-0.5">💡 Insight:</span> {log.explanation}
                            </p>
                          )}
                        </div>
                      );
                    })}
                    
                    {drawerNews.length > 3 && (
                      <div className="flex justify-center py-2 bg-white/[0.005]">
                        <button
                          onClick={() => setShowAllDrawerNews(!showAllDrawerNews)}
                          className="text-[11px] font-bold text-premium-accent hover:text-premium-accent/80 transition-colors uppercase tracking-wider bg-transparent border-none cursor-pointer py-1.5 px-3 rounded hover:bg-white/5"
                        >
                          {showAllDrawerNews ? "Show Less" : `See All (${drawerNews.length})`}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

    </div>
  );
}