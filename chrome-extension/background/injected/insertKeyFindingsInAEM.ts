/**
 * insertKeyFindingsInAEM (INJECTED)
 *
 * Walks the page's JCR tree looking for webmasters-aem richtexteditor
 * nodes, finds the one that sits next to the "Key findings" heading
 * (same parent container), and writes a 4-property payload that
 * matches what the dialog Done button emits:
 *   text / derivedDom / textAsJson / textIsRich
 *
 * Falls back to the first empty RTE on the page if the heading can't
 * be found. The verify step logs property shapes to the AEM DevTools
 * console so we can debug without cluttering the side panel.
 *
 * SELF-CONTAINED: serialized into the page — no imports / closures.
 */
export async function insertKeyFindingsInAEM(slug, html, textAsJson) {
  const logs = []
  const log = (m) => logs.push({ type: 'log', message: m })
  const logErr = (m) => logs.push({ type: 'error', message: m })
  const logWarn = (m) => logs.push({ type: 'warn', message: m })

  console.groupCollapsed('[KeyFindings] insert into ' + slug)
  try {
    log('Conectando con AEM…')
    const token = (await fetch('/libs/granite/csrf/token.json').then((r) => r.json())).token
    if (!token) throw new Error('No se pudo obtener el token CSRF')

    const parentPath = '/content/msci/us/en/research-and-insights/blog-post'
    const jcrContent = parentPath + '/' + slug + '/jcr:content'

    log('Buscando el componente "Key findings" en la página…')
    const pageTree = await fetch(jcrContent + '.infinity.json', {
      headers: { 'CSRF-Token': token },
    }).then((r) => r.json())
    if (!pageTree) throw new Error('No se pudo leer la página')

    // Collect every richtexteditor node, in document order.
    const RTE_TYPE = 'webmasters-aem/components/richtexteditor'
    const rteNodes = []
    function walk(node, path) {
      if (!node || typeof node !== 'object') return
      if ((node['sling:resourceType'] || '') === RTE_TYPE) {
        rteNodes.push({
          path,
          text: typeof node.text === 'string' ? node.text : '',
          nodeName: path.substring(path.lastIndexOf('/') + 1),
        })
      }
      for (const [k, v] of Object.entries(node)) {
        if (k.startsWith('jcr:') || k.startsWith('sling:') || k.startsWith('cq:') || k.startsWith(':')) continue
        if (typeof v === 'object' && v !== null && !Array.isArray(v)) walk(v, path + '/' + k)
      }
    }
    walk(pageTree, jcrContent)

    console.log('[KeyFindings] RTEs encontrados:', rteNodes.length)
    console.table(
      rteNodes.map((n) => ({
        nodeName: n.nodeName,
        preview: n.text.replace(/<[^>]+>/g, '').substring(0, 60),
        path: n.path,
      }))
    )

    if (rteNodes.length === 0) {
      logErr('No se encontraron componentes de texto enriquecido en esta página.')
      return { success: false, logs, error: 'No RTE components found' }
    }

    // Locate the "Key findings" heading and its sibling target.
    let kfIdx = -1
    for (let i = 0; i < rteNodes.length; i++) {
      const plain = rteNodes[i].text.replace(/<[^>]+>/g, '').toLowerCase().trim()
      if (plain.includes('key finding')) {
        kfIdx = i
        break
      }
    }

    let targetNode = null
    if (kfIdx !== -1 && kfIdx + 1 < rteNodes.length) {
      const kfParent = rteNodes[kfIdx].path.substring(0, rteNodes[kfIdx].path.lastIndexOf('/'))
      const next = rteNodes[kfIdx + 1]
      const nextParent = next.path.substring(0, next.path.lastIndexOf('/'))
      if (kfParent === nextParent) targetNode = next
    }
    if (!targetNode) {
      targetNode = rteNodes.find((n) => !n.text.replace(/<[^>]+>/g, '').trim())
      if (targetNode) {
        logWarn('No se encontró el encabezado "Key findings" — se usará el primer RTE vacío.')
      }
    }
    if (!targetNode) {
      logErr('No se pudo encontrar un componente destino para insertar los bullets.')
      return { success: false, logs, error: 'No target RTE found' }
    }

    log('Componente destino encontrado.')
    console.log('[KeyFindings] target path:', targetNode.path)

    const existing = targetNode.text.replace(/<[^>]+>/g, '').trim()
    if (existing.length > 0) {
      logWarn('El componente destino ya tenía contenido — se sobrescribirá.')
      console.warn('[KeyFindings] overwriting existing content:', existing.substring(0, 200))
    }

    // Build the Sling POST payload. The 4 properties that matter:
    //   text / derivedDom / textAsJson / textIsRich
    log('Insertando contenido…')

    const writeParams = new URLSearchParams()
    writeParams.set('_charset_', 'utf-8')
    writeParams.set(':status', 'browser')
    writeParams.set('./text', html)
    writeParams.set('./text@TypeHint', 'String')
    writeParams.set('./derivedDom', html)
    writeParams.set('./derivedDom@TypeHint', 'String')
    writeParams.set('./textAsJson', textAsJson || '')
    writeParams.set('./textAsJson@TypeHint', 'String')
    writeParams.set('./textIsRich', 'true')
    writeParams.set('./jcr:lastModified', '')
    writeParams.set('./jcr:lastModified@TypeHint', 'Date')
    writeParams.set('./jcr:lastModifiedBy', '')

    console.log('[KeyFindings] POST', targetNode.path)
    console.log(
      '[KeyFindings] payload fields:',
      [...writeParams.keys()].filter((k) => k.startsWith('./'))
    )

    const res = await fetch(targetNode.path, {
      method: 'POST',
      headers: {
        'CSRF-Token': token,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: writeParams.toString(),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('[KeyFindings] write failed', res.status, errText)
      logErr('No se pudo escribir el contenido (HTTP ' + res.status + ').')
      return { success: false, logs, error: 'Write failed: HTTP ' + res.status }
    }

    try {
      const verify = await fetch(targetNode.path + '.json', {
        headers: { 'CSRF-Token': token },
      }).then((r) => r.json())
      console.log('[KeyFindings] verify text       ', verify.text)
      console.log('[KeyFindings] verify derivedDom ', verify.derivedDom)
      console.log('[KeyFindings] verify textAsJson ', verify.textAsJson)
      console.log('[KeyFindings] verify textIsRich ', verify.textIsRich)
      const ok =
        typeof verify.derivedDom === 'string' &&
        verify.derivedDom.includes('<li') &&
        typeof verify.textAsJson === 'string' &&
        verify.textAsJson.includes('"LI"')
      if (!ok) {
        logWarn('La escritura se realizó pero la verificación no encontró la lista esperada.')
      }
    } catch (e) {
      console.warn('[KeyFindings] verify failed', e)
    }

    log('Contenido insertado. Refrescando editor…')
    return { success: true, logs, targetPath: targetNode.path }
  } catch (err) {
    console.error('[KeyFindings] fatal', err)
    logErr('Error: ' + err.message)
    return { success: false, logs, error: err.message }
  } finally {
    console.groupEnd()
  }
}

/**
 * refreshEditorFrame (INJECTED into the editor tab)
 *
 * AEM Cloud loads editor.html inside an iframe of the /ui SPA shell,
 * so we inject this into all frames and pick the one that actually
 * has Granite.author. It uses persistence.updateParagraph to force
 * AEM to re-render the editable so the user sees the new bullets
 * without hitting F5.
 *
 * SELF-CONTAINED.
 */
export async function refreshEditorFrame(componentPath: string, html: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: Record<string, any> = { frameUrl: location.href }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = window as any
  const ns = win.Granite && win.Granite.author
  if (!ns || !ns.editables) {
    console.debug('[KeyFindings/refresh] no Granite.author in', location.href)
    return out
  }
  out.hasGraniteAuthor = true

  const total = ns.editables.length || 0
  let editable = null
  for (let i = 0; i < total; i++) {
    const ed = ns.editables[i]
    if (ed && ed.path === componentPath) {
      editable = ed
      break
    }
  }
  if (!editable) {
    const altPath = componentPath.replace('/jcr:content/', '/')
    for (let i = 0; i < total; i++) {
      const ed = ns.editables[i]
      if (ed && ed.path === altPath) {
        editable = ed
        break
      }
    }
  }
  if (!editable) {
    console.warn('[KeyFindings/refresh] editable not found for', componentPath, '(total=' + total + ')')
    out.reason = 'Editable not found'
    return out
  }

  console.log('[KeyFindings/refresh] persistence APIs:', ns.persistence ? Object.keys(ns.persistence) : 'none')

  try {
    if (ns.persistence && typeof ns.persistence.updateParagraph === 'function') {
      const ret = ns.persistence.updateParagraph(editable, {
        text: html,
        textIsRich: true,
        _charset_: 'utf-8',
      })
      if (ret && typeof ret.then === 'function') await ret
      out.persistMethod = 'persistence.updateParagraph'
    }
  } catch (e) {
    out.persistError = e.message || String(e)
    console.error('[KeyFindings/refresh] persistence.updateParagraph failed', e)
  }

  try {
    if (typeof editable.refresh === 'function') {
      const p = editable.refresh()
      if (p && typeof p.then === 'function') await p
      out.refreshMethod = 'editable.refresh'
    }
  } catch (e) {
    console.warn('[KeyFindings/refresh] editable.refresh failed', e)
  }
  return out
}
