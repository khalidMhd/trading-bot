const config = require('../config');
const priceFeed = require('./priceFeed');
const { computeIndicators } = require('./indicators');
const { evaluateSignal } = require('./strategy');

function buildPayloadFromState(state) {
  const { candles, indicators, signal, price, lastUpdate, provider, stats, h1Trend, backtest } = state;
  return {
    symbol: config.symbolDisplay,
    timeframe: 'M15',
    price,
    lastUpdate,
    provider,
    signal,
    stats,
    backtest: backtest ?? null,
    probability: signal
      ? {
          buy: signal.buyProbability,
          sell: signal.sellProbability,
          confluence: signal.confluence,
          threshold: config.signalThreshold,
          totalFactors: config.totalFactors,
        }
      : null,
    indicators: indicators
      ? {
          ema9: indicators.ema9,
          ema21: indicators.ema21,
          rsi: indicators.rsi,
          atr: indicators.atr,
          adx: indicators.adx,
          trend: indicators.trend,
          h1Trend,
        }
      : null,
    candles: (candles || []).slice(-60).map((c) => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    })),
    ema9Series: indicators?.series?.ema9?.slice(-60) ?? [],
    ema21Series: indicators?.series?.ema21?.slice(-60) ?? [],
  };
}

async function fetchMarketState() {
  const { candles, m5Candles, h1Candles } = await priceFeed.getMarketData();
  const price = priceFeed.getCurrentPrice(candles);
  const indicators = computeIndicators(candles);
  const m5Indicators = m5Candles?.length >= 50 ? computeIndicators(m5Candles) : null;
  const h1Indicators = h1Candles?.length >= 50 ? computeIndicators(h1Candles) : null;
  const signal = evaluateSignal(candles, indicators, price, m5Indicators, h1Indicators);

  return {
    candles,
    indicators,
    signal,
    price,
    lastUpdate: new Date().toISOString(),
    provider: priceFeed.getProviderInfo(),
    h1Trend: h1Indicators?.trend ?? null,
  };
}

async function buildMarketPayload() {
  const state = await fetchMarketState();
  return buildPayloadFromState({
    ...state,
    stats: {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      openTrades: 0,
      winRate: 0,
      totalPnl: 0,
      cloudMode: true,
    },
  });
}

module.exports = {
  buildMarketPayload,
  buildPayloadFromState,
  fetchMarketState,
};
