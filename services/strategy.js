const config = require('../config');

const SIGNAL_THRESHOLD = config.signalThreshold;
const MIN_EDGE = config.minEdge;
const ADX_MIN = config.adxMin;
const MIN_CONFLUENCE = config.minConfluence;

const MAJOR_NEWS_HOURS_UTC = [
  { day: 3, hour: 12, minute: 30, name: 'FOMC' },
  { day: 5, hour: 12, minute: 30, name: 'NFP' },
];

function isNewsWindow(date = new Date()) {
  const utcDay = date.getUTCDay();
  const utcHour = date.getUTCHours();
  const utcMinute = date.getUTCMinutes();

  for (const event of MAJOR_NEWS_HOURS_UTC) {
    if (utcDay !== event.day) continue;
    const eventMinutes = event.hour * 60 + event.minute;
    const nowMinutes = utcHour * 60 + utcMinute;
    if (Math.abs(nowMinutes - eventMinutes) <= 30) {
      return { blocked: true, reason: `${event.name} news window` };
    }
  }
  return { blocked: false, reason: null };
}

function getSession(date = new Date()) {
  const hour = date.getUTCHours();
  if (hour >= 0 && hour < 8) return 'Asian';
  if (hour >= 8 && hour < 13) return 'London';
  if (hour >= 13 && hour < 21) return 'New York';
  return 'Asian (late)';
}

function isPrimeSession(session) {
  return session === 'London' || session === 'New York';
}

function scoreEmaTrend(ind) {
  const { ema9, ema21, ema50, ema9Prev, ema21Prev } = ind;
  let bull = 0;
  let bear = 0;
  const reasons = [];

  if (ema9 > ema21 && ema21 > ema50) {
    bull += 20;
    reasons.push('EMA stack bullish (9 > 21 > 50)');
  } else if (ema9 < ema21 && ema21 < ema50) {
    bear += 20;
    reasons.push('EMA stack bearish (9 < 21 < 50)');
  } else if (ema9 > ema21) {
    bull += 12;
    reasons.push('EMA9 above EMA21');
  } else if (ema9 < ema21) {
    bear += 12;
    reasons.push('EMA9 below EMA21');
  }

  if (ema9Prev <= ema21Prev && ema9 > ema21) {
    bull += 5;
    reasons.push('Fresh bullish EMA crossover');
  }
  if (ema9Prev >= ema21Prev && ema9 < ema21) {
    bear += 5;
    reasons.push('Fresh bearish EMA crossover');
  }

  return { bull, bear, reasons };
}

function scoreRsi(ind) {
  const { rsi, rsiPrev } = ind;
  let bull = 0;
  let bear = 0;
  const reasons = [];

  if (rsi > 50 && rsi < 70 && rsi > rsiPrev) {
    bull += 15;
    reasons.push(`RSI bullish momentum (${rsi.toFixed(1)})`);
  } else if (rsi < 50 && rsi > 30 && rsi < rsiPrev) {
    bear += 15;
    reasons.push(`RSI bearish momentum (${rsi.toFixed(1)})`);
  } else if (rsi >= 70) {
    bear += 8;
    reasons.push('RSI overbought — sell bias');
  } else if (rsi <= 30) {
    bull += 8;
    reasons.push('RSI oversold — buy bias');
  } else if (rsi > 50) {
    bull += 6;
  } else {
    bear += 6;
  }

  return { bull, bear, reasons };
}

function scoreMacd(ind) {
  const { macd, macdSignal, macdHist, macdHistPrev } = ind;
  let bull = 0;
  let bear = 0;
  const reasons = [];

  if (macd > macdSignal && macdHist > 0) {
    bull += macdHist > macdHistPrev ? 15 : 10;
    reasons.push('MACD bullish');
  } else if (macd < macdSignal && macdHist < 0) {
    bear += macdHist < macdHistPrev ? 15 : 10;
    reasons.push('MACD bearish');
  } else if (macdHist > macdHistPrev) {
    bull += 5;
  } else if (macdHist < macdHistPrev) {
    bear += 5;
  }

  return { bull, bear, reasons };
}

function scoreAdx(ind) {
  const { adx, plusDi, minusDi } = ind;
  let bull = 0;
  let bear = 0;
  const reasons = [];

  if (adx >= 25) {
    if (plusDi > minusDi) {
      bull += 15;
      reasons.push(`Strong bullish trend (ADX ${adx.toFixed(1)})`);
    } else if (minusDi > plusDi) {
      bear += 15;
      reasons.push(`Strong bearish trend (ADX ${adx.toFixed(1)})`);
    }
  } else if (adx >= 20) {
    if (plusDi > minusDi) bull += 8;
    else if (minusDi > plusDi) bear += 8;
    reasons.push(`Moderate trend (ADX ${adx.toFixed(1)})`);
  } else {
    reasons.push(`Weak trend (ADX ${adx.toFixed(1)}) — lower confidence`);
  }

  return { bull, bear, reasons };
}

function scoreBollinger(price, ind) {
  const { bbUpper, bbMiddle, bbLower } = ind;
  let bull = 0;
  let bear = 0;
  const reasons = [];

  if (price <= bbLower) {
    bull += 10;
    reasons.push('Price at lower Bollinger Band');
  } else if (price >= bbUpper) {
    bear += 10;
    reasons.push('Price at upper Bollinger Band');
  } else if (price > bbMiddle) {
    bull += 5;
  } else if (price < bbMiddle) {
    bear += 5;
  }

  return { bull, bear, reasons };
}

function scoreCandleFlow(candles) {
  let bull = 0;
  let bear = 0;
  const reasons = [];
  if (!candles || candles.length < 3) return { bull, bear, reasons };

  const last3 = candles.slice(-3);
  const bullishCandles = last3.filter((c) => c.close > c.open).length;
  const bearishCandles = last3.filter((c) => c.close < c.open).length;

  if (bullishCandles >= 2) {
    bull += 10;
    reasons.push(`${bullishCandles}/3 recent candles bullish`);
  } else if (bearishCandles >= 2) {
    bear += 10;
    reasons.push(`${bearishCandles}/3 recent candles bearish`);
  }

  return { bull, bear, reasons };
}

function scoreM5Confirm(m5Indicators) {
  let bull = 0;
  let bear = 0;
  const reasons = [];

  if (!m5Indicators) {
    return { bull, bear, reasons };
  }

  const { ema9, ema21, rsi, rsiPrev } = m5Indicators;

  if (ema9 > ema21 && rsi > 50 && rsi > rsiPrev) {
    bull += 15;
    reasons.push('M5 confirms bullish (EMA + RSI)');
  } else if (ema9 < ema21 && rsi < 50 && rsi < rsiPrev) {
    bear += 15;
    reasons.push('M5 confirms bearish (EMA + RSI)');
  } else if (ema9 > ema21) {
    bull += 8;
    reasons.push('M5 EMA bullish');
  } else if (ema9 < ema21) {
    bear += 8;
    reasons.push('M5 EMA bearish');
  }

  return { bull, bear, reasons };
}

function scoreH1Trend(h1Indicators) {
  let bull = 0;
  let bear = 0;
  const reasons = [];

  if (!h1Indicators) {
    reasons.push('H1 data unavailable');
    return { bull, bear, reasons, blocked: false };
  }

  const { ema9, ema21, ema50, trend } = h1Indicators;

  if (ema9 > ema21 && ema21 > ema50) {
    bull += 20;
    reasons.push('H1 trend strongly bullish');
  } else if (ema9 < ema21 && ema21 < ema50) {
    bear += 20;
    reasons.push('H1 trend strongly bearish');
  } else if (ema9 > ema21) {
    bull += 12;
    reasons.push('H1 trend bullish');
  } else if (ema9 < ema21) {
    bear += 12;
    reasons.push('H1 trend bearish');
  } else {
    reasons.push('H1 trend neutral');
  }

  return { bull, bear, reasons, trend };
}

function scoreH1Filter(h1Indicators, direction) {
  if (!config.useH1Filter) {
    return { pass: true, reason: 'H1 filter disabled' };
  }
  if (!h1Indicators) return { pass: true, reason: null };
  if (direction === 'BUY' && h1Indicators.ema9 < h1Indicators.ema21) {
    return { pass: false, reason: 'H1 trend bearish — BUY blocked' };
  }
  if (direction === 'SELL' && h1Indicators.ema9 > h1Indicators.ema21) {
    return { pass: false, reason: 'H1 trend bullish — SELL blocked' };
  }
  return { pass: true, reason: `H1 confirms ${direction.toLowerCase()}` };
}

function scoreSession(session) {
  let bull = 0;
  let bear = 0;
  const reasons = [];

  if (isPrimeSession(session)) {
    bull += 5;
    bear += 5;
    reasons.push(`${session} session — high liquidity`);
  } else {
    reasons.push(`${session} session — lower liquidity`);
  }

  return { bull, bear, reasons };
}

function computeProbabilities(scores) {
  const bull = scores.reduce((s, x) => s + x.bull, 0);
  const bear = scores.reduce((s, x) => s + x.bear, 0);
  const total = bull + bear || 1;

  const buyProbability = Math.round((bull / total) * 100);
  const sellProbability = 100 - buyProbability;

  return { buyProbability, sellProbability, bullScore: bull, bearScore: bear };
}

function getConfidence(probability) {
  if (probability >= 85) return 'high';
  if (probability >= SIGNAL_THRESHOLD) return 'medium';
  return 'low';
}

function evaluateSignal(candles, indicators, currentPrice, m5Indicators = null, h1Indicators = null) {
  const news = isNewsWindow();
  const session = getSession();

  const base = {
    signal: 'HOLD',
    confidence: 'low',
    buyProbability: 50,
    sellProbability: 50,
    confluence: 0,
    entry: currentPrice,
    stopLoss: null,
    takeProfit: null,
    holdMinutes: '15-30',
    reasons: [],
    factorScores: [],
    filters: {
      session,
      newsClear: !news.blocked,
      newsReason: news.reason,
    },
    timestamp: new Date().toISOString(),
  };

  if (!indicators) {
    base.reasons.push('Insufficient candle data for indicators');
    return base;
  }

  if (news.blocked) {
    base.reasons.push(`Blocked: ${news.reason}`);
    base.buyProbability = 0;
    base.sellProbability = 0;
    return base;
  }

  const scorers = [
    { name: 'EMA Trend', ...scoreEmaTrend(indicators) },
    { name: 'RSI', ...scoreRsi(indicators) },
    { name: 'MACD', ...scoreMacd(indicators) },
    { name: 'ADX', ...scoreAdx(indicators) },
    { name: 'Bollinger', ...scoreBollinger(currentPrice, indicators) },
    { name: 'Candle Flow', ...scoreCandleFlow(candles) },
    { name: 'M5 Confirm', ...scoreM5Confirm(m5Indicators) },
    ...(config.useH1Filter ? [{ name: 'H1 Trend', ...scoreH1Trend(h1Indicators) }] : []),
    { name: 'Session', ...scoreSession(session) },
  ];

  const { buyProbability, sellProbability, bullScore, bearScore } = computeProbabilities(scorers);
  base.buyProbability = buyProbability;
  base.sellProbability = sellProbability;
  base.factorScores = scorers.map((s) => ({
    name: s.name,
    bull: s.bull,
    bear: s.bear,
  }));

  const allReasons = scorers.flatMap((s) => s.reasons);
  const bullishFactors = scorers.filter((s) => s.bull > s.bear).length;
  const bearishFactors = scorers.filter((s) => s.bear > s.bull).length;
  base.confluence = Math.max(bullishFactors, bearishFactors);

  const slDistance = indicators.atr * 1.5;
  const tpDistance = indicators.atr * 2.0;
  const adxOk = indicators.adx >= ADX_MIN;
  const h1BuyOk = scoreH1Filter(h1Indicators, 'BUY');
  const h1SellOk = scoreH1Filter(h1Indicators, 'SELL');

  const canBuy =
    buyProbability >= SIGNAL_THRESHOLD &&
    buyProbability >= sellProbability + MIN_EDGE &&
    bullishFactors >= MIN_CONFLUENCE &&
    adxOk &&
    h1BuyOk.pass;

  const canSell =
    sellProbability >= SIGNAL_THRESHOLD &&
    sellProbability >= buyProbability + MIN_EDGE &&
    bearishFactors >= MIN_CONFLUENCE &&
    adxOk &&
    h1SellOk.pass;

  if (canBuy) {
    base.signal = 'BUY';
    base.confidence = getConfidence(buyProbability);
    base.stopLoss = round(currentPrice - slDistance);
    base.takeProfit = round(currentPrice + tpDistance);
    base.reasons = [
      `Buy probability ${buyProbability}% (${bullishFactors}/${config.totalFactors} factors agree)`,
      h1BuyOk.reason,
      ...allReasons.filter((r) =>
        r.includes('bull') || r.includes('Bull') || r.includes('bullish') || r.includes('oversold') || r.includes('lower')
      ).slice(0, 3),
      `SL/TP based on ATR (${indicators.atr.toFixed(2)})`,
    ];
  } else if (canSell) {
    base.signal = 'SELL';
    base.confidence = getConfidence(sellProbability);
    base.stopLoss = round(currentPrice + slDistance);
    base.takeProfit = round(currentPrice - tpDistance);
    base.reasons = [
      `Sell probability ${sellProbability}% (${bearishFactors}/${config.totalFactors} factors agree)`,
      h1SellOk.reason,
      ...allReasons.filter((r) =>
        r.includes('bear') || r.includes('Bear') || r.includes('bearish') || r.includes('overbought') || r.includes('upper')
      ).slice(0, 3),
      `SL/TP based on ATR (${indicators.atr.toFixed(2)})`,
    ];
  } else {
    base.reasons = [
      `Buy ${buyProbability}% · Sell ${sellProbability}% — need ${SIGNAL_THRESHOLD}%+ with ${MIN_EDGE}% edge`,
      `Confluence: ${bullishFactors} bullish / ${bearishFactors} bearish factors`,
      !adxOk ? `ADX ${indicators.adx.toFixed(1)} < ${ADX_MIN} — trend too weak` : null,
      !h1BuyOk.pass && buyProbability > sellProbability ? h1BuyOk.reason : null,
      !h1SellOk.pass && sellProbability > buyProbability ? h1SellOk.reason : null,
      ...allReasons.slice(0, 2),
    ].filter(Boolean);
    if (buyProbability > sellProbability) {
      base.confidence = buyProbability >= 65 ? 'medium' : 'low';
    } else if (sellProbability > buyProbability) {
      base.confidence = sellProbability >= 65 ? 'medium' : 'low';
    }
  }

  return base;
}

function round(n) {
  return Math.round(n * 100) / 100;
}

module.exports = {
  evaluateSignal,
  getSession,
  isNewsWindow,
  SIGNAL_THRESHOLD,
};
