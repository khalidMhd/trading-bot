const config = require('../config');
const { fetchMt5Candles } = require('./mt5Feed');

const YAHOO_SYMBOL = 'GC=F';
const FETCH_HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };

let activeProvider = null;
let lastError = null;
let providerMeta = {};
let cachedM5Candles = [];
let cachedH1Candles = [];

const BASE_PRICE = 2650;
let demoState = { price: BASE_PRICE, candles: [] };

function getOandaBaseUrl() {
  return config.oandaEnvironment === 'live'
    ? 'https://api-fxtrade.oanda.com'
    : 'https://api-fxpractice.oanda.com';
}

async function fetchOandaCandles() {
  const url = new URL(`${getOandaBaseUrl()}/v3/instruments/XAU_USD/candles`);
  url.searchParams.set('granularity', 'M15');
  url.searchParams.set('count', String(config.candleCount));
  url.searchParams.set('price', 'M');

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${config.oandaApiToken}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OANDA HTTP ${res.status}: ${body}`);
  }

  const data = await res.json();
  return (data.candles || [])
    .filter((c) => c.complete)
    .map((c) => ({
      time: c.time,
      open: parseFloat(c.mid.o),
      high: parseFloat(c.mid.h),
      low: parseFloat(c.mid.l),
      close: parseFloat(c.mid.c),
      volume: parseFloat(c.volume || 0),
    }));
}

async function fetchTwelveDataCandles() {
  const url = new URL('https://api.twelvedata.com/time_series');
  url.searchParams.set('symbol', 'XAU/USD');
  url.searchParams.set('interval', '15min');
  url.searchParams.set('outputsize', String(config.candleCount));
  url.searchParams.set('apikey', config.twelveDataApiKey);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Twelve Data HTTP ${res.status}`);

  const data = await res.json();
  if (data.status === 'error') throw new Error(data.message || 'Twelve Data API error');

  return (data.values || [])
    .map((v) => ({
      time: normalizeTime(v.datetime),
      open: parseFloat(v.open),
      high: parseFloat(v.high),
      low: parseFloat(v.low),
      close: parseFloat(v.close),
      volume: parseFloat(v.volume || 0),
    }))
    .reverse();
}

async function fetchYahooCandles(interval = '15m', count = config.candleCount, range = '5d') {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(YAHOO_SYMBOL)}?interval=${interval}&range=${range}`;

  const res = await fetch(url, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`Yahoo Finance HTTP ${res.status}`);

  const data = await res.json();
  const result = data.chart?.result?.[0];
  if (!result) throw new Error('Yahoo Finance: no chart data');

  const timestamps = result.timestamp || [];
  const q = result.indicators?.quote?.[0] || {};
  const candles = [];

  for (let i = 0; i < timestamps.length; i++) {
    if (q.open[i] == null || q.close[i] == null) continue;
    candles.push({
      time: new Date(timestamps[i] * 1000).toISOString(),
      open: round(q.open[i]),
      high: round(q.high[i]),
      low: round(q.low[i]),
      close: round(q.close[i]),
      volume: q.volume[i] || 0,
    });
  }

  if (candles.length === 0) throw new Error('Yahoo Finance: empty candle set');

  const livePrice = result.meta?.regularMarketPrice;
  if (livePrice != null) {
    const last = candles[candles.length - 1];
    last.close = round(livePrice);
    last.high = round(Math.max(last.high, livePrice));
    last.low = round(Math.min(last.low, livePrice));
  }

  return candles.slice(-count);
}

async function fetchYahooM5Candles() {
  return fetchYahooCandles('5m', 60);
}

async function fetchYahooHistorical(interval = '15m', range = '60d') {
  return fetchYahooCandles(interval, 2000, range);
}

async function fetchYahooHistoricalBundle() {
  const [candles, m5Candles, h1Candles] = await Promise.all([
    fetchYahooHistorical('15m', '60d'),
    fetchYahooCandles('5m', 500, '5d').catch(() => []),
    fetchYahooCandles('1h', 500, '60d').catch(() => []),
  ]);
  return { candles, m5Candles, h1Candles, symbol: 'GC=F (Yahoo)' };
}

function generateDemoCandles(count = 100) {
  const candles = [];
  let price = BASE_PRICE;
  const now = Date.now();
  const intervalMs = 15 * 60 * 1000;

  for (let i = count - 1; i >= 0; i--) {
    const time = new Date(now - i * intervalMs);
    const volatility = 2 + Math.random() * 4;
    const change = (Math.random() - 0.48) * volatility;
    const open = price;
    const close = open + change;
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;
    candles.push({
      time: time.toISOString(),
      open: round(open),
      high: round(high),
      low: round(low),
      close: round(close),
      volume: Math.floor(500 + Math.random() * 2000),
    });
    price = close;
  }

  demoState.candles = candles;
  demoState.price = price;
  return candles;
}

function updateDemoCandle() {
  if (demoState.candles.length === 0) return generateDemoCandles(config.candleCount);
  const last = demoState.candles[demoState.candles.length - 1];
  const volatility = 0.5 + Math.random() * 1.5;
  const change = (Math.random() - 0.5) * volatility;
  last.close = round(last.close + change);
  last.high = round(Math.max(last.high, last.close));
  last.low = round(Math.min(last.low, last.close));
  demoState.price = last.close;
  return demoState.candles;
}

function getProviderChain() {
  const chain = [];
  if (config.useDemo) return ['demo'];
  if (config.useMt5) chain.push('mt5');
  if (config.oandaApiToken) chain.push('oanda');
  if (config.twelveDataApiKey) chain.push('twelvedata');
  chain.push('yahoo');
  return chain;
}

function resolveProvider() {
  return activeProvider || getProviderChain()[0];
}

async function fetchFromProvider(provider) {
  if (provider === 'demo') {
    providerMeta = {};
    cachedM5Candles = updateDemoCandle();
    cachedH1Candles = cachedM5Candles;
    return { candles: cachedM5Candles, m5Candles: cachedM5Candles.slice(-60), h1Candles: cachedH1Candles };
  }
  if (provider === 'mt5') {
    const result = await fetchMt5Candles();
    providerMeta = result.meta;
    cachedM5Candles = result.m5Candles || [];
    cachedH1Candles = result.h1Candles || [];
    return { candles: result.candles, m5Candles: cachedM5Candles, h1Candles: cachedH1Candles };
  }
  if (provider === 'oanda') {
    providerMeta = {};
    cachedM5Candles = [];
    cachedH1Candles = [];
    return { candles: await fetchOandaCandles(), m5Candles: [], h1Candles: [] };
  }
  if (provider === 'twelvedata') {
    providerMeta = {};
    cachedM5Candles = [];
    cachedH1Candles = [];
    return { candles: await fetchTwelveDataCandles(), m5Candles: [], h1Candles: [] };
  }
  providerMeta = {};
  const candles = await fetchYahooCandles();
  try {
    cachedM5Candles = await fetchYahooM5Candles();
    cachedH1Candles = await fetchYahooCandles('1h', 100);
  } catch {
    cachedM5Candles = [];
    cachedH1Candles = [];
  }
  return { candles, m5Candles: cachedM5Candles, h1Candles: cachedH1Candles };
}

async function getMarketData() {
  const chain = getProviderChain();
  const errors = [];

  for (const provider of chain) {
    try {
      const data = await fetchFromProvider(provider);
      activeProvider = provider;
      lastError = errors.length ? errors.join(' | ') : null;
      if (errors.length) {
        console.warn(`[priceFeed] Using ${provider} after fallback. Prior errors: ${lastError}`);
      }
      return data;
    } catch (err) {
      errors.push(`${provider}: ${err.message}`);
      console.error(`[priceFeed] ${provider} failed:`, err.message);
    }
  }

  throw new Error(`All data sources failed. ${errors.join(' | ')}`);
}

async function getCandles() {
  const data = await getMarketData();
  return data.candles;
}

function getM5Candles() {
  return cachedM5Candles;
}

function getCurrentPrice(candles) {
  if (!candles?.length) return null;
  return candles[candles.length - 1].close;
}

function getProviderInfo() {
  const provider = activeProvider || resolveProvider();
  const labels = {
    mt5: {
      mode: 'live',
      source: 'MetaTrader 5',
      detail: providerMeta.broker
        ? `${providerMeta.symbol} · ${providerMeta.broker}`
        : 'XAUUSD from your MT5 broker',
    },
    oanda: { mode: 'live', source: 'OANDA', detail: 'XAU_USD spot (broker feed)' },
    twelvedata: { mode: 'live', source: 'Twelve Data', detail: 'XAU/USD spot forex' },
    yahoo: {
      mode: 'live',
      source: 'Yahoo Finance',
      detail: 'COMEX Gold (GC=F) — may differ from MT5 XAUUSD',
    },
    demo: { mode: 'demo', source: 'Simulated', detail: 'Fake prices — not for trading' },
  };
  return {
    provider,
    ...(labels[provider] || labels.yahoo),
    bid: providerMeta.bid ?? null,
    ask: providerMeta.ask ?? null,
    mt5Requested: config.useMt5 && !config.useDemo,
    mt5Connected: provider === 'mt5',
    lastError,
  };
}

function normalizeTime(dt) {
  if (!dt) return new Date().toISOString();
  if (dt.includes('T')) return new Date(dt).toISOString();
  return new Date(dt.replace(' ', 'T') + 'Z').toISOString();
}

function round(n) {
  return Math.round(n * 100) / 100;
}

module.exports = {
  getCandles,
  getMarketData,
  getM5Candles,
  getCurrentPrice,
  getProviderInfo,
  generateDemoCandles,
  fetchYahooHistoricalBundle,
};
