const express = require('express');
const cors = require('cors');
const http = require('http');
const fs = require('fs');
const { Server } = require('socket.io');
const path = require('path');
const config = require('./config');
const { buildPayloadFromState, fetchMarketState } = require('./services/marketEngine');
const tradeTracker = require('./services/tradeTracker');
const { runBacktest } = require('./services/backtest');
const apiRoutes = require('./routes/api');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

const pageRoutes = {
  '/app': 'app.html',
  '/news': 'news.html',
  '/tools': 'tools.html',
  '/glossary': 'glossary.html',
  '/calendar': 'calendar.html',
  '/gold-price': 'gold-price.html',
  '/gold-rate': 'gold-rate.html',
  '/simulator': 'simulator.html',
  '/gold-trading-strategy': 'gold-trading-strategy.html',
  '/gold-trading-sessions': 'gold-trading-sessions.html',
  '/forex-trading': 'forex-trading.html',
  '/pivot-calculator': 'pivot-calculator.html',
  '/fibonacci-calculator': 'fibonacci-calculator.html',
  '/margin-calculator': 'margin-calculator.html',
  '/major-currency-pairs': 'major-currency-pairs.html',
  '/what-is-a-pip': 'what-is-a-pip.html',
  '/about': 'about.html',
  '/how-it-works': 'how-it-works.html',
  '/disclaimer': 'disclaimer.html',
  '/privacy': 'privacy.html',
};
Object.entries(pageRoutes).forEach(([route, file]) => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', file));
  });
});

app.get('/news/:slug', (req, res) => {
  const file = path.join(__dirname, 'public', 'news', `${req.params.slug}.html`);
  if (fs.existsSync(file)) {
    res.sendFile(file);
  } else {
    res.status(404).send('Article not found');
  }
});

app.use(express.static(path.join(__dirname, 'public')));

let state = {
  candles: [],
  indicators: null,
  signal: null,
  price: null,
  lastUpdate: null,
  provider: { mode: 'live', source: '—', detail: 'Starting…' },
  stats: tradeTracker.getStats(),
};

const signalHistory = [];
const MAX_HISTORY = 200;
let lastBacktest = null;
let backtestRunning = false;

async function refreshMarketData() {
  try {
    const market = await fetchMarketState();
    const lastCandle = market.candles[market.candles.length - 1];

    tradeTracker.updateTrades(market.price, lastCandle.high, lastCandle.low);

    const prevSignal = state.signal?.signal;
    if (market.signal.signal !== 'HOLD' && market.signal.signal !== prevSignal) {
      tradeTracker.openTrade(market.signal);
      signalHistory.unshift({ ...market.signal, id: Date.now() });
      if (signalHistory.length > MAX_HISTORY) signalHistory.pop();
    }

    state = {
      ...market,
      stats: tradeTracker.getStats(),
      backtest: lastBacktest,
    };

    io.emit('market-update', buildPayload());
  } catch (err) {
    console.error('[refresh] Error:', err.message);
  }
}

function buildPayload() {
  return buildPayloadFromState(state);
}

async function runBacktestJob() {
  if (backtestRunning) return lastBacktest;
  backtestRunning = true;
  try {
    console.log('[backtest] Running historical backtest...');
    lastBacktest = await runBacktest(2000);
    console.log(`[backtest] Done: ${lastBacktest.winRate}% win rate over ${lastBacktest.totalSignals} signals`);
    state.backtest = lastBacktest;
    io.emit('market-update', buildPayload());
    return lastBacktest;
  } catch (err) {
    console.error('[backtest] Failed:', err.message);
    throw err;
  } finally {
    backtestRunning = false;
  }
}

app.use('/api', apiRoutes(() => ({
  state,
  signalHistory,
  buildPayload,
  getStats: () => tradeTracker.getStats(),
  runBacktestJob,
  getLastBacktest: () => lastBacktest,
})));

io.on('connection', (socket) => {
  socket.emit('market-update', buildPayload());
});

async function start() {
  try {
    await refreshMarketData();
    const p = state.provider;
    console.log(`[data] ${p.mode.toUpperCase()} · ${p.source} · ${p.detail}`);
    if (p.provider === 'mt5') {
      console.log(`[data] MT5 symbol: ${p.detail}`);
    }
    runBacktestJob().catch(() => {});
  } catch (err) {
    console.error('[data] Failed to load live XAUUSD data:', err.message);
    process.exit(1);
  }

  setInterval(refreshMarketData, config.pollIntervalMs);

  server.listen(config.port, () => {
    console.log(`Gold Signal Bot running at http://localhost:${config.port}`);
  });
}

const isVercel = process.env.VERCEL === '1';
if (!isVercel) {
  start();
}
