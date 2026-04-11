// ─── Supabase Config ────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://zrorbndnrrrtcatvezro.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpyb3JibmRucnJydGNhdHZlenJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjY3MDIsImV4cCI6MjA4ODY0MjcwMn0.xnFfZe7J_QoTHPxlGopzo_zPlUDQh_esW5ymPDxpgXA'

const AEM_HOST = 'https://author-p125318-e1369672.adobeaemcloud.com'
const APP_HOST = 'https://msci-publishing.vercel.app'

// SharePoint URLs expire after ~1 hour
const URL_LIFETIME_MS = 60 * 60 * 1000

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
    articles = await supabaseFetch('articles?status=neq.published&order=created_at.desc&select=id,headline,slug,status,type,publish_date,authors,tags,meta_description,read_time,exhibit_paths,banner_paths,body_blocks,footnotes,bullets,related_resources,final_url,sharepoint_folder_url,updated_at')
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

  document.querySelectorAll('#steps-bar .step').forEach(el => {
    const s = parseInt(el.dataset.step)
    el.classList.toggle('active', s === step)
    el.classList.toggle('completed', s < step)
  })

  document.querySelectorAll('.step-content').forEach(el => {
    el.classList.toggle('active', el.id === `step-${step}`)
  })

  if (step === 2) populateStep2()
  if (step === 3) populateStep3()
  if (step === 4) populateStep4()
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 2: Assets
// ═════════════════════════════════════════════════════════════════════════════
function populateStep2() {
  const a = selectedArticle
  document.getElementById('step2-title').textContent = a.headline || 'Untitled'
  const statusEl = document.getElementById('step2-status')
  const statusLabel = { 'in-progress': 'In Progress', 'in-review': 'In Review', 'approved': 'Approved' }[a.status] || a.status
  statusEl.textContent = statusLabel
  statusEl.className = `badge badge-${a.status}`

  const { exhibitAssets, bannerAssets } = getAssets(a)
  document.getElementById('exhibits-count').textContent = exhibitAssets.length
  document.getElementById('banners-count').textContent = bannerAssets.length

  const damPath = `/content/dam/web/msci-com/research-and-insights/blog-post/${a.slug}`
  document.getElementById('dam-path').textContent = damPath
  document.getElementById('dam-link').href = `${AEM_HOST}/ui#/aem/assets.html${damPath}`

  // Freshness indicator
  updateFreshnessIndicator(a)

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
  // Reset refresh button
  const refreshBtn = document.getElementById('btn-refresh-assets')
  refreshBtn.disabled = false
  refreshBtn.classList.remove('refreshing')
  refreshBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M13.65 2.35A7.96 7.96 0 008 0C3.58 0 .01 3.58.01 8S3.58 16 8 16c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 018 14 6 6 0 012 8a6 6 0 016-6c1.66 0 3.14.69 4.22 1.78L9 7h7V0l-2.35 2.35z" fill="currentColor"/></svg>
    Refresh URLs
  `
}

function updateFreshnessIndicator(article) {
  const dot = document.querySelector('#freshness-indicator .freshness-dot')
  const label = document.getElementById('freshness-label')
  const detail = document.getElementById('freshness-detail')

  const updatedAt = article.updated_at ? new Date(article.updated_at) : null
  if (!updatedAt) {
    dot.className = 'freshness-dot expired'
    label.textContent = 'Unknown — refresh recommended'
    detail.textContent = ''
    return
  }

  const now = new Date()
  const elapsed = now - updatedAt
  const remaining = URL_LIFETIME_MS - elapsed
  const minutesAgo = Math.round(elapsed / 60000)
  const minutesLeft = Math.max(0, Math.round(remaining / 60000))

  if (remaining <= 0) {
    dot.className = 'freshness-dot expired'
    label.textContent = 'Expired — refresh required'
    detail.textContent = `Last updated ${minutesAgo} min ago. URLs expire after ~60 min.`
  } else if (remaining < 15 * 60 * 1000) {
    dot.className = 'freshness-dot expiring'
    label.textContent = `Expiring soon (~${minutesLeft} min left)`
    detail.textContent = `Last updated ${minutesAgo} min ago.`
  } else {
    dot.className = 'freshness-dot fresh'
    label.textContent = `Fresh (~${minutesLeft} min left)`
    detail.textContent = `Last updated ${minutesAgo} min ago.`
  }
}

async function refreshAssets() {
  const btn = document.getElementById('btn-refresh-assets')
  btn.disabled = true
  btn.classList.add('refreshing')
  btn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" class="spin"><path d="M13.65 2.35A7.96 7.96 0 008 0C3.58 0 .01 3.58.01 8S3.58 16 8 16c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 018 14 6 6 0 012 8a6 6 0 016-6c1.66 0 3.14.69 4.22 1.78L9 7h7V0l-2.35 2.35z" fill="currentColor"/></svg>
    Refreshing...
  `

  try {
    const res = await fetch(`${APP_HOST}/api/sharepoint/refresh-assets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleId: selectedArticle.id })
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()

    // Update local state with fresh data
    selectedArticle.exhibit_paths = data.exhibit_paths
    selectedArticle.banner_paths = data.banner_paths
    selectedArticle.body_blocks = data.body_blocks
    selectedArticle.updated_at = new Date().toISOString()

    const idx = articles.findIndex(a => a.id === selectedArticle.id)
    if (idx !== -1) articles[idx] = { ...articles[idx], ...selectedArticle }

    // Refresh counts and indicator
    const { exhibitAssets, bannerAssets } = getAssets(selectedArticle)
    document.getElementById('exhibits-count').textContent = exhibitAssets.length
    document.getElementById('banners-count').textContent = bannerAssets.length
    updateFreshnessIndicator(selectedArticle)

    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M13.65 2.35A7.96 7.96 0 008 0C3.58 0 .01 3.58.01 8S3.58 16 8 16c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 018 14 6 6 0 012 8a6 6 0 016-6c1.66 0 3.14.69 4.22 1.78L9 7h7V0l-2.35 2.35z" fill="currentColor"/></svg>
      ✓ Refreshed
    `
  } catch (err) {
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M13.65 2.35A7.96 7.96 0 008 0C3.58 0 .01 3.58.01 8S3.58 16 8 16c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 018 14 6 6 0 012 8a6 6 0 016-6c1.66 0 3.14.69 4.22 1.78L9 7h7V0l-2.35 2.35z" fill="currentColor"/></svg>
      ✗ Failed — retry
    `
    console.error('Refresh failed:', err)
  } finally {
    btn.disabled = false
    btn.classList.remove('refreshing')
  }
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

// ═════════════════════════════════════════════════════════════════════════════
// STEP 3: Create Page (with expanded tags)
// ═════════════════════════════════════════════════════════════════════════════
function populateStep3() {
  const a = selectedArticle
  document.getElementById('step3-title').textContent = a.headline || 'Untitled'
  document.getElementById('prop-slug').textContent = a.slug || '—'
  document.getElementById('prop-type').textContent = { 'blog-post': 'Blog Post', 'paper': 'Paper', 'quick-take': 'Quick Take', 'podcast': 'Podcast' }[a.type] || a.type || '—'
  document.getElementById('prop-date').textContent = a.publish_date || '—'
  document.getElementById('prop-readtime').textContent = a.read_time ? `${a.read_time} min` : '—'
  document.getElementById('prop-authors').textContent = (a.authors || []).map(au => au.name).join(', ') || '—'

  // Tags: count + full list
  const allTags = a.tags?.all_tags || []
  document.getElementById('prop-tags-count').textContent = allTags.length + ' tags'

  const tagsList = document.getElementById('prop-tags-list')
  if (allTags.length === 0) {
    tagsList.innerHTML = '<span style="font-size:11px;color:#999;">No tags</span>'
  } else {
    tagsList.innerHTML = allTags.map(tag => {
      const sep = tag.indexOf(' : ')
      if (sep !== -1) {
        const category = escHtml(tag.substring(0, sep).trim())
        const value = escHtml(tag.substring(sep + 3).trim())
        return `<span class="tag-chip"><span class="tag-category">${category}:</span> ${value}</span>`
      }
      return `<span class="tag-chip">${escHtml(tag)}</span>`
    }).join('')
  }

  // Reset UI
  document.getElementById('page-log').classList.add('hidden')
  document.getElementById('page-log').innerHTML = ''
  document.getElementById('page-links').classList.add('hidden')
  document.getElementById('btn-goto-step4').classList.add('hidden')
  document.getElementById('btn-create-page').disabled = false
  document.getElementById('btn-create-page').classList.remove('running')
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 4: Content Blocks
// ═════════════════════════════════════════════════════════════════════════════
function populateStep4() {
  const a = selectedArticle
  document.getElementById('step4-title').textContent = a.headline || 'Untitled'

  const bullets = a.bullets || []
  const preview = document.getElementById('kf-preview')
  const btnInsert = document.getElementById('btn-insert-kf')
  const btnCopy = document.getElementById('btn-copy-kf')

  if (bullets.length === 0) {
    preview.innerHTML = '<p class="empty-state">No key findings for this article</p>'
    btnInsert.disabled = true
    btnCopy.disabled = true
  } else {
    preview.innerHTML = '<ul>' + bullets.map(b => `<li>${escHtml(b)}</li>`).join('') + '</ul>'
    btnInsert.disabled = false
    btnCopy.disabled = false
  }

  // Reset
  document.getElementById('kf-log').classList.add('hidden')
  document.getElementById('kf-log').innerHTML = ''
  btnInsert.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 12l7-7 3 3-7 7H2v-3z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.5 3.5l2-2 3 3-2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    Insert into AEM
  `
  btnCopy.textContent = 'Copy HTML'
}

function buildKeyFindingsHtml(bullets) {
  const lis = bullets.map(b =>
    `<li style="margin-bottom:16px"><span style="font-family:Mercury Text G1,Georgia,serif;font-size:18px;line-height:1.6;color:#333333">${b}</span></li>`
  ).join('')
  return `<ul style="list-style-type:disc;padding-left:24px;margin:16px 0">${lis}</ul>`
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

  // Refresh articles list
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

  // Step 2: Refresh SharePoint URLs
  document.getElementById('btn-refresh-assets').addEventListener('click', refreshAssets)

  // Step 2: Publish Assets
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

  // Step 2 → 3
  document.getElementById('btn-goto-step3').addEventListener('click', () => goToStep(3))

  // Step 3: Create Page
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

  // Step 3 → 4
  document.getElementById('btn-goto-step4').addEventListener('click', () => goToStep(4))

  // Step 4: Insert Key Findings into AEM
  document.getElementById('btn-insert-kf').addEventListener('click', async () => {
    const btn = document.getElementById('btn-insert-kf')
    btn.disabled = true
    btn.textContent = 'Inserting...'

    const html = buildKeyFindingsHtml(selectedArticle.bullets || [])
    const success = await runInAEM({
      type: 'INSERT_KEY_FINDINGS',
      slug: selectedArticle.slug,
      html
    }, 'kf-log')

    if (success) {
      btn.textContent = '✓ Inserted'
    } else {
      btn.disabled = false
      btn.textContent = 'Retry Insert'
    }
  })

  // Step 4: Copy Key Findings HTML
  document.getElementById('btn-copy-kf').addEventListener('click', () => {
    const html = buildKeyFindingsHtml(selectedArticle.bullets || [])
    navigator.clipboard.writeText(html).then(() => {
      const btn = document.getElementById('btn-copy-kf')
      btn.textContent = '✓ Copied'
      setTimeout(() => { btn.textContent = 'Copy HTML' }, 2000)
    })
  })
})
