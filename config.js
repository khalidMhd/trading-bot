require('dotenv').config();

const isVercel = process.env.VERCEL === '1';

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS, 10) || 60000,
  candleCount: 100,
  isVercel,

  // Trading pair (always XAUUSD)
  symbol: 'XAUUSD',
  symbolDisplay: 'XAUUSD',
  timeframe: '15min',

  // Provider priority: mt5 → oanda → twelvedata → yahoo (MT5 disabled on Vercel)
  useMt5: !isVercel && process.env.USE_MT5 !== 'false',
  mt5Symbol: process.env.MT5_SYMBOL || 'XAUUSD',
  mt5Path: process.env.MT5_PATH || '',
  pythonPath: process.env.PYTHON_PATH || 'python',
  oandaApiToken: process.env.OANDA_API_TOKEN || '',
  oandaEnvironment: process.env.OANDA_ENV || 'practice', // practice | live
  twelveDataApiKey: process.env.TWELVE_DATA_API_KEY || '',

  // Set USE_DEMO=true only for offline UI testing (not real prices)
  useDemo: process.env.USE_DEMO === 'true',

  // Strategy mode: balanced (75% / ADX 22 / 5 factors) — good for 15-30 min gold trades
  signalThreshold: parseInt(process.env.SIGNAL_THRESHOLD, 10) || 75,
  minEdge: parseInt(process.env.MIN_EDGE, 10) || 12,
  adxMin: parseInt(process.env.ADX_MIN, 10) || 22,
  minConfluence: parseInt(process.env.MIN_CONFLUENCE, 10) || 5,
  useH1Filter: process.env.USE_H1_FILTER === 'true',
  get totalFactors() {
    return this.useH1Filter ? 9 : 8;
  },
};
