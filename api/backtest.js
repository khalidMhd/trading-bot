const { runBacktest } = require('../services/backtest');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const result = await runBacktest();
    res.status(200).json(result);
  } catch (err) {
    console.error('[api/backtest]', err.message);
    res.status(500).json({ error: err.message });
  }
};
