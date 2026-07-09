const config = require('../config');
const priceFeed = require('./priceFeed');
const { computeIndicators } = require('./indicators');
const { evaluateSignal } = require('./strategy');
const { runMt5Backtest } = require('./backtestMt5');

function getH1SliceBefore(h1Candles, m15Time) {
  const ts = new Date(m15Time).getTime();
  return h1Candles.filter((c) => new Date(c.time).getTime() <= ts);
}

function getM5SliceBefore(m5Candles, m15Time, count = 60) {
  const ts = new Date(m15Time).getTime();
  return m5Candles.filter((c) => new Date(c.time).getTime() <= ts).slice(-count);
}

function simulateTrade(signal, futureCandles, maxBars = 2) {
  for (let i = 0; i < Math.min(futureCandles.length, maxBars); i++) {
    const bar = futureCandles[i];
    if (signal.signal === 'BUY') {
      if (bar.low <= signal.stopLoss) return { outcome: 'loss', pnl: signal.stopLoss - signal.entry, bars: i + 1 };
      if (bar.high >= signal.takeProfit) return { outcome: 'win', pnl: signal.takeProfit - signal.entry, bars: i + 1 };
    } else {
      if (bar.high >= signal.stopLoss) return { outcome: 'loss', pnl: signal.entry - signal.stopLoss, bars: i + 1 };
      if (bar.low <= signal.takeProfit) return { outcome: 'win', pnl: signal.entry - signal.takeProfit, bars: i + 1 };
    }
  }

  const last = futureCandles[Math.min(futureCandles.length, maxBars) - 1];
  if (!last) return { outcome: 'loss', pnl: 0, bars: 0 };

  const pnl = signal.signal === 'BUY' ? last.close - signal.entry : signal.entry - last.close;
  return { outcome: pnl >= 0 ? 'win' : 'loss', pnl, bars: maxBars };
}

function summarizeTrades(trades, meta) {
  const wins = trades.filter((t) => t.outcome === 'win').length;
  const losses = trades.filter((t) => t.outcome === 'loss').length;
  const total = wins + losses;
  const winRate = total > 0 ? round((wins / total) * 100) : 0;
  const totalPnl = round(trades.reduce((s, t) => s + t.pnl, 0));
  const grossProfit = round(trades.filter((t) => t.pnl > 0).reduce((s, t) => s + t.pnl, 0));
  const grossLoss = Math.abs(round(trades.filter((t) => t.pnl < 0).reduce((s, t) => s + t.pnl, 0)));
  const profitFactor = grossLoss > 0 ? round(grossProfit / grossLoss) : grossProfit > 0 ? 999 : 0;

  return {
    symbol: meta.symbol,
    period: meta.period,
    source: meta.source,
    totalSignals: total,
    wins,
    losses,
    winRate,
    totalPnl,
    profitFactor,
    avgPnl: total > 0 ? round(totalPnl / total) : 0,
    recentTrades: trades.slice(-15).reverse(),
    runAt: new Date().toISOString(),
  };
}

function runSimulation(candles, h1All, m5All, maxCandles) {
  const sliceEnd = Math.min(candles.length, maxCandles);
  const trades = [];
  const startIdx = 60;

  for (let i = startIdx; i < sliceEnd - 3; i++) {
    const slice = candles.slice(0, i + 1);
    const price = slice[slice.length - 1].close;
    const time = slice[slice.length - 1].time;

    const indicators = computeIndicators(slice);
    if (!indicators) continue;

    const h1Slice = getH1SliceBefore(h1All, time);
    const h1Indicators = h1Slice.length >= 50 ? computeIndicators(h1Slice) : null;
    const m5Slice = getM5SliceBefore(m5All, time);
    const m5Indicators = m5Slice.length >= 30 ? computeIndicators(m5Slice) : null;

    const signal = evaluateSignal(slice, indicators, price, m5Indicators, h1Indicators);
    if (signal.signal === 'HOLD') continue;

    const future = candles.slice(i + 1, i + 3);
    const result = simulateTrade(signal, future, 2);

    trades.push({
      time,
      signal: signal.signal,
      entry: signal.entry,
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfit,
      buyProbability: signal.buyProbability,
      confluence: signal.confluence,
      ...result,
    });
  }

  return trades;
}

async function runYahooBacktest(maxCandles = 400) {
  const { candles, m5Candles, h1Candles, symbol } = await priceFeed.fetchYahooHistoricalBundle();
  const trades = runSimulation(candles, h1Candles, m5Candles, maxCandles);

  return summarizeTrades(trades, {
    symbol,
    period: `Last ${Math.min(candles.length, maxCandles)} M15 candles (Yahoo GC=F)`,
    source: 'yahoo',
  });
}

async function runBacktest(candleCount = 2000) {
  const cloudLimit = config.isVercel ? 300 : candleCount;

  if (config.useMt5) {
    try {
      return await runMt5Backtest(candleCount);
    } catch (err) {
      if (!config.isVercel) console.warn('[backtest] MT5 failed, using Yahoo:', err.message);
    }
  }

  return runYahooBacktest(cloudLimit);
}

function round(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { runBacktest, runYahooBacktest };
