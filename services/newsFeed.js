const FEEDS = [
  {
    url: 'https://news.google.com/rss/search?q=gold+XAUUSD+forex+trading&hl=en-US&gl=US&ceid=US:en',
    source: 'Google News',
    filterGold: false,
  },
  {
    url: 'https://www.investing.com/rss/news_14.rss',
    source: 'Investing.com',
    filterGold: true,
  },
  {
    url: 'https://www.fxstreet.com/rss/news',
    source: 'FXStreet',
    filterGold: true,
  },
  {
    url: 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=GC=F&region=US&lang=en-US',
    source: 'Yahoo Finance',
    filterGold: true,
  },
];

const GOLD_KEYWORDS = /\b(gold|xauusd|xau\/usd|xau-usd|bullion|precious metal|comex|gc=f|fed\b|fomc|inflation|treasury yield|dollar index|dxy|safe haven|central bank)\b/i;

function decodeEntities(str) {
  return String(str)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(str) {
  return String(str).replace(/<[^>]+>/g, '').trim();
}

function extractTag(block, tag) {
  const cdata = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, 'i').exec(block);
  if (cdata) return decodeEntities(cdata[1].trim());
  const plain = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(block);
  if (plain) return decodeEntities(stripHtml(plain[1].trim()));
  return '';
}

function extractLink(block) {
  const link = extractTag(block, 'link');
  if (link) return link;
  const href = /<link[^>]+href=["']([^"']+)["']/i.exec(block);
  return href ? href[1] : '';
}

function parseRssXml(xml, source, limit = 8) {
  const items = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  for (const block of blocks) {
    if (items.length >= limit) break;
    const title = extractTag(block, 'title');
    const link = extractLink(block);
    if (!title || !link) continue;
    items.push({
      title,
      link,
      pubDate: extractTag(block, 'pubDate') || extractTag(block, 'updated') || '',
      source,
    });
  }
  return items;
}

async function fetchFeed(feed) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(feed.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'TradingBotsLive/1.0 (news aggregator)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    let items = parseRssXml(xml, feed.source, 12);
    if (feed.filterGold) {
      items = items.filter((item) => GOLD_KEYWORDS.test(item.title));
    }
    return items;
  } finally {
    clearTimeout(timer);
  }
}

async function getNewsHeadlines(maxItems = 15) {
  const results = await Promise.allSettled(FEEDS.map((f) => fetchFeed(f)));
  const merged = [];
  const seen = new Set();

  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    for (const item of result.value) {
      const key = item.title.toLowerCase().slice(0, 80);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
  }

  merged.sort((a, b) => {
    const da = a.pubDate ? Date.parse(a.pubDate) : 0;
    const db = b.pubDate ? Date.parse(b.pubDate) : 0;
    return db - da;
  });

  return {
    items: merged.slice(0, maxItems),
    updatedAt: new Date().toISOString(),
    sources: FEEDS.map((f) => f.source),
  };
}

module.exports = { getNewsHeadlines };
