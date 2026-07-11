(function () {
  const listEl = document.getElementById('feed-list');
  const updatedEl = document.getElementById('feed-updated');
  if (!listEl) return;

  const limit = listEl.dataset.limit ? parseInt(listEl.dataset.limit, 10) : 15;

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDate(str) {
    if (!str) return '';
    const d = new Date(str);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function render(items, updatedAt) {
    if (!items.length) {
      listEl.innerHTML = '<p class="feed-empty">Headlines temporarily unavailable. Check back soon.</p>';
      return;
    }

    listEl.innerHTML = items.map((item) => `
      <article class="feed-item">
        <a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">
          <span class="feed-title">${escapeHtml(item.title)}</span>
        </a>
        <div class="feed-meta">
          <span class="feed-source">${escapeHtml(item.source)}</span>
          ${item.pubDate ? `<time>${formatDate(item.pubDate)}</time>` : ''}
        </div>
      </article>
    `).join('');

    if (updatedEl && updatedAt) {
      updatedEl.textContent = `Updated ${formatDate(updatedAt)}`;
    }
  }

  listEl.innerHTML = '<p class="feed-loading">Loading headlines…</p>';

  fetch(`/api/news-feed?limit=${limit}`)
    .then((r) => r.json())
    .then((data) => render(data.items || [], data.updatedAt))
    .catch(() => {
      listEl.innerHTML = '<p class="feed-empty">Could not load headlines. <a href="/news">Browse our guides</a>.</p>';
    });
})();
