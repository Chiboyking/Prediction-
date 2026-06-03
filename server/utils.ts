import fs from 'fs';
import path from 'path';

// Math helpers
export function getSMA(prices: number[], period: number): number[] {
  const sma: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      sma.push(prices[i]);
    } else {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
  }
  return sma;
}

export function getEMA(prices: number[], period: number): number[] {
  const ema: number[] = [];
  if (prices.length === 0) return ema;
  const k = 2 / (period + 1);
  ema.push(prices[0]);
  for (let i = 1; i < prices.length; i++) {
    ema.push(prices[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

export function getRSI(prices: number[], period: number = 14): number[] {
  const rsi: number[] = new Array(prices.length).fill(50);
  if (prices.length <= period) return rsi;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return rsi;
}

// CSV utility helpers
export function writeCSV(filePath: string, headers: string[], rows: any[][]): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const csvContent = [headers.join(',')].concat(rows.map(r => r.join(','))).join('\n');
  fs.writeFileSync(filePath, csvContent);
}

export function parseCSV(filePath: string): any[][] {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf-8').trim();
  if (!content) return [];
  return content.split('\n').map(line => line.split(','));
}
