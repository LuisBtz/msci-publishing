/**
 * Step 3 — Create Page
 *
 * Populates the "create AEM page" screen: shows the article's
 * metadata summary and the expanded tag list the page will receive,
 * and builds the parameters object consumed by createPageInAEM.
 *
 * If the pre-check detected that the page already exists, we show a
 * validation card with direct links to the editor + sites view and
 * hide the create button.
 */
import { state } from '../state.js'
import { AEM_HOST } from '../config.js'
import { escHtml } from '../ui/escHtml.js'

const TYPE_LABELS = {
  'blog-post': 'Blog Post',
  paper: 'Paper',
  'quick-take': 'Quick Take',
  podcast: 'Podcast',
}

export function populateStep3() {
  const a = state.selectedArticle
  document.getElementById('step3-title').textContent = a.headline || 'Untitled'
  document.getElementById('prop-slug').textContent = a.slug || '—'
  document.getElementById('prop-type').textContent = TYPE_LABELS[a.type] || a.type || '—'
  document.getElementById('prop-date').textContent = a.publish_date || '—'
  document.getElementById('prop-readtime').textContent = a.read_time ? `${a.read_time} min` : '—'
  document.getElementById('prop-authors').textContent =
    (a.authors || []).map((au) => au.name).join(', ') || '—'

  const allTags = a.tags?.all_tags || []
  document.getElementById('prop-tags-count').textContent = allTags.length + ' tags'

  const tagsList = document.getElementById('prop-tags-list')
  if (allTags.length === 0) {
    tagsList.innerHTML = '<span style="font-size:11px;color:#999;">No tags</span>'
  } else {
    tagsList.innerHTML = allTags
      .map((tag) => {
        const sep = tag.indexOf(' : ')
        if (sep !== -1) {
          const category = escHtml(tag.substring(0, sep).trim())
          const value = escHtml(tag.substring(sep + 3).trim())
          return `<span class="tag-chip"><span class="tag-category">${category}:</span> ${value}</span>`
        }
        return `<span class="tag-chip">${escHtml(tag)}</span>`
      })
      .join('')
  }

  document.getElementById('page-log').classList.add('hidden')
  document.getElementById('page-log').innerHTML = ''
  document.getElementById('page-links').classList.add('hidden')
  document.getElementById('btn-goto-step4').classList.add('hidden')
  document.getElementById('btn-create-page').disabled = false
  document.getElementById('btn-create-page').classList.remove('running')

  renderStep3Validation(a)
}

export function renderStep3Validation(article) {
  const card = document.getElementById('step3-validation')
  const pageCheck = article._pageCheck
  const createBtn = document.getElementById('btn-create-page')
  const continueBtn = document.getElementById('btn-goto-step4')
  const pageLinks = document.getElementById('page-links')

  if (pageCheck?.exists) {
    const slug = article.slug
    const parentPath = '/content/msci/us/en/research-and-insights/blog-post'
    const editUrl = `${AEM_HOST}/editor.html${parentPath}/${slug}.html`
    const sitesUrl = `${AEM_HOST}/ui#/aem/sites.html${parentPath}`

    card.classList.remove('hidden')
    card.innerHTML = `
      <div class="validation-card-icon">✓</div>
      <div class="validation-card-body">
        <h3>La página ya existe en AEM</h3>
        <p>${escHtml(pageCheck.title || article.headline || '')}</p>
        <p><code>${escHtml(pageCheck.pagePath || '')}</code></p>
        <button id="btn-recreate-page" class="btn-link-inline">Recrear / actualizar propiedades</button>
      </div>
    `
    createBtn.classList.add('hidden')
    continueBtn.classList.remove('hidden')
    continueBtn.textContent = 'Continuar al paso 4 →'

    document.getElementById('link-edit-page').href = editUrl
    document.getElementById('link-sites-view').href = sitesUrl
    pageLinks.classList.remove('hidden')

    document.getElementById('btn-recreate-page').addEventListener('click', () => {
      card.classList.add('hidden')
      createBtn.classList.remove('hidden')
      continueBtn.classList.add('hidden')
      pageLinks.classList.add('hidden')
    })
  } else {
    card.classList.add('hidden')
    card.innerHTML = ''
    createBtn.classList.remove('hidden')
  }
}

export function buildCreatePageParams(article) {
  const slug = article.slug || ''
  const damBase = '/content/dam/web/msci-com/research-and-insights/blog-post'
  const contributorBase = '/content/dam/web/msci-com/research-and-insights/contributor'
  const toAuthorSlug = (name) =>
    (name || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  const authorPaths = (article.authors || [])
    .map((a) => {
      if (a.content_fragment_path) return a.content_fragment_path
      const s = toAuthorSlug(a.name)
      return s ? `${contributorBase}/${s}/${s}` : null
    })
    .filter(Boolean)
  const allBanners = Object.values(article.banner_paths || {})
  const banner1x1 = allBanners.find((b) => b?.filename?.includes('1x1'))
  const thumbnailDamPath = banner1x1?.filename
    ? `${damBase}/${slug}/banners/${banner1x1.filename}`
    : ''

  return {
    slug,
    title: article.headline || '',
    metaDesc: article.meta_description || '',
    readTime: article.read_time ? parseInt(article.read_time, 10) : 0,
    publishDate: article.publish_date || '',
    authorPaths,
    tags: article.tags?.all_tags || [],
    thumbnailDamPath,
  }
}
