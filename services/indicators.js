const { EMA, RSI, ATR, ADX, MACD, BollingerBands } = require('technicalindicators');

function computeIndicators(candles) {
  if (!candles || candles.length < 50) {
    return null;
  }

  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);

  const ema9 = EMA.calculate({ period: 9, values: closes });
  const ema21 = EMA.calculate({ period: 21, values: closes });
  const ema50 = EMA.calculate({ period: 50, values: closes });
  const rsi = RSI.calculate({ period: 14, values: closes });
  const atr = ATR.calculate({ high: highs, low: lows, close: closes, period: 14 });
  const adxResult = ADX.calculate({ high: highs, low: lows, close: closes, period: 14 });
  const macd = MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });
  const bb = BollingerBands.calculate({
    period: 20,
    stdDev: 2,
    values: closes,
  });

  const ema9Offset = closes.length - ema9.length;
  const ema21Offset = closes.length - ema21.length;
  const ema50Offset = closes.length - ema50.length;
  const rsiOffset = closes.length - rsi.length;
  const adxOffset = closes.length - adxResult.length;
  const macdOffset = closes.length - macd.length;
  const bbOffset = closes.length - bb.length;

  const lastAdx = adxResult[adxResult.length - 1] || {};
  const lastMacd = macd[macd.length - 1] || {};
  const lastMacdPrev = macd[macd.length - 2] || {};
  const lastBb = bb[bb.length - 1] || {};

  return {
    ema9: ema9[ema9.length - 1],
    ema21: ema21[ema21.length - 1],
    ema50: ema50[ema50.length - 1],
    ema9Prev: ema9[ema9.length - 2],
    ema21Prev: ema21[ema21.length - 2],
    rsi: rsi[rsi.length - 1],
    rsiPrev: rsi[rsi.length - 2],
    atr: atr[atr.length - 1],
    adx: lastAdx.adx ?? 0,
    plusDi: lastAdx.pdi ?? 0,
    minusDi: lastAdx.mdi ?? 0,
    macd: lastMacd.MACD ?? 0,
    macdSignal: lastMacd.signal ?? 0,
    macdHist: lastMacd.histogram ?? 0,
    macdHistPrev: lastMacdPrev.histogram ?? 0,
    bbUpper: lastBb.upper,
    bbMiddle: lastBb.middle,
    bbLower: lastBb.lower,
    trend: ema9[ema9.length - 1] > ema21[ema21.length - 1] ? 'bullish' : 'bearish',
    series: {
      ema9: padSeries(ema9, ema9Offset, closes.length),
      ema21: padSeries(ema21, ema21Offset, closes.length),
      rsi: padSeries(rsi, rsiOffset, closes.length),
    },
  };
}

function padSeries(series, offset, totalLength) {
  const padded = new Array(totalLength).fill(null);
  for (let i = 0; i < series.length; i++) {
    padded[offset + i] = series[i];
  }
  return padded;
}

module.exports = { computeIndicators };
