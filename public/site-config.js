/**
 * Monetization & analytics config — edit this file after signing up for ad/affiliate programs.
 * Site: https://www.trading-bots.live
 */
window.SITE_CONFIG = {
  // Google Analytics 4 — https://analytics.google.com → Admin → Data Streams → Measurement ID
  gaMeasurementId: '',

  // PropellerAds — https://propellerads.com (fast approval)
  propellerAds: {
    enabled: false,
    zones: {
      top: '', // Paste PropellerAds script URL from your dashboard
      mid: '',
    },
  },

  // Ezoic — https://www.ezoic.com (set enabled after Ezoic approves your site)
  ezoic: {
    enabled: false,
  },

  // Broker affiliate — paste YOUR partner/IB link (Exness, XM, IC Markets, etc.)
  affiliate: {
    enabled: true,
    brokerName: 'Partner Broker',
    headline: 'Ready to trade gold with real prices?',
    description: 'Open a free demo account with a regulated broker and practice XAUUSD alongside our live signals.',
    ctaText: 'Open free demo account →',
    url: '', // ← Paste your affiliate link here
    disclosure: 'Affiliate link — we may earn a commission at no extra cost to you.',
  },
};
