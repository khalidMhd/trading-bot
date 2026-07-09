const { buildMarketPayload } = require('../services/marketEngine');
const { runBacktest } = require('../services/backtest');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const segment = req.query.path;
  const route = Array.isArray(segment) ? segment[0] : (segment || '');

  try {
    switch (route) {
      case 'market': {
        const payload = await buildMarketPayload();
        res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
        res.status(200).json(payload);
        return;
      }
      case 'signal': {
        const payload = await buildMarketPayload();
        res.status(200).json(payload.signal || { signal: 'HOLD' });
        return;
      }
      case 'status': {
        const payload = await buildMarketPayload();
        res.status(200).json({
          symbol: 'XAUUSD',
          provider: payload.provider,
          lastUpdate: payload.lastUpdate,
          price: payload.price,
          cloud: true,
        });
        return;
      }
      case 'history':
        res.status(200).json([]);
        return;
      case 'backtest': {
        const result = await runBacktest();
        res.status(200).json(result);
        return;
      }
      default:
        res.status(404).json({ error: `Unknown API route: ${route || '(empty)'}` });
    }
  } catch (err) {
    console.error('[api]', route, err.message);
    res.status(500).json({ error: err.message });
  }
};
