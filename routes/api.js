const express = require('express');
const router = express.Router();

module.exports = (getContext) => {
  router.get('/status', (req, res) => {
    const { state } = getContext();
    res.json({
      symbol: 'XAUUSD',
      provider: state.provider,
      lastUpdate: state.lastUpdate,
      price: state.price,
    });
  });

  router.get('/signal', (req, res) => {
    const { state } = getContext();
    res.json(state.signal || { signal: 'HOLD' });
  });

  router.get('/market', (req, res) => {
    const { buildPayload } = getContext();
    res.json(buildPayload());
  });

  router.get('/history', (req, res) => {
    const { signalHistory } = getContext();
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    res.json(signalHistory.slice(0, limit));
  });

  router.get('/stats', (req, res) => {
    const { getStats } = getContext();
    res.json(getStats());
  });

  router.get('/backtest', async (req, res) => {
    try {
      const { runBacktestJob, getLastBacktest } = getContext();
      const result = await runBacktestJob();
      res.json(result || getLastBacktest());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
