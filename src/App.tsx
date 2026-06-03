import React, { useState, useEffect, useMemo } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  LayoutDashboard, 
  History, 
  Briefcase, 
  Cpu, 
  RefreshCw, 
  ArrowUpRight, 
  ArrowDownRight, 
  Lock, 
  Terminal, 
  AlertTriangle,
  Play,
  RotateCcw,
  Activity,
  Award,
  Sparkles,
  Percent,
  CheckCircle,
  Database
} from 'lucide-react';

// Interfaces matching backend
interface LiveQuote {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  lastUpdated: string;
}

interface Signal {
  ticker: string;
  date: string;
  price: number;
  probability: number;
  confidence: number;
  stopLoss: number;
  conservativeTarget: number;
  aggressiveTarget: number;
  expectedReturn: number;
  isAlpha: boolean;
  isHiddenGem: boolean;
}

interface BacktestMetric {
  ticker: string;
  totalSignals: number;
  successfulSignals: number;
  hitRate: number;
  avgReturnPercent: number;
  winningTrades: number;
  losingTrades: number;
  profitFactor: number;
}

interface BacktestSummary {
  metrics: Record<string, BacktestMetric>;
  overallHitRate: number;
  overallAvgReturnPercent: number;
  overallProfitFactor: number;
  totalSimulatedSignals: number;
}

interface PortfolioPosition {
  ticker: string;
  shares: number;
  averagePrice: number;
  totalCost: number;
}

interface TradeLog {
  id: string;
  ticker: string;
  type: 'BUY' | 'SELL';
  shares: number;
  price: number;
  totalNgn: number;
  date: string;
  dateTimeStr: string;
}

interface PaperTraderState {
  cash: number;
  positions: Record<string, PortfolioPosition>;
  logs: TradeLog[];
}

interface DividendInfo {
  ticker: string;
  yieldPct: number;
  amountPerShare: number;
  exDividendDate: string;
  paymentDate: string;
}

export default function App() {
  // Session Authentication state
  const [authToken, setAuthToken] = useState<string | null>(localStorage.getItem('ngx_token'));
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Tab State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'backtest' | 'portfolio' | 'models'>('dashboard');

  // Market & Model States
  const [usdNgnRate, setUsdNgnRate] = useState<number>(1600);
  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>({});
  const [predictions, setPredictions] = useState<Signal[]>([]);
  const [alphaPicks, setAlphaPicks] = useState<Signal[]>([]);
  const [hiddenGems, setHiddenGems] = useState<Signal[]>([]);
  const [backtestInfo, setBacktestInfo] = useState<BacktestSummary | null>(null);
  const [portfolio, setPortfolio] = useState<PaperTraderState>({ cash: 1000000, positions: {}, logs: [] });
  const [dividends, setDividends] = useState<Record<string, DividendInfo>>({});
  const [modelsStatus, setModelsStatus] = useState<Record<string, any>>({});

  // Trading Interactivity States
  const [selectedTicker, setSelectedTicker] = useState<string>('MTNN');
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [chartMode, setChartMode] = useState<'price' | 'indicators'>('price');
  const [isRetraining, setIsRetraining] = useState(false);
  const [isTicking, setIsTicking] = useState(false);

  // Trade form states
  const [tradeAction, setTradeAction] = useState<'BUY' | 'SELL'>('BUY');
  const [tradeTicker, setTradeTicker] = useState<string>('MTNN');
  const [tradeShares, setTradeShares] = useState<number>(1000);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [tradeSuccess, setTradeSuccess] = useState<string | null>(null);

  // Periodic Refresh
  const [marketRefreshSec, setMarketRefreshSec] = useState(15);

  // Check initial login status
  useEffect(() => {
    if (authToken) {
      fetch('/api/auth/check', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })
      .then(res => res.json())
      .then(data => {
        if (!data.authenticated) {
          setAuthToken(null);
          localStorage.removeItem('ngx_token');
        }
      })
      .catch(() => {
        setAuthToken(null);
        localStorage.removeItem('ngx_token');
      });
    }
  }, [authToken]);

  // Load active tab data
  useEffect(() => {
    if (!authToken) return;

    loadMarketData();
    loadPredictionData();
    loadPortfolioData();
    loadDividendsData();
    loadModelsStatus();
    loadBacktestData();

    // Secondary automatic poll every 15s for quotes
    const interval = setInterval(() => {
      loadMarketData();
    }, 15000);

    return () => clearInterval(interval);
  }, [authToken]);

  // Countdown timer for quotes
  useEffect(() => {
    if (!authToken) return;
    const timer = setInterval(() => {
      setMarketRefreshSec(prev => {
        if (prev <= 1) {
          loadMarketData();
          return 15;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [authToken]);

  // Fetch historical series when selectedTicker shifts
  useEffect(() => {
    if (!authToken || !selectedTicker) return;
    setHistoricalData([]);
    fetch(`/api/stocks/features/${selectedTicker}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
    .then(res => res.json())
    .then(data => {
      setHistoricalData(data);
    })
    .catch(err => console.error('Failed fetching history:', err));
  }, [authToken, selectedTicker]);

  // Set initial trade form stock price when ticker shifts
  useEffect(() => {
    if (quotes[tradeTicker]) {
      setTradeError(null);
    }
  }, [tradeTicker, quotes]);

  const loadMarketData = () => {
    fetch('/api/stocks/quotes', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
    .then(res => res.json())
    .then(data => {
      if (data.usdNgnRate) setUsdNgnRate(data.usdNgnRate);
      if (data.quotes) setQuotes(data.quotes);
    })
    .catch(err => console.error('Market loading error:', err));
  };

  const loadPredictionData = () => {
    fetch('/api/predictions', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
    .then(res => res.json())
    .then(data => {
      if (data.all) setPredictions(data.all);
      if (data.alphaPicks) setAlphaPicks(data.alphaPicks);
      if (data.hiddenGems) setHiddenGems(data.hiddenGems);
    })
    .catch(err => console.error('Prediction loading error:', err));
  };

  const loadPortfolioData = () => {
    fetch('/api/portfolio', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
    .then(res => res.json())
    .then(data => {
      setPortfolio(data);
    })
    .catch(err => console.error('Portfolio loading error:', err));
  };

  const loadDividendsData = () => {
    fetch('/api/dividends', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
    .then(res => res.json())
    .then(data => {
      setDividends(data);
    })
    .catch(err => console.error('Dividends loading error:', err));
  };

  const loadModelsStatus = () => {
    fetch('/api/models/status', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
    .then(res => res.json())
    .then(data => {
      if (data.models) setModelsStatus(data.models);
    })
    .catch(err => console.error('Models loading error:', err));
  };

  const loadBacktestData = () => {
    fetch('/api/backtest/run', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
    .then(res => res.json())
    .then(data => {
      setBacktestInfo(data);
    })
    .catch(err => console.error('Backtest loading error:', err));
  };

  // Handle Log-in
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: passwordInput })
    })
    .then(async res => {
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Server rejected credential.');
      }
      setAuthToken(data.token);
      localStorage.setItem('ngx_token', data.token);
    })
    .catch(err => {
      setAuthError(err.message);
    })
    .finally(() => {
      setAuthLoading(false);
    });
  };

  // Logout
  const handleLogout = () => {
    fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` }
    }).finally(() => {
      setAuthToken(null);
      localStorage.removeItem('ngx_token');
      setActiveTab('dashboard');
    });
  };

  // Execute buy/sell trade
  const handleOrderExecution = (e: React.FormEvent) => {
    e.preventDefault();
    setTradeError(null);
    setTradeSuccess(null);

    const quote = quotes[tradeTicker];
    if (!quote) {
      setTradeError('Price lookup offline for this ticker.');
      return;
    }

    const endpoint = tradeAction === 'BUY' ? '/api/portfolio/buy' : '/api/portfolio/sell';
    
    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        ticker: tradeTicker,
        shares: tradeShares,
        price: quote.price
      })
    })
    .then(async res => {
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Transaction rejected.');
      }
      setTradeSuccess(data.message);
      setPortfolio(data.state);
    })
    .catch(err => {
      setTradeError(err.message);
    });
  };

  // Trigger rapid realtime simulation update
  const triggerManualMarketUpdate = () => {
    if (isTicking) return;
    setIsTicking(true);
    
    fetch('/api/stocks/tick', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
    .then(res => res.json())
    .then(data => {
      if (data.usdNgnRate) setUsdNgnRate(data.usdNgnRate);
      if (data.quotes) setQuotes(data.quotes);
      
      // Reload relevant info
      loadPredictionData();
      loadPortfolioData();
      
      // Trigger short visual indicator
      setTimeout(() => setIsTicking(false), 800);
    })
    .catch(err => {
      console.error(err);
      setIsTicking(false);
    });
  };

  // Trigger Model Training
  const triggerModelRetraining = () => {
    if (isRetraining) return;
    setIsRetraining(true);

    fetch('/api/models/retrain', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
    .then(res => res.json())
    .then(data => {
      if (data.summary) {
        loadModelsStatus();
        loadPredictionData();
        loadBacktestData();
        alert('Walk-forward model training completed successfully!');
      }
    })
    .catch(err => {
      console.error(err);
      alert('Walk-forward training cycle failed. Check server logs.');
    })
    .finally(() => {
      setIsRetraining(false);
    });
  };

  // Reset Portfolio Cash
  const resetPortfolio = () => {
    if (!confirm('Are you sure you want to hard reset your paper trading balance to ₦1,000,000 and clear all positions?')) return;
    fetch('/api/portfolio/reset', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
    .then(res => res.json())
    .then(data => {
      setPortfolio(data.state);
      setTradeSuccess('Portfolio cleared. Cash reset to ₦1,000,000.');
    })
    .catch(err => console.error(err));
  };

  // Derived Portfolio calculations
  const portfolioEquity = useMemo(() => {
    if (!portfolio || !quotes) return 1000000;
    let value = portfolio.cash;
    Object.values(portfolio.positions).forEach((pos: any) => {
      const currentPrice = quotes[pos.ticker]?.price || pos.averagePrice;
      value += pos.shares * currentPrice;
    });
    return value;
  }, [portfolio, quotes]);

  const unrealizedPnL = useMemo(() => {
    if (!portfolio || !quotes) return { ngn: 0, percent: 0 };
    let initialCostSum = 0;
    let currentValSum = 0;

    Object.values(portfolio.positions).forEach((pos: any) => {
      const currentPrice = quotes[pos.ticker]?.price || pos.averagePrice;
      initialCostSum += pos.totalCost;
      currentValSum += pos.shares * currentPrice;
    });

    const diff = currentValSum - initialCostSum;
    const pct = initialCostSum === 0 ? 0 : (diff / initialCostSum) * 100;
    return { ngn: diff, percent: pct };
  }, [portfolio, quotes]);

  const projectedPassiveIncome = useMemo(() => {
    if (!portfolio || !dividends) return 0;
    let income = 0;
    Object.values(portfolio.positions).forEach((pos: any) => {
      const divInfo = dividends[pos.ticker];
      if (divInfo && divInfo.amountPerShare) {
        income += pos.shares * divInfo.amountPerShare;
      }
    });
    return income;
  }, [portfolio, dividends]);

  // If not authenticated, render beautiful glassmorphism dark Login Screen
  if (!authToken) {
    return (
      <div className="min-h-screen bg-neutral-950 font-sans text-neutral-100 flex flex-col justify-between" id="login-container">
        {/* Top Disclaimer Banner */}
        <div className="bg-amber-500/20 text-semibold border-b border-amber-500/30 text-amber-300 text-xs py-2 px-4 shadow text-center flex items-center justify-center gap-2">
          <AlertTriangle size={14} className="text-amber-400" />
          <span>⚠️ RESEARCH PROTOTYPE – NOT FINANCIAL ADVICE. For educational research use only. Created for NGX Stock Market Predictions.</span>
        </div>

        <div className="flex-1 flex items-center justify-center p-4 flex-col gap-6">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-8 backdrop-blur-md relative overflow-hidden" id="login-card">
            {/* Ambient Background Glow Decors */}
            <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-emerald-500/10 blur-3xl"></div>
            <div className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full bg-emerald-500/10 blur-3xl"></div>

            <div className="text-center mb-8">
              <div className="inline-flex p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl mb-4" id="login-icon-box">
                <Activity size={28} />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white mb-1">NGX QuantPredict™</h1>
              <p className="text-sm text-neutral-400">Nigerian Stock Exchange Research Suite</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
                  Enter Secure Access Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                    <Lock size={16} />
                  </div>
                  <input
                    id="password-input"
                    type="password"
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-4 py-3 bg-neutral-950 border border-neutral-800 rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:border-emerald-500/50 transition-colors text-sm"
                  />
                </div>
              </div>

              {authError && (
                <div className="p-3 bg-red-950/40 border border-red-500/20 rounded-xl text-red-300 text-xs flex items-center gap-2" id="login-error">
                  <AlertTriangle size={14} className="text-red-400 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <button
                id="login-submit-btn"
                type="submit"
                disabled={authLoading}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-neutral-950 font-semibold rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                {authLoading ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Authorizing...</span>
                  </>
                ) : (
                  <>
                    <span>Decrypt & Access Suite</span>
                    <ArrowUpRight size={16} />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 border-t border-neutral-800 pt-6 text-center text-xs text-neutral-500 space-y-1">
              <p>Confidential Proprietary Quantitative Models.</p>
              <p>Default credential: <code className="bg-neutral-950 px-1 inline-block text-emerald-400/90 rounded border border-neutral-850">ngx-research</code></p>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-neutral-900 bg-neutral-950 text-center text-xs text-neutral-600 font-mono tracking-tight">
          NGX_PREDICTOR_CLIENT_V1.2.0 • RUNTIME SECURE • 5Y BACKBURN DATA_SEEDED
        </div>
      </div>
    );
  }

  // Active Main application view
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans" id="app-container">
      
      {/* Top Disclaimer Banner */}
      <div className="bg-amber-500/20 border-b border-amber-500/30 text-amber-300 text-xs py-2 px-4 shadow text-center flex items-center justify-center gap-2 shrink-0">
        <AlertTriangle size={14} className="text-amber-400" />
        <span>⚠️ RESEARCH PROTOTYPE – NOT FINANCIAL ADVICE. For educational research use only. All trade signals are mathematical backtest models.</span>
      </div>

      {/* Main Header navigation */}
      <header className="bg-neutral-900 border-b border-neutral-800 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
            <Activity size={22} className="text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white leading-none">NGX Predictor Research</h1>
              <span className="text-[10px] bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded font-mono font-bold leading-none">PROT v2.4</span>
            </div>
            <p className="text-xs text-neutral-400 mt-1">Nigerian Stock Exchange Machine Learning Prediction Engines</p>
          </div>
        </div>

        {/* Global Nav Tabs */}
        <nav className="flex items-center bg-neutral-950 p-1 border border-neutral-800 rounded-xl">
          <button
            id="tab-dashboard-btn"
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all uppercase flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'dashboard' ? 'bg-neutral-855 text-emerald-400 border border-neutral-800' : 'text-neutral-400 hover:text-neutral-100'
            }`}
          >
            <LayoutDashboard size={14} />
            <span>Signals</span>
          </button>
          <button
            id="tab-backtest-btn"
            onClick={() => setActiveTab('backtest')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all uppercase flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'backtest' ? 'bg-neutral-855 text-emerald-400 border border-neutral-800' : 'text-neutral-400 hover:text-neutral-100'
            }`}
          >
            <History size={14} />
            <span>Backtest Engine</span>
          </button>
          <button
            id="tab-portfolio-btn"
            onClick={() => setActiveTab('portfolio')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all uppercase flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'portfolio' ? 'bg-neutral-855 text-emerald-400 border border-neutral-800' : 'text-neutral-400 hover:text-neutral-100'
            }`}
          >
            <Briefcase size={14} />
            <span>Paper Trading</span>
          </button>
          <button
            id="tab-models-btn"
            onClick={() => setActiveTab('models')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all uppercase flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'models' ? 'bg-neutral-855 text-emerald-400 border border-neutral-800' : 'text-neutral-400 hover:text-neutral-100'
            }`}
          >
            <Cpu size={14} />
            <span>Calibration</span>
          </button>
        </nav>

        {/* Header Right Controls */}
        <div className="flex items-center gap-4">
          {/* Quick tick buttons */}
          <button
            id="tick-feed-btn"
            onClick={triggerManualMarketUpdate}
            disabled={isTicking}
            className="flex items-center gap-2 border border-neutral-800 bg-neutral-950 text-neutral-300 hover:text-emerald-400 uppercase py-2 px-3.5 rounded-lg text-[10px] font-bold tracking-wider disabled:opacity-40 transition-all cursor-pointer"
            title="Force a real-time increment updates tick"
          >
            <ArrowUpRight size={13} className={isTicking ? 'animate-bounce text-emerald-400' : ''} />
            <span>Sim Tick</span>
          </button>

          <div className="text-right shrink-0">
            <span className="text-[10px] text-neutral-500 block uppercase font-mono leading-none mb-1">Live Update In</span>
            <span className="text-xs font-mono font-bold text-emerald-400 leading-none">{marketRefreshSec}s</span>
          </div>

          <button
            id="logout-btn"
            onClick={handleLogout}
            className="bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 hover:border-red-500/20 text-neutral-400 hover:text-red-400 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Hero Metrics Strip */}
      <section className="bg-neutral-950 border-b border-neutral-900 py-3.5 px-6 grid grid-cols-2 md:grid-cols-4 gap-4" id="stats-banner">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/5 text-emerald-400 border border-emerald-500/10 rounded-lg shrink-0">
            <DollarSign size={16} />
          </div>
          <div>
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">USD/NGN Rate</span>
            <span className="font-bold font-mono text-sm block">₦{usdNgnRate.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/5 text-emerald-400 border border-emerald-500/10 rounded-lg shrink-0">
            <Briefcase size={16} />
          </div>
          <div>
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">Paper Cash Balance</span>
            <span className="font-bold font-mono text-sm block">₦{portfolio.cash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/5 text-emerald-400 border border-emerald-500/10 rounded-lg shrink-0">
            <Activity size={16} />
          </div>
          <div>
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">Portfolio Net Equity</span>
            <span className="font-bold font-mono text-sm block text-emerald-400">₦{portfolioEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/5 text-emerald-400 border border-emerald-500/10 rounded-lg shrink-0">
            <Percent size={16} />
          </div>
          <div>
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">Unrealized profit/loss</span>
            <span className={`font-bold font-mono text-sm block ${unrealizedPnL.ngn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {unrealizedPnL.ngn >= 0 ? '+' : ''}₦{unrealizedPnL.ngn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({unrealizedPnL.percent.toFixed(2)}%)
            </span>
          </div>
        </div>
      </section>

      {/* Main Container */}
      <main className="flex-1 overflow-x-hidden p-6 space-y-6" id="dashboard-main">

        {/* 1. DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6" id="view-dashboard">
            {/* Top Row: AI Picks Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Alpha Picks (Confidence >= 70%) */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6" id="grid-alpha-picks">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1 px-2.5 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded font-bold font-mono text-xs">HOT</div>
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-white">⭐ Premium Alpha Picks</h2>
                </div>
                {alphaPicks.length === 0 ? (
                  <div className="h-44 flex flex-col justify-center items-center text-center text-xs text-neutral-500 border border-dashed border-neutral-800 rounded-xl bg-neutral-950/50">
                    <Sparkles size={20} className="text-neutral-700 mb-2" />
                    <span>No premium Alpha picks generated today with confidence ≥70%.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {alphaPicks.map(sig => (
                      <div key={sig.ticker} className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl flex items-center justify-between">
                        <div>
                          <div className="text-xs font-semibold text-neutral-400">COMPUTE {sig.date}</div>
                          <span className="text-xl font-black text-white">{sig.ticker}</span>
                          <span className="block font-mono text-xs font-bold text-neutral-300 mt-1">Price: ₦{sig.price.toFixed(2)}</span>
                          <span className="text-[10px] text-neutral-400 block mt-1.5">Exp Return: +{sig.expectedReturn.toFixed(1)}%</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-neutral-500 uppercase block mb-1">M-Prob</span>
                          <span className="text-2xl font-black font-mono text-emerald-400">{(sig.confidence).toFixed(0)}%</span>
                          {/* Targets specs */}
                          <div className="text-[9px] text-neutral-500 mt-1 font-mono font-bold">
                            <div>Target: ₦{sig.conservativeTarget.toFixed(2)}</div>
                            <div>Stop: ₦{sig.stopLoss.toFixed(2)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Hidden Gems (Price < 50 && Confidence >= 60%) */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6" id="grid-hidden-gems">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1 px-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-bold font-mono text-xs">GEM</div>
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-white">💎 Hidden Gems (&lt;₦50)</h2>
                </div>
                {hiddenGems.length === 0 ? (
                  <div className="h-44 flex flex-col justify-center items-center text-center text-xs text-neutral-500 border border-dashed border-neutral-800 rounded-xl bg-neutral-950/50">
                    <Award size={20} className="text-neutral-700 mb-2" />
                    <span>No penny value Gems (&lt;₦50) found displaying confidence ≥60%.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {hiddenGems.map(sig => (
                      <div key={sig.ticker} className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl flex items-center justify-between">
                        <div>
                          <div className="text-xs font-semibold text-violet-400 font-mono tracking-wide">VALUE BIAS</div>
                          <span className="text-xl font-black text-white">{sig.ticker}</span>
                          <span className="block font-mono text-xs font-bold text-neutral-300 mt-1">Price: ₦{sig.price.toFixed(2)}</span>
                          <span className="text-[10px] text-neutral-400 block mt-1.5">Exp Return: +{sig.expectedReturn.toFixed(1)}%</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-neutral-500 uppercase block mb-1">M-Prob</span>
                          <span className="text-2xl font-black font-mono text-violet-400">{(sig.confidence).toFixed(0)}%</span>
                          {/* Targets specs */}
                          <div className="text-[9px] text-neutral-500 mt-1 font-mono font-bold">
                            <div>Target: ₦{sig.conservativeTarget.toFixed(2)}</div>
                            <div>Stop: ₦{sig.stopLoss.toFixed(2)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Bottom Row: Market Overview & Stock Candlestick Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column: All Signals Tree list */}
              <div className="lg:col-span-1 bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col h-[520px]">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-white mb-4 flex items-center gap-1.5">
                  <Database size={15} />
                  <span>Ensemble Predictions Feed</span>
                </h2>
                
                <div className="overflow-y-auto flex-1 pr-1 space-y-2 " id="signals-tree-feed">
                  {predictions.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-center text-xs text-neutral-500">
                      <span>No predictive signals calculated yet. Run walk-forward calibration first.</span>
                    </div>
                  ) : (
                    predictions.map(sig => (
                      <button
                        id={`select-stock-${sig.ticker}`}
                        key={sig.ticker}
                        onClick={() => setSelectedTicker(sig.ticker)}
                        className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                          selectedTicker === sig.ticker 
                            ? 'bg-emerald-950/40 border-emerald-500/50 shadow-lg shadow-emerald-500/5' 
                            : 'bg-neutral-950 border-neutral-850 hover:border-neutral-700'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">{sig.ticker}</span>
                            {sig.isAlpha && (
                              <span className="bg-yellow-500/20 text-yellow-400 text-[8px] font-bold px-1 py-0.5 rounded uppercase leading-none">ALPHA</span>
                            )}
                            {sig.isHiddenGem && (
                              <span className="bg-violet-500/20 text-violet-400 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase leading-none">GEM</span>
                            )}
                          </div>
                          <span className="text-xs text-neutral-400 font-mono mt-0.5 block">Last Trade: ₦{sig.price.toFixed(2)}</span>
                        </div>
                        
                        <div className="text-right">
                          <span className="text-[10px] text-neutral-500 uppercase block leading-none mb-0.5">Confidence</span>
                          <span className={`font-mono text-sm font-black leading-none ${sig.confidence >= 70 ? 'text-emerald-400' : 'text-neutral-300'}`}>
                            {sig.confidence.toFixed(1)}%
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Right Column (ColSpan=2): Quantitative Research Chart Analyzer */}
              <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col h-[520px]">
                <div className="flex flex-col sm:flex-row items-center sm:justify-between justify-center gap-3 mb-6 shrink-0">
                  <div>
                    <h2 className="text-md font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <span>👁️ {selectedTicker} Deep Technical Analyzer</span>
                    </h2>
                    <p className="text-xs text-neutral-400 mt-1">Simulated 5-year daily charting profile with technical indicators overlays</p>
                  </div>

                  {/* Chart config control */}
                  <div className="flex items-center bg-neutral-950 p-1 border border-neutral-800 rounded-lg">
                    <button
                      id="chart-mode-price-btn"
                      onClick={() => setChartMode('price')}
                      className={`px-3 py-1.5 rounded text-xs font-semibold uppercase leading-none transition-all cursor-pointer ${
                        chartMode === 'price' ? 'bg-neutral-850 text-emerald-400 font-bold' : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      Price &amp; SMAs
                    </button>
                    <button
                      id="chart-mode-inds-btn"
                      onClick={() => setChartMode('indicators')}
                      className={`px-3 py-1.5 rounded text-xs font-semibold uppercase leading-none transition-all cursor-pointer ${
                        chartMode === 'indicators' ? 'bg-neutral-850 text-emerald-400 font-bold' : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      RSI &amp; CMF
                    </button>
                  </div>
                </div>

                {/* Primary Chart Box */}
                <div className="flex-1 w-full min-h-[300px]">
                  {historicalData.length === 0 ? (
                    <div className="h-full flex flex-col justify-center items-center text-neutral-500 text-xs">
                      <RefreshCw className="animate-spin mb-3 text-emerald-500" size={24} />
                      <span>Loading historical dataset...</span>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      {chartMode === 'price' ? (
                        <AreaChart data={historicalData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                          <defs>
                            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                          <XAxis dataKey="date" stroke="#6b7280" style={{ fontSize: 9, fontFamily: 'monospace' }} />
                          <YAxis domain={['auto', 'auto']} stroke="#6b7280" style={{ fontSize: 9, fontFamily: 'monospace' }} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: 12, fontSize: 11 }}
                            labelStyle={{ color: '#9ca3af', fontWeight: 'bold' }}
                          />
                          <Legend wrapperStyle={{ fontSize: 10, marginTop: 4 }} />
                          <Area type="monotone" name="Close Price (₦)" dataKey="close" stroke="#10b981" fillOpacity={1} fill="url(#colorPrice)" strokeWidth={2} />
                          <Line type="monotone" name="SMA20" dataKey="sma20" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
                          <Line type="monotone" name="SMA50" dataKey="sma50" stroke="#3b82f6" strokeWidth={1.5} dot={false} />
                        </AreaChart>
                      ) : (
                        <AreaChart data={historicalData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                          <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                          <XAxis dataKey="date" stroke="#6b7280" style={{ fontSize: 9, fontFamily: 'monospace' }} />
                          <YAxis stroke="#6b7280" style={{ fontSize: 9, fontFamily: 'monospace' }} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: 12, fontSize: 11 }}
                          />
                          <Legend wrapperStyle={{ fontSize: 10, marginTop: 4 }} />
                          <Area type="monotone" name="RSI (14)" dataKey="rsi" stroke="#8b5cf6" strokeWidth={2} fill="#8b5cf6" fillOpacity={0.06} />
                          <Line type="monotone" name="CMF (20)" dataKey="cmf" stroke="#06b6d4" strokeWidth={1.5} dot={false} />
                        </AreaChart>
                      )}
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Selected Ticker Quick Metrics footer of chart box */}
                {quotes[selectedTicker] && (
                  <div className="mt-4 pt-4 border-t border-neutral-800 grid grid-cols-4 gap-2 text-center" id="chart-extra-details">
                    <div>
                      <span className="text-[9px] text-neutral-500 uppercase block">Daily Open</span>
                      <span className="font-mono text-xs font-bold text-white">₦{(quotes[selectedTicker].open).toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-neutral-500 uppercase block">Session Intraday High</span>
                      <span className="font-mono text-xs font-bold text-emerald-400">₦{(quotes[selectedTicker].high).toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-neutral-500 uppercase block">Session Intraday Low</span>
                      <span className="font-mono text-xs font-bold text-red-400">₦{(quotes[selectedTicker].low).toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-neutral-500 uppercase block">Trading volume</span>
                      <span className="font-mono text-xs font-bold text-white">{(quotes[selectedTicker].volume).toLocaleString()}</span>
                    </div>
                  </div>
                )}

              </div>

            </div>
          </div>
        )}


        {/* 2. BACKTEST ENGINE TAB */}
        {activeTab === 'backtest' && (
          <div className="space-y-6" id="view-backtest">
            
            {/* Global metrics ribbon */}
            {backtestInfo && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4" id="backtest-pockets-summary">
                <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-2xl">
                  <span className="text-xs text-neutral-400 font-semibold uppercase block tracking-wider mb-1">Global Target Hit Rate</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black font-mono text-emerald-400">{backtestInfo.overallHitRate.toFixed(1)}%</span>
                  </div>
                  <p className="text-[10px] text-neutral-500 mt-2">Percentage of model alerts yielding &gt;2% in 5-day horizon</p>
                </div>

                <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-2xl">
                  <span className="text-xs text-neutral-400 font-semibold uppercase block tracking-wider mb-1">Overall Return per Signal</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black font-mono text-emerald-400">+{backtestInfo.overallAvgReturnPercent.toFixed(2)}%</span>
                  </div>
                  <p className="text-[10px] text-neutral-500 mt-2">Average 5-day return across all historical alerts</p>
                </div>

                <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-2xl">
                  <span className="text-xs text-neutral-400 font-semibold uppercase block tracking-wider mb-1">Profit Factor</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black font-mono text-emerald-400">{backtestInfo.overallProfitFactor}</span>
                  </div>
                  <p className="text-[10px] text-neutral-500 mt-2">Gross simulated gains divided by gross simulated losses</p>
                </div>

                <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-2xl">
                  <span className="text-xs text-neutral-400 font-semibold uppercase block tracking-wider mb-1">Simulated Sample size</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black font-mono text-white">{backtestInfo.totalSimulatedSignals.toLocaleString()}</span>
                  </div>
                  <p className="text-[10px] text-neutral-500 mt-2">Total actionable signals backtested over the 5-year window</p>
                </div>
              </div>
            )}

            {/* Main grid analysis split and charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Backtest metrics chart */}
              <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-2xl p-6 h-[500px] flex flex-col">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-white mb-4">📈 OOS Backtest Returns by Ticker</h3>
                <div className="flex-1 w-full min-h-[300px]">
                  {backtestInfo ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={Object.values(backtestInfo.metrics).filter((m: any) => m.totalSignals > 0)} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                        <XAxis dataKey="ticker" stroke="#9ca3af" style={{ fontSize: 9 }} />
                        <YAxis stroke="#9ca3af" style={{ fontSize: 9 }} label={{ value: 'Average Trade Return (%)', angle: -90, position: 'insideLeft', style: { fill: '#9ca3af', fontSize: 10 } }} />
                        <Tooltip contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: 12, fontSize: 11 }} />
                        <Bar dataKey="avgReturnPercent" fill="#10b981" radius={[4, 4, 0, 0]} name="Average Trade Return" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-neutral-500">
                      <span>Analyzing backtest metrics...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Backtest tabular grid analysis panel */}
              <div className="lg:col-span-1 bg-neutral-900 border border-neutral-800 rounded-2xl p-6 h-[500px] flex flex-col">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-white mb-2">📊 Ticker Backtest Grid</h3>
                <p className="text-[10px] text-neutral-400 mb-4">Complete overview of out-of-sample walk-forward results</p>

                <div className="overflow-y-auto flex-1 pr-1 space-y-2 font-mono text-xs">
                  {backtestInfo ? (
                    Object.values(backtestInfo.metrics).map((m: any) => (
                      <div key={m.ticker} className="bg-neutral-950 border border-neutral-850 rounded-xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between border-b border-neutral-850 pb-1.5">
                          <span className="font-bold text-sm text-white">{m.ticker}</span>
                          <span className={`font-black uppercase text-[10px] px-2 py-0.5 rounded leading-none ${
                            m.hitRate >= 65 ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/30' :
                            m.hitRate >= 50 ? 'bg-amber-950/40 text-amber-500 border border-amber-500/30' : 'bg-red-950/40 text-red-500'
                          }`}>
                            HR: {m.hitRate.toFixed(0)}%
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-[10px] text-neutral-400">
                          <div>Avg Return: <span className="font-bold text-neutral-200">+{m.avgReturnPercent.toFixed(2)}%</span></div>
                          <div>Profit Factor: <span className="font-bold text-neutral-200">{m.profitFactor}</span></div>
                          <div>Wins/Losses: <span className="font-bold text-neutral-200">{m.winningTrades}W / {m.losingTrades}L</span></div>
                          <div>Signal Count: <span className="font-bold text-neutral-200">{m.totalSignals} alerts</span></div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-neutral-500">
                      <span>Compiling backtest statistics...</span>
                    </div>
                  )}
                </div>
              </div>

            </div>

          </div>
        )}


        {/* 3. PORTFOLIO / PAPER TRADING TAB */}
        {activeTab === 'portfolio' && (
          <div className="space-y-6" id="view-portfolio">
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Side: Order Entry Pad */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 h-fit" id="container-order-pad">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-white mb-2">⚡ Secure Transaction Pad</h3>
                <p className="text-xs text-neutral-400 mb-6">Invest with initial simulated ₦1,000,000 portfolio fund. Trades suffer standard 0.5% slide fee commissions.</p>
                
                <form onSubmit={handleOrderExecution} className="space-y-5">
                  {/* BUY / SELL selector */}
                  <div>
                    <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-2">Order Direction</label>
                    <div className="grid grid-cols-2 gap-2 bg-neutral-950 p-1 border border-neutral-800 rounded-lg">
                      <button
                        id="order-side-buy"
                        type="button"
                        onClick={() => setTradeAction('BUY')}
                        className={`py-2 text-xs font-bold rounded-md tracking-wider uppercase transition-all cursor-pointer ${
                          tradeAction === 'BUY' ? 'bg-emerald-50 text-neutral-950 shadow-md shadow-emerald-500/10' : 'text-neutral-400 hover:text-neutral-200'
                        }`}
                      >
                        Buy Order
                      </button>
                      <button
                        id="order-side-sell"
                        type="button"
                        onClick={() => setTradeAction('SELL')}
                        className={`py-2 text-xs font-bold rounded-md tracking-wider uppercase transition-all cursor-pointer ${
                          tradeAction === 'SELL' ? 'bg-red-500 text-neutral-950 shadow-md shadow-red-500/10' : 'text-neutral-400 hover:text-neutral-200'
                        }`}
                      >
                        Sell Order
                      </button>
                    </div>
                  </div>

                  {/* Stock select */}
                  <div>
                    <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-1.5">Asset Ticker</label>
                    <select
                      id="order-ticker-select"
                      value={tradeTicker}
                      onChange={(e) => setTradeTicker(e.target.value)}
                      className="w-full bg-neutral-950 text-white text-sm border border-neutral-800 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500/45 transition-colors font-semibold"
                    >
                      {Object.keys(quotes).map(t => (
                        <option key={t} value={t}>{t} (₦{(quotes[t]?.price || 0).toFixed(2)})</option>
                      ))}
                    </select>
                  </div>

                  {/* Quantity */}
                  <div>
                    <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-1.5">Shares Quantity</label>
                    <input
                      id="order-shares-input"
                      type="number"
                      required
                      min={10}
                      step={10}
                      value={tradeShares}
                      onChange={(e) => setTradeShares(Math.max(10, parseInt(e.target.value, 10)))}
                      className="w-full bg-neutral-950 border border-neutral-800 text-white rounded-xl text-sm px-4 py-3 focus:outline-none focus:border-emerald-500/40 transition-colors font-mono font-bold"
                    />
                  </div>

                  {/* Pricing and fee summary */}
                  {quotes[tradeTicker] && (
                    <div className="bg-neutral-950 border border-neutral-850 rounded-xl p-4 text-xs space-y-1.5 font-mono" id="order-pricing-summary">
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Share Pricing:</span>
                        <span className="text-white font-bold">₦{quotes[tradeTicker].price.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Principal shares cost:</span>
                        <span className="text-white">₦{(quotes[tradeTicker].price * tradeShares).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Slippage Commissions (0.5%):</span>
                        <span className="text-neutral-400">₦{(quotes[tradeTicker].price * tradeShares * 0.005).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="border-t border-neutral-850 pt-1.5 mt-1.5 flex justify-between font-bold text-sm">
                        <span className="text-neutral-300">Net order cost:</span>
                        <span className="text-emerald-400">₦{(quotes[tradeTicker].price * tradeShares * (tradeAction === 'BUY' ? 1.005 : 0.995)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  )}

                  {/* Feedback indicators */}
                  {tradeError && (
                    <div className="p-3 bg-red-950/40 border border-red-500/20 rounded-xl text-red-300 text-xs flex items-center gap-2">
                      <AlertTriangle size={14} className="text-red-400 shrink-0" />
                      <span>{tradeError}</span>
                    </div>
                  )}

                  {tradeSuccess && (
                    <div className="p-3 bg-emerald-950/40 border border-emerald-500/20 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
                      <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                      <span>{tradeSuccess}</span>
                    </div>
                  )}

                  {/* Submit Order action */}
                  <button
                    id="order-execute-btn"
                    type="submit"
                    className={`w-full py-3.5 text-neutral-950 font-bold uppercase rounded-xl text-xs tracking-wider transition-all cursor-pointer shadow-lg ${
                      tradeAction === 'BUY' 
                        ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/10' 
                        : 'bg-red-500 hover:bg-red-600 shadow-red-500/10'
                    }`}
                  >
                    Transmit {tradeAction} execution order
                  </button>

                  <div className="text-center pt-2">
                    <button
                      id="reset-portfolio-btn"
                      type="button"
                      onClick={resetPortfolio}
                      className="inline-flex items-center gap-1.5 text-[10px] text-neutral-500 hover:text-red-400 uppercase tracking-widest transition-all font-bold cursor-pointer bg-transparent border-none"
                    >
                      <RotateCcw size={11} />
                      <span>Hard reset Balance</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Right Side: Current Positions list & Logs */}
              <div className="lg:col-span-2 space-y-6 flex flex-col justify-between" id="container-portfolio-overview">
                
                {/* Positions list */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-white mb-4">💼 Current Asset Hold</h3>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse" id="portfolio-positions-table">
                      <thead>
                        <tr className="border-b border-neutral-800 font-mono text-[9px] text-neutral-500 uppercase tracking-widest">
                          <th className="pb-3 pr-2">Asset Ticker</th>
                          <th className="pb-3 px-2">Hold shares</th>
                          <th className="pb-3 px-2 text-right font-semibold">Average Cost</th>
                          <th className="pb-3 px-2 text-right font-semibold">Current Price</th>
                          <th className="pb-3 px-2 text-right font-semibold">Market Value</th>
                          <th className="pb-3 pl-2 text-right font-semibold">PnL (%)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-850 text-xs">
                        {Object.keys(portfolio.positions).length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-6 text-center text-neutral-500">
                              No open holdings. Put in a BUY transaction order to get started!
                            </td>
                          </tr>
                        ) : (
                          Object.values(portfolio.positions).map((pos: any) => {
                            const latestPrice = quotes[pos.ticker]?.price || pos.averagePrice;
                            const mktVal = pos.shares * latestPrice;
                            const profit = mktVal - pos.totalCost;
                            const profitPct = pos.totalCost === 0 ? 0 : (profit / pos.totalCost) * 100;
                            
                            return (
                              <tr key={pos.ticker} className="hover:bg-neutral-950/20">
                                <td className="py-3 pr-2 font-bold text-white">{pos.ticker}</td>
                                <td className="py-3 px-2 font-mono">{pos.shares.toLocaleString()}</td>
                                <td className="py-3 px-2 text-right font-mono">₦{pos.averagePrice.toFixed(2)}</td>
                                <td className="py-3 px-2 text-right font-mono">₦{latestPrice.toFixed(2)}</td>
                                <td className="py-3 px-2 text-right font-mono font-bold text-neutral-100">₦{mktVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td className={`py-3 pl-2 text-right font-mono font-bold ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {profit >= 0 ? '+' : ''}{profitPct.toFixed(2)}%
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Dividend Monitor Dashboard */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                     <h3 className="text-sm font-semibold uppercase tracking-wider text-white">💰 Passive Income Yield Monitor</h3>
                     <div className="text-right">
                       <span className="text-[10px] text-neutral-400 uppercase tracking-widest block">Est. Annual Passive Income</span>
                       <span className="text-lg font-bold font-mono text-emerald-400 block leading-tight">
                         ₦{projectedPassiveIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                       </span>
                     </div>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-neutral-800 font-mono text-[9px] text-neutral-500 uppercase tracking-widest">
                          <th className="pb-3 pr-2">Ticker</th>
                          <th className="pb-3 px-2 text-right">Yield (%)</th>
                          <th className="pb-3 px-2 text-right">Dividend/Share</th>
                          <th className="pb-3 px-2 text-right">Ex-Dividend</th>
                          <th className="pb-3 pl-2 text-right">Payout Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-850 text-xs">
                        {Object.keys(dividends).length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-neutral-500">
                              System syncing upcoming dividend schedules...
                            </td>
                          </tr>
                        ) : (
                          Object.values(dividends).map((div: DividendInfo) => {                            
                            return (
                              <tr key={div.ticker} className="hover:bg-neutral-950/20">
                                <td className="py-3 pr-2 font-bold text-white">{div.ticker}</td>
                                <td className="py-3 px-2 text-right font-mono text-emerald-400 font-bold">{div.yieldPct.toFixed(2)}%</td>
                                <td className="py-3 px-2 text-right font-mono">₦{div.amountPerShare.toFixed(2)}</td>
                                <td className="py-3 px-2 text-right font-mono text-neutral-300">{div.exDividendDate}</td>
                                <td className="py-3 pl-2 text-right font-mono text-neutral-300">{div.paymentDate}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Audit Trade Logs */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col h-[280px]">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-white mb-3">📜 Transaction History Ledger</h3>
                  
                  <div className="overflow-y-auto flex-1 pr-1 space-y-2 text-[11px] font-mono" id="portfolio-ledger-feed">
                    {portfolio.logs.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-neutral-500 text-xs font-sans">
                        <span>No transactions recorded. Active trading will populate audit ledger.</span>
                      </div>
                    ) : (
                      portfolio.logs.map(log => (
                        <div key={log.id} className="bg-neutral-950 border border-neutral-850 p-2.5 rounded-xl flex items-center justify-between">
                          <div>
                            <span className={`inline-block font-bold px-1.5 py-0.5 rounded text-[8px] mr-2 ${
                              log.type === 'BUY' ? 'bg-emerald-950/55 text-emerald-400' : 'bg-red-950/55 text-red-400'
                            }`}>
                              {log.type}
                            </span>
                            <span className="font-bold text-white uppercase">{log.ticker}</span>
                            <span className="text-[10px] text-neutral-400 block mt-1">
                              Quantity: {log.shares.toLocaleString()} @ ₦{log.price.toFixed(2)} • {log.dateTimeStr}
                            </span>
                          </div>
                          
                          <div className="text-right">
                            <span className="text-[10px] text-neutral-500 block">ID: {log.id}</span>
                            <span className="font-bold text-neutral-200">₦{log.totalNgn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

            </div>

          </div>
        )}


        {/* 4. MODEL CALIBRATION TAB */}
        {activeTab === 'models' && (
          <div className="space-y-6" id="view-models">
            
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6" id="models-tuning-panel">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800 pb-6 mb-6">
                <div>
                  <h3 className="text-md font-bold uppercase tracking-wider text-white flex items-center gap-2">
                    <Cpu size={18} className="text-emerald-400" />
                    <span>Ensemble Model Walk-Forward Calibration Status</span>
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1">Each ticker trains our proprietary Random-Forest Tree ensemble (adapted to node constraints). Walk-forward TimeSeriesSplit OOS threshold level is set to 60.0% accuracy.</p>
                </div>

                <button
                  id="rebuild-models-btn"
                  onClick={triggerModelRetraining}
                  disabled={isRetraining}
                  className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-neutral-950 font-bold uppercase py-3.5 px-6 rounded-xl text-xs tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/10 shrink-0 border-none"
                >
                  {isRetraining ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>Retraining Ensembles...</span>
                    </>
                  ) : (
                    <>
                      <Play size={13} fill="currentColor" />
                      <span>Recalibrate All Models</span>
                    </>
                  )}
                </button>
              </div>

              {/* Grid status overview columns */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4" id="models-calib-grid">
                {Object.keys(modelsStatus).length === 0 ? (
                  <div className="col-span-full py-12 text-center text-xs text-neutral-500">
                    <RefreshCw className="animate-spin mb-3 mx-auto text-emerald-400" size={24} />
                    <span>Analyzing trained classifier endpoints...</span>
                  </div>
                ) : (
                  Object.keys(modelsStatus).map(ticker => {
                    const model = modelsStatus[ticker];
                    const accuracyPct = model.accuracy * 100;
                    
                    return (
                      <div key={ticker} className="bg-neutral-950 border border-neutral-850 rounded-xl p-4 flex flex-col justify-between space-y-3 font-mono text-xs">
                        <div className="flex items-center justify-between border-b border-neutral-850 pb-2">
                          <span className="font-bold text-sm text-white">{ticker}</span>
                          <span className={`w-2.5 h-2.5 rounded-full ${model.isReliable ? 'bg-emerald-400' : 'bg-red-400'}`} title={model.isReliable ? 'Reliable' : 'Unreliable'} />
                        </div>
                        
                        <div>
                          <span className="text-[9px] text-neutral-500 uppercase block">OOS Accuracy</span>
                          <span className={`text-lg font-black ${model.isReliable ? 'text-emerald-400' : 'text-neutral-400'}`}>
                            {accuracyPct.toFixed(1)}%
                          </span>
                        </div>

                        <div>
                          <span className="text-[9px] text-neutral-500 uppercase block">Verdict Status</span>
                          <span className={`font-sans font-bold text-[10px] uppercase block tracking-wider ${
                            model.isReliable ? 'text-emerald-400' : 'text-red-400/95'
                          }`}>
                            {model.isReliable ? '● Active Reliable' : '● Inactive'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>
        )}

      </main>

      {/* Persistent Disclaimer/Footer bar */}
      <footer className="bg-neutral-900 border-t border-neutral-855 py-4 px-6 text-center text-xs text-neutral-500 font-mono flex flex-col md:flex-row justify-between items-center gap-2" id="app-footer">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-emerald-500" />
          <span>© 2026 NGX Predictor Suite. NGX simulated models configured strictly under academic and sandbox metrics.</span>
        </div>
        <div>
          <span>PORT: 3000 • DESTRUCT_DAEMON_15MIN</span>
        </div>
      </footer>

    </div>
  );
}
