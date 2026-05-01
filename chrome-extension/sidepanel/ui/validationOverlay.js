/**
 * validationOverlay
 *
 * Full-pane blocking spinner shown while we probe AEM for an
 * article's DAM + page status. The DOM nodes live in sidepanel.html;
 * this module only toggles the `.hidden` class and sets the label.
 */
export function showValidationOverlay(text) {
    const overlay = document.getElementById('validation-overlay');
    document.getElementById('validation-overlay-text').textContent = text || 'Checking...';
    overlay.classList.remove('hidden');
}
export function hideValidationOverlay() {
    document.getElementById('validation-overlay').classList.add('hidden');
}
