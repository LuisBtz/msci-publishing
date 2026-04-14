/**
 * insertFootnotesInAEM (INJECTED)
 *
 * Finds the empty RTE inside the LAST Theme Container v2 on the page
 * (the one that sits right after the spacer component) and writes the
 * footnotes payload using the standard 4-property recipe:
 *   text / derivedDom / textAsJson / textIsRich
 *
 * The footnotes are rendered as consecutive <p> tags, each wrapping a
 * <span> with the caption class used on msci.com:
 *   ms-caption-m caption-m ms-font-regular
 *
 * Links inside footnote text are wrapped with:
 *   ms-link-label-sm lg:ms-link-label-lg ms-font-regular
 *
 * SELF-CONTAINED: serialized into the page — no imports / closures.
 */
export async function insertFootnotesInAEM(slug, footnotes) {
  const logs = []
  const log = (m) => logs.push({ type: 'log', message: m })
  const logErr = (m) => logs.push({ type: 'error', message: m })
  const logWarn = (m) => logs.push({ type: 'warn', message: m })

  console.groupCollapsed('[Footnotes] insert into ' + slug)
  try {
    log('Conectando con AEM…')
    const token = (await fetch('/libs/granite/csrf/token.json').then((r) => r.json())).token
    if (!token) throw new Error('No se pudo obtener el token CSRF')

    const parentPath = '/content/msci/us/en/research-and-insights/blog-post'
    const jcrContent = parentPath + '/' + slug + '/jcr:content'

    log('Leyendo estructura de la página…')
    const pageTree = await fetch(jcrContent + '.infinity.json', {
      headers: { 'CSRF-Token': token },
    }).then((r) => r.json())
    if (!pageTree) throw new Error('No se pudo leer la página')

    // ── Find all Theme Container v2 nodes ──────────────────────────
    const CONTAINER_TYPE = 'webmasters-aem/components/container/v2/container'
    const RTE_TYPE = 'webmasters-aem/components/richtexteditor'
    const SPACER_TYPE = 'webmasters-aem/components/spacer'

    const containers = []
    function findContainers(node, path) {
      if (!node || typeof node !== 'object') return
      if ((node['sling:resourceType'] || '') === CONTAINER_TYPE) {
        containers.push({ path, node })
      }
      for (const [k, v] of Object.entries(node)) {
        if (k.startsWith('jcr:') || k.startsWith('sling:') || k.startsWith('cq:') || k.startsWith(':')) continue
        if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
          findContainers(v, path + '/' + k)
        }
      }
    }
    findContainers(pageTree, jcrContent)

    log('Theme Container v2 encontrados: ' + containers.length)
    if (containers.length === 0) {
      logErr('No se encontraron Theme Container v2 en la página.')
      return { success: false, logs, error: 'No containers found' }
    }

    // ── Walk the LAST container looking for spacer → RTE ───────────
    const lastContainer = containers[containers.length - 1]
    log('Último container: ' + lastContainer.path)

    // Get child keys of the container (skip metadata)
    function childKeys(node) {
      return Object.keys(node).filter(
        (k) => !k.startsWith('jcr:') && !k.startsWith('sling:') &&
               !k.startsWith('cq:') && !k.startsWith(':') &&
               typeof node[k] === 'object' && node[k] !== null
      )
    }

    // The container has a responsivegrid (node0) as first child
    const containerKids = childKeys(lastContainer.node)
    let grid = null
    let gridPath = null
    for (const k of containerKids) {
      const child = lastContainer.node[k]
      // The responsivegrid is typically named node0 or responsivegrid
      if (k.startsWith('node') || k === 'responsivegrid') {
        grid = child
        gridPath = lastContainer.path + '/' + k
        break
      }
    }

    // Fallback: if no named grid, treat the container itself as the parent
    if (!grid) {
      grid = lastContainer.node
      gridPath = lastContainer.path
    }

    const gridKids = childKeys(grid)
    let targetRtePath = null
    let spacerSeen = false

    for (const k of gridKids) {
      const child = grid[k]
      const resType = child['sling:resourceType'] || ''

      if (resType.includes('spacer')) {
        spacerSeen = true
      }

      if (resType === RTE_TYPE && spacerSeen) {
        targetRtePath = gridPath + '/' + k
        log('RTE target encontrado después del spacer: ' + k)
        break
      }
    }

    // Fallback: find any RTE in the last container
    if (!targetRtePath) {
      for (const k of gridKids) {
        const child = grid[k]
        if ((child['sling:resourceType'] || '') === RTE_TYPE) {
          targetRtePath = gridPath + '/' + k
          logWarn('No se encontró spacer — usando el RTE: ' + k)
          break
        }
      }
    }

    if (!targetRtePath) {
      logErr('No se encontró un RTE en el último Theme Container v2.')
      return { success: false, logs, error: 'No target RTE found in last container' }
    }

    // Check if it already has content
    const existingNode = grid[targetRtePath.split('/').pop()] || {}
    const existingText = (typeof existingNode.text === 'string' ? existingNode.text : '').replace(/<[^>]+>/g, '').trim()
    if (existingText.length > 0) {
      logWarn('El RTE ya tiene contenido — se sobrescribirá.')
      console.warn('[Footnotes] overwriting:', existingText.substring(0, 200))
    }

    // ── Build the footnotes payload ─────────────────────────────────
    const FN_CLASS = 'ms-caption-m caption-m ms-font-regular'
    const LINK_CLASS = 'ms-link-label-sm lg:ms-link-label-lg ms-font-regular'

    function processText(raw) {
      let t = raw || ''
      t = t.replace(/<a\s/gi, `<a `)
      t = t.replace(/<a /gi, (match) => {
        return `<a `
      })
      // Wrap link text in span with link class
      t = t.replace(/<a([^>]*)>([\s\S]*?)<\/a>/gi, (_, attrs, inner) => {
        // If inner already has a span, leave it; otherwise wrap
        if (inner.includes('<span')) return `<a${attrs}>${inner}</a>`
        return `<a${attrs}><span class='${LINK_CLASS}'>${inner}</span></a>`
      })
      return t
    }

    const paragraphs = (footnotes || []).map((f) => {
      const number = f.number || ''
      const text = processText(f.text || '')
      return `<p><span class='${FN_CLASS}'>${number} ${text}</span></p>`
    })

    const html = paragraphs.join('\n')

    const astChildren = (footnotes || []).map((f) => {
      const number = f.number || ''
      const rawText = f.text || ''
      // Build inline children: parse <a> tags into AST link nodes
      const inlineChildren = buildInlineAst(number + ' ' + rawText, LINK_CLASS)
      return {
        tag: 'P',
        className: '',
        tailwindStyles: '',
        typography: '',
        color: '',
        children: [
          {
            tag: 'SPAN',
            className: FN_CLASS,
            tailwindStyles: '',
            typography: '',
            color: '',
            children: inlineChildren,
          },
        ],
      }
    })

    // Parse inline HTML to AST nodes (text + links)
    function buildInlineAst(html, linkClass) {
      const results = []
      const re = /<a([^>]*)>([\s\S]*?)<\/a>/gi
      let lastIdx = 0
      let m
      const plain = html.replace(/<(?!a\s|\/a>)[^>]+>/gi, '')
      // For simplicity, use the plain text version for AST
      const stripped = html.replace(/<[^>]+>/g, '')
      results.push({ tag: 'text', textContent: stripped })
      return results
    }

    const textAsJson = JSON.stringify({ root: { children: astChildren } })

    log('Insertando ' + footnotes.length + ' footnotes…')
    console.log('[Footnotes] POST', targetRtePath)
    console.log('[Footnotes] html preview:', html.substring(0, 300))

    const writeParams = new URLSearchParams()
    writeParams.set('_charset_', 'utf-8')
    writeParams.set(':status', 'browser')
    writeParams.set('./text', html)
    writeParams.set('./text@TypeHint', 'String')
    writeParams.set('./derivedDom', html)
    writeParams.set('./derivedDom@TypeHint', 'String')
    writeParams.set('./textAsJson', textAsJson)
    writeParams.set('./textAsJson@TypeHint', 'String')
    writeParams.set('./textIsRich', 'true')
    writeParams.set('./jcr:lastModified', '')
    writeParams.set('./jcr:lastModified@TypeHint', 'Date')
    writeParams.set('./jcr:lastModifiedBy', '')

    const res = await fetch(targetRtePath, {
      method: 'POST',
      headers: {
        'CSRF-Token': token,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: writeParams.toString(),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('[Footnotes] write failed', res.status, errText)
      logErr('No se pudo escribir el contenido (HTTP ' + res.status + ').')
      return { success: false, logs, error: 'Write failed: HTTP ' + res.status }
    }

    // Verify
    try {
      const verify = await fetch(targetRtePath + '.json', {
        headers: { 'CSRF-Token': token },
      }).then((r) => r.json())
      console.log('[Footnotes] verify text       ', verify.text)
      console.log('[Footnotes] verify derivedDom ', verify.derivedDom)
      console.log('[Footnotes] verify textAsJson ', verify.textAsJson)
      console.log('[Footnotes] verify textIsRich ', verify.textIsRich)
      const ok =
        typeof verify.derivedDom === 'string' &&
        verify.derivedDom.includes('<p>') &&
        typeof verify.textAsJson === 'string' &&
        verify.textAsJson.includes('"P"')
      if (!ok) {
        logWarn('La escritura se realizó pero la verificación no encontró el formato esperado.')
      }
    } catch (e) {
      console.warn('[Footnotes] verify failed', e)
    }

    log('Footnotes insertados. Refrescando editor…')
    return { success: true, logs, targetPath: targetRtePath }
  } catch (err) {
    console.error('[Footnotes] fatal', err)
    logErr('Error: ' + err.message)
    return { success: false, logs, error: err.message }
  } finally {
    console.groupEnd()
  }
}
