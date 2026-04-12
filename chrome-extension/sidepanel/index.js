/**
 * Sidepanel entry
 *
 * Bootstraps the Chrome extension side panel: loads the article list,
 * starts the AEM connection heartbeat, and wires every button in the
 * four-step wizard to its handler.
 *
 * All business logic lives in the step modules and api/ helpers —
 * this file is pure event-listener plumbing.
 */
import { state } from './state.js'
import { loadArticles } from './api/supabase.js'
import { checkAEMConnection, runInAEM } from './api/background.js'
import { renderArticles } from './ui/articleList.js'
import { goToStep, refreshStepBar, handleStepIndicatorClick } from './steps/navigation.js'
import { refreshAssets } from './steps/step2Assets.js'
import { buildCreatePageParams } from './steps/step3Page.js'
import { buildKeyFindingsPayload, buildBodyBlocksPayload } from './steps/step4Content.js'
import { getAssets } from './steps/getAssets.js'
import { AEM_HOST } from './config.js'

document.addEventListener('DOMContentLoaded', () => {
  loadArticles()
  checkAEMConnection()
  setInterval(checkAEMConnection, 10000)

  // Refresh articles list
  document.getElementById('btn-refresh').addEventListener('click', loadArticles)

  // Search
  document.getElementById('search-input').addEventListener('input', renderArticles)

  // Filter chips
  document.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'))
      chip.classList.add('active')
      state.currentFilter = chip.dataset.filter
      renderArticles()
    })
  })

  // Back buttons
  document
    .getElementById('btn-back-2')
    .addEventListener('click', () =>
      handleStepIndicatorClick(document.querySelector('#steps-bar .step[data-step="1"]'))
    )
  document.getElementById('btn-back-3').addEventListener('click', () => goToStep(2))
  document.getElementById('btn-back-4').addEventListener('click', () => goToStep(3))

  // Step indicator clicks
  document.querySelectorAll('#steps-bar .step').forEach((el) => {
    el.addEventListener('click', () => handleStepIndicatorClick(el))
  })

  // Step 2: Refresh SharePoint URLs
  document.getElementById('btn-refresh-assets').addEventListener('click', refreshAssets)

  // Step 2: Publish Assets
  document.getElementById('btn-publish-assets').addEventListener('click', async () => {
    const btn = document.getElementById('btn-publish-assets')
    btn.disabled = true
    btn.classList.add('running')
    btn.textContent = 'Publishing assets...'

    const { exhibitAssets, bannerAssets } = getAssets(state.selectedArticle)
    const success = await runInAEM(
      {
        type: 'PUBLISH_ASSETS',
        slug: state.selectedArticle.slug,
        title: state.selectedArticle.headline,
        exhibitAssets,
        bannerAssets,
      },
      'assets-log'
    )

    btn.classList.remove('running')
    if (success) {
      btn.textContent = '✓ Assets Published'
      document.getElementById('btn-goto-step3').classList.remove('hidden')
      state.completedSteps.add(2)
      refreshStepBar()
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

    const params = buildCreatePageParams(state.selectedArticle)
    const success = await runInAEM({ type: 'CREATE_PAGE', params }, 'page-log')

    btn.classList.remove('running')
    if (success) {
      btn.textContent = '✓ Page Created'
      const slug = state.selectedArticle.slug
      const parentPath = '/content/msci/us/en/research-and-insights/blog-post'
      document.getElementById('link-edit-page').href =
        `${AEM_HOST}/editor.html${parentPath}/${slug}.html`
      document.getElementById('link-sites-view').href =
        `${AEM_HOST}/ui#/aem/sites.html${parentPath}`
      document.getElementById('page-links').classList.remove('hidden')
      document.getElementById('btn-goto-step4').classList.remove('hidden')
      state.completedSteps.add(3)
      refreshStepBar()
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

    const { html, textAsJson } = buildKeyFindingsPayload(state.selectedArticle.bullets || [])
    const success = await runInAEM(
      {
        type: 'INSERT_KEY_FINDINGS',
        slug: state.selectedArticle.slug,
        html,
        textAsJson,
      },
      'kf-log'
    )

    btn.disabled = false
    btn.textContent = success ? '✓ Inserted — run again' : 'Retry Insert'
  })

  // Step 4: Insert Body Content into AEM
  document.getElementById('btn-insert-body').addEventListener('click', async () => {
    const btn = document.getElementById('btn-insert-body')
    btn.disabled = true
    btn.textContent = 'Inserting body content...'

    const bodyBlocks = buildBodyBlocksPayload(state.selectedArticle)
    const success = await runInAEM(
      {
        type: 'INSERT_BODY_CONTENT',
        slug: state.selectedArticle.slug,
        bodyBlocks,
      },
      'body-log'
    )

    btn.disabled = false
    btn.innerHTML = success
      ? '✓ Inserted — run again'
      : `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 12l7-7 3 3-7 7H2v-3z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.5 3.5l2-2 3 3-2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Retry Insert Body`
  })

  // Step 4: Discover Page Structure
  document.getElementById('btn-discover-page').addEventListener('click', async () => {
    const btn = document.getElementById('btn-discover-page')
    btn.disabled = true
    btn.textContent = 'Discovering...'

    await runInAEM(
      {
        type: 'DISCOVER_PAGE',
        slug: state.selectedArticle.slug,
      },
      'body-log'
    )

    btn.disabled = false
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6.5 1a5.5 5.5 0 014.38 8.82l4.15 4.15a.75.75 0 01-1.06 1.06l-4.15-4.15A5.5 5.5 0 116.5 1zm0 1.5a4 4 0 100 8 4 4 0 000-8z" fill="currentColor"/></svg>
      Discover Page Structure
    `
  })

  // Step 4: Probe Sibling Schemas
  document.getElementById('btn-probe-siblings').addEventListener('click', async () => {
    const btn = document.getElementById('btn-probe-siblings')
    btn.disabled = true
    btn.textContent = 'Probing...'

    await runInAEM(
      {
        type: 'PROBE_SIBLINGS',
        slug: state.selectedArticle.slug,
      },
      'body-log'
    )

    btn.disabled = false
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1v6m0 0v6m0-6h6m-6 0H2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      Probe Sibling Schemas
    `
  })

  // Step 4: Copy Key Findings HTML
  document.getElementById('btn-copy-kf').addEventListener('click', () => {
    const { html } = buildKeyFindingsPayload(state.selectedArticle.bullets || [])
    navigator.clipboard.writeText(html).then(() => {
      const btn = document.getElementById('btn-copy-kf')
      btn.textContent = '✓ Copied'
      setTimeout(() => {
        btn.textContent = 'Copy HTML'
      }, 2000)
    })
  })
})
