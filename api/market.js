const { buildMarketPayload } = require('../services/marketEngine');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const payload = await buildMarketPayload();
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
    res.status(200).json(payload);
  } catch (err) {
    console.error('[api/market]', err.message);
    res.status(500).json({ error: err.message });
  }
};
