/**
 * probeSiblingSchemas (INJECTED)
 *
 * Scans sibling blog-post pages to find components that already have
 * real content — specifically vegaEmbedChart with a JSON URL and image
 * with a fileReference — and returns their full property maps so we
 * know exactly what to write when creating new components dynamically.
 *
 * Also captures a fully-populated RTE and the container/responsivegrid
 * parent structure to understand required JCR properties for node creation.
 *
 * SELF-CONTAINED: serialized into the page — no imports / closures.
 */
export async function probeSiblingSchemas(slug) {
  const logs = []
  const log = (m) => logs.push({ type: 'log', message: m })
  const logErr = (m) => logs.push({ type: 'error', message: m })
  const logWarn = (m) => logs.push({ type: 'warn', message: m })

  console.groupCollapsed('[Probe] sibling schemas')
  try {
    log('Obteniendo token CSRF…')
    const token = (await fetch('/libs/granite/csrf/token.json').then((r) => r.json())).token
    if (!token) throw new Error('No se pudo obtener el token CSRF')

    const siblingBase = '/content/msci/us/en/research-and-insights/blog-post'
    const schemas = {
      vegaEmbedChart: null,
      image: null,
      richtexteditor: null,
      containerV2: null,
      responsivegrid: null,
    }

    log('Listando siblings…')
    const list = await fetch(siblingBase + '.1.json', {
      headers: { 'CSRF-Token': token },
    }).then((r) => r.json())

    const siblings = Object.keys(list)
      .filter((k) => !k.startsWith('jcr:') && !k.startsWith(':') && !k.startsWith('sling:') && !k.startsWith('cq:') && k !== slug && k !== 'rep:policy')
      .slice(0, 30)

    log('Encontrados ' + siblings.length + ' siblings para explorar')

    for (const sib of siblings) {
      if (schemas.vegaEmbedChart && schemas.image && schemas.richtexteditor && schemas.containerV2) {
        break // found all schemas
      }

      let tree
      try {
        tree = await fetch(siblingBase + '/' + sib + '/jcr:content.infinity.json', {
          headers: { 'CSRF-Token': token },
        }).then((r) => r.json())
      } catch (e) {
        continue
      }
      if (!tree) continue

      function walk(node, path) {
        if (!node || typeof node !== 'object') return
        const resType = node['sling:resourceType'] || ''

        // Capture vegaEmbedChart with actual content
        if (!schemas.vegaEmbedChart && resType === 'webmasters-aem/components/vegaEmbedChart') {
          const hasContent = Object.keys(node).some(
            (k) => !k.startsWith('jcr:') && !k.startsWith('sling:') && !k.startsWith(':') && typeof node[k] !== 'object'
          )
          if (hasContent) {
            schemas.vegaEmbedChart = { path, sibling: sib, properties: extractProps(node), fullNode: node }
            log('  vegaEmbedChart encontrado en ' + sib)
          }
        }

        // Capture image with fileReference
        if (!schemas.image && resType === 'webmasters-aem/components/image' && node.fileReference) {
          schemas.image = { path, sibling: sib, properties: extractProps(node), fullNode: node }
          log('  image encontrado en ' + sib)
        }

        // Capture RTE with body content (not key findings heading)
        if (!schemas.richtexteditor && resType === 'webmasters-aem/components/richtexteditor' && node.text) {
          const plain = node.text.replace(/<[^>]+>/g, '').trim()
          if (plain.length > 50 && !plain.toLowerCase().includes('key finding')) {
            schemas.richtexteditor = { path, sibling: sib, properties: extractProps(node), fullNode: node }
            log('  richtexteditor encontrado en ' + sib)
          }
        }

        // Capture container/v2 with children
        if (!schemas.containerV2 && resType === 'webmasters-aem/components/container/v2/container') {
          const childKeys = Object.keys(node).filter(
            (k) => !k.startsWith('jcr:') && !k.startsWith('sling:') && !k.startsWith('cq:') && !k.startsWith(':') && typeof node[k] === 'object'
          )
          if (childKeys.length > 0) {
            schemas.containerV2 = {
              path,
              sibling: sib,
              properties: extractProps(node),
              childKeys,
              fullNode: Object.fromEntries(
                Object.entries(node).filter(([k]) => typeof node[k] !== 'object' || k === childKeys[0])
              ),
            }
            // Also grab the responsivegrid inside
            const rgKey = childKeys.find((k) => {
              const child = node[k]
              return child && (child['sling:resourceType'] || '').includes('responsivegrid')
            })
            if (rgKey && !schemas.responsivegrid) {
              schemas.responsivegrid = {
                path: path + '/' + rgKey,
                sibling: sib,
                properties: extractProps(node[rgKey]),
                fullNode: node[rgKey],
              }
              log('  responsivegrid encontrado en ' + sib)
            }
            log('  containerV2 encontrado en ' + sib)
          }
        }

        for (const [k, v] of Object.entries(node)) {
          if (k.startsWith('jcr:') || k.startsWith('sling:') || k.startsWith('cq:') || k.startsWith(':')) continue
          if (typeof v === 'object' && v !== null && !Array.isArray(v)) walk(v, path + '/' + k)
        }
      }

      walk(tree, siblingBase + '/' + sib + '/jcr:content')
    }

    function extractProps(node) {
      const props = {}
      for (const [k, v] of Object.entries(node)) {
        if (typeof v !== 'object' || v === null) {
          props[k] = v
        }
      }
      return props
    }

    // Report findings
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    log('SCHEMAS DESCUBIERTOS')
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    for (const [name, schema] of Object.entries(schemas)) {
      if (schema) {
        log('\n' + name + ' (from: ' + schema.sibling + ')')
        log('  path: ' + schema.path)
        log('  properties:')
        for (const [k, v] of Object.entries(schema.properties)) {
          const val = typeof v === 'string' && v.length > 80 ? v.substring(0, 80) + '…' : v
          log('    ' + k + ' = ' + JSON.stringify(val))
        }
      } else {
        logWarn('\n' + name + ': NO ENCONTRADO')
      }
    }

    console.log('[Probe] All schemas:', schemas)
    for (const [name, schema] of Object.entries(schemas)) {
      if (schema) {
        console.log('[Probe] ' + name + ' full node:', schema.fullNode)
        console.log('[Probe] ' + name + ' properties:', schema.properties)
      }
    }

    log('\n✅ Probe completo — revisa la consola (F12) para datos detallados.')
    return { success: true, logs, schemas }
  } catch (err) {
    console.error('[Probe] fatal', err)
    logErr('Error: ' + err.message)
    return { success: false, logs, error: err.message }
  } finally {
    console.groupEnd()
  }
}
