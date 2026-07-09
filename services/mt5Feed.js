const { spawn } = require('child_process');
const path = require('path');
const config = require('../config');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'mt5_feed.py');

function runMt5Feed() {
  return new Promise((resolve, reject) => {
    const args = [
      SCRIPT,
      config.mt5Symbol,
      String(config.candleCount),
      config.mt5Path || '',
    ];

    const proc = spawn(config.pythonPath, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `MT5 script exited with code ${code}`));
        return;
      }

      try {
        const data = JSON.parse(stdout.trim());
        if (data.error) {
          reject(new Error(data.error));
          return;
        }
        resolve(data);
      } catch {
        reject(new Error(`Invalid MT5 response: ${stdout.slice(0, 200)}`));
      }
    });

    proc.on('error', (err) => reject(new Error(`Failed to run Python: ${err.message}`)));
  });
}

async function fetchMt5Candles() {
  const data = await runMt5Feed();

  const mapCandles = (list) => (list || []).map((c) => ({
    time: new Date(c.time * 1000).toISOString(),
    open: round(c.open),
    high: round(c.high),
    low: round(c.low),
    close: round(c.close),
    volume: c.volume,
  }));

  return {
    candles: mapCandles(data.candles),
    m5Candles: mapCandles(data.m5_candles),
    h1Candles: mapCandles(data.h1_candles),
    meta: {
      symbol: data.symbol,
      broker: data.broker,
      bid: data.bid,
      ask: data.ask,
    },
  };
}

function round(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { fetchMt5Candles };
