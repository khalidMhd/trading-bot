(function () {
  // Central place to manage the site menu. Add new pages here and every page updates.
  var MENU = [
    { type: 'cta', label: 'Live App', href: '/app' },
    {
      type: 'group', label: 'Markets', items: [
        { label: 'Gold Price Today', href: '/gold-price' },
        { label: 'Gold Rate (Tola/Gram)', href: '/gold-rate' },
        { label: 'Trading Sessions', href: '/gold-trading-sessions' },
        { label: 'Economic Calendar', href: '/calendar' },
      ]
    },
    {
      type: 'group', label: 'Tools', items: [
        { label: 'Trading Calculators', href: '/tools' },
        { label: 'Confluence Simulator', href: '/simulator' },
      ]
    },
    {
      type: 'group', label: 'Learn', items: [
        { label: 'Gold Trading Strategy', href: '/gold-trading-strategy' },
        { label: 'News & Guides', href: '/news' },
        { label: 'How It Works', href: '/how-it-works' },
        { label: 'Glossary', href: '/glossary' },
      ]
    },
    {
      type: 'group', label: 'Company', items: [
        { label: 'About', href: '/about' },
        { label: 'Disclaimer', href: '/disclaimer' },
        { label: 'Privacy', href: '/privacy' },
      ]
    },
  ];

  function currentPath() {
    var p = window.location.pathname.replace(/\/+$/, '');
    return p === '' ? '/' : p;
  }

  function isActive(href, path) {
    if (href === '/app') return path === '/app';
    return path === href || (href !== '/' && path.indexOf(href) === 0);
  }

  function build() {
    var nav = document.querySelector('nav.site-nav');
    if (!nav) return;
    var path = currentPath();

    var logo =
      '<a href="/" class="site-logo"><img src="/logo.png" alt="Trading Bots Live logo" class="site-logo-img" width="32" height="32" />Trading Bots <span class="live-dot">Live</span></a>';

    var toggle = '<button class="nav-toggle" type="button" aria-label="Toggle menu" aria-expanded="false">☰</button>';

    var linksHtml = MENU.map(function (entry) {
      if (entry.type === 'cta') {
        var act = isActive(entry.href, path) ? ' active' : '';
        return '<a href="' + entry.href + '" class="nav-cta' + act + '">' + entry.label + '</a>';
      }
      var groupActive = entry.items.some(function (it) { return isActive(it.href, path); });
      var itemsHtml = entry.items.map(function (it) {
        var a = isActive(it.href, path) ? ' class="active"' : '';
        return '<a href="' + it.href + '"' + a + '>' + it.label + '</a>';
      }).join('');
      return (
        '<div class="nav-item' + (groupActive ? ' has-active' : '') + '">' +
        '<button type="button" class="nav-drop-btn" aria-expanded="false">' + entry.label + '<span class="nav-caret">▾</span></button>' +
        '<div class="nav-drop">' + itemsHtml + '</div>' +
        '</div>'
      );
    }).join('');

    nav.innerHTML = logo + toggle + '<div class="site-links">' + linksHtml + '</div>';

    var links = nav.querySelector('.site-links');
    var toggleBtn = nav.querySelector('.nav-toggle');

    toggleBtn.addEventListener('click', function () {
      var open = links.classList.toggle('open');
      toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    var dropBtns = nav.querySelectorAll('.nav-drop-btn');
    dropBtns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var item = btn.parentElement;
        var willOpen = !item.classList.contains('open');
        nav.querySelectorAll('.nav-item.open').forEach(function (o) {
          o.classList.remove('open');
          o.querySelector('.nav-drop-btn').setAttribute('aria-expanded', 'false');
        });
        if (willOpen) {
          item.classList.add('open');
          btn.setAttribute('aria-expanded', 'true');
        }
      });
    });

    document.addEventListener('click', function (e) {
      if (!nav.contains(e.target)) {
        nav.querySelectorAll('.nav-item.open').forEach(function (o) {
          o.classList.remove('open');
          o.querySelector('.nav-drop-btn').setAttribute('aria-expanded', 'false');
        });
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
