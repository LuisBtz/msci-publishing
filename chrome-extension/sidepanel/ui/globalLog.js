/**
 * Global Log Panel
 *
 * Renders all process logs organized by section into a single
 * collapsible panel at the bottom of the sidebar. Each section
 * (Assets, Page, Key Findings, etc.) gets its own labeled group.
 */
import { state } from '../state.js';
import { escHtml } from './escHtml.js';
const SECTIONS = [
    { key: 'assets', label: 'Assets' },
    { key: 'page', label: 'Page Creation' },
    { key: 'keyFindings', label: 'Key Findings' },
    { key: 'bodyContent', label: 'Body Content' },
    { key: 'authors', label: 'Authors' },
    { key: 'relatedContent', label: 'Related Content' },
    { key: 'footnotes', label: 'Footnotes' },
    { key: 'cleanup', label: 'Cleanup' },
];
export function renderGlobalLog() {
    const container = document.getElementById('global-log-content');
    if (!container)
        return;
    let html = '';
    let totalEntries = 0;
    for (const section of SECTIONS) {
        const entries = state.processLogs[section.key] || [];
        if (entries.length === 0)
            continue;
        totalEntries += entries.length;
        html += `<div class="log-section">`;
        html += `<div class="log-section-header">${escHtml(section.label)}</div>`;
        for (const entry of entries) {
            const cls = entry.type === 'error'
                ? 'log-error'
                : entry.type === 'warn'
                    ? 'log-warn'
                    : 'log-success';
            html += `<span class="${cls}">${escHtml(entry.message)}</span>\n`;
        }
        html += `</div>`;
    }
    if (totalEntries === 0) {
        html = '<span class="log-info">No logs yet...</span>';
    }
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
    // Update badge count
    const badge = document.getElementById('global-log-badge');
    if (badge) {
        badge.textContent = totalEntries > 0 ? String(totalEntries) : '';
        badge.classList.toggle('hidden', totalEntries === 0);
    }
}
export function toggleGlobalLog() {
    const panel = document.getElementById('global-log');
    panel.classList.toggle('open');
}
