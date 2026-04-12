/**
 * Step 2 — Assets
 *
 * Populates the "publish assets to DAM" screen:
 *
 *   - Lists counts of exhibits and banners that will be uploaded.
 *   - Shows a freshness indicator for the SharePoint download URLs
 *     (they expire after ~1 hour, so the user may need to refresh).
 *   - If AEM already has the assets (detected by the pre-check), we
 *     hide the publish button and show a "continue" shortcut.
 *   - Exposes refreshAssets() which hits /api/sharepoint/refresh-assets
 *     to get new URLs + updates the article in place.
 */
import { state } from '../state.js'
import { AEM_HOST, APP_HOST, URL_LIFETIME_MS } from '../config.js'
import { escHtml } from '../ui/escHtml.js'
import { getAssets } from './getAssets.js'

const STATUS_LABELS = {
  'in-progress': 'In Progress',
  'in-review': 'In Review',
  approved: 'Approved',
}

export function populateStep2() {
  const a = state.selectedArticle
  document.getElementById('step2-title').textContent = a.headline || 'Untitled'
  const statusEl = document.getElementById('step2-status')
  statusEl.textContent = STATUS_LABELS[a.status] || a.status
  statusEl.className = `badge badge-${a.status}`

  const { exhibitAssets, bannerAssets } = getAssets(a)
  document.getElementById('exhibits-count').textContent = exhibitAssets.length
  document.getElementById('banners-count').textContent = bannerAssets.length

  const damPath = `/content/dam/web/msci-com/research-and-insights/blog-post/${a.slug}`
  document.getElementById('dam-path').textContent = damPath
  document.getElementById('dam-link').href = `${AEM_HOST}/ui#/aem/assets.html${damPath}`

  updateFreshnessIndicator(a)

  document.getElementById('assets-log').classList.add('hidden')
  document.getElementById('assets-log').innerHTML = ''
  document.getElementById('btn-goto-step3').classList.add('hidden')
  document.getElementById('btn-publish-assets').disabled = false
  document.getElementById('btn-publish-assets').classList.remove('running')
  document.getElementById('btn-publish-assets').innerHTML = `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1v10M4 5l4-4 4 4M2 13h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    Publish Assets to DAM
  `
  const refreshBtn = document.getElementById('btn-refresh-assets')
  refreshBtn.disabled = false
  refreshBtn.classList.remove('refreshing')
  refreshBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M13.65 2.35A7.96 7.96 0 008 0C3.58 0 .01 3.58.01 8S3.58 16 8 16c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 018 14 6 6 0 012 8a6 6 0 016-6c1.66 0 3.14.69 4.22 1.78L9 7h7V0l-2.35 2.35z" fill="currentColor"/></svg>
    Refresh URLs
  `

  renderStep2Validation(a)
}

export function renderStep2Validation(article) {
  const card = document.getElementById('step2-validation')
  const damCheck = article._damCheck
  const publishBtn = document.getElementById('btn-publish-assets')
  const continueBtn = document.getElementById('btn-goto-step3')

  if (damCheck?.exists) {
    card.classList.remove('hidden')
    card.innerHTML = `
      <div class="validation-card-icon">✓</div>
      <div class="validation-card-body">
        <h3>Assets ya existen en el DAM</h3>
        <p>La carpeta <code>${escHtml(damCheck.folderPath || '')}</code> ya contiene
        <strong>${damCheck.exhibitsCount || 0}</strong> exhibit(s) y
        <strong>${damCheck.bannersCount || 0}</strong> banner(s).
        Puedes saltarte este paso.</p>
        <button id="btn-republish-assets" class="btn-link-inline">Volver a subir de todas formas</button>
      </div>
    `
    publishBtn.classList.add('hidden')
    continueBtn.classList.remove('hidden')
    continueBtn.textContent = 'Continuar al paso 3 →'

    document.getElementById('btn-republish-assets').addEventListener('click', () => {
      card.classList.add('hidden')
      publishBtn.classList.remove('hidden')
      continueBtn.classList.add('hidden')
    })
  } else {
    card.classList.add('hidden')
    card.innerHTML = ''
    publishBtn.classList.remove('hidden')
  }
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

export async function refreshAssets() {
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
      body: JSON.stringify({ articleId: state.selectedArticle.id }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()

    state.selectedArticle.exhibit_paths = data.exhibit_paths
    state.selectedArticle.banner_paths = data.banner_paths
    state.selectedArticle.body_blocks = data.body_blocks
    state.selectedArticle.updated_at = new Date().toISOString()

    const idx = state.articles.findIndex((a) => a.id === state.selectedArticle.id)
    if (idx !== -1) state.articles[idx] = { ...state.articles[idx], ...state.selectedArticle }

    const { exhibitAssets, bannerAssets } = getAssets(state.selectedArticle)
    document.getElementById('exhibits-count').textContent = exhibitAssets.length
    document.getElementById('banners-count').textContent = bannerAssets.length
    updateFreshnessIndicator(state.selectedArticle)

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
