/**
 * Background messaging helpers
 *
 * Thin wrappers around chrome.runtime.sendMessage used by every step
 * to talk to the service worker:
 *
 *   - sendBackground: one-shot fire-and-wait with error handling.
 *   - runInAEM:       same, but streams the response's `logs` array
 *                     into a <pre> element in the side panel.
 *   - checkAEMConnection: PING_AEM poll used to light the "connected"
 *                         dot at the top of the panel.
 */
import { escHtml } from '../ui/escHtml.js'

export function sendBackground(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message })
      } else {
        resolve(response)
      }
    })
  })
}

export function runInAEM(message, logElementId) {
  return new Promise((resolve) => {
    const logEl = document.getElementById(logElementId)
    logEl.classList.remove('hidden')
    logEl.innerHTML = '<span class="log-info">Connecting to AEM...</span>\n'

    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        logEl.innerHTML += `<span class="log-error">Error: ${escHtml(
          chrome.runtime.lastError.message
        )}</span>\n`
        resolve(false)
        return
      }
      const res = response || { success: false, error: 'No response from background' }
      if (Array.isArray(res.logs)) {
        res.logs.forEach((entry) => {
          const cls =
            entry.type === 'error'
              ? 'log-error'
              : entry.type === 'warn'
                ? 'log-warn'
                : 'log-success'
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

export function checkAEMConnection() {
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
