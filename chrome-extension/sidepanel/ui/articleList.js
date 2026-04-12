/**
 * articleList
 *
 * Renders the filterable/searchable list of articles on step 1. The
 * filter chip and search input update state.currentFilter and then
 * call renderArticles() to refresh the DOM. Click on a card fires
 * selectArticle, which kicks off the AEM validation flow.
 */
import { state } from '../state.js'
import { escHtml } from './escHtml.js'
import { selectArticle } from '../steps/selectArticle.js'

const STATUS_LABELS = {
  'in-progress': 'In Progress',
  'in-review': 'In Review',
  approved: 'Approved',
}

const TYPE_LABELS = {
  'blog-post': 'Blog Post',
  paper: 'Paper',
  'quick-take': 'Quick Take',
  podcast: 'Podcast',
}

export function renderArticles() {
  const list = document.getElementById('articles-list')
  const search = document.getElementById('search-input').value.toLowerCase()

  let filtered = state.articles
  if (state.currentFilter !== 'all') {
    filtered = filtered.filter((a) => a.status === state.currentFilter)
  }
  if (search) {
    filtered = filtered.filter(
      (a) =>
        (a.headline || '').toLowerCase().includes(search) ||
        (a.slug || '').toLowerCase().includes(search)
    )
  }

  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state">No articles found</div>'
    return
  }

  list.innerHTML = filtered
    .map((a) => {
      const badgeClass = `badge-${a.status}`
      const statusLabel = STATUS_LABELS[a.status] || a.status
      const typeLabel = TYPE_LABELS[a.type] || a.type || ''
      return `
      <div class="article-card" data-id="${a.id}">
        <div class="article-card-title">${escHtml(a.headline || 'Untitled')}</div>
        <div class="article-card-meta">
          <span class="badge ${badgeClass}">${statusLabel}</span>
          <span>${typeLabel}</span>
          ${a.publish_date ? `<span>${a.publish_date}</span>` : ''}
        </div>
      </div>
    `
    })
    .join('')

  list.querySelectorAll('.article-card').forEach((card) => {
    card.addEventListener('click', () => {
      const id = card.dataset.id
      const article = state.articles.find((a) => a.id === id)
      if (article) selectArticle(article)
    })
  })
}
