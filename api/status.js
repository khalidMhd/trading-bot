const { buildMarketPayload } = require('../services/marketEngine');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const payload = await buildMarketPayload();
    res.status(200).json({
      symbol: 'XAUUSD',
      provider: payload.provider,
      lastUpdate: payload.lastUpdate,
      price: payload.price,
      cloud: true,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
