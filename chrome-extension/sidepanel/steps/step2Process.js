/**
 * Step 2 — Automated Process
 *
 * Replaces the old manual steps 2-4 with a single orchestrated flow:
 *   Phase A: Upload assets to DAM (with conflict detection)
 *   Phase B: Create AEM page (with conflict / custom slug handling)
 *   Phase C: Inject all content modules + cleanup empty containers
 *   Phase D: Build report → transition to Step 3
 *
 * User interaction is only required when conflicts are detected
 * (DAM folder exists, page exists). Everything else runs automatically.
 */
import { state, setProcessReport } from '../state.js'
import { runInAEMSilent } from '../api/background.js'
import { escHtml } from '../ui/escHtml.js'
import { getAssets } from './getAssets.js'
import { buildCreatePageParams } from './step3Page.js'
import { buildKeyFindingsPayload, buildBodyBlocksPayload } from './step4Content.js'
import { goToStep } from './navigation.js'
import { renderGlobalLog } from '../ui/globalLog.js'
import { AEM_HOST, APP_HOST } from '../config.js'

/** Populate the process step UI */
export function populateStep2() {
  const a = state.selectedArticle
  const { exhibitAssets, bannerAssets } = getAssets(a)

  const totalAssets = exhibitAssets.length + bannerAssets.length
  const bodyBlocks = a.body_blocks || []
  const bullets = a.bullets || []
  const authors = a.authors || []
  const related = a.related_resources || []
  const footnotes = a.footnotes || []

  document.getElementById('process-title').textContent = a.headline || 'Untitled'
  document.getElementById('process-description').innerHTML = `
    <p><strong>${totalAssets}</strong> asset(s) will be uploaded to DAM
    (${exhibitAssets.length} exhibits, ${bannerAssets.length} banners),
    the page will be created, and the following content will be injected:</p>
    <ul>
      <li>${bullets.length} key finding(s)</li>
      <li>${bodyBlocks.length} body block(s)</li>
      <li>${authors.length} author(s)</li>
      <li>${related.length} related resource(s)</li>
      <li>${footnotes.length} footnote(s)</li>
    </ul>
  `

  // Reset phase indicators
  document.querySelectorAll('.phase-card').forEach((el) => {
    el.classList.remove('phase-running', 'phase-done', 'phase-error', 'phase-warning')
    const status = el.querySelector('.phase-status')
    if (status) status.textContent = ''
  })

  // Reset conflict areas
  document.getElementById('conflict-assets').classList.add('hidden')
  document.getElementById('conflict-assets').innerHTML = ''
  document.getElementById('conflict-page').classList.add('hidden')
  document.getElementById('conflict-page').innerHTML = ''

  // Show start button, hide abort
  const startBtn = document.getElementById('btn-start-process')
  startBtn.disabled = false
  startBtn.classList.remove('running')
  startBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><polygon points="5,3 13,8 5,13" fill="currentColor"/></svg>
    Start process
  `
}

/** Main orchestrator — runs all phases sequentially */
export async function startProcess() {
  const btn = document.getElementById('btn-start-process')
  btn.disabled = true
  btn.classList.add('running')
  btn.textContent = 'Processing...'

  const startTime = Date.now()
  const errors = []

  try {
    // ─── Phase A: Assets ───
    const assetsOk = await phaseAssets(errors)
    if (!assetsOk) {
      btn.disabled = false
      btn.classList.remove('running')
      btn.textContent = 'Retry process'
      return
    }

    // ─── Phase B: Page ───
    const pageOk = await phasePage(errors)
    if (!pageOk) {
      btn.disabled = false
      btn.classList.remove('running')
      btn.textContent = 'Retry process'
      return
    }

    // ─── Phase C: Content ───
    await phaseContent(errors)

    // ─── Phase D: Report ───
    const duration = Date.now() - startTime
    await phaseReport(errors, duration)

    btn.textContent = 'Process completed'
  } catch (err) {
    errors.push(err.message)
    btn.disabled = false
    btn.classList.remove('running')
    btn.textContent = 'Error — retry'
  }
}

// ─── PHASE A: Assets ─────────────────────────────────────────────

async function phaseAssets(errors) {
  const card = document.getElementById('phase-assets')
  setPhaseRunning(card, 'Uploading assets to DAM...')

  const article = state.selectedArticle
  const damCheck = article._damCheck

  // If folder exists, ask user
  if (damCheck?.exists) {
    setPhaseWarning(card, 'DAM folder already exists')
    const damPath = damCheck.folderPath || `/content/dam/web/msci-com/research-and-insights/blog-post/${article.slug}`
    const damUrl = `${AEM_HOST}/ui#/aem/assets.html${damPath}`

    const conflictEl = document.getElementById('conflict-assets')
    conflictEl.classList.remove('hidden')
    conflictEl.innerHTML = `
      <div class="conflict-card">
        <p>The folder <code>${escHtml(damPath)}</code> already contains
        <strong>${damCheck.exhibitsCount || 0}</strong> exhibit(s) and
        <strong>${damCheck.bannersCount || 0}</strong> banner(s).</p>
        <a href="${escHtml(damUrl)}" target="_blank" class="link-external">View in DAM</a>
        <div class="conflict-actions">
          <button id="btn-conflict-assets-continue" class="btn-primary btn-small">Continue (overwrite)</button>
          <button id="btn-conflict-assets-cancel" class="btn-outline btn-small">Cancel</button>
        </div>
      </div>
    `

    const userChoice = await new Promise((resolve) => {
      document.getElementById('btn-conflict-assets-continue').addEventListener('click', () => resolve('continue'))
      document.getElementById('btn-conflict-assets-cancel').addEventListener('click', () => resolve('cancel'))
    })

    conflictEl.classList.add('hidden')

    if (userChoice === 'cancel') {
      setPhaseError(card, 'Cancelled by user')
      return false
    }

    setPhaseRunning(card, 'Overwriting assets...')
  }

  // Upload assets
  const { exhibitAssets, bannerAssets } = getAssets(state.selectedArticle)
  const result = await runInAEMSilent({
    type: 'PUBLISH_ASSETS',
    slug: state.selectedArticle.slug,
    title: state.selectedArticle.headline,
    exhibitAssets,
    bannerAssets,
  })

  state.processLogs.assets = result.logs || []
  renderGlobalLog()

  if (result.success) {
    setPhaseComplete(card, `${exhibitAssets.length + bannerAssets.length} asset(s) uploaded`)
    return true
  } else {
    errors.push('Assets upload failed')
    setPhaseError(card, 'Failed to upload assets')
    return false
  }
}

// ─── PHASE B: Page ───────────────────────────────────────────────

async function phasePage(errors) {
  const card = document.getElementById('phase-page')
  setPhaseRunning(card, 'Creating page in AEM...')

  const article = state.selectedArticle
  const pageCheck = article._pageCheck
  const parentPath = '/content/msci/us/en/research-and-insights/blog-post'

  // If page exists, ask user
  if (pageCheck?.exists) {
    setPhaseWarning(card, 'Page already exists in AEM')
    const existingSlug = pageCheck.pagePath?.split('/').pop() || article.slug
    const sitesUrl = `${AEM_HOST}/ui#/aem/sites.html${parentPath}/${existingSlug}`
    const editUrl = `${AEM_HOST}/editor.html${parentPath}/${existingSlug}.html`

    const conflictEl = document.getElementById('conflict-page')
    conflictEl.classList.remove('hidden')
    conflictEl.innerHTML = `
      <div class="conflict-card">
        <p>The page <strong>${escHtml(pageCheck.title || article.headline)}</strong> already exists.</p>
        <p><code>${escHtml(pageCheck.pagePath || '')}</code></p>
        <a href="${escHtml(sitesUrl)}" target="_blank" class="link-external">View in Sites</a>
        <a href="${escHtml(editUrl)}" target="_blank" class="link-external">Edit page</a>
        <div class="conflict-actions">
          <button id="btn-conflict-page-overwrite" class="btn-primary btn-small">Overwrite</button>
          <button id="btn-conflict-page-custom-slug" class="btn-outline btn-small">Use custom slug</button>
        </div>
        <div id="custom-slug-form" class="hidden">
          <div class="custom-slug-input-row">
            <input type="text" id="input-custom-slug" placeholder="${escHtml(article.slug)}" value="${escHtml(article.slug)}" />
            <button id="btn-save-custom-slug" class="btn-primary btn-small">Save</button>
          </div>
        </div>
      </div>
    `

    const userChoice = await new Promise((resolve) => {
      document.getElementById('btn-conflict-page-overwrite').addEventListener('click', () => resolve('overwrite'))
      document.getElementById('btn-conflict-page-custom-slug').addEventListener('click', () => {
        document.getElementById('custom-slug-form').classList.remove('hidden')
        document.getElementById('input-custom-slug').focus()
      })
      document.getElementById('btn-save-custom-slug').addEventListener('click', async () => {
        const newSlug = document.getElementById('input-custom-slug').value.trim()
        if (!newSlug) return
        // Update slug via Next.js API (uses service role key)
        try {
          const res = await fetch(`${APP_HOST}/api/articles/update`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: article.id, slug: newSlug }),
          })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          article.slug = newSlug
          state.processLogs.page.push({ type: 'log', message: `Slug updated to: ${newSlug}` })
          renderGlobalLog()
        } catch (e) {
          state.processLogs.page.push({ type: 'error', message: `Error updating slug: ${e.message}` })
          renderGlobalLog()
        }
        resolve('custom-slug') // skip delete, create with new slug
      })
    })

    conflictEl.classList.add('hidden')

    // If overwriting, delete the existing page first
    if (userChoice === 'overwrite') {
      setPhaseRunning(card, 'Deleting existing page...')
      const deletePath = pageCheck.pagePath || `${parentPath}/${existingSlug}`
      const deleteResult = await runInAEMSilent({
        type: 'DELETE_PAGE',
        pagePath: deletePath,
      })
      state.processLogs.page = [...(state.processLogs.page || []), ...(deleteResult.logs || [])]
      renderGlobalLog()
      if (!deleteResult.success) {
        errors.push('Failed to delete existing page')
        setPhaseError(card, 'Failed to delete existing page')
        return false
      }
    }

    setPhaseRunning(card, 'Creating page...')
  }

  // Create page with the current slug (may have been updated by custom slug)
  const params = buildCreatePageParams(state.selectedArticle)
  const result = await runInAEMSilent({ type: 'CREATE_PAGE', params })

  state.processLogs.page = [...(state.processLogs.page || []), ...(result.logs || [])]
  renderGlobalLog()

  if (result.success) {
    setPhaseComplete(card, `Page created: ${state.selectedArticle.slug}`)
    return true
  } else {
    errors.push('Page creation failed')
    setPhaseError(card, 'Failed to create page')
    return false
  }
}

// ─── PHASE C: Content ────────────────────────────────────────────

async function phaseContent(errors) {
  const card = document.getElementById('phase-content')
  setPhaseRunning(card, 'Injecting content...')

  const article = state.selectedArticle
  const slug = article.slug
  const modules = []

  // 1. Key Findings
  const bullets = article.bullets || []
  if (bullets.length > 0) {
    setPhaseRunning(card, 'Injecting Key Findings...')
    const { html, textAsJson } = buildKeyFindingsPayload(bullets)
    const kfResult = await runInAEMSilent({
      type: 'INSERT_KEY_FINDINGS',
      slug,
      html,
      textAsJson,
    })
    state.processLogs.keyFindings = kfResult.logs || []
    if (kfResult.success) modules.push('keyFindings')
    else errors.push('Key Findings injection failed')
    renderGlobalLog()
  }

  // 2. Body Content
  const bodyBlocks = buildBodyBlocksPayload(article)
  if (bodyBlocks.length > 0) {
    setPhaseRunning(card, 'Injecting Body Content...')
    const bodyResult = await runInAEMSilent({
      type: 'INSERT_BODY_CONTENT',
      slug,
      bodyBlocks,
    })
    state.processLogs.bodyContent = bodyResult.logs || []
    if (bodyResult.success) modules.push('bodyContent')
    else errors.push('Body Content injection failed')
    renderGlobalLog()
  }

  // 3. Authors
  const authorPaths = buildAuthorPaths(article)
  if (authorPaths.length > 0) {
    setPhaseRunning(card, 'Injecting Authors...')
    const authResult = await runInAEMSilent({
      type: 'INSERT_AUTHORS',
      slug,
      authorPaths,
    })
    state.processLogs.authors = authResult.logs || []
    if (authResult.success) modules.push('authors')
    else errors.push('Authors injection failed')
    renderGlobalLog()
  }

  // 4. Related Content
  const relatedItems = buildRelatedItems(article)
  if (relatedItems.length > 0) {
    setPhaseRunning(card, 'Injecting Related Content...')
    const relResult = await runInAEMSilent({
      type: 'INSERT_RELATED_CONTENT',
      slug,
      relatedItems,
    })
    state.processLogs.relatedContent = relResult.logs || []
    if (relResult.success) modules.push('relatedContent')
    else errors.push('Related Content injection failed')
    renderGlobalLog()
  }

  // 5. Footnotes
  const footnotes = (article.footnotes || []).map((f) => ({
    number: f.number || '',
    text: f.text || '',
  }))
  if (footnotes.length > 0) {
    setPhaseRunning(card, 'Injecting Footnotes...')
    const fnResult = await runInAEMSilent({
      type: 'INSERT_FOOTNOTES',
      slug,
      footnotes,
    })
    state.processLogs.footnotes = fnResult.logs || []
    if (fnResult.success) modules.push('footnotes')
    else errors.push('Footnotes injection failed')
    renderGlobalLog()
  }

  // 6. Cleanup empty containers
  setPhaseRunning(card, 'Cleaning up empty containers...')
  const cleanResult = await runInAEMSilent({
    type: 'CLEANUP_EMPTY_CONTAINERS',
    slug,
  })
  state.processLogs.cleanup = cleanResult.logs || []
  renderGlobalLog()

  // Store injected modules for report
  state._contentModules = modules
  state._containersCleanedCount = cleanResult.deletedCount || 0

  if (errors.length === 0) {
    setPhaseComplete(card, `${modules.length} module(s) injected`)
  } else {
    setPhaseWarning(card, `${modules.length} module(s) OK, ${errors.length} error(s)`)
  }
}

// ─── PHASE D: Report ─────────────────────────────────────────────

async function phaseReport(errors, durationMs) {
  const article = state.selectedArticle
  const slug = article.slug
  const parentPath = '/content/msci/us/en/research-and-insights/blog-post'
  const damBase = '/content/dam/web/msci-com/research-and-insights/blog-post'
  const { exhibitAssets, bannerAssets } = getAssets(article)

  const stageHost = 'https://www-stage.msci.com'

  const report = {
    published_at: new Date().toISOString(),
    dam_folder: `${damBase}/${slug}`,
    dam_url: `${AEM_HOST}/ui#/aem/assets.html${damBase}/${slug}`,
    page_path: `${parentPath}/${slug}`,
    sites_url: `${AEM_HOST}/ui#/aem/sites.html${parentPath}/${slug}`,
    editor_url: `${AEM_HOST}/editor.html${parentPath}/${slug}.html`,
    preview_url: `${stageHost}/research-and-insights/blog-post/${slug}`,
    title: article.headline || '',
    slug,
    meta_description: article.meta_description || '',
    tags: article.tags?.all_tags || [],
    assets_uploaded: { exhibits: exhibitAssets.length, banners: bannerAssets.length },
    content_injected: state._contentModules || [],
    containers_cleaned: state._containersCleanedCount || 0,
    errors,
    duration_ms: durationMs,
  }

  setProcessReport(report)

  // Save report via Next.js API (uses service role key)
  try {
    const saveUrl = `${APP_HOST}/api/articles/update`
    const saveBody = JSON.stringify({ id: article.id, publish_report: report })
    console.log('[Report] Saving to:', saveUrl, 'body size:', saveBody.length)
    const res = await fetch(saveUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: saveBody,
    })
    if (res.ok) {
      const data = await res.json()
      console.log('[Report] Saved successfully:', data)
    } else {
      const errText = await res.text().catch(() => '')
      console.error('[Report] Failed to save:', res.status, errText)
      report.errors = [...(report.errors || []), `Failed to save report to database: HTTP ${res.status}`]
    }
  } catch (e) {
    console.error('[Report] Failed to save:', e)
    report.errors = [...(report.errors || []), `Failed to save report: ${e.message}`]
  }

  // Transition to step 3
  state.completedSteps.add(2)
  goToStep(3)
}

// ─── Helpers ─────────────────────────────────────────────────────

function buildAuthorPaths(article) {
  const contributorBase = '/content/dam/web/msci-com/research-and-insights/contributor'
  const toSlug = (name) =>
    (name || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  return (article.authors || [])
    .map((a) => {
      if (a.content_fragment_path) return a.content_fragment_path
      const s = toSlug(a.name)
      return s ? `${contributorBase}/${s}/${s}` : null
    })
    .filter(Boolean)
}

function buildRelatedItems(article) {
  const MSCI_ROOT = '/content/msci/us/en'
  const IPC_ROOT = '/content/ipc/us/en/indexes'
  function toAemPath(url) {
    if (!url) return url
    if (url.startsWith('/content/')) return url
    try {
      const parsed = new URL(url, 'https://www.msci.com')
      const host = parsed.hostname.toLowerCase()
      const path = parsed.pathname
      if (!host.endsWith('msci.com')) return url
      if (host === 'support.msci.com') return url
      if (path.startsWith('/indexes/index/')) return url
      if (path.startsWith('/indexes/')) return IPC_ROOT.replace('/indexes', '') + path
      return MSCI_ROOT + path
    } catch {
      return url
    }
  }
  return (article.related_resources || []).slice(0, 3).map((r) => ({
    title: r.title || '',
    description: r.meta_description || '',
    ctaLink: r.aem_path || toAemPath(r.original_url || r.url) || '',
    ctaLabel: r.cta_label || 'Learn more',
  }))
}

// ─── Phase card UI helpers ───────────────────────────────────────

function setPhaseRunning(card, text) {
  card.classList.remove('phase-done', 'phase-error', 'phase-warning')
  card.classList.add('phase-running')
  const status = card.querySelector('.phase-status')
  if (status) status.innerHTML = `<span class="phase-spinner"></span> ${escHtml(text)}`
}

function setPhaseComplete(card, text) {
  card.classList.remove('phase-running', 'phase-error', 'phase-warning')
  card.classList.add('phase-done')
  const status = card.querySelector('.phase-status')
  if (status) status.innerHTML = `<span class="phase-check">&#10003;</span> ${escHtml(text)}`
}

function setPhaseError(card, text) {
  card.classList.remove('phase-running', 'phase-done', 'phase-warning')
  card.classList.add('phase-error')
  const status = card.querySelector('.phase-status')
  if (status) status.innerHTML = `<span class="phase-x">&#10007;</span> ${escHtml(text)}`
}

function setPhaseWarning(card, text) {
  card.classList.remove('phase-running', 'phase-done', 'phase-error')
  card.classList.add('phase-warning')
  const status = card.querySelector('.phase-status')
  if (status) status.innerHTML = `<span class="phase-warn">!</span> ${escHtml(text)}`
}
