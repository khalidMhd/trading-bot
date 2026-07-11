(function () {
  const grid = document.getElementById('news-grid');
  const filters = document.getElementById('news-filters');
  if (!grid || !window.NEWS_ARTICLES) return;

  let active = 'all';

  function formatDate(iso) {
    return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function renderCards() {
    const items = active === 'all'
      ? NEWS_ARTICLES
      : NEWS_ARTICLES.filter((a) => a.category === active);

    if (!items.length) {
      grid.innerHTML = '<p class="news-empty">No articles in this category yet.</p>';
      return;
    }

    grid.innerHTML = items.map((a) => `
      <article class="news-card">
        <span class="news-cat news-cat-${a.category}">${escapeHtml(a.categoryLabel)}</span>
        <h2><a href="/news/${a.slug}">${escapeHtml(a.title)}</a></h2>
        <p>${escapeHtml(a.excerpt)}</p>
        <div class="news-meta">
          <time datetime="${a.date}">${formatDate(a.date)}</time>
          <span>${a.readMin} min read</span>
        </div>
        <a href="/news/${a.slug}" class="news-read">Read article →</a>
      </article>
    `).join('');
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  if (filters && window.NEWS_CATEGORIES) {
    filters.innerHTML = NEWS_CATEGORIES.map((c) => `
      <button type="button" class="news-filter${c.id === active ? ' active' : ''}" data-cat="${c.id}">
        ${escapeHtml(c.label)}
      </button>
    `).join('');

    filters.addEventListener('click', (e) => {
      const btn = e.target.closest('.news-filter');
      if (!btn) return;
      active = btn.getAttribute('data-cat');
      filters.querySelectorAll('.news-filter').forEach((b) => {
        b.classList.toggle('active', b.getAttribute('data-cat') === active);
      });
      renderCards();
    });
  }

  renderCards();
})();
