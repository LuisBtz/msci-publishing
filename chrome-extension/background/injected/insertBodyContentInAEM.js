/**
 * insertBodyContentInAEM (INJECTED)
 *
 * Dynamically creates Theme Container v2 + Layout Container (responsivegrid)
 * structures for each body block, then writes content into the appropriate
 * child components (RTE for text, Image for static exhibits, VegaEmbedChart
 * for interactive exhibits).
 *
 * Container creation order:
 *   1. Find the "Key findings" container (already populated by step 4a)
 *   2. For each body block, create a new container AFTER the previous one
 *   3. Inside each container, create the right child components
 *   4. Write content to each component
 *
 * SELF-CONTAINED: serialized into the page — no imports / closures.
 */
export async function insertBodyContentInAEM(slug, bodyBlocks) {
  const logs = []
  const log = (m) => logs.push({ type: 'log', message: m })
  const logErr = (m) => logs.push({ type: 'error', message: m })
  const logWarn = (m) => logs.push({ type: 'warn', message: m })

  console.groupCollapsed('[BodyContent] insert into ' + slug)
  try {
    log('Conectando con AEM…')
    const token = (await fetch('/libs/granite/csrf/token.json').then((r) => r.json())).token
    if (!token) throw new Error('No se pudo obtener el token CSRF')

    const parentPath = '/content/msci/us/en/research-and-insights/blog-post'
    const jcrContent = parentPath + '/' + slug + '/jcr:content'
    const damBase = '/content/dam/web/msci-com/research-and-insights/blog-post/' + slug + '/exhibits'

    // Helper: Sling POST
    async function slingPost(path, params) {
      const res = await fetch(path, {
        method: 'POST',
        headers: {
          'CSRF-Token': token,
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        body: params.toString(),
      })
      return res
    }

    // ── Step 1: Find the body section parent ─────────────────────────
    log('Buscando la sección del body…')
    const pageTree = await fetch(jcrContent + '.infinity.json', {
      headers: { 'CSRF-Token': token },
    }).then((r) => r.json())
    if (!pageTree) throw new Error('No se pudo leer la página')

    // Walk the tree to find the "Key findings" heading RTE
    const RTE_TYPE = 'webmasters-aem/components/richtexteditor'
    const CONTAINER_TYPE = 'webmasters-aem/components/container/v2/container'
    let kfContainerPath = null

    function findKeyFindings(node, path) {
      if (!node || typeof node !== 'object') return
      if ((node['sling:resourceType'] || '') === RTE_TYPE) {
        const plain = (typeof node.text === 'string' ? node.text : '').replace(/<[^>]+>/g, '').toLowerCase().trim()
        if (plain.includes('key finding')) {
          // The KF RTE is inside: container/node0/richtexteditor
          // We want the container path (2 levels up)
          const parts = path.split('/')
          // Go up: richtexteditor → node0 → container
          kfContainerPath = parts.slice(0, -2).join('/')
          return
        }
      }
      for (const [k, v] of Object.entries(node)) {
        if (kfContainerPath) return
        if (k.startsWith('jcr:') || k.startsWith('sling:') || k.startsWith('cq:') || k.startsWith(':')) continue
        if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
          findKeyFindings(v, path + '/' + k)
        }
      }
    }
    findKeyFindings(pageTree, jcrContent)

    if (!kfContainerPath) {
      logErr('No se encontró el contenedor de "Key findings". Asegúrate de insertar los Key Findings primero.')
      return { success: false, logs, error: 'Key findings container not found' }
    }

    // The body section responsivegrid is the parent of the KF container
    const bodySectionGrid = kfContainerPath.substring(0, kfContainerPath.lastIndexOf('/'))
    log('Body section: …' + bodySectionGrid.split('/').slice(-3).join('/'))
    console.log('[BodyContent] body section grid:', bodySectionGrid)
    console.log('[BodyContent] KF container:', kfContainerPath)

    // ── Step 2: Create containers for each body block ────────────────
    const kfContainerName = kfContainerPath.split('/').pop()
    let previousContainerName = kfContainerName
    const createdPaths = []

    for (let i = 0; i < bodyBlocks.length; i++) {
      const block = bodyBlocks[i]
      const blockLabel = block.type === 'text'
        ? 'Text'
        : block.type === 'exhibit' && block.exhibitType === 'interactive'
          ? 'Interactive'
          : 'Exhibit'
      log(`\n━━ Block ${i + 1}/${bodyBlocks.length}: ${blockLabel} ━━`)

      // 2a. Create the Theme Container v2
      const containerName = 'body_block_' + i
      const containerPath = bodySectionGrid + '/' + containerName

      log('Creando contenedor…')
      const containerParams = new URLSearchParams()
      containerParams.set('jcr:primaryType', 'nt:unstructured')
      containerParams.set('sling:resourceType', CONTAINER_TYPE)
      containerParams.set('numOfColumns', '1')
      containerParams.set('theme', 'white')
      containerParams.set('defaultMargin', '0')
      containerParams.set('defaultRowGap', '1')
      containerParams.set('hasMediumMargins', 'false')
      containerParams.set('hasLargeMargins', 'false')
      containerParams.set('hasRowGap', 'false')
      containerParams.set('hasMediumRowGap', 'false')
      containerParams.set('hasLargeRowGap', 'false')
      containerParams.set(':order', 'after ' + previousContainerName)

      let res = await slingPost(containerPath, containerParams)
      if (!res.ok && res.status !== 200 && res.status !== 201) {
        logErr('  Error creando contenedor: HTTP ' + res.status)
        continue
      }
      log('  Contenedor creado ✓')

      // 2b. Ensure node0 (responsivegrid) exists inside the container.
      // AEM MAY auto-create it, so check first; if missing, create it.
      const gridPath = containerPath + '/node0'
      let gridExists = false
      try {
        const checkRes = await fetch(gridPath + '.json', { headers: { 'CSRF-Token': token } })
        if (checkRes.ok) {
          const gridNode = await checkRes.json()
          gridExists = (gridNode['sling:resourceType'] || '').includes('responsivegrid')
        }
      } catch (e) { /* not found */ }

      if (!gridExists) {
        const gridParams = new URLSearchParams()
        gridParams.set('jcr:primaryType', 'nt:unstructured')
        gridParams.set('sling:resourceType', 'wcm/foundation/components/responsivegrid')
        res = await slingPost(gridPath, gridParams)
        if (!res.ok && res.status !== 200 && res.status !== 201) {
          logErr('  Error creando responsivegrid: HTTP ' + res.status)
          continue
        }
        log('  Layout container (node0) creado ✓')
      } else {
        log('  Layout container (node0) ya existía ✓')
      }

      // 2c. Create child components based on block type
      if (block.type === 'text') {
        await createTextBlock(gridPath, block, token, log, logErr)
      } else if (block.type === 'exhibit') {
        if (block.exhibitType === 'interactive') {
          await createInteractiveExhibitBlock(gridPath, block, damBase, token, log, logErr)
        } else {
          await createStaticExhibitBlock(gridPath, block, damBase, token, log, logErr)
        }
      }

      previousContainerName = containerName
      createdPaths.push(containerPath)
    }

    // ── Verification: check what actually exists in JCR ─────────────
    log('\n━━ Verificación ━━')
    if (createdPaths.length > 0) {
      try {
        const verifyPath = createdPaths[0]
        const verifyRes = await fetch(verifyPath + '.infinity.json', {
          headers: { 'CSRF-Token': token },
        })
        if (verifyRes.ok) {
          const tree = await verifyRes.json()
          const childKeys = Object.keys(tree).filter(k => !k.startsWith('jcr:') && !k.startsWith('sling:') && !k.startsWith('cq:') && !k.startsWith(':'))
          log('Block 0 container children: ' + JSON.stringify(childKeys))
          if (tree.node0) {
            const gridKeys = Object.keys(tree.node0).filter(k => !k.startsWith('jcr:') && !k.startsWith('sling:') && !k.startsWith('cq:') && !k.startsWith(':'))
            log('Block 0 node0 children: ' + JSON.stringify(gridKeys))
            log('Block 0 node0 resourceType: ' + (tree.node0['sling:resourceType'] || '(none)'))
            // Check first child component
            for (const gk of gridKeys) {
              const comp = tree.node0[gk]
              if (comp && typeof comp === 'object') {
                log('  → ' + gk + ': resourceType=' + (comp['sling:resourceType'] || '(none)') + ', text=' + (typeof comp.text === 'string' ? comp.text.substring(0, 60) + '…' : '(no text)'))
              }
            }
          } else {
            log('⚠ node0 NOT found in container tree!')
          }
        } else {
          logWarn('Verification fetch failed: HTTP ' + verifyRes.status)
        }
      } catch (e) {
        logWarn('Verification error: ' + e.message)
      }
    }

    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    log('✅ ' + createdPaths.length + '/' + bodyBlocks.length + ' bloques insertados.')
    log('Refrescando editor…')
    return { success: true, logs, createdPaths }
  } catch (err) {
    console.error('[BodyContent] fatal', err)
    logErr('Error: ' + err.message)
    return { success: false, logs, error: err.message }
  } finally {
    console.groupEnd()
  }

  // ── Text Block: single RTE ─────────────────────────────────────────
  async function createTextBlock(gridPath, block, token, log, logErr) {
    const rtePath = gridPath + '/richtexteditor'
    const { html, textAsJson } = buildBodyRtePayload(block.html)

    log('  Escribiendo texto en RTE…')
    const p = new URLSearchParams()
    p.set('_charset_', 'utf-8')
    p.set('./jcr:primaryType', 'nt:unstructured')
    p.set('./sling:resourceType', 'webmasters-aem/components/richtexteditor')
    p.set('./text', html)
    p.set('./text@TypeHint', 'String')
    p.set('./derivedDom', html)
    p.set('./derivedDom@TypeHint', 'String')
    p.set('./textAsJson', textAsJson)
    p.set('./textAsJson@TypeHint', 'String')
    p.set('./textIsRich', 'true')

    const res = await fetch(rtePath, {
      method: 'POST',
      headers: {
        'CSRF-Token': token,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: p.toString(),
    })
    if (res.ok) {
      log('  RTE escrito ✓ (HTTP ' + res.status + ')')
    } else {
      const resBody = await res.text().catch(() => '')
      logErr('  Error escribiendo RTE: HTTP ' + res.status + ' → ' + resBody.substring(0, 100))
    }
  }

  // ── Static Exhibit Block: RTE (title) + Image + RTE (caption) ──────
  async function createStaticExhibitBlock(gridPath, block, damBase, token, log, logErr) {
    // Title RTE
    if (block.title) {
      const titlePath = gridPath + '/richtexteditor_title'
      const { html, textAsJson } = buildExhibitTitlePayload(block.title)
      log('  Escribiendo título del exhibit…')
      const p = new URLSearchParams()
      p.set('_charset_', 'utf-8')
      p.set('./jcr:primaryType', 'nt:unstructured')
      p.set('./sling:resourceType', 'webmasters-aem/components/richtexteditor')
      p.set('./text', html)
      p.set('./text@TypeHint', 'String')
      p.set('./derivedDom', html)
      p.set('./derivedDom@TypeHint', 'String')
      p.set('./textAsJson', textAsJson)
      p.set('./textAsJson@TypeHint', 'String')
      p.set('./textIsRich', 'true')

      const res = await fetch(titlePath, {
        method: 'POST',
        headers: {
          'CSRF-Token': token,
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        body: p.toString(),
      })
      if (res.ok) log('  Título escrito ✓')
      else logErr('  Error título: HTTP ' + res.status)
    }

    // Image component
    if (block.desktopFilename) {
      const imgPath = gridPath + '/image'
      log('  Configurando imagen…')
      const p = new URLSearchParams()
      p.set('_charset_', 'utf-8')
      p.set('./jcr:primaryType', 'nt:unstructured')
      p.set('./sling:resourceType', 'webmasters-aem/components/image')
      p.set('./fileReference', damBase + '/' + block.desktopFilename)
      p.set('./fileReference@TypeHint', 'String')
      if (block.mobileFilename) {
        p.set('./mobileImage', damBase + '/' + block.mobileFilename)
        p.set('./mobileImage@TypeHint', 'String')
      }
      p.set('./imageWidth', 'native')
      p.set('./imageAlignment', 'left-align')
      p.set('./altTextDesktopCheck', 'false')
      p.set('./altTextMobileCheck', 'false')
      if (block.title) {
        p.set('./altText', block.title)
        p.set('./altTextMobile', block.title)
      }

      const res = await fetch(imgPath, {
        method: 'POST',
        headers: {
          'CSRF-Token': token,
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        body: p.toString(),
      })
      if (res.ok) log('  Imagen configurada ✓ → ' + block.desktopFilename)
      else logErr('  Error imagen: HTTP ' + res.status)
    }

    // Caption RTE
    if (block.caption) {
      const capPath = gridPath + '/richtexteditor_caption'
      const { html, textAsJson } = buildCaptionPayload(block.caption)
      log('  Escribiendo caption…')
      const p = new URLSearchParams()
      p.set('_charset_', 'utf-8')
      p.set('./jcr:primaryType', 'nt:unstructured')
      p.set('./sling:resourceType', 'webmasters-aem/components/richtexteditor')
      p.set('./text', html)
      p.set('./text@TypeHint', 'String')
      p.set('./derivedDom', html)
      p.set('./derivedDom@TypeHint', 'String')
      p.set('./textAsJson', textAsJson)
      p.set('./textAsJson@TypeHint', 'String')
      p.set('./textIsRich', 'true')

      const res = await fetch(capPath, {
        method: 'POST',
        headers: {
          'CSRF-Token': token,
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        body: p.toString(),
      })
      if (res.ok) log('  Caption escrito ✓')
      else logErr('  Error caption: HTTP ' + res.status)
    }
  }

  // ── Interactive Exhibit Block: RTE (title) + VegaEmbedChart + RTE (caption)
  async function createInteractiveExhibitBlock(gridPath, block, damBase, token, log, logErr) {
    // Title RTE (same as static)
    if (block.title) {
      const titlePath = gridPath + '/richtexteditor_title'
      const { html, textAsJson } = buildExhibitTitlePayload(block.title)
      log('  Escribiendo título del interactive…')
      const p = new URLSearchParams()
      p.set('_charset_', 'utf-8')
      p.set('./jcr:primaryType', 'nt:unstructured')
      p.set('./sling:resourceType', 'webmasters-aem/components/richtexteditor')
      p.set('./text', html)
      p.set('./text@TypeHint', 'String')
      p.set('./derivedDom', html)
      p.set('./derivedDom@TypeHint', 'String')
      p.set('./textAsJson', textAsJson)
      p.set('./textAsJson@TypeHint', 'String')
      p.set('./textIsRich', 'true')

      const res = await fetch(titlePath, {
        method: 'POST',
        headers: {
          'CSRF-Token': token,
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        body: p.toString(),
      })
      if (res.ok) log('  Título escrito ✓')
      else logErr('  Error título: HTTP ' + res.status)
    }

    // VegaEmbedChart component
    if (block.jsonFilename) {
      const vegaPath = gridPath + '/vegaembedchart'
      log('  Configurando Vega chart…')
      const p = new URLSearchParams()
      p.set('_charset_', 'utf-8')
      p.set('./jcr:primaryType', 'nt:unstructured')
      p.set('./sling:resourceType', 'webmasters-aem/components/vegaEmbedChart')
      p.set('./jsonUrl', damBase + '/' + block.jsonFilename)
      p.set('./jsonUrl@TypeHint', 'String')

      const res = await fetch(vegaPath, {
        method: 'POST',
        headers: {
          'CSRF-Token': token,
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        body: p.toString(),
      })
      if (res.ok) log('  Vega chart configurado ✓ → ' + block.jsonFilename)
      else logErr('  Error vega chart: HTTP ' + res.status)
    }

    // Caption RTE
    if (block.caption) {
      const capPath = gridPath + '/richtexteditor_caption'
      const { html, textAsJson } = buildCaptionPayload(block.caption)
      log('  Escribiendo caption…')
      const p = new URLSearchParams()
      p.set('_charset_', 'utf-8')
      p.set('./jcr:primaryType', 'nt:unstructured')
      p.set('./sling:resourceType', 'webmasters-aem/components/richtexteditor')
      p.set('./text', html)
      p.set('./text@TypeHint', 'String')
      p.set('./derivedDom', html)
      p.set('./derivedDom@TypeHint', 'String')
      p.set('./textAsJson', textAsJson)
      p.set('./textAsJson@TypeHint', 'String')
      p.set('./textIsRich', 'true')

      const res = await fetch(capPath, {
        method: 'POST',
        headers: {
          'CSRF-Token': token,
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        body: p.toString(),
      })
      if (res.ok) log('  Caption escrito ✓')
      else logErr('  Error caption: HTTP ' + res.status)
    }
  }

  // ── HTML → AEM RTE payload converters ──────────────────────────────
  // These must produce BOTH `html` (text/derivedDom) and `textAsJson`
  // in the exact format AEM's richtexteditor dialog expects.

  function buildBodyRtePayload(rawHtml) {
    // Parse the raw body HTML and convert to AEM format
    const BODY_CLASS = 'ms-body-l-sm lg:ms-body-l-lg ms-font-regular'
    const H2_CLASS = 'ms-headline-2-sm lg:ms-headline-2-lg ms-font-semibold'
    const H3_CLASS = 'ms-headline-3-sm lg:ms-headline-3-lg ms-font-semibold'

    // Build HTML with MSCI span classes
    let html = rawHtml || ''
    // Wrap h2 content in styled span
    html = html.replace(/<h2>([\s\S]*?)<\/h2>/gi, (_, inner) =>
      `<h2><span class='${H2_CLASS}'>${inner}</span></h2>`
    )
    html = html.replace(/<h3>([\s\S]*?)<\/h3>/gi, (_, inner) =>
      `<h3><span class='${H3_CLASS}'>${inner}</span></h3>`
    )
    // Wrap paragraph content in styled span (skip already-wrapped ones)
    html = html.replace(/<p>([\s\S]*?)<\/p>/gi, (match, inner) => {
      if (inner.includes(H2_CLASS) || inner.includes(H3_CLASS)) return match
      return `<p><span class='${BODY_CLASS}'>${inner}</span></p>`
    })

    // Build textAsJson AST
    const astChildren = htmlToAstChildren(rawHtml, BODY_CLASS, H2_CLASS, H3_CLASS)
    const textAsJson = JSON.stringify({ root: { children: astChildren } })

    return { html, textAsJson }
  }

  function buildExhibitTitlePayload(title) {
    const TITLE_CLASS = 'ms-headline-3-sm lg:ms-headline-3-lg ms-font-semibold'
    const html = `<p><span class='${TITLE_CLASS}'>${escText(title)}</span></p>`
    const textAsJson = JSON.stringify({
      root: {
        children: [
          {
            tag: 'P',
            className: '',
            tailwindStyles: '',
            typography: '',
            color: '',
            children: [
              {
                tag: 'SPAN',
                className: TITLE_CLASS,
                tailwindStyles: '',
                typography: '',
                color: '',
                children: [{ tag: 'text', textContent: title }],
              },
            ],
          },
        ],
      },
    })
    return { html, textAsJson }
  }

  function buildCaptionPayload(caption) {
    const CAP_CLASS = 'ms-body-s-sm lg:ms-body-s-lg ms-font-regular'
    const html = `<p><span class='${CAP_CLASS}'>${escText(caption)}</span></p>`
    const textAsJson = JSON.stringify({
      root: {
        children: [
          {
            tag: 'P',
            className: '',
            tailwindStyles: '',
            typography: '',
            color: '',
            children: [
              {
                tag: 'SPAN',
                className: CAP_CLASS,
                tailwindStyles: '',
                typography: '',
                color: '',
                children: [{ tag: 'text', textContent: caption }],
              },
            ],
          },
        ],
      },
    })
    return { html, textAsJson }
  }

  function escText(s) {
    return (s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  /**
   * Parse raw HTML body block into AEM textAsJson AST children.
   * Uses the browser DOM to parse the HTML, then walks the DOM tree.
   */
  function htmlToAstChildren(rawHtml, bodyClass, h2Class, h3Class) {
    const tmp = document.createElement('div')
    tmp.innerHTML = rawHtml || ''
    const children = []

    for (const el of tmp.children) {
      const tag = el.tagName
      let spanClass = bodyClass
      if (tag === 'H2') spanClass = h2Class
      else if (tag === 'H3') spanClass = h3Class

      children.push({
        tag: tag,
        className: '',
        tailwindStyles: '',
        typography: '',
        color: '',
        children: [
          {
            tag: 'SPAN',
            className: spanClass,
            tailwindStyles: '',
            typography: '',
            color: '',
            children: walkInlineChildren(el),
          },
        ],
      })
    }
    return children
  }

  /**
   * Walk inline children (text, strong, em, a, sup) and convert to AST nodes.
   */
  function walkInlineChildren(el) {
    const result = []
    for (const node of el.childNodes) {
      if (node.nodeType === 3) {
        // Text node
        const text = node.textContent
        if (text) result.push({ tag: 'text', textContent: text })
      } else if (node.nodeType === 1) {
        // Element node
        const tag = node.tagName
        const astNode = {
          tag: tag,
          className: '',
          tailwindStyles: '',
          typography: '',
          color: '',
          children: walkInlineChildren(node),
        }
        if (tag === 'A') {
          astNode.href = node.getAttribute('href') || ''
          astNode.target = node.getAttribute('target') || ''
        }
        result.push(astNode)
      }
    }
    return result
  }
}
