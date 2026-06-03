export interface DividendInfo {
  ticker: string;
  yieldPct: number;       // Estimated annual yield %
  amountPerShare: number;
  exDividendDate: string; // Ex-dividend date ISO
  paymentDate: string;    // Payment date ISO
}

const DIVIDEND_DATA: Record<string, DividendInfo> = {
  'MTNN': { ticker: 'MTNN', yieldPct: 8.5, amountPerShare: 15.6, exDividendDate: '2024-04-18', paymentDate: '2024-05-24' },
  'ZENITHBANK': { ticker: 'ZENITHBANK', yieldPct: 12.4, amountPerShare: 3.5, exDividendDate: '2024-04-25', paymentDate: '2024-05-08' },
  'GTCO': { ticker: 'GTCO', yieldPct: 8.8, amountPerShare: 3.2, exDividendDate: '2024-04-20', paymentDate: '2024-05-15' },
  'AIRTELAFRI': { ticker: 'AIRTELAFRI', yieldPct: 4.2, amountPerShare: 110, exDividendDate: '2024-06-20', paymentDate: '2024-07-26' },
  'SEPLAT': { ticker: 'SEPLAT', yieldPct: 5.5, amountPerShare: 150, exDividendDate: '2024-05-10', paymentDate: '2024-05-30' },
  'DANGCEM': { ticker: 'DANGCEM', yieldPct: 5.8, amountPerShare: 30.0, exDividendDate: '2024-04-15', paymentDate: '2024-04-30' },
  'NESTLE': { ticker: 'NESTLE', yieldPct: 10.5, amountPerShare: 45.0, exDividendDate: '2024-05-20', paymentDate: '2024-06-15' },
  'BUACEMENT': { ticker: 'BUACEMENT', yieldPct: 6.2, amountPerShare: 2.8, exDividendDate: '2024-07-11', paymentDate: '2024-08-05' },
};

export class DividendMonitor {
  public static getAllDividends(): Record<string, DividendInfo> {
    return DIVIDEND_DATA;
  }

  public static getDividendForTicker(ticker: string): DividendInfo | null {
    return DIVIDEND_DATA[ticker] || null;
  }

  public static calculatePassiveIncome(positions: Array<{ticker: string, shares: number}>): number {
    let projectedIncome = 0;
    for (const pos of positions) {
      const div = DIVIDEND_DATA[pos.ticker];
      if (div) {
        projectedIncome += pos.shares * div.amountPerShare;
      }
    }
    return projectedIncome;
  }
}
