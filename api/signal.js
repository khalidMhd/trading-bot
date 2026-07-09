const { buildMarketPayload } = require('../services/marketEngine');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const payload = await buildMarketPayload();
    res.status(200).json(payload.signal || { signal: 'HOLD' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
