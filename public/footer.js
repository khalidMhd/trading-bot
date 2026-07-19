(function () {
  // Shared site footer. Add pages to a column here and every page updates.
  var COLUMNS = [
    {
      title: 'Markets', links: [
        { label: 'Gold Price Today', href: '/gold-price' },
        { label: 'Gold Rate (Tola/Gram)', href: '/gold-rate' },
        { label: 'Economic Calendar', href: '/calendar' },
        { label: 'Live Signals', href: '/app' },
      ]
    },
    {
      title: 'Tools', links: [
        { label: 'Trading Calculators', href: '/tools' },
        { label: 'Confluence Simulator', href: '/simulator' },
        { label: 'Gold Glossary', href: '/glossary' },
      ]
    },
    {
      title: 'Learn', links: [
        { label: 'News & Guides', href: '/news' },
        { label: 'How It Works', href: '/how-it-works' },
        { label: 'Gold Trading for Beginners', href: '/news/gold-trading-for-beginners' },
        { label: 'Risk Management', href: '/news/gold-risk-management-guide' },
      ]
    },
    {
      title: 'Company', links: [
        { label: 'About', href: '/about' },
        { label: 'Disclaimer', href: '/disclaimer' },
        { label: 'Privacy Policy', href: '/privacy' },
      ]
    },
  ];

  function build() {
    var footer = document.querySelector('footer.site-footer');
    if (!footer) return;
    var year = new Date().getFullYear();

    var brand =
      '<div class="footer-brand">' +
        '<a href="/" class="site-logo"><img src="/logo.png" alt="Trading Bots Live logo" class="site-logo-img" width="32" height="32" />Trading Bots <span class="live-dot">Live</span></a>' +
        '<p>Free real-time XAUUSD gold signals, live gold price, and trading tools — built to help you trade smarter. Educational use only, not financial advice.</p>' +
      '</div>';

    var cols = COLUMNS.map(function (col) {
      var links = col.links.map(function (l) {
        return '<a href="' + l.href + '">' + l.label + '</a>';
      }).join('');
      return '<div class="footer-col"><h4>' + col.title + '</h4>' + links + '</div>';
    }).join('');

    footer.innerHTML =
      '<div class="footer-cols">' + brand + cols + '</div>' +
      '<div class="footer-bottom">' +
        '<p>&copy; ' + year + ' Trading Bots Live · Educational use only · Not financial advice</p>' +
        '<p class="footer-risk">Trading gold (XAUUSD) carries a substantial risk of loss and is not suitable for every investor. Past performance does not guarantee future results.</p>' +
      '</div>';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
