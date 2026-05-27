'use strict';
// ═══════════════════════════════════════════════════════════
// NEXUS TRADER — Technical Analysis Engine
// All indicators computed from raw price arrays
// ═══════════════════════════════════════════════════════════

function rsi(prices, period = 14) {
  if (prices.length < period + 1) return 50;
  let g = 0, l = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const d = prices[i] - prices[i - 1];
    d > 0 ? g += d : l += Math.abs(d);
  }
  const rs = (g / period) / ((l / period) || 0.0001);
  return 100 - (100 / (1 + rs));
}

function ema(prices, period) {
  if (prices.length < period) return prices[prices.length - 1] || 0;
  const k = 2 / (period + 1);
  let e = prices.slice(0, period).reduce((a, b) => a + b) / period;
  for (let i = period; i < prices.length; i++) e = prices[i] * k + e * (1 - k);
  return e;
}

function sma(prices, period) {
  if (prices.length < period) return prices[prices.length - 1] || 0;
  return prices.slice(-period).reduce((a, b) => a + b) / period;
}

function macd(prices, fast = 12, slow = 26, signal = 9) {
  if (prices.length < slow + signal) return { macd: 0, signal: 0, histogram: 0 };
  const macdVals = [];
  for (let i = slow; i <= prices.length; i++) {
    const sl = prices.slice(0, i);
    macdVals.push(ema(sl, fast) - ema(sl, slow));
  }
  const macdLine = macdVals[macdVals.length - 1];
  const signalLine = ema(macdVals, signal);
  return { macd: macdLine, signal: signalLine, histogram: macdLine - signalLine };
}

function bollingerBands(prices, period = 20, mult = 2) {
  if (prices.length < period) return { upper: 0, middle: 0, lower: 0, percentB: 50, width: 0 };
  const sl = prices.slice(-period);
  const mid = sl.reduce((a, b) => a + b) / period;
  const std = Math.sqrt(sl.reduce((a, b) => a + (b - mid) ** 2, 0) / period);
  const upper = mid + mult * std, lower = mid - mult * std;
  const cur = prices[prices.length - 1];
  const pB = (upper - lower) > 0 ? ((cur - lower) / (upper - lower)) * 100 : 50;
  return { upper, middle: mid, lower, percentB: pB, width: ((upper - lower) / mid) * 100 };
}

function stochastic(prices, kPer = 14, dPer = 3) {
  if (prices.length < kPer) return { k: 50, d: 50 };
  const sl = prices.slice(-kPer), hi = Math.max(...sl), lo = Math.min(...sl);
  const cur = prices[prices.length - 1];
  const k = hi === lo ? 50 : ((cur - lo) / (hi - lo)) * 100;
  const kVals = [];
  for (let i = kPer; i <= prices.length; i++) {
    const s = prices.slice(i - kPer, i), h = Math.max(...s), l2 = Math.min(...s);
    kVals.push(h === l2 ? 50 : ((prices[i - 1] - l2) / (h - l2)) * 100);
  }
  const d = kVals.length >= dPer ? kVals.slice(-dPer).reduce((a, b) => a + b) / dPer : k;
  return { k: Math.min(100, Math.max(0, k)), d: Math.min(100, Math.max(0, d)) };
}

function adx(prices, period = 14) {
  if (prices.length < period * 2) return { adx: 25, plusDI: 0, minusDI: 0 };
  let trSum = 0, pDM = 0, mDM = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const c = prices[i], p = prices[i - 1] || prices[i];
    trSum += Math.max(c - c * 0.998, Math.abs(c - p), Math.abs(c * 0.998 - p));
    pDM += Math.max(0, c - p);
    mDM += Math.max(0, p - c);
  }
  const pDI = trSum > 0 ? (pDM / trSum) * 100 : 0;
  const nDI = trSum > 0 ? (mDM / trSum) * 100 : 0;
  const dx = (pDI + nDI) > 0 ? (Math.abs(pDI - nDI) / (pDI + nDI)) * 100 : 0;
  return { adx: Math.min(100, dx), plusDI: pDI, minusDI: nDI };
}

function atr(prices, period = 14) {
  if (prices.length < period + 1) return 0;
  let sum = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const c = prices[i], p = prices[i - 1] || prices[i];
    sum += Math.max(c - c * 0.999, Math.abs(c - p), Math.abs(c * 0.999 - p));
  }
  return sum / period;
}

function momentum(prices, period = 10) {
  if (prices.length < period + 1) return 0;
  return ((prices[prices.length - 1] / prices[prices.length - 1 - period]) - 1) * 100;
}

function williamsR(prices, period = 14) {
  if (prices.length < period) return -50;
  const sl = prices.slice(-period), hi = Math.max(...sl), lo = Math.min(...sl);
  const cur = prices[prices.length - 1];
  return hi === lo ? -50 : ((hi - cur) / (hi - lo)) * -100;
}

function pivotPoints(prices) {
  const hi = Math.max(...prices.slice(-20));
  const lo = Math.min(...prices.slice(-20));
  const cl = prices[prices.length - 1];
  const p = (hi + lo + cl) / 3;
  return {
    pivot: p, r1: 2 * p - lo, r2: p + (hi - lo), r3: hi + 2 * (p - lo),
    s1: 2 * p - hi, s2: p - (hi - lo), s3: lo - 2 * (hi - p)
  };
}

function digitFrequency(prices, count = 50) {
  const freq = Array(10).fill(0);
  const recent = prices.slice(-count);
  recent.forEach(p => { freq[Math.floor(Math.abs(p * 100)) % 10]++; });
  const total = recent.length || 1;
  const evenCount = freq[0] + freq[2] + freq[4] + freq[6] + freq[8];
  const over5Count = freq[6] + freq[7] + freq[8] + freq[9];
  return {
    frequency: freq,
    percentages: freq.map(f => +((f / total) * 100).toFixed(1)),
    evenPct: +((evenCount / total) * 100).toFixed(1),
    oddPct: +(((total - evenCount) / total) * 100).toFixed(1),
    over5Pct: +((over5Count / total) * 100).toFixed(1),
    under5Pct: +(((total - over5Count) / total) * 100).toFixed(1),
    mostCommon: freq.indexOf(Math.max(...freq)),
    leastCommon: freq.indexOf(Math.min(...freq)),
  };
}

// ── Master Analysis ──────────────────────────────────────────
function analyzeMarket(symbol, prices) {
  if (!prices || prices.length < 40) return { symbol, direction: 'NEUTRAL', confidence: 0, error: 'insufficient_data' };

  const RSI    = rsi(prices);
  const MACD   = macd(prices);
  const BB     = bollingerBands(prices);
  const STOCH  = stochastic(prices);
  const ADX    = adx(prices);
  const MOM    = momentum(prices);
  const WR     = williamsR(prices);
  const ATR    = atr(prices);
  const EMA9   = ema(prices, 9);
  const EMA21  = ema(prices, 21);
  const EMA50  = ema(prices, 50);
  const EMA200 = ema(prices, Math.min(200, prices.length));
  const SMA20  = sma(prices, 20);
  const PIVOT  = pivotPoints(prices);
  const cur    = prices[prices.length - 1];
  const trendUp = EMA9 > EMA21 && EMA21 > EMA50;
  const trendDn = EMA9 < EMA21 && EMA21 < EMA50;
  const trendStr = Math.abs((EMA9 - EMA50) / EMA50 * 100);

  let score = 0, buyC = 0, sellC = 0, neutC = 0;

  // RSI (weight 25)
  if (RSI < 25)      { score += 25; buyC++;  }
  else if (RSI < 35) { score += 15; buyC++;  }
  else if (RSI > 75) { score -= 25; sellC++; }
  else if (RSI > 65) { score -= 15; sellC++; }
  else neutC++;

  // MACD (weight 22)
  if (MACD.histogram > 0)      { score += 22; buyC++;  }
  else if (MACD.histogram < 0) { score -= 22; sellC++; }
  else neutC++;

  // Bollinger Bands (weight 18)
  if (cur <= BB.lower * 1.002)      { score += 18; buyC++;  }
  else if (cur >= BB.upper * 0.998) { score -= 18; sellC++; }
  else if (BB.percentB < 20)        { score += 10; buyC++;  }
  else if (BB.percentB > 80)        { score -= 10; sellC++; }
  else neutC++;

  // EMA Trend (weight 15)
  if (trendUp && ADX.adx > 20)      { score += 15; buyC++;  }
  else if (trendDn && ADX.adx > 20) { score -= 15; sellC++; }
  else neutC++;

  // Stochastic (weight 10)
  if (STOCH.k < 20 && STOCH.d < 20) { score += 10; buyC++;  }
  else if (STOCH.k > 80 && STOCH.d > 80) { score -= 10; sellC++; }
  else neutC++;

  // Momentum (weight 8)
  if (MOM > 0.2)       { score += 8; buyC++;  }
  else if (MOM < -0.2) { score -= 8; sellC++; }

  // Williams %R (weight 7)
  if (WR < -80)  { score += 7; buyC++;  }
  else if (WR > -20) { score -= 7; sellC++; }

  // Price vs Pivot (weight 5)
  if (cur > PIVOT.pivot && cur < PIVOT.r1) score += 5;
  else if (cur < PIVOT.pivot && cur > PIVOT.s1) score -= 5;

  const conf = Math.min(95, Math.max(40, (Math.abs(score) / 110) * 100));
  const dir  = score > 8 ? 'BUY' : score < -8 ? 'SELL' : 'NEUTRAL';
  const recent10 = prices.slice(-10);
  const volPct = ((Math.max(...recent10) - Math.min(...recent10)) / cur) * 100;

  return {
    symbol, timestamp: Date.now(), price: cur,
    direction: dir,
    confidence: +conf.toFixed(2),
    score,
    buySignals: buyC, sellSignals: sellC, neutralSignals: neutC,
    trendUp, trendDn, trendStrength: +trendStr.toFixed(3),
    indicators: {
      rsi: +RSI.toFixed(2),
      macd: { line: +MACD.macd.toFixed(6), signal: +MACD.signal.toFixed(6), histogram: +MACD.histogram.toFixed(6) },
      bb: { upper: +BB.upper.toFixed(5), middle: +BB.middle.toFixed(5), lower: +BB.lower.toFixed(5), percentB: +BB.percentB.toFixed(2), width: +BB.width.toFixed(3) },
      stoch: { k: +STOCH.k.toFixed(2), d: +STOCH.d.toFixed(2) },
      adx: +ADX.adx.toFixed(2), momentum: +MOM.toFixed(3), williamsR: +WR.toFixed(2),
      atr: +ATR.toFixed(6),
      ema: { ema9: +EMA9.toFixed(5), ema21: +EMA21.toFixed(5), ema50: +EMA50.toFixed(5), ema200: +EMA200.toFixed(5) },
      sma20: +SMA20.toFixed(5), pivotPoints: PIVOT, volatilityPct: +volPct.toFixed(4)
    },
    summary: `${dir} | ${conf.toFixed(0)}% conf | ${buyC}↑ ${sellC}↓ ${neutC}— signals`
  };
}

module.exports = { rsi, ema, sma, macd, bollingerBands, stochastic, adx, atr, momentum, williamsR, pivotPoints, digitFrequency, analyzeMarket };
