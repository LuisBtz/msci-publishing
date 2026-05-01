/**
 * escHtml
 *
 * Minimal HTML-escape used throughout the side panel whenever we
 * build innerHTML strings from dynamic data. Leans on the browser's
 * own text-to-HTML conversion via a throwaway div so it's immune to
 * whatever weird characters an article title might contain.
 */
export function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
}
