const { getNewsHeadlines } = require('../services/newsFeed');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 15, 25);
    const data = await getNewsHeadlines(limit);
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');
    res.status(200).json(data);
  } catch (err) {
    console.error('[api/news-feed]', err.message);
    res.status(500).json({ error: err.message, items: [] });
  }
};
