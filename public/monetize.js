(function () {
  const cfg = window.SITE_CONFIG || {};

  function initAnalytics() {
    const id = cfg.gaMeasurementId;
    if (!id || !id.startsWith('G-')) return;

    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
    document.head.appendChild(s);

    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', id, { anonymize_ip: true });
  }

  function isAdAllowedPage() {
    const path = window.location.pathname.replace(/\/$/, '') || '/';
    return !['/app', '/privacy', '/disclaimer'].includes(path);
  }

  function loadAdSenseScript(clientId) {
    if (document.querySelector('script[src*="adsbygoogle.js"]')) return;
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`;
    s.crossOrigin = 'anonymous';
    document.head.appendChild(s);
  }

  function initAdSense() {
    const ads = cfg.adsense;
    if (!ads?.enabled || !ads.clientId?.startsWith('ca-pub-')) return;
    if (!isAdAllowedPage()) return;

    loadAdSenseScript(ads.clientId);

    document.querySelectorAll('.ad-slot[data-zone]').forEach((el) => {
      const key = el.getAttribute('data-zone');
      const slotId = ads.slots?.[key];
      if (!slotId) return;

      const ins = document.createElement('ins');
      ins.className = 'adsbygoogle';
      ins.style.display = 'block';
      ins.setAttribute('data-ad-client', ads.clientId);
      ins.setAttribute('data-ad-slot', slotId);
      ins.setAttribute('data-ad-format', 'auto');
      ins.setAttribute('data-full-width-responsive', 'true');
      el.appendChild(ins);
      el.classList.add('ad-loaded');
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    });
  }

  function injectPropellerZone(el, scriptSrc) {
    if (!scriptSrc || !cfg.propellerAds?.enabled) return;
    const script = document.createElement('script');
    script.async = true;
    script.dataset.cfasync = 'false';
    script.src = scriptSrc;
    el.appendChild(script);
    el.classList.add('ad-loaded');
  }

  function initAdSlots() {
    if (!cfg.propellerAds?.enabled) return;
    document.querySelectorAll('.ad-slot[data-zone]').forEach((el) => {
      const key = el.getAttribute('data-zone');
      const scriptSrc = cfg.propellerAds.zones?.[key];
      if (scriptSrc) injectPropellerZone(el, scriptSrc);
    });
  }

  function renderAffiliateSlots() {
    const aff = cfg.affiliate;
    if (!aff?.enabled || !aff.url) return;

    document.querySelectorAll('.affiliate-slot').forEach((el) => {
      el.innerHTML = `
        <div class="affiliate-box">
          <span class="affiliate-tag">Partner</span>
          <h3>${escapeHtml(aff.headline)}</h3>
          <p>${escapeHtml(aff.description)}</p>
          <a href="${escapeAttr(aff.url)}" class="btn-primary affiliate-cta"
             target="_blank" rel="noopener noreferrer sponsored">${escapeHtml(aff.ctaText)}</a>
          <p class="affiliate-disclosure">${escapeHtml(aff.disclosure)}</p>
        </div>`;
    });
  }

  function initCookieNotice() {
    const hasAds = cfg.propellerAds?.enabled || cfg.adsense?.enabled;
    if (!cfg.gaMeasurementId && !hasAds) return;
    if (localStorage.getItem('tbl-cookie-ok')) return;

    const bar = document.createElement('div');
    bar.className = 'cookie-bar';
    bar.innerHTML = `
      <p>We use cookies for analytics and ads. See our <a href="/privacy">Privacy Policy</a>.</p>
      <button type="button" class="btn-primary cookie-accept">Accept</button>`;
    document.body.appendChild(bar);
    bar.querySelector('.cookie-accept').addEventListener('click', () => {
      localStorage.setItem('tbl-cookie-ok', '1');
      bar.remove();
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, '&#39;');
  }

  if (cfg.ezoic?.enabled) {
    // Add Ezoic site integration script from your Ezoic dashboard after approval
    // document.head.appendChild(...)
  }

  initAnalytics();
  initAdSense();
  initAdSlots();
  renderAffiliateSlots();
  initCookieNotice();
})();
