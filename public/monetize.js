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
    if (!cfg.gaMeasurementId && !cfg.propellerAds?.enabled) return;
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
  initAdSlots();
  renderAffiliateSlots();
  initCookieNotice();
})();
