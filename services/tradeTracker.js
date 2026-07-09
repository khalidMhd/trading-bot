const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const TRADES_FILE = path.join(DATA_DIR, 'trades.json');
const MAX_HOLD_MS = 30 * 60 * 1000;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadTrades() {
  ensureDataDir();
  if (!fs.existsSync(TRADES_FILE)) return { open: [], closed: [] };
  try {
    return JSON.parse(fs.readFileSync(TRADES_FILE, 'utf8'));
  } catch {
    return { open: [], closed: [] };
  }
}

function saveTrades(data) {
  ensureDataDir();
  fs.writeFileSync(TRADES_FILE, JSON.stringify(data, null, 2));
}

function openTrade(signal) {
  if (!signal || signal.signal === 'HOLD' || !signal.stopLoss || !signal.takeProfit) return null;

  const data = loadTrades();
  const duplicate = data.open.find(
    (t) => t.signal === signal.signal && Math.abs(t.entry - signal.entry) < 0.5
  );
  if (duplicate) return null;

  const trade = {
    id: Date.now(),
    signal: signal.signal,
    entry: signal.entry,
    stopLoss: signal.stopLoss,
    takeProfit: signal.takeProfit,
    buyProbability: signal.buyProbability,
    sellProbability: signal.sellProbability,
    confluence: signal.confluence,
    confidence: signal.confidence,
    openedAt: signal.timestamp || new Date().toISOString(),
    status: 'open',
  };

  data.open.unshift(trade);
  saveTrades(data);
  return trade;
}

function updateTrades(currentPrice, candleHigh, candleLow) {
  const data = loadTrades();
  const now = Date.now();
  const stillOpen = [];

  for (const trade of data.open) {
    const openedMs = new Date(trade.openedAt).getTime();
    const expired = now - openedMs >= MAX_HOLD_MS;
    let outcome = null;
    let exitPrice = currentPrice;

    if (trade.signal === 'BUY') {
      if (candleLow <= trade.stopLoss) {
        outcome = 'loss';
        exitPrice = trade.stopLoss;
      } else if (candleHigh >= trade.takeProfit) {
        outcome = 'win';
        exitPrice = trade.takeProfit;
      } else if (expired) {
        outcome = currentPrice >= trade.entry ? 'win' : 'loss';
        exitPrice = currentPrice;
      }
    } else if (trade.signal === 'SELL') {
      if (candleHigh >= trade.stopLoss) {
        outcome = 'loss';
        exitPrice = trade.stopLoss;
      } else if (candleLow <= trade.takeProfit) {
        outcome = 'win';
        exitPrice = trade.takeProfit;
      } else if (expired) {
        outcome = currentPrice <= trade.entry ? 'win' : 'loss';
        exitPrice = currentPrice;
      }
    }

    if (outcome) {
      const pnl = trade.signal === 'BUY'
        ? round(exitPrice - trade.entry)
        : round(trade.entry - exitPrice);

      data.closed.unshift({
        ...trade,
        status: 'closed',
        outcome,
        exitPrice: round(exitPrice),
        pnl,
        closedAt: new Date().toISOString(),
        holdMinutes: Math.round((now - openedMs) / 60000),
      });
    } else {
      stillOpen.push(trade);
    }
  }

  data.open = stillOpen;
  saveTrades(data);
  return data;
}

function getStats() {
  const data = loadTrades();
  const closed = data.closed;
  const wins = closed.filter((t) => t.outcome === 'win').length;
  const losses = closed.filter((t) => t.outcome === 'loss').length;
  const total = wins + losses;
  const winRate = total > 0 ? round((wins / total) * 100) : 0;
  const totalPnl = round(closed.reduce((s, t) => s + (t.pnl || 0), 0));
  const grossProfit = round(closed.filter((t) => t.pnl > 0).reduce((s, t) => s + t.pnl, 0));
  const grossLoss = Math.abs(round(closed.filter((t) => t.pnl < 0).reduce((s, t) => s + t.pnl, 0)));
  const profitFactor = grossLoss > 0 ? round(grossProfit / grossLoss) : grossProfit > 0 ? 999 : 0;

  return {
    totalTrades: total,
    wins,
    losses,
    openTrades: data.open.length,
    winRate,
    totalPnl,
    profitFactor,
    recentClosed: closed.slice(0, 10),
    open: data.open,
  };
}

function round(n) {
  return Math.round(n * 100) / 100;
}

module.exports = {
  openTrade,
  updateTrades,
  getStats,
  loadTrades,
};
