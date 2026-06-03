import express, { Express, Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// CORE CONTROLLER AND SERVICE IMPORTS WITH EXPLICIT EXTENSIONS
import { CONFIG } from './config.ts';
import { DataFetcher } from './data_fetcher.ts';
import { EnsembleModel } from './ensemble_model.ts';
import { Backtester } from './backtest.ts';
import { PaperTrader } from './paper_trader.ts';
import { AuthManager } from './auth.ts';
import { ModelMonitor } from './model_monitor.ts';
import { DividendMonitor } from './dividend_monitor.ts';

// Resolve directory paths for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();

// Express JSON parsing middleware configuration
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- SECURED ROUTE MIDDLEWARES ---
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token || !AuthManager.validateToken(token)) {
    return res.status(401).json({ error: 'Auth token expired or invalid.' });
  }
  next();
}

// --- AUTH SESSION ROUTING ---
app.post('/api/login', (req: Request, res: Response) => {
  const { password } = req.body;
  if (password === CONFIG.DASHBOARD_PASSWORD) {
    const token = AuthManager.createSession();
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Incorrect platform access password.' });
  }
});

app.post('/api/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (token) {
    AuthManager.destorySession(token);
  }
  res.json({ success: true });
});

app.get('/api/verify', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (token && AuthManager.validateToken(token)) {
    res.json({ valid: true });
  } else {
    res.status(401).json({ valid: false });
  }
});

// --- PLATFORM API ENDPOINTS ---

app.get('/api/dashboard', requireAuth, (req: Request, res: Response) => {
  try {
    const liveNaira = DataFetcher.getLiveUsdNgn();
    const signals = EnsembleModel.generatePredictions();
    const metrics = EnsembleModel.getMetrics();

    // Alpha Picks: confidence >= 70%
    const alphaPicks = signals.filter(s => s.confidence >= 70).slice(0, 3);
    
    // Hidden Gems: price < ₦50 and confidence >= 60%
    const hiddenGems = signals.filter(s => s.price < 50 && s.confidence >= 60).slice(0, 4);

    // Ticker market status (simulated: OPEN on weekdays, CLOSED on weekends)
    const day = new Date().getDay();
    const isWeekend = day === 0 || day === 6;
    const tickerStatuses = CONFIG.TICKERS.map(t => ({
      ticker: t,
      status: isWeekend ? 'CLOSED' : 'OPEN' as any
    }));

    res.json({
      alphaPicks,
      hiddenGems,
      allSignals: signals,
      liveUsdNgn: liveNaira,
      tickerStatuses,
      modelMetrics: metrics,
      lastUpdated: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stock-history/:ticker', requireAuth, (req: Request, res: Response) => {
  const ticker = req.params.ticker;
  const allData = DataFetcher.loadAllData();
  const data = allData[ticker];
  if (!data) {
    res.status(404).json({ error: 'Ticker not found' });
  } else {
    // Return last 100 entries for lightweight charts
    res.json(data.slice(-100));
  }
});

app.get('/api/backtest', requireAuth, (req: Request, res: Response) => {
  try {
    const summary = Backtester.backtestSummary();
    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/portfolio', requireAuth, (req: Request, res: Response) => {
  try {
    const snapshot = PaperTrader.getSnapshot();
    res.json(snapshot);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/dividends', requireAuth, (req: Request, res: Response) => {
  try {
    const dividends = DividendMonitor.getAllDividends();
    res.json(dividends);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/portfolio/trade', requireAuth, (req: Request, res: Response) => {
  try {
    const { ticker, shares, price, type } = req.body;
    let result;
    if (type === 'BUY') {
      result = PaperTrader.buy(ticker, shares, price);
    } else if (type === 'SELL') {
      result = PaperTrader.sell(ticker, shares, price);
    } else {
      return res.status(400).json({ error: 'Invalid transaction type.' });
    }
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/monitor', requireAuth, (req: Request, res: Response) => {
  try {
    const logs = ModelMonitor.getLogs();
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/retrain', requireAuth, (req: Request, res: Response) => {
  try {
    const updatedMetrics = EnsembleModel.retrainModels();
    // Audit drift metrics after retraining to update logs
    ModelMonitor.runWeeklyAudit();
    res.json({ success: true, metrics: updatedMetrics });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- BOOTSTRAP DATABASES & DATA ---
export function bootstrap(): void {
  console.log('[NGX Platform] Initializing structural local assets...');
  DataFetcher.initializeDataStorage();
  EnsembleModel.initializeStorage();
  PaperTrader.initialize();
  ModelMonitor.initialize();

  // Warm-up fetching rates and initial metrics
  DataFetcher.fetchUsdNgn();
  const metrics = EnsembleModel.getMetrics();
  if (Object.keys(metrics).length === 0) {
    EnsembleModel.retrainAllModels();
  }
}

// Automatically bootstrap in development/testing context
bootstrap();

// --- BACKGROUND BACKGROUND SERVICES SCHEDULER ---
const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

setInterval(() => {
  try {
    console.log('[Scheduler] Executing 15-minute walk-forward data tick sync...');
    DataFetcher.updateRealtimeTick();
    DataFetcher.fetchUsdNgn();
  } catch (err) {
    console.error('[Scheduler Error] data fetch tick failure:', err);
  }
}, FIFTEEN_MINUTES);

setInterval(() => {
  try {
    console.log('[Scheduler] Running hourly model drift evaluation audit...');
    ModelMonitor.runWeeklyAudit();
  } catch (err) {
    console.error('[Scheduler Error] performance auditing drift check failure:', err);
  }
}, ONE_HOUR);

// Weekly retraining scheduled checks: Runs on Sunday at 2 AM
setInterval(() => {
  const now = new Date();
  if (now.getDay() === 0 && now.getHours() === 2 && now.getMinutes() === 0) {
    try {
      console.log('[Scheduler] Sunday 02:00 AM reached. Auto-optimizing neural walk-forward models...');
      EnsembleModel.retrainAllModels();
      ModelMonitor.runWeeklyAudit();
    } catch (err) {
      console.error('[Scheduler Error] weekly optimization routine failure:', err);
    }
  }
}, 60 * 1000); // Check every minute to find exact hit

export default app;
