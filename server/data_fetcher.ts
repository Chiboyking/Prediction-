import fs from 'fs';
import path from 'path';
import https from 'https';
import { CONFIG } from './config';
import { writeCSV, parseCSV } from './utils';

export interface OHLCV {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface LiveQuote {
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

export class DataFetcher {
  private static liveUsdNgn: number = 1600.0;
  private static liveQuotesCache: Record<string, LiveQuote> = {};

  private static getFilePath(ticker: string): string {
    return path.join(process.cwd(), 'data', 'market', `${ticker}.csv`);
  }

  // Generates 1500 days of realistic synthetic stock price data
  public static generateSyntheticHistory(ticker: string, days: number = 1350): OHLCV[] {
    const history: OHLCV[] = [];
    const startPriceMap: Record<string, number> = {
      MTNN: 220.0,
      AIRTELAFRI: 2100.0,
      DANGCEM: 450.0,
      ZENITHBANK: 35.0,
      GTCO: 42.0,
      FBNH: 22.0,
      ACCESSCORP: 19.5,
      UBA: 24.0,
      TRANSCORP: 12.0,
      WAPCO: 34.0
    };

    let price = startPriceMap[ticker] || 50.0;
    const today = new Date();
    
    const volMap: Record<string, number> = {
      MTNN: 0.018,
      AIRTELAFRI: 0.015,
      DANGCEM: 0.014,
      ZENITHBANK: 0.022,
      GTCO: 0.021,
      FBNH: 0.024,
      ACCESSCORP: 0.023,
      UBA: 0.022,
      TRANSCORP: 0.028,
      WAPCO: 0.019
    };
    const dailyVol = volMap[ticker] || 0.02;

    for (let i = days; i > 0; i--) {
      const curDate = new Date(today);
      curDate.setDate(today.getDate() - i);
      
      const dayOfWeek = curDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      const dateStr = curDate.toISOString().split('T')[0];
      const drift = 0.00015;
      const rand = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
      const returnVal = drift + dailyVol * rand;
      
      const prevClose = price;
      price = price * Math.exp(returnVal);
      if (price < 1.0) price = 1.0;

      const dOpen = prevClose * (1 + (Math.random() * 0.01 - 0.005));
      const dHigh = Math.max(price, dOpen) * (1 + Math.random() * 0.012);
      const dLow = Math.min(price, dOpen) * (1 - Math.random() * 0.012);
      const dVol = Math.floor(200000 + Math.random() * 1800000);

      history.push({
        date: dateStr,
        open: parseFloat(dOpen.toFixed(2)),
        high: parseFloat(dHigh.toFixed(2)),
        low: parseFloat(dLow.toFixed(2)),
        close: parseFloat(price.toFixed(2)),
        volume: dVol
      });
    }

    return history;
  }

  public static initializeDataStorage(): void {
    const dataDir = path.resolve(process.cwd(), 'data');
    const marketDir = path.resolve(dataDir, 'market');
    
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(marketDir)) {
      fs.mkdirSync(marketDir, { recursive: true });
    }

    const headers = ['date', 'open', 'high', 'low', 'close', 'volume'];

    for (const ticker of CONFIG.TICKERS) {
      const file = this.getFilePath(ticker);
      if (!fs.existsSync(file)) {
        console.log(`[SEED ENGINE] Seeding 5 years of historical market OHLCV for ticker: ${ticker}`);
        const ticks = this.generateSyntheticHistory(ticker);
        const rows = ticks.map(t => [t.date, t.open, t.high, t.low, t.close, t.volume]);
        writeCSV(file, headers, rows);
      }
    }

    // Populate the cache with last entries
    for (const ticker of CONFIG.TICKERS) {
      const file = this.getFilePath(ticker);
      const rows = parseCSV(file);
      const lastLine = rows[rows.length - 1];
      
      if (lastLine && lastLine.length >= 6 && lastLine[0] !== 'date') {
        const [date, open, high, low, close, volume] = lastLine;
        this.liveQuotesCache[ticker] = {
          ticker,
          price: parseFloat(close),
          change: 0,
          changePercent: 0,
          open: parseFloat(open),
          high: parseFloat(high),
          low: parseFloat(low),
          volume: parseInt(volume, 10),
          lastUpdated: new Date().toLocaleTimeString()
        };
      }
    }

    this.fetchUsdNgn();
  }

  public static getLiveUsdNgn(): number {
    return this.liveUsdNgn;
  }

  public static getStockHistory(ticker: string, limit: number = 100): OHLCV[] {
    const filePath = this.getFilePath(ticker);
    const rows = parseCSV(filePath);
    
    const parsed: OHLCV[] = [];
    for (const row of rows) {
      if (row.length < 6 || row[0] === 'date' || !row[0]) continue;
      const [date, open, high, low, close, volume] = row;
      parsed.push({
        date,
        open: parseFloat(open),
        high: parseFloat(high),
        low: parseFloat(low),
        close: parseFloat(close),
        volume: parseInt(volume, 10)
      });
    }
    return parsed.slice(-limit).reverse();
  }

  public static loadAllData(): Record<string, OHLCV[]> {
    const result: Record<string, OHLCV[]> = {};
    for (const ticker of CONFIG.TICKERS) {
      const filePath = this.getFilePath(ticker);
      const rows = parseCSV(filePath);
      
      const parsed: OHLCV[] = [];
      for (const row of rows) {
        if (row.length < 6 || row[0] === 'date' || !row[0]) continue;
        const [date, open, high, low, close, volume] = row;
        parsed.push({
          date,
          open: parseFloat(open),
          high: parseFloat(high),
          low: parseFloat(low),
          close: parseFloat(close),
          volume: parseInt(volume, 10)
        });
      }
      result[ticker] = parsed;
    }
    return result;
  }

  public static fetchUsdNgn(): void {
    https.get('https://open.er-api.com/v6/latest/USD', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed && parsed.rates && parsed.rates.NGN) {
            this.liveUsdNgn = parsed.rates.NGN;
            console.log(`[DATA ENG] Pulled live USD/NGN exchange rate: ₦${this.liveUsdNgn.toFixed(2)}`);
          }
        } catch {
          // ignore parsing error
        }
      });
    }).on('error', () => {
      // ignore network fetch failures
    });
  }

  public static updateRealtimeTick(): void {
    const todayStr = new Date().toISOString().split('T')[0];

    for (const ticker of CONFIG.TICKERS) {
      const current = this.liveQuotesCache[ticker];
      if (!current) continue;

      const deltaPercent = (Math.random() * 0.024 - 0.012);
      const change = current.price * deltaPercent;
      const newPrice = Math.max(1.0, parseFloat((current.price + change).toFixed(2)));
      const openPrice = current.open;

      const highPrice = parseFloat(Math.max(current.high, newPrice).toFixed(2));
      const lowPrice = parseFloat(Math.min(current.low, newPrice).toFixed(2));
      const volStep = Math.floor(5000 + Math.random() * 85000);

      this.liveQuotesCache[ticker] = {
        ticker,
        price: newPrice,
        change: parseFloat((newPrice - openPrice).toFixed(2)),
        changePercent: parseFloat(((newPrice - openPrice) / openPrice * 100).toFixed(2)),
        open: current.open,
        high: highPrice,
        low: lowPrice,
        volume: current.volume + volStep,
        lastUpdated: new Date().toLocaleTimeString()
      };

      const file = this.getFilePath(ticker);
      if (fs.existsSync(file)) {
        const lines = fs.readFileSync(file, 'utf-8').trim().split('\n');
        const lastLineIdx = lines.length - 1;
        const lastLine = lines[lastLineIdx];

        if (lastLine) {
          const parts = lastLine.split(',');
          if (parts[0] === todayStr) {
            lines[lastLineIdx] = `${todayStr},${openPrice},${highPrice},${lowPrice},${newPrice},${current.volume + volStep}`;
          } else {
            lines.push(`${todayStr},${newPrice},${newPrice},${newPrice},${newPrice},${volStep}`);
          }
          fs.writeFileSync(file, lines.join('\n'));
        }
      }
    }

    this.liveUsdNgn += (Math.random() * 4 - 2);
  }

  public static getQuotes() {
    return this.liveQuotesCache;
  }
}
