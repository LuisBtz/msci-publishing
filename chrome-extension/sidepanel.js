// ─── Supabase Config ────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://zrorbndnrrrtcatvezro.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpyb3JibmRucnJydGNhdHZlenJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjY3MDIsImV4cCI6MjA4ODY0MjcwMn0.xnFfZe7J_QoTHPxlGopzo_zPlUDQh_esW5ymPDxpgXA'

const AEM_HOST = 'https://author-p125318-e1369672.adobeaemcloud.com'

// ─── State ──────────────────────────────────────────────────────────────────
let articles = []
let selectedArticle = null
let currentStep = 1
let currentFilter = 'all'

// ─── Supabase REST helpers ──────────────────────────────────────────────────
async function supabaseFetch(endpoint) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    }
  })
  if (!res.ok) throw new Error(`Supabase error: ${res.status}`)
  return res.json()
}

async function loadArticles() {
  const list = document.getElementById('articles-list')
  list.innerHTML = '<div class="loading-spinner">Loading articles...</div>'
  try {
    articles = await supabaseFetch('articles?status=neq.published&order=created_at.desc&select=id,headline,slug,status,type,publish_date,authors,tags,meta_description,read_time,exhibit_paths,banner_paths,body_blocks,footnotes,bullets,related_resources,final_url,sharepoint_folder_url')
    renderArticles()
  } catch (err) {
    list.innerHTML = `<div class="empty-state">Error loading articles: ${err.message}</div>`
  }
}

function renderArticles() {
  const list = document.getElementById('articles-list')
  const search = document.getElementById('search-input').value.toLowerCase()

  let filtered = articles
  if (currentFilter !== 'all') {
    filtered = filtered.filter(a => a.status === currentFilter)
  }
  if (search) {
    filtered = filtered.filter(a =>
      (a.headline || '').toLowerCase().includes(search) ||
      (a.slug || '').toLowerCase().includes(search)
    )
  }

  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state">No articles found</div>'
    return
  }

  list.innerHTML = filtered.map(a => {
    const badgeClass = `badge-${a.status}`
    const statusLabel = { 'in-progress': 'In Progress', 'in-review': 'In Review', 'approved': 'Approved' }[a.status] || a.status
    const typeLabel = { 'blog-post': 'Blog Post', 'paper': 'Paper', 'quick-take': 'Quick Take', 'podcast': 'Podcast' }[a.type] || a.type || ''
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
  }).join('')

  list.querySelectorAll('.article-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id
      selectedArticle = articles.find(a => a.id === id)
      if (selectedArticle) goToStep(2)
    })
  })
}

// ─── Step Navigation ────────────────────────────────────────────────────────
function goToStep(step) {
  currentStep = step

  // Update step bar
  document.querySelectorAll('#steps-bar .step').forEach(el => {
    const s = parseInt(el.dataset.step)
    el.classList.toggle('active', s === step)
    el.classList.toggle('completed', s < step)
  })

  // Show/hide content
  document.querySelectorAll('.step-content').forEach(el => {
    el.classList.toggle('active', el.id === `step-${step}`)
  })

  if (step === 2) populateStep2()
  if (step === 3) populateStep3()
}

// ─── Step 2: Assets ─────────────────────────────────────────────────────────
function populateStep2() {
  const a = selectedArticle
  document.getElementById('step2-title').textContent = a.headline || 'Untitled'
  const statusEl = document.getElementById('step2-status')
  const statusLabel = { 'in-progress': 'In Progress', 'in-review': 'In Review', 'approved': 'Approved' }[a.status] || a.status
  statusEl.textContent = statusLabel
  statusEl.className = `badge badge-${a.status}`

  // Count assets
  const { exhibitAssets, bannerAssets } = getAssets(a)
  document.getElementById('exhibits-count').textContent = exhibitAssets.length
  document.getElementById('banners-count').textContent = bannerAssets.length

  const damPath = `/content/dam/web/msci-com/research-and-insights/blog-post/${a.slug}`
  document.getElementById('dam-path').textContent = damPath
  document.getElementById('dam-link').href = `${AEM_HOST}/ui#/aem/assets.html${damPath}`

  // Reset UI
  document.getElementById('assets-log').classList.add('hidden')
  document.getElementById('assets-log').innerHTML = ''
  document.getElementById('btn-goto-step3').classList.add('hidden')
  document.getElementById('btn-publish-assets').disabled = false
  document.getElementById('btn-publish-assets').classList.remove('running')
  document.getElementById('btn-publish-assets').innerHTML = `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1v10M4 5l4-4 4 4M2 13h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    Publish Assets to DAM
  `
}

function getAssets(article) {
  const exhibitPaths = article.exhibit_paths || null
  const exhibitAssets = []
  if (exhibitPaths) {
    const { statics = [], interactives = [] } = exhibitPaths
    statics.forEach(e => {
      if (e.desktop?.downloadUrl) exhibitAssets.push({ url: e.desktop.downloadUrl, filename: e.desktop.filename })
      if (e.mobile?.downloadUrl) exhibitAssets.push({ url: e.mobile.downloadUrl, filename: e.mobile.filename })
    })
    interactives.forEach(e => {
      if (e.json?.downloadUrl) exhibitAssets.push({ url: e.json.downloadUrl, filename: e.json.filename })
    })
  }
  const bannerAssets = []
  if (article.banner_paths) {
    Object.values(article.banner_paths).forEach(b => {
      if (b?.downloadUrl && b?.filename?.endsWith('.webp')) bannerAssets.push({ url: b.downloadUrl, filename: b.filename })
    })
  }
  return { exhibitAssets, bannerAssets }
}

function buildCreatePageParams(article) {
  const slug = article.slug || ''
  const damBase = '/content/dam/web/msci-com/research-and-insights/blog-post'
  const contributorBase = '/content/dam/web/msci-com/research-and-insights/contributor'
  const toAuthorSlug = name => (name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const authorPaths = (article.authors || []).map(a => {
    if (a.content_fragment_path) return a.content_fragment_path
    const s = toAuthorSlug(a.name)
    return s ? `${contributorBase}/${s}/${s}` : null
  }).filter(Boolean)
  const allBanners = Object.values(article.banner_paths || {})
  const banner1x1 = allBanners.find(b => b?.filename?.includes('1x1'))
  const thumbnailDamPath = banner1x1?.filename ? `${damBase}/${slug}/banners/${banner1x1.filename}` : ''

  return {
    slug,
    title: article.headline || '',
    metaDesc: article.meta_description || '',
    readTime: article.read_time ? parseInt(article.read_time, 10) : 0,
    publishDate: article.publish_date || '',
    authorPaths,
    tags: article.tags?.all_tags || [],
    thumbnailDamPath
  }
}

// ─── Step 3: Create Page ────────────────────────────────────────────────────
function populateStep3() {
  const a = selectedArticle
  document.getElementById('step3-title').textContent = a.headline || 'Untitled'
  document.getElementById('prop-slug').textContent = a.slug || '—'
  document.getElementById('prop-type').textContent = { 'blog-post': 'Blog Post', 'paper': 'Paper', 'quick-take': 'Quick Take', 'podcast': 'Podcast' }[a.type] || a.type || '—'
  document.getElementById('prop-date').textContent = a.publish_date || '—'
  document.getElementById('prop-readtime').textContent = a.read_time ? `${a.read_time} min` : '—'
  document.getElementById('prop-authors').textContent = (a.authors || []).map(au => au.name).join(', ') || '—'
  document.getElementById('prop-tags').textContent = (a.tags?.all_tags || []).length + ' tags'

  // Reset UI
  document.getElementById('page-log').classList.add('hidden')
  document.getElementById('page-log').innerHTML = ''
  document.getElementById('page-links').classList.add('hidden')
  document.getElementById('btn-goto-step4').classList.add('hidden')
  document.getElementById('btn-create-page').disabled = false
  document.getElementById('btn-create-page').classList.remove('running')
}

// ─── Run a structured request in the active AEM tab ────────────────────────
function runInAEM(message, logElementId) {
  return new Promise((resolve) => {
    const logEl = document.getElementById(logElementId)
    logEl.classList.remove('hidden')
    logEl.innerHTML = '<span class="log-info">Connecting to AEM...</span>\n'

    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        logEl.innerHTML += `<span class="log-error">Error: ${escHtml(chrome.runtime.lastError.message)}</span>\n`
        resolve(false)
        return
      }
      const res = response || { success: false, error: 'No response from background' }
      if (Array.isArray(res.logs)) {
        res.logs.forEach(entry => {
          const cls = entry.type === 'error' ? 'log-error' : entry.type === 'warn' ? 'log-warn' : 'log-success'
          logEl.innerHTML += `<span class="${cls}">${escHtml(entry.message)}</span>\n`
        })
      }
      if (!res.success && res.error) {
        logEl.innerHTML += `<span class="log-error">Error: ${escHtml(res.error)}</span>\n`
      }
      logEl.innerHTML += `<span class="log-info">— Script completed —</span>\n`
      logEl.scrollTop = logEl.scrollHeight
      resolve(!!res.success)
    })
  })
}

// ─── AEM Connection Check ───────────────────────────────────────────────────
function checkAEMConnection() {
  chrome.runtime.sendMessage({ type: 'PING_AEM' }, (response) => {
    const dot = document.getElementById('connection-status')
    if (chrome.runtime.lastError || !response?.connected) {
      dot.classList.remove('connected')
      dot.classList.add('disconnected')
      dot.title = 'Not connected to AEM — open AEM Author in the active tab'
    } else {
      dot.classList.remove('disconnected')
      dot.classList.add('connected')
      dot.title = 'Connected to AEM Author'
    }
  })
}

// ─── Utilities ──────────────────────────────────────────────────────────────
function escHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

// ─── Event Listeners ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadArticles()
  checkAEMConnection()
  setInterval(checkAEMConnection, 10000)

  // Refresh
  document.getElementById('btn-refresh').addEventListener('click', loadArticles)

  // Search
  document.getElementById('search-input').addEventListener('input', renderArticles)

  // Filter chips
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'))
      chip.classList.add('active')
      currentFilter = chip.dataset.filter
      renderArticles()
    })
  })

  // Back buttons
  document.getElementById('btn-back-2').addEventListener('click', () => goToStep(1))
  document.getElementById('btn-back-3').addEventListener('click', () => goToStep(2))
  document.getElementById('btn-back-4').addEventListener('click', () => goToStep(3))

  // Publish Assets
  document.getElementById('btn-publish-assets').addEventListener('click', async () => {
    const btn = document.getElementById('btn-publish-assets')
    btn.disabled = true
    btn.classList.add('running')
    btn.textContent = 'Publishing assets...'

    const { exhibitAssets, bannerAssets } = getAssets(selectedArticle)
    const success = await runInAEM({
      type: 'PUBLISH_ASSETS',
      slug: selectedArticle.slug,
      title: selectedArticle.headline,
      exhibitAssets,
      bannerAssets
    }, 'assets-log')

    btn.classList.remove('running')
    if (success) {
      btn.textContent = '✓ Assets Published'
      document.getElementById('btn-goto-step3').classList.remove('hidden')
    } else {
      btn.disabled = false
      btn.textContent = 'Retry Publish Assets'
    }
  })

  // Continue to step 3
  document.getElementById('btn-goto-step3').addEventListener('click', () => goToStep(3))

  // Create Page
  document.getElementById('btn-create-page').addEventListener('click', async () => {
    const btn = document.getElementById('btn-create-page')
    btn.disabled = true
    btn.classList.add('running')
    btn.textContent = 'Creating page...'

    const params = buildCreatePageParams(selectedArticle)
    const success = await runInAEM({ type: 'CREATE_PAGE', params }, 'page-log')

    btn.classList.remove('running')
    if (success) {
      btn.textContent = '✓ Page Created'
      const slug = selectedArticle.slug
      const parentPath = '/content/msci/us/en/research-and-insights/blog-post'
      document.getElementById('link-edit-page').href = `${AEM_HOST}/editor.html${parentPath}/${slug}.html`
      document.getElementById('link-sites-view').href = `${AEM_HOST}/ui#/aem/sites.html${parentPath}`
      document.getElementById('page-links').classList.remove('hidden')
      document.getElementById('btn-goto-step4').classList.remove('hidden')
    } else {
      btn.disabled = false
      btn.textContent = 'Retry Create Page'
    }
  })

  // Continue to step 4
  document.getElementById('btn-goto-step4').addEventListener('click', () => goToStep(4))
})
