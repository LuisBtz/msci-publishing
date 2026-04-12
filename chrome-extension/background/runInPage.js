/**
 * runInPage
 *
 * Thin wrapper around chrome.scripting.executeScript that:
 *   - Resolves the active AEM tab first and returns a friendly error
 *     if the user isn't on AEM.
 *   - Runs the provided function in the MAIN world so that fetch
 *     calls carry the user's AEM session cookies.
 *   - Normalizes the response to the { success, ... } shape the side
 *     panel expects.
 *
 * The `func` passed in MUST be self-contained: Chrome serializes it
 * via Function.prototype.toString(), so any closure variables from
 * its module will be undefined in the page context.
 */
import { getActiveAEMTab } from './aemTabs.js'

export async function runInPage(func, args) {
  const tab = await getActiveAEMTab()
  if (!tab) {
    return { success: false, error: 'Not on AEM Author tab. Open AEM in the active tab.' }
  }
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func,
      args,
    })
    return injection?.result || { success: false, error: 'No result from page' }
  } catch (err) {
    return { success: false, error: 'Injection failed: ' + err.message }
  }
}
