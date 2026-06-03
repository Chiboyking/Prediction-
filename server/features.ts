import { OHLCV } from './data_fetcher.ts';

export interface FeatureRow {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;

  rsi: number;
  macd: number;
  macdSignal: number;
  macdDiff: number;
  sma20: number;
  sma50: number;
  smaRatio: number;
  bbUpper: number;
  bbLower: number;
  bbPctB: number;
  bbWidth: number;
  atr: number;
  adx: number;
  obv: number;
  cmf: number;
  return1d: number;
  return5d: number;
  volatility20d: number;
  volumeRatio: number;
  highLowRatio: number;
  dayOfWeek: number;

  target5d: number; // 5-day forward return binary label
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

function stdDev(arr: number[], avg?: number): number {
  if (arr.length <= 1) return 0;
  const valAvg = avg !== undefined ? avg : mean(arr);
  const sqDiffs = arr.map(val => Math.pow(val - valAvg, 2));
  return Math.sqrt(sqDiffs.reduce((sum, val) => sum + val, 0) / (arr.length - 1));
}

export function engineerFeatures(series: OHLCV[]): FeatureRow[] {
  const n = series.length;
  if (n < 55) return [];

  const features: FeatureRow[] = [];
  const closes = series.map(d => d.close);
  const highs = series.map(d => d.high);
  const lows = series.map(d => d.low);
  const volumes = series.map(d => d.volume);

  const smas20: number[] = new Array(n).fill(0);
  const smas50: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    if (i >= 19) {
      smas20[i] = mean(closes.slice(i - 19, i + 1));
    }
    if (i >= 49) {
      smas50[i] = mean(closes.slice(i - 49, i + 1));
    }
  }

  const calculateEMA = (period: number): number[] => {
    const k = 2 / (period + 1);
    const ema: number[] = new Array(n).fill(0);
    if (n >= period) {
      ema[period - 1] = mean(closes.slice(0, period));
      for (let i = period; i < n; i++) {
        ema[i] = closes[i] * k + ema[i - 1] * (1 - k);
      }
    }
    return ema;
  };

  const ema12 = calculateEMA(12);
  const ema26 = calculateEMA(26);
  
  const macd: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    macd[i] = ema12[i] - ema26[i];
  }

  const macdSignal: number[] = new Array(n).fill(0);
  const macdSignalPeriod = 9;
  const signalK = 2 / (macdSignalPeriod + 1);
  if (n >= 34) {
    let startIdx = 25;
    macdSignal[startIdx + macdSignalPeriod - 1] = mean(macd.slice(startIdx, startIdx + macdSignalPeriod));
    for (let i = startIdx + macdSignalPeriod; i < n; i++) {
      macdSignal[i] = macd[i] * signalK + macdSignal[i - 1] * (1 - signalK);
    }
  }

  const rsi: number[] = new Array(n).fill(0);
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= 14; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= 14;
  avgLoss /= 14;
  rsi[14] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = 15; i < n; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    
    avgGain = (avgGain * 13 + gain) / 14;
    avgLoss = (avgLoss * 13 + loss) / 14;
    
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  const tr: number[] = new Array(n).fill(0);
  const atr: number[] = new Array(n).fill(0);
  tr[0] = highs[0] - lows[0];
  for (let i = 1; i < n; i++) {
    const hl = highs[i] - lows[i];
    const hc_prev = Math.abs(highs[i] - closes[i - 1]);
    const lc_prev = Math.abs(lows[i] - closes[i - 1]);
    tr[i] = Math.max(hl, hc_prev, lc_prev);
  }

  atr[13] = mean(tr.slice(0, 14));
  for (let i = 14; i < n; i++) {
    atr[i] = (atr[i - 1] * 13 + tr[i]) / 14;
  }

  const adx: number[] = new Array(n).fill(0);
  const plusDM: number[] = new Array(n).fill(0);
  const minusDM: number[] = new Array(n).fill(0);

  for (let i = 1; i < n; i++) {
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    
    if (upMove > downMove && upMove > 0) plusDM[i] = upMove;
    if (downMove > upMove && downMove > 0) minusDM[i] = downMove;
  }

  const smoothedPlusDM: number[] = new Array(n).fill(0);
  const smoothedMinusDM: number[] = new Array(n).fill(0);
  const smoothedTR: number[] = new Array(n).fill(0);

  if (n >= 14) {
    smoothedPlusDM[13] = plusDM.slice(1, 14).reduce((sum, v) => sum + v, 0);
    smoothedMinusDM[13] = minusDM.slice(1, 14).reduce((sum, v) => sum + v, 0);
    smoothedTR[13] = tr.slice(1, 14).reduce((sum, v) => sum + v, 0);

    for (let i = 14; i < n; i++) {
      smoothedPlusDM[i] = smoothedPlusDM[i - 1] - (smoothedPlusDM[i - 1] / 14) + plusDM[i];
      smoothedMinusDM[i] = smoothedMinusDM[i - 1] - (smoothedMinusDM[i - 1] / 14) + minusDM[i];
      smoothedTR[i] = smoothedTR[i - 1] - (smoothedTR[i - 1] / 14) + tr[i];

      const plusDI = smoothedTR[i] === 0 ? 0 : 100 * (smoothedPlusDM[i] / smoothedTR[i]);
      const minusDI = smoothedTR[i] === 0 ? 0 : 100 * (smoothedMinusDM[i] / smoothedTR[i]);

      const sumDI = plusDI + minusDI;
      const diffDI = Math.abs(plusDI - minusDI);
      const dx = sumDI === 0 ? 0 : 100 * (diffDI / sumDI);

      if (i === 14) {
        adx[i] = dx;
      } else {
        adx[i] = (adx[i - 1] * 13 + dx) / 14;
      }
    }
  }

  const obv: number[] = new Array(n).fill(0);
  obv[0] = volumes[0];
  for (let i = 1; i < n; i++) {
    if (closes[i] > closes[i - 1]) obv[i] = obv[i - 1] + volumes[i];
    else if (closes[i] < closes[i - 1]) obv[i] = obv[i - 1] - volumes[i];
    else obv[i] = obv[i - 1];
  }

  const bbUpper: number[] = new Array(n).fill(0);
  const bbLower: number[] = new Array(n).fill(0);
  for (let i = 19; i < n; i++) {
    const ma = smas20[i];
    const std = stdDev(closes.slice(i - 19, i + 1), ma);
    bbUpper[i] = ma + 2 * std;
    bbLower[i] = ma - 2 * std;
  }

  for (let i = 50; i < n; i++) {
    const dateObj = new Date(series[i].date);
    let day = dateObj.getDay() - 1; 
    if (day < 0) day = 4;

    let sumMFV = 0;
    let sumVol = 0;
    for (let j = i - 19; j <= i; j++) {
      const hlRange = highs[j] - lows[j];
      const mfm = hlRange === 0 ? 0 : ((closes[j] - lows[j]) - (highs[j] - closes[j])) / hlRange;
      sumMFV += mfm * volumes[j];
      sumVol += volumes[j];
    }
    const cmf = sumVol === 0 ? 0 : sumMFV / sumVol;

    const return1d = (closes[i] - closes[i - 1]) / closes[i - 1];
    const return5d = (closes[i] - closes[i - 5]) / closes[i - 5];

    const last20Returns = [];
    for (let j = i - 19; j <= i; j++) {
      last20Returns.push((closes[j] - closes[j - 1]) / closes[j - 1]);
    }
    const vol20 = stdDev(last20Returns);

    const avgVolume20 = mean(volumes.slice(i - 19, i + 1));
    const volumeRatio = avgVolume20 === 0 ? 1 : volumes[i] / avgVolume20;
    const highLowRatio = lows[i] === 0 ? 0 : (highs[i] - lows[i]) / lows[i];

    let target5dReturn = 0;
    let target5d = 0;
    if (i < n - 5) {
      target5dReturn = (closes[i + 5] - closes[i]) / closes[i];
      target5d = target5dReturn > 0.02 ? 1 : 0;
    }

    const currentHighBB = bbUpper[i];
    const currentLowBB = bbLower[i];
    const bbPctB = (currentHighBB - currentLowBB === 0) ? 0.5 : (closes[i] - currentLowBB) / (currentHighBB - currentLowBB);
    const bbWidth = smas20[i] === 0 ? 0 : (currentHighBB - currentLowBB) / smas20[i];

    features.push({
      date: series[i].date,
      open: series[i].open,
      high: series[i].high,
      low: series[i].low,
      close: series[i].close,
      volume: series[i].volume,

      rsi: rsi[i] || 50,
      macd: macd[i] || 0,
      macdSignal: macdSignal[i] || 0,
      macdDiff: (macd[i] - macdSignal[i]) || 0,
      sma20: smas20[i],
      sma50: smas50[i],
      smaRatio: smas50[i] === 0 ? 1 : smas20[i] / smas50[i],
      bbUpper: currentHighBB,
      bbLower: currentLowBB,
      bbPctB,
      bbWidth,
      atr: atr[i] || 0,
      adx: adx[i] || 25,
      obv: obv[i],
      cmf,
      return1d,
      return5d,
      volatility20d: vol20,
      volumeRatio,
      highLowRatio,
      dayOfWeek: day,

      target5d
    });
  }

  return features;
}
