/**
 * probeRelatedContentStructure (INJECTED)
 *
 * v5b: Reads the current page's gridcards to capture the RTE fields
 * AEM writes after clicking Done (teaserDescription, textAsJsonForTeaser,
 * derivedDomTeaser). Also scans a limited set of siblings for examples.
 *
 * SELF-CONTAINED: serialized into the page — no imports / closures.
 */
export async function probeRelatedContentStructure(slug) {
  const logs = []
  const log = (m) => logs.push({ type: 'log', message: m })
  const logErr = (m) => logs.push({ type: 'error', message: m })

  console.groupCollapsed('[ProbeRelated] v5b — RTE field discovery')
  try {
    log('Obteniendo token CSRF...')
    const token = (await fetch('/libs/granite/csrf/token.json').then((r) => r.json())).token
    if (!token) throw new Error('No se pudo obtener el token CSRF')

    const siblingBase = '/content/msci/us/en/research-and-insights/blog-post'
    const GRIDCARD_TYPE = 'webmasters-aem/components/gridcard'
    const RTE_FIELDS = ['teaserDescription', 'textAsJsonForTeaser', 'derivedDomTeaser', 'textAsJson', 'derivedDom']

    // ── Step 1: Read OUR page's gridcards ──────────────────────────
    log('\n━━ Current page gridcards ━━')
    const jcrContent = siblingBase + '/' + slug + '/jcr:content'

    try {
      const pageTree = await fetch(jcrContent + '.infinity.json', {
        headers: { 'CSRF-Token': token },
      }).then((r) => r.json())

      const cards = []
      function findCards(node, path) {
        if (!node || typeof node !== 'object') return
        if ((node['sling:resourceType'] || '') === GRIDCARD_TYPE) {
          cards.push({ path, node })
        }
        for (const [k, v] of Object.entries(node)) {
          if (k.startsWith('jcr:') || k.startsWith('sling:') || k.startsWith('cq:') || k.startsWith(':')) continue
          if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
            findCards(v, path + '/' + k)
          }
        }
      }
      findCards(pageTree, jcrContent)

      log('Cards encontradas: ' + cards.length)
      for (const cc of cards) {
        const cardName = cc.path.split('/').pop()
        log('\n  ' + cardName + ':')
        const raw = JSON.stringify(cc.node, null, 2)
        for (const line of raw.split('\n')) {
          log('  ' + line)
        }
      }
    } catch (e) {
      logErr('Error leyendo página actual: ' + e.message)
    }

    // ── Step 2: Quick scan of 30 siblings for RTE examples ─────────
    log('\n━━ Siblings con RTE fields ━━')
    const list = await fetch(siblingBase + '.1.json', {
      headers: { 'CSRF-Token': token },
    }).then((r) => r.json())

    const siblings = Object.keys(list)
      .filter((k) => !k.startsWith('jcr:') && !k.startsWith(':') && !k.startsWith('sling:') && !k.startsWith('cq:') && k !== slug && k !== 'rep:policy')
      .slice(0, 30)

    log(siblings.length + ' siblings a escanear')
    let foundRTE = false

    for (const sib of siblings) {
      if (foundRTE) break
      let tree
      try {
        tree = await fetch(siblingBase + '/' + sib + '/jcr:content.infinity.json', {
          headers: { 'CSRF-Token': token },
        }).then((r) => r.json())
      } catch (e) { continue }
      if (!tree) continue

      function scan(node, path) {
        if (foundRTE || !node || typeof node !== 'object') return
        if ((node['sling:resourceType'] || '') === GRIDCARD_TYPE) {
          const hasRTE = RTE_FIELDS.some((f) => node[f] !== undefined)
          if (hasRTE) {
            log('\nRTE card en: ' + sib)
            const raw = JSON.stringify(node, null, 2)
            for (const line of raw.split('\n')) {
              log('  ' + line)
            }
            foundRTE = true
            return
          }
        }
        for (const [k, v] of Object.entries(node)) {
          if (foundRTE) return
          if (k.startsWith('jcr:') || k.startsWith('sling:') || k.startsWith('cq:') || k.startsWith(':')) continue
          if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
            scan(v, path + '/' + k)
          }
        }
      }
      scan(tree, siblingBase + '/' + sib + '/jcr:content')
    }

    if (!foundRTE) {
      log('No se encontró ejemplo con RTE en siblings.')
      log('Abre una card, haz Done, y ejecuta este probe de nuevo.')
    }

    log('\nProbe completo.')
    return { success: true, logs }
  } catch (err) {
    console.error('[ProbeRelated] fatal', err)
    logErr('Error: ' + err.message)
    return { success: false, logs, error: err.message }
  } finally {
    console.groupEnd()
  }
}
