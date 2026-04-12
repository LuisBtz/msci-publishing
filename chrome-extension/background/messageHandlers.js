/**
 * messageHandlers
 *
 * Maps every runtime message type from the side panel to the
 * corresponding injected-function runner. PING_AEM is special (it
 * only answers whether the active tab is AEM), and
 * INSERT_KEY_FINDINGS has an extra post-step that refreshes the
 * open editor tab so the user sees the new content instantly.
 *
 * Each handler returns true when it intends to call sendResponse
 * asynchronously — matching the chrome.runtime.onMessage contract.
 */
import { getActiveAEMTab, findEditorTabForPage } from './aemTabs.js'
import { runInPage } from './runInPage.js'

import { publishAssetsInAEM } from './injected/publishAssetsInAEM.js'
import { createPageInAEM } from './injected/createPageInAEM.js'
import { checkDamAssetsInAEM } from './injected/checkDamAssetsInAEM.js'
import { checkPageExistsInAEM } from './injected/checkPageExistsInAEM.js'
import { insertKeyFindingsInAEM, refreshEditorFrame } from './injected/insertKeyFindingsInAEM.js'
import { discoverPageStructure } from './injected/discoverPageStructure.js'
import { probeSiblingSchemas } from './injected/probeSiblingSchemas.js'
import { insertBodyContentInAEM } from './injected/insertBodyContentInAEM.js'

export function handleMessage(message, _sender, sendResponse) {
  if (message.type === 'PING_AEM') {
    ;(async () => {
      const tab = await getActiveAEMTab()
      sendResponse({ success: true, connected: !!tab })
    })()
    return true
  }

  if (message.type === 'PUBLISH_ASSETS') {
    ;(async () => {
      const result = await runInPage(publishAssetsInAEM, [
        message.slug,
        message.title,
        message.exhibitAssets,
        message.bannerAssets,
      ])
      sendResponse(result)
    })()
    return true
  }

  if (message.type === 'CREATE_PAGE') {
    ;(async () => {
      const result = await runInPage(createPageInAEM, [message.params])
      sendResponse(result)
    })()
    return true
  }

  if (message.type === 'CHECK_DAM_ASSETS') {
    ;(async () => {
      const result = await runInPage(checkDamAssetsInAEM, [message.slug])
      sendResponse(result)
    })()
    return true
  }

  if (message.type === 'CHECK_PAGE_EXISTS') {
    ;(async () => {
      const result = await runInPage(checkPageExistsInAEM, [message.slug])
      sendResponse(result)
    })()
    return true
  }

  if (message.type === 'DISCOVER_PAGE') {
    ;(async () => {
      const result = await runInPage(discoverPageStructure, [message.slug])
      sendResponse(result)
    })()
    return true
  }

  if (message.type === 'INSERT_BODY_CONTENT') {
    ;(async () => {
      const result = await runInPage(insertBodyContentInAEM, [
        message.slug,
        message.bodyBlocks,
      ])

      // Refresh editor tab if successful
      if (result.success && result.createdPaths?.length) {
        const { tab: editorTab } = await findEditorTabForPage(message.slug)
        if (editorTab) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: editorTab.id },
              func: () => location.reload(),
            })
            result.logs.push({ type: 'log', message: 'Editor recargado.' })
          } catch (e) {
            result.logs.push({
              type: 'warn',
              message: 'No se pudo recargar el editor — recárgalo manualmente.',
            })
          }
        } else {
          result.logs.push({
            type: 'warn',
            message: 'No se encontró el editor abierto — ábrelo desde el paso 3.',
          })
        }
      }

      sendResponse(result)
    })()
    return true
  }

  if (message.type === 'PROBE_SIBLINGS') {
    ;(async () => {
      const result = await runInPage(probeSiblingSchemas, [message.slug])
      sendResponse(result)
    })()
    return true
  }

  if (message.type === 'INSERT_KEY_FINDINGS') {
    ;(async () => {
      const result = await runInPage(insertKeyFindingsInAEM, [
        message.slug,
        message.html,
        message.textAsJson,
      ])

      // After writing, refresh the editor tab so the user sees the new
      // content without F5. The editor tab is often separate from the
      // active tab (opened from step 3 with target=_blank), so we scan
      // every window for it and inject into all frames, picking the one
      // that actually has Granite.author.
      if (result.success && result.targetPath) {
        const { tab: editorTab, diag } = await findEditorTabForPage(message.slug)
        console.log('[KeyFindings] tab search', diag)

        if (!editorTab) {
          result.logs.push({
            type: 'warn',
            message:
              'No se encontró el editor abierto — abre "Edit page in AEM" en el paso 3 y vuelve a intentar.',
          })
        } else {
          try {
            const injectionResults = await chrome.scripting.executeScript({
              target: { tabId: editorTab.id, allFrames: true },
              world: 'MAIN',
              func: refreshEditorFrame,
              args: [result.targetPath, message.html],
            })

            const chosen =
              (injectionResults || []).map((i) => i?.result).find((r) => r && r.persistMethod) ||
              (injectionResults || []).map((i) => i?.result).find((r) => r && r.hasGraniteAuthor) ||
              (injectionResults || []).map((i) => i?.result).find(Boolean) ||
              {}
            console.log('[KeyFindings] refresh result', chosen, 'frames=', injectionResults?.length)

            if (chosen.persistMethod) {
              result.logs.push({ type: 'log', message: 'Vista previa actualizada.' })
            } else if (chosen.refreshMethod) {
              result.logs.push({
                type: 'log',
                message: 'Editor refrescado, pero la vista previa puede tardar en actualizarse.',
              })
            } else {
              result.logs.push({
                type: 'warn',
                message: 'No se pudo refrescar el editor automáticamente — refresca la pestaña manualmente.',
              })
            }
          } catch (e) {
            console.error('[KeyFindings] refresh injection failed', e)
            result.logs.push({
              type: 'warn',
              message: 'No se pudo refrescar el editor automáticamente.',
            })
          }
        }
      }

      sendResponse(result)
    })()
    return true
  }
}
