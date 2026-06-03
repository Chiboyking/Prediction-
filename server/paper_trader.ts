import fs from 'fs';
import path from 'path';
import { CONFIG } from './config.ts';
import { DataFetcher } from './data_fetcher.ts';

export interface Position {
  ticker: string;
  shares: number;
  avgPrice: number;
  currentPrice: number;
  profitLossPct: number;
}

export interface Transaction {
  id: string;
  ticker: string;
  shares: number;
  price: number;
  type: 'BUY' | 'SELL';
  date: string;
  totalValue: number;
}

export interface PortfolioState {
  cash: number;
  totalValue: number;
  positionsValue: number;
  overallReturnPct: number;
  positions: Position[];
  history: Transaction[];
}

export class PaperTrader {
  private static getFilePath(): string {
    return path.join(CONFIG.DATA_DIR, 'portfolio.json');
  }

  // App API routing mappings getters and hooks
  public static initialize(): void {
    this.initPortfolio();
  }

  public static getSnapshot(): PortfolioState {
    return this.loadState();
  }

  public static buy(ticker: string, shares: number, price: number): { success: boolean; message: string } {
    return this.executeTrade(ticker, shares, price, 'BUY');
  }

  public static sell(ticker: string, shares: number, price: number): { success: boolean; message: string } {
    return this.executeTrade(ticker, shares, price, 'SELL');
  }

  // Set up portfolio ledger with baseline initial balance
  public static initPortfolio(): void {
    const file = this.getFilePath();
    if (!fs.existsSync(CONFIG.DATA_DIR)) {
      fs.mkdirSync(CONFIG.DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(file)) {
      const state: PortfolioState = {
        cash: CONFIG.INITIAL_BALANCE,
        totalValue: CONFIG.INITIAL_BALANCE,
        positionsValue: 0,
        overallReturnPct: 0.0,
        positions: [],
        history: []
      };
      fs.writeFileSync(file, JSON.stringify(state, null, 2), 'utf-8');
      console.log(`[PaperTrader] Generated clean account portfolio with ₦${CONFIG.INITIAL_BALANCE.toLocaleString()} cash balance.`);
    }
  }

  // Get current account ledger, updating stock prices in real time
  public static loadState(): PortfolioState {
    const file = this.getFilePath();
    this.initPortfolio();

    const raw = fs.readFileSync(file, 'utf-8');
    const state: PortfolioState = JSON.parse(raw);

    // Refresh holding positions current price valuations
    let positionsValue = 0;
    state.positions = state.positions.map(pos => {
      const liveHistory = DataFetcher.getStockHistory(pos.ticker, 1);
      const currentPrice = liveHistory.length > 0 ? liveHistory[0].close : pos.avgPrice;
      const profitLossPct = Number((((currentPrice - pos.avgPrice) / pos.avgPrice) * 100).toFixed(2));
      positionsValue += pos.shares * currentPrice;

      return {
        ...pos,
        currentPrice,
        profitLossPct
      };
    });

    state.positionsValue = Number(positionsValue.toFixed(2));
    state.totalValue = Number((state.cash + positionsValue).toFixed(2));
    state.overallReturnPct = Number((((state.totalValue - CONFIG.INITIAL_BALANCE) / CONFIG.INITIAL_BALANCE) * 100).toFixed(2));

    // Save recalculated state
    fs.writeFileSync(file, JSON.stringify(state, null, 2), 'utf-8');
    return state;
  }

  // Submit and execute order slip
  public static executeTrade(ticker: string, shares: number, price: number, type: 'BUY' | 'SELL'): { success: boolean; message: string } {
    const state = this.loadState();
    
    // Safety check price
    const liveHistory = DataFetcher.getStockHistory(ticker, 1);
    const executionPrice = liveHistory.length > 0 ? liveHistory[0].close : price;
    const orderCost = shares * executionPrice;

    if (type === 'BUY') {
      if (state.cash < orderCost) {
        return { success: false, message: `Insufficient cash holdings. Order requires ₦${orderCost.toLocaleString()}, but only ₦${state.cash.toLocaleString()} available.` };
      }

      state.cash = Number((state.cash - orderCost).toFixed(2));

      const existingPos = state.positions.find(p => p.ticker === ticker);
      if (existingPos) {
        const totalShares = existingPos.shares + shares;
        const avgPrice = ((existingPos.shares * existingPos.avgPrice) + orderCost) / totalShares;
        existingPos.shares = totalShares;
        existingPos.avgPrice = Number(avgPrice.toFixed(2));
      } else {
        state.positions.push({
          ticker,
          shares,
          avgPrice: Number(executionPrice.toFixed(2)),
          currentPrice: Number(executionPrice.toFixed(2)),
          profitLossPct: 0.0
        });
      }
    } else {
      const posIdx = state.positions.findIndex(p => p.ticker === ticker);
      if (posIdx === -1 || state.positions[posIdx].shares < shares) {
        const sharesHeld = posIdx === -1 ? 0 : state.positions[posIdx].shares;
        return { success: false, message: `Short selling denied. Requested liquidation of ${shares} shares of ${ticker}, but only hold ${sharesHeld} shares.` };
      }

      const orderGain = shares * executionPrice;
      state.cash = Number((state.cash + orderGain).toFixed(2));

      const pos = state.positions[posIdx];
      pos.shares -= shares;
      if (pos.shares === 0) {
        state.positions.splice(posIdx, 1);
      }
    }

    const tx: Transaction = {
      id: `TX-${Math.floor(100000 + Math.random() * 8990000)}`,
      ticker,
      shares,
      price: Number(executionPrice.toFixed(2)),
      type,
      date: new Date().toISOString(),
      totalValue: Number(orderCost.toFixed(2))
    };

    state.history.unshift(tx); // prepend to show latest transactions first

    // Recalculate valuations
    const postPositionsVal = state.positions.reduce((acc, p) => acc + (p.shares * p.currentPrice), 0);
    state.positionsValue = Number(postPositionsVal.toFixed(2));
    state.totalValue = Number((state.cash + postPositionsVal).toFixed(2));
    state.overallReturnPct = Number((((state.totalValue - CONFIG.INITIAL_BALANCE) / CONFIG.INITIAL_BALANCE) * 100).toFixed(2));

    fs.writeFileSync(this.getFilePath(), JSON.stringify(state, null, 2), 'utf-8');
    return { success: true, message: `Successfully executed physical mock paper order: ${type} ${shares.toLocaleString()} shares of ${ticker} at ₦${executionPrice.toFixed(2)}.` };
  }
}
