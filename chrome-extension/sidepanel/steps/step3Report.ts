/**
 * Step 3 — Report
 *
 * Displays a summary of the automated publishing process with links
 * to the DAM folder, AEM page, editor and preview. The report data
 * comes from state.processReport which was populated by step2Process.
 */
import { state } from '../state.js'
import { escHtml } from '../ui/escHtml.js'

export function populateStep3() {
  const report = state.processReport
  const container = document.getElementById('report-content')

  if (!report) {
    container.innerHTML = '<p class="empty-state">No report available</p>'
    return
  }

  const hasErrors = report.errors && report.errors.length > 0
  const statusClass = hasErrors ? 'report-status-warning' : 'report-status-success'
  const statusText = hasErrors ? 'Process completed with errors' : 'Page created successfully'
  const statusIcon = hasErrors ? '!' : '&#10003;'

  const durationSec = report.duration_ms ? (report.duration_ms / 1000).toFixed(1) : '—'

  container.innerHTML = `
    <div class="report-status ${statusClass}">
      <span class="report-status-icon">${statusIcon}</span>
      <span>${statusText}</span>
      <span class="report-duration">${durationSec}s</span>
    </div>

    <div class="report-links">
      <h3>Links</h3>
      <div class="report-link-row">
        <span class="report-link-label">DAM Folder</span>
        <a href="${escHtml(report.dam_url)}" target="_blank" class="link-external">${escHtml(report.dam_url)}</a>
      </div>
      <div class="report-link-row">
        <span class="report-link-label">Sites (AEM)</span>
        <a href="${escHtml(report.sites_url)}" target="_blank" class="link-external">${escHtml(report.sites_url)}</a>
      </div>
      <div class="report-link-row">
        <span class="report-link-label">Editor</span>
        <a href="${escHtml(report.editor_url)}" target="_blank" class="link-external">${escHtml(report.editor_url)}</a>
      </div>
      <div class="report-link-row">
        <span class="report-link-label">Preview</span>
        <a href="${escHtml(report.preview_url)}" target="_blank" class="link-external">${escHtml(report.preview_url)}</a>
      </div>
    </div>

    <div class="report-meta">
      <h3>Metadata</h3>
      <div class="report-meta-row">
        <span class="report-meta-label">Title</span>
        <span>${escHtml(report.title)}</span>
      </div>
      <div class="report-meta-row">
        <span class="report-meta-label">Slug</span>
        <code>${escHtml(report.slug)}</code>
      </div>
      <div class="report-meta-row">
        <span class="report-meta-label">Meta description</span>
        <span class="report-meta-desc">${escHtml(report.meta_description)}</span>
      </div>
      <div class="report-meta-row">
        <span class="report-meta-label">Tags</span>
        <span>${report.tags?.length || 0} tag(s)</span>
      </div>
    </div>

    <div class="report-summary">
      <h3>Summary</h3>
      <div class="report-summary-grid">
        <div class="report-stat">
          <span class="report-stat-num">${report.assets_uploaded?.exhibits || 0}</span>
          <span class="report-stat-label">Exhibits</span>
        </div>
        <div class="report-stat">
          <span class="report-stat-num">${report.assets_uploaded?.banners || 0}</span>
          <span class="report-stat-label">Banners</span>
        </div>
        <div class="report-stat">
          <span class="report-stat-num">${report.content_injected?.length || 0}</span>
          <span class="report-stat-label">Modules</span>
        </div>
        <div class="report-stat">
          <span class="report-stat-num">${report.containers_cleaned || 0}</span>
          <span class="report-stat-label">Cleaned</span>
        </div>
      </div>
    </div>

    ${
      hasErrors
        ? `<div class="report-errors">
        <h3>Errors</h3>
        <ul>${report.errors.map((e) => `<li>${escHtml(e)}</li>`).join('')}</ul>
      </div>`
        : ''
    }
  `
}
