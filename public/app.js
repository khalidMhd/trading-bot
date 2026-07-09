const POLL_MS = 60000;
const HISTORY_KEY = 'gold-bot-signal-history';
const PAPER_KEY = 'gold-bot-paper-trades';

let chart = null;
let lastAlertedSignal = null;
let lastSeenSignalKey = null;
let notificationsEnabled = false;
let socket = null;

function updateNotifyButton() {
  const btn = document.getElementById('notify-btn');
  if (!btn || !('Notification' in window)) {
    if (btn) {
      btn.textContent = 'Alerts N/A';
      btn.disabled = true;
    }
    return;
  }

  if (Notification.permission === 'granted') {
    btn.textContent = '🔔 Alerts ON';
    btn.className = 'btn-notify enabled';
    notificationsEnabled = true;
  } else if (Notification.permission === 'denied') {
    btn.textContent = '🔔 Blocked';
    btn.className = 'btn-notify denied';
    btn.title = 'Enable notifications in Chrome: Site settings → Notifications';
  } else {
    btn.textContent = '🔔 Enable Alerts';
    btn.className = 'btn-notify';
    btn.title = 'Click to allow Chrome/Windows notifications for BUY/SELL signals';
  }
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    alert('This browser does not support desktop notifications.');
    return;
  }

  if (Notification.permission === 'granted') {
    notificationsEnabled = true;
    updateNotifyButton();
    new Notification('Gold Signal Bot', {
      body: 'Alerts are enabled. You will be notified on BUY/SELL signals.',
      tag: 'gold-bot-setup',
    });
    return;
  }

  if (Notification.permission === 'denied') {
    alert('Notifications are blocked. In Chrome: click the lock icon in the address bar → Site settings → Notifications → Allow.');
    updateNotifyButton();
    return;
  }

  const result = await Notification.requestPermission();
  notificationsEnabled = result === 'granted';
  updateNotifyButton();

  if (notificationsEnabled) {
    new Notification('Gold Signal Bot', {
      body: 'Alerts enabled! You will get notified when a BUY or SELL signal fires.',
      tag: 'gold-bot-setup',
    });
    playAlertSound('setup');
  }
}

function playAlertSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const playTone = (freq, start, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };

    if (type === 'BUY') {
      playTone(880, 0, 0.15);
      playTone(1100, 0.18, 0.2);
    } else if (type === 'SELL') {
      playTone(600, 0, 0.15);
      playTone(450, 0.18, 0.25);
    } else {
      playTone(700, 0, 0.12);
    }
  } catch {
    // Audio optional
  }
}

function showSignalNotification(signal) {
  if (!notificationsEnabled || Notification.permission !== 'granted') return;

  const sig = signal.signal;
  const entry = formatPrice(signal.entry);
  const sl = formatPrice(signal.stopLoss);
  const tp = formatPrice(signal.takeProfit);
  const prob = sig === 'BUY' ? signal.buyProbability : signal.sellProbability;

  const title = `XAUUSD ${sig} Signal`;
  const body = `Entry ${entry} · SL ${sl} · TP ${tp}\n${prob}% probability · ${signal.confidence} confidence`;

  const notification = new Notification(title, {
    body,
    tag: `gold-signal-${sig}-${Date.now()}`,
    requireInteraction: true,
    silent: false,
  });

  notification.onclick = () => {
    window.focus();
    notification.close();
  };

  playAlertSound(sig);
}

function maybeAlert(signal) {
  const sig = signal?.signal || 'HOLD';

  if (sig === 'HOLD') {
    lastAlertedSignal = null;
    return;
  }

  if (sig !== 'BUY' && sig !== 'SELL') return;
  if (sig === lastAlertedSignal) return;

  lastAlertedSignal = sig;
  showSignalNotification(signal);
}

function initChart() {
  const ctx = document.getElementById('price-chart').getContext('2d');
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Close',
          data: [],
          borderColor: '#58a6ff',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.1,
        },
        {
          label: 'EMA 9',
          data: [],
          borderColor: '#3fb950',
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.1,
        },
        {
          label: 'EMA 21',
          data: [],
          borderColor: '#f85149',
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#8b949e' } },
      },
      scales: {
        x: {
          ticks: { color: '#8b949e', maxTicksLimit: 8 },
          grid: { color: '#30363d' },
        },
        y: {
          ticks: { color: '#8b949e' },
          grid: { color: '#30363d' },
        },
      },
    },
  });
}

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString();
}

function formatPrice(n) {
  if (n == null) return '—';
  return n.toFixed(2);
}

function updateStats(stats) {
  if (!stats) return;
  const winRateEl = document.getElementById('win-rate');
  winRateEl.textContent = stats.totalTrades > 0 ? `${stats.winRate}%` : '—';
  winRateEl.className = `stat-value ${stats.winRate >= 50 ? 'positive' : stats.totalTrades > 0 ? 'negative' : ''}`;

  document.getElementById('win-loss').textContent =
    stats.totalTrades > 0 ? `${stats.wins}W / ${stats.losses}L` : '—';
  document.getElementById('open-trades').textContent = stats.openTrades ?? 0;

  const pnlEl = document.getElementById('total-pnl');
  if (stats.totalTrades > 0) {
    pnlEl.textContent = `${stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl} pts`;
    pnlEl.className = `stat-value ${stats.totalPnl >= 0 ? 'positive' : 'negative'}`;
  } else {
    pnlEl.textContent = '—';
    pnlEl.className = 'stat-value';
  }
}

function updateBacktest(bt) {
  const el = document.getElementById('backtest-result');
  if (!bt) {
    el.textContent = 'Run backtest to see historical win rate.';
    return;
  }
  const source = bt.source === 'mt5' ? 'MT5' : 'Yahoo GC=F';
  el.innerHTML = `
    <strong>${bt.winRate}%</strong> win rate ·
    ${bt.wins}W / ${bt.losses}L ·
    ${bt.totalSignals} signals ·
    PnL: <span class="${bt.totalPnl >= 0 ? 'buy-text' : 'sell-text'}">${bt.totalPnl >= 0 ? '+' : ''}${bt.totalPnl} pts</span> ·
    PF: ${bt.profitFactor}
    <br><span class="muted">${bt.period} · ${source}</span>
  `;
}

async function runBacktest() {
  const el = document.getElementById('backtest-result');
  el.textContent = 'Running backtest…';
  try {
    const res = await fetch('/api/backtest');
    const bt = await res.json();
    if (bt.error) throw new Error(bt.error);
    updateBacktest(bt);
  } catch (err) {
    el.textContent = `Backtest failed: ${err.message}`;
  }
}

function updateUI(data) {
  const { signal, price, lastUpdate, provider, probability, indicators, candles, ema9Series, ema21Series } = data;

  const modeBadge = document.getElementById('mode-badge');
  const isLive = provider?.mode === 'live';
  modeBadge.textContent = isLive ? 'LIVE' : 'DEMO';
  modeBadge.className = `badge badge-${isLive ? 'live' : 'demo'}`;

  const sourceLabel = document.getElementById('source-label');
  if (provider) {
    sourceLabel.textContent = `${provider.source} · ${provider.detail}`;
    if (provider.bid != null && provider.ask != null) {
      sourceLabel.textContent += ` · Bid ${provider.bid.toFixed(2)} / Ask ${provider.ask.toFixed(2)}`;
    }
  }

  document.getElementById('last-update').textContent = `Updated ${formatTime(lastUpdate)}`;
  document.getElementById('price').textContent = formatPrice(price);

  const sigEl = document.getElementById('signal-display');
  const sig = signal?.signal || 'HOLD';
  sigEl.textContent = sig;
  sigEl.className = `signal ${sig.toLowerCase()}`;

  const confEl = document.getElementById('confidence');
  confEl.textContent = signal?.confidence || '—';
  if (signal?.confidence === 'high') confEl.style.background = '#238636';
  else if (signal?.confidence === 'medium') confEl.style.background = '#9e6a03';
  else confEl.style.background = 'var(--border)';

  const buyProb = probability?.buy ?? signal?.buyProbability ?? 50;
  const sellProb = probability?.sell ?? signal?.sellProbability ?? 50;
  document.getElementById('buy-prob').textContent = `${buyProb}%`;
  document.getElementById('sell-prob').textContent = `${sellProb}%`;
  document.getElementById('buy-bar').style.width = `${buyProb}%`;
  document.getElementById('sell-bar').style.width = `${sellProb}%`;
  document.getElementById('confluence').textContent =
    `Confluence: ${probability?.confluence ?? signal?.confluence ?? '—'}/${probability?.totalFactors ?? 8} factors`;
  const threshold = probability?.threshold ?? 75;
  const thresholdMet = buyProb >= threshold || sellProb >= threshold;
  document.getElementById('threshold-note').textContent =
    sig !== 'HOLD'
      ? 'Active signal'
      : thresholdMet
        ? 'Threshold met — waiting on confluence / ADX / edge'
        : `Signal fires at ${threshold}%+ (balanced)`;

  document.getElementById('entry').textContent = formatPrice(signal?.entry);
  document.getElementById('sl').textContent = formatPrice(signal?.stopLoss);
  document.getElementById('tp').textContent = formatPrice(signal?.takeProfit);
  document.getElementById('hold-time').textContent = signal?.holdMinutes || '15–30 min';

  const reasonsEl = document.getElementById('reasons');
  reasonsEl.innerHTML = '';
  (signal?.reasons || []).forEach((r) => {
    const li = document.createElement('li');
    li.textContent = r;
    reasonsEl.appendChild(li);
  });

  if (indicators) {
    document.getElementById('rsi').textContent = indicators.rsi?.toFixed(1) ?? '—';
    document.getElementById('ema').textContent = `${formatPrice(indicators.ema9)} / ${formatPrice(indicators.ema21)}`;
    document.getElementById('atr').textContent = indicators.atr?.toFixed(2) ?? '—';
    document.getElementById('adx').textContent = indicators.adx?.toFixed(1) ?? '—';
    document.getElementById('trend').textContent = indicators.trend ?? '—';
    document.getElementById('h1-trend').textContent = indicators.h1Trend ?? '—';
  }

  if (data.stats?.cloudMode) {
    updateStats(getClientStats());
    trackClientSignal(signal, price);
  } else {
    updateStats(data.stats);
  }
  updateBacktest(data.backtest);
  maybeAlert(signal);

  if (signal?.filters) {
    document.getElementById('session').textContent = signal.filters.session || '—';
    const newsEl = document.getElementById('news-status');
    if (signal.filters.newsClear) {
      newsEl.textContent = 'News: Clear';
      newsEl.className = 'news-status clear';
    } else {
      newsEl.textContent = `News: ${signal.filters.newsReason || 'Blocked'}`;
      newsEl.className = 'news-status blocked';
    }
  }

  if (chart && candles) {
    const labels = candles.map((c) => {
      const d = new Date(c.time);
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    });
    chart.data.labels = labels;
    chart.data.datasets[0].data = candles.map((c) => c.close);
    chart.data.datasets[1].data = ema9Series || [];
    chart.data.datasets[2].data = ema21Series || [];
    chart.update('none');
  }
}

function loadStoredHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveStoredHistory(history) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 200)));
}

function loadPaperTrades() {
  try {
    return JSON.parse(localStorage.getItem(PAPER_KEY) || '{"open":[],"closed":[]}');
  } catch {
    return { open: [], closed: [] };
  }
}

function savePaperTrades(data) {
  localStorage.setItem(PAPER_KEY, JSON.stringify(data));
}

function getClientStats() {
  const data = loadPaperTrades();
  const closed = data.closed || [];
  const wins = closed.filter((t) => t.outcome === 'win').length;
  const losses = closed.filter((t) => t.outcome === 'loss').length;
  const total = wins + losses;
  const totalPnl = closed.reduce((s, t) => s + (t.pnl || 0), 0);
  return {
    totalTrades: total,
    wins,
    losses,
    openTrades: (data.open || []).length,
    winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
    totalPnl: Math.round(totalPnl * 100) / 100,
    cloudMode: true,
  };
}

function updatePaperTrades(price, high, low) {
  const data = loadPaperTrades();
  const px = price ?? 0;
  const hi = high ?? px;
  const lo = low ?? px;

  data.open = (data.open || []).filter((trade) => {
    let outcome = null;
    let pnl = 0;

    if (trade.signal === 'BUY') {
      if (lo <= trade.stopLoss) {
        outcome = 'loss';
        pnl = trade.stopLoss - trade.entry;
      } else if (hi >= trade.takeProfit) {
        outcome = 'win';
        pnl = trade.takeProfit - trade.entry;
      }
    } else if (trade.signal === 'SELL') {
      if (hi >= trade.stopLoss) {
        outcome = 'loss';
        pnl = trade.entry - trade.stopLoss;
      } else if (lo <= trade.takeProfit) {
        outcome = 'win';
        pnl = trade.entry - trade.takeProfit;
      }
    }

    if (outcome) {
      data.closed.unshift({ ...trade, outcome, pnl, closedAt: new Date().toISOString() });
      return false;
    }
    return true;
  });

  if (data.closed.length > 200) data.closed = data.closed.slice(0, 200);
  savePaperTrades(data);
}

function trackClientSignal(signal, price) {
  if (!signal || signal.signal === 'HOLD' || !signal.stopLoss || !signal.takeProfit) return;

  const key = `${signal.signal}-${signal.entry?.toFixed(2)}-${signal.timestamp}`;
  if (key === lastSeenSignalKey) return;
  lastSeenSignalKey = key;

  const history = loadStoredHistory();
  history.unshift({ ...signal, id: Date.now() });
  saveStoredHistory(history);

  const paper = loadPaperTrades();
  const duplicate = (paper.open || []).find(
    (t) => t.signal === signal.signal && Math.abs(t.entry - signal.entry) < 0.5
  );
  if (!duplicate) {
    paper.open = paper.open || [];
    paper.open.push({
      id: Date.now(),
      signal: signal.signal,
      entry: signal.entry,
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfit,
      openedAt: signal.timestamp,
    });
    savePaperTrades(paper);
  }

  renderHistory(history);
}

function renderHistory(history) {
  const el = document.getElementById('history');
  if (!history.length) {
    el.innerHTML = '<p class="muted">No signals yet — waiting for BUY/SELL setup…</p>';
    return;
  }

  el.innerHTML = history
    .map(
      (h) => `
      <div class="history-item">
        <span class="sig ${h.signal.toLowerCase()}">${h.signal}</span>
        <span>${formatPrice(h.entry)}</span>
        <span class="muted">B${h.buyProbability ?? '—'}% S${h.sellProbability ?? '—'}%</span>
        <span class="muted">${h.confidence}</span>
        <span class="muted">${formatTime(h.timestamp)}</span>
      </div>
    `
    )
    .join('');
}

async function loadHistory() {
  try {
    const res = await fetch('/api/history');
    if (res.ok) {
      const history = await res.json();
      if (history.length) {
        renderHistory(history);
        return;
      }
    }
  } catch {
    // API history unavailable on Vercel — use localStorage
  }
  renderHistory(loadStoredHistory());
}

async function fetchMarket() {
  try {
    const res = await fetch('/api/market');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    const lastCandle = data.candles?.[data.candles.length - 1];
    if (data.stats?.cloudMode && data.price != null) {
      updatePaperTrades(data.price, lastCandle?.high, lastCandle?.low);
    }

    updateUI(data);
  } catch (err) {
    console.error('Market fetch failed:', err.message);
    document.getElementById('source-label').textContent = `Error: ${err.message}`;
  }
}

function startDataFeed() {
  fetchMarket();
  setInterval(fetchMarket, POLL_MS);

  if (typeof io === 'function') {
    try {
      socket = io();
      socket.on('market-update', (data) => updateUI(data));
      socket.on('connect', () => loadHistory());
    } catch {
      // Socket.io not available (Vercel) — polling only
    }
  }
}

document.getElementById('run-backtest').addEventListener('click', runBacktest);
document.getElementById('notify-btn').addEventListener('click', requestNotificationPermission);

updateNotifyButton();
if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
  notificationsEnabled = true;
}

initChart();
loadHistory();
startDataFeed();
setInterval(loadHistory, 30000);
