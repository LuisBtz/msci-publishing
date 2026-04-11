// Service worker for the MSCI AEM Publisher side panel.
//
// The side panel sends structured publish/create requests; we inject the
// matching runner function into the active AEM Author tab's MAIN world via
// chrome.scripting. Running in MAIN world means the script executes with the
// user's AEM session cookies. Arguments are passed natively, so the page's
// CSP (eval / inline-script) doesn't matter.

const AEM_HOST_PREFIX = 'https://author-p125318-e1369672.adobeaemcloud.com'

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })

async function getActiveAEMTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.url?.startsWith(AEM_HOST_PREFIX)) return null
  return tab
}

// Find an open AEM editor.html tab for a specific page path. Looks across
// every window because the user often opens the editor in a separate tab
// via target="_blank" and then switches focus back to Sites/Assets to use
// the side panel. The active tab in that case is NOT the editor, so we
// need to locate the editor tab explicitly to inject the refresh script.
//
// Returns { tab, diag } where diag describes what we saw, so the caller
// can surface a useful message in the side-panel log when nothing matches.
async function findEditorTabForPage(slug) {
  const diag = { totalAemTabs: 0, totalEditorTabs: 0, urls: [], reason: '' }

  // Always query everything and filter manually. URL match patterns in
  // chrome.tabs.query are picky and we observed them returning 0 results
  // even when the editor was clearly open.
  const allTabs = await chrome.tabs.query({})
  const aemTabs = allTabs.filter(t => t.url && t.url.startsWith(AEM_HOST_PREFIX))
  const editorTabs = aemTabs.filter(t => t.url.includes('/editor.html/'))

  diag.totalAemTabs = aemTabs.length
  diag.totalEditorTabs = editorTabs.length
  // Show ALL aem tabs (up to 8) so the user can see why the editor wasn't found
  diag.urls = aemTabs.slice(0, 8).map(t => t.url)

  if (!editorTabs.length) {
    diag.reason = aemTabs.length
      ? `no editor.html tab open (saw ${aemTabs.length} other AEM tab(s) — Sites/Assets view doesn't have Granite.author)`
      : 'no AEM tabs open at all'
    return { tab: null, diag }
  }

  // Permissive match: any editor.html tab whose URL contains the slug.
  const match = editorTabs.find(t => t.url.includes('/' + slug + '.html')) ||
                editorTabs.find(t => t.url.includes('/' + slug))

  if (!match) {
    diag.reason = `${editorTabs.length} editor.html tab(s) open, none matching slug "${slug}"`
    return { tab: null, diag }
  }

  return { tab: match, diag }
}

async function runInPage(func, args) {
  const tab = await getActiveAEMTab()
  if (!tab) return { success: false, error: 'Not on AEM Author tab. Open AEM in the active tab.' }
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'ISOLATED',
      func,
      args
    })
    return injection?.result || { success: false, error: 'No result from page' }
  } catch (err) {
    return { success: false, error: 'Injection failed: ' + err.message }
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'PING_AEM') {
    ;(async () => {
      const tab = await getActiveAEMTab()
      sendResponse({ success: true, connected: !!tab })
    })()
    return true
  }

  if (message.type === 'PUBLISH_ASSETS') {
    ;(async () => {
      const result = await runInPage(publishAssetsInAEM, [message.slug, message.title, message.exhibitAssets, message.bannerAssets])
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

  if (message.type === 'INSERT_KEY_FINDINGS') {
    ;(async () => {
      const result = await runInPage(insertKeyFindingsInAEM, [message.slug, message.html, message.textAsJson])

      // After writing content, refresh the editor tab so the user sees
      // the new content without having to F5. The editor tab is often
      // separate from the active tab (opened from step 3 with target=_blank),
      // so we scan all windows for it. AEM Cloud loads editor.html inside
      // an iframe of the /ui SPA shell, so we inject into all frames and
      // pick the one that actually has Granite.author.
      //
      // High-level status goes to the side panel; detailed diagnostics
      // (frame URLs, available APIs, persist errors) go to the AEM editor
      // tab's DevTools console.
      if (result.success && result.targetPath) {
        const { tab: editorTab, diag } = await findEditorTabForPage(message.slug)
        console.log('[KeyFindings] tab search', diag)

        if (!editorTab) {
          result.logs.push({
            type: 'warn',
            message: 'No se encontró el editor abierto — abre "Edit page in AEM" en el paso 3 y vuelve a intentar.'
          })
        } else {
          try {
            const injectionResults = await chrome.scripting.executeScript({
              target: { tabId: editorTab.id, allFrames: true },
              world: 'MAIN',
              func: async (componentPath, html) => {
                const out = { frameUrl: location.href }
                const ns = window.Granite && window.Granite.author
                if (!ns || !ns.editables) {
                  console.debug('[KeyFindings/refresh] no Granite.author in', location.href)
                  return out
                }
                out.hasGraniteAuthor = true

                // Locate the editable by exact path match (with a /jcr:content fallback).
                const total = ns.editables.length || 0
                let editable = null
                for (let i = 0; i < total; i++) {
                  const ed = ns.editables[i]
                  if (ed && ed.path === componentPath) { editable = ed; break }
                }
                if (!editable) {
                  const altPath = componentPath.replace('/jcr:content/', '/')
                  for (let i = 0; i < total; i++) {
                    const ed = ns.editables[i]
                    if (ed && ed.path === altPath) { editable = ed; break }
                  }
                }
                if (!editable) {
                  console.warn('[KeyFindings/refresh] editable not found for', componentPath, '(total=' + total + ')')
                  out.reason = 'Editable not found'
                  return out
                }

                console.log('[KeyFindings/refresh] persistence APIs:', ns.persistence ? Object.keys(ns.persistence) : 'none')

                // PRIMARY: save via Granite.author.persistence so AEM runs
                // the same persistence path the dialog Done uses.
                try {
                  if (ns.persistence && typeof ns.persistence.updateParagraph === 'function') {
                    const ret = ns.persistence.updateParagraph(editable, { text: html, textIsRich: true, _charset_: 'utf-8' })
                    if (ret && typeof ret.then === 'function') await ret
                    out.persistMethod = 'persistence.updateParagraph'
                  }
                } catch (e) {
                  out.persistError = e.message || String(e)
                  console.error('[KeyFindings/refresh] persistence.updateParagraph failed', e)
                }

                // Refresh the editor view so the new content shows immediately.
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
              },
              args: [result.targetPath, message.html]
            })

            const chosen =
              (injectionResults || []).map(i => i?.result).find(r => r && r.persistMethod) ||
              (injectionResults || []).map(i => i?.result).find(r => r && r.hasGraniteAuthor) ||
              (injectionResults || []).map(i => i?.result).find(Boolean) || {}
            console.log('[KeyFindings] refresh result', chosen, 'frames=', injectionResults?.length)

            if (chosen.persistMethod) {
              result.logs.push({ type: 'log', message: 'Vista previa actualizada.' })
            } else if (chosen.refreshMethod) {
              result.logs.push({ type: 'log', message: 'Editor refrescado, pero la vista previa puede tardar en actualizarse.' })
            } else {
              result.logs.push({ type: 'warn', message: 'No se pudo refrescar el editor automáticamente — refresca la pestaña manualmente.' })
            }
          } catch (e) {
            console.error('[KeyFindings] refresh injection failed', e)
            result.logs.push({ type: 'warn', message: 'No se pudo refrescar el editor automáticamente.' })
          }
        }
      }

      sendResponse(result)
    })()
    return true
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// Functions injected into the AEM page's MAIN world.
//
// These must be SELF-CONTAINED — chrome.scripting serializes them via
// Function.prototype.toString() and re-parses them in the page, so closure
// references won't work. They collect log entries into a local array and
// return { success, logs, error? } so the side panel can render them.
// ═══════════════════════════════════════════════════════════════════════════

async function publishAssetsInAEM(slug, title, exhibitAssets, bannerAssets) {
  const logs = []
  const log = (m) => logs.push({ type: 'log', message: m })
  const logErr = (m) => logs.push({ type: 'error', message: m })
  const logWarn = (m) => logs.push({ type: 'warn', message: m })

  try {
    log('🔑 Fetching CSRF token...')
    const token = (await fetch('/libs/granite/csrf/token.json').then(r => r.json())).token
    if (!token) throw new Error('Could not get CSRF token')

    const apiBase = '/api/assets/web/msci-com/research-and-insights/blog-post'
    const damBase = '/content/dam/web/msci-com/research-and-insights/blog-post'
    const mimeMap = { webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', svg: 'image/svg+xml', json: 'application/json' }

    async function createFolder(path, folderTitle) {
      const r = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CSRF-Token': token },
        body: JSON.stringify({ class: 'assetFolder', properties: { title: folderTitle } })
      })
      return r.status
    }

    async function uploadAsset(sourceUrl, damFolderPath, filename) {
      try {
        const srcRes = await fetch(sourceUrl)
        if (!srcRes.ok) return { ok: false, detail: 'source fetch failed: HTTP ' + srcRes.status }
        const buffer = await srcRes.arrayBuffer()
        if (!buffer.byteLength) return { ok: false, detail: 'empty response from source URL' }
        const ext = filename.split('.').pop().toLowerCase()
        const mime = mimeMap[ext] || 'application/octet-stream'

        const initRes = await fetch(damFolderPath + '.initiateUpload.json', {
          method: 'POST',
          headers: { 'CSRF-Token': token, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ fileName: filename, fileSize: String(buffer.byteLength) }).toString()
        })
        if (!initRes.ok) {
          const txt = await initRes.text()
          return { ok: false, detail: 'initiate failed HTTP ' + initRes.status + ': ' + txt.slice(0, 200) }
        }
        const initData = await initRes.json()
        const fileInfo = initData.files && initData.files[0]
        if (!fileInfo || !fileInfo.uploadURIs || !fileInfo.uploadURIs.length) return { ok: false, detail: 'no uploadURIs in response' }

        const putRes = await fetch(fileInfo.uploadURIs[0], {
          method: 'PUT',
          headers: { 'Content-Type': mime },
          body: buffer
        })
        if (!putRes.ok) return { ok: false, detail: 'blob PUT failed: HTTP ' + putRes.status }

        const completeRes = await fetch(initData.completeURI, {
          method: 'POST',
          headers: { 'CSRF-Token': token, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ fileName: filename, fileSize: String(buffer.byteLength), mimeType: mime, uploadToken: fileInfo.uploadToken, replace: 'true' }).toString()
        })
        return { ok: completeRes.ok, status: completeRes.status, size: buffer.byteLength, mime }
      } catch (e) { return { ok: false, detail: e.message } }
    }

    function logResult(filename, res) {
      if (res.ok) log(`   ✅ ${filename} (${Math.round(res.size / 1024)}KB, ${res.mime})`)
      else logErr(`   ❌ ${filename} — ${res.detail || 'HTTP ' + res.status}`)
    }

    let s
    log('📁 Step 1: Creating folder structure')
    s = await createFolder(`${apiBase}/${slug}`, title)
    log('   Article folder: ' + (s === 201 ? '✅ Created' : s === 409 ? '⚠ Already exists' : '❌ HTTP ' + s))
    s = await createFolder(`${apiBase}/${slug}/exhibits`, 'Exhibits')
    log('   Exhibits folder: ' + (s === 201 ? '✅ Created' : s === 409 ? '⚠ Already exists' : '❌ HTTP ' + s))
    s = await createFolder(`${apiBase}/${slug}/banners`, 'Banners')
    log('   Banners folder: ' + (s === 201 ? '✅ Created' : s === 409 ? '⚠ Already exists' : '❌ HTTP ' + s))

    log(`\n📤 Step 2: Uploading ${exhibitAssets.length} exhibit(s)...`)
    if (exhibitAssets.length === 0) logWarn('   No exhibits to upload')
    for (let i = 0; i < exhibitAssets.length; i++) {
      const a = exhibitAssets[i]
      log(`   [${i + 1}/${exhibitAssets.length}] Uploading ${a.filename}...`)
      logResult(a.filename, await uploadAsset(a.url, `${damBase}/${slug}/exhibits`, a.filename))
    }

    log(`\n📤 Step 3: Uploading ${bannerAssets.length} banner(s)...`)
    if (bannerAssets.length === 0) logWarn('   No banners to upload')
    for (let i = 0; i < bannerAssets.length; i++) {
      const a = bannerAssets[i]
      log(`   [${i + 1}/${bannerAssets.length}] Uploading ${a.filename}...`)
      logResult(a.filename, await uploadAsset(a.url, `${damBase}/${slug}/banners`, a.filename))
    }

    log(`\n✅ All done! View at: /ui#/aem/assets.html${damBase}/${slug}`)
    return { success: true, logs }
  } catch (err) {
    logErr('💥 Fatal error: ' + err.message)
    return { success: false, logs, error: err.message }
  }
}

async function createPageInAEM(params) {
  const logs = []
  const log = (m) => logs.push({ type: 'log', message: m })
  const logErr = (m) => logs.push({ type: 'error', message: m })
  const logWarn = (m) => logs.push({ type: 'warn', message: m })

  try {
    const { slug, title, metaDesc, readTime, publishDate, authorPaths, tags, thumbnailDamPath } = params

    log('🔑 Fetching CSRF token...')
    const token = (await fetch('/libs/granite/csrf/token.json').then(r => r.json())).token
    if (!token) throw new Error('Could not get CSRF token')

    const templatePath = '/conf/webmasters-aem/settings/wcm/templates/research-page2'
    const parentPath = '/content/msci/us/en/research-and-insights/blog-post'
    const pagePath = parentPath + '/' + slug
    const jcrContent = pagePath + '/jcr:content'
    const siblingBase = '/content/msci/us/en/research-and-insights/blog-post'

    async function post_(path, p) {
      return fetch(path, { method: 'POST', headers: { 'CSRF-Token': token, 'Content-Type': 'application/x-www-form-urlencoded' }, body: p.toString() })
    }
    const ok = r => r.status === 200 || r.status === 201

    log('🔍 Discovering sibling page properties...')
    let siblingProps = null
    let siblingAuthors = null
    try {
      const list = await fetch(siblingBase + '.1.json', { headers: { 'CSRF-Token': token } }).then(r => r.json())
      for (const key of Object.keys(list).filter(k => !k.startsWith('jcr:') && !k.startsWith(':')).slice(0, 20)) {
        try {
          const props = await fetch(siblingBase + '/' + key + '/jcr:content.2.json', { headers: { 'CSRF-Token': token } }).then(r => r.json())
          const authRes = await fetch(siblingBase + '/' + key + '/jcr:content/authors.2.json', { headers: { 'CSRF-Token': token } })
          if (authRes.ok) { siblingAuthors = await authRes.json(); siblingProps = props; break }
        } catch (e) {}
      }
    } catch (e) {}

    log(`\n1️⃣ Creating page "${slug}"...`)
    const s = (await fetch('/bin/wcmcommand', {
      method: 'POST',
      headers: { 'CSRF-Token': token, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ cmd: 'createPage', parentPath, title, label: slug, template: templatePath }).toString()
    })).status
    if (s === 200 || s === 201) log('   ✅ Created')
    else if (s === 500) logWarn('   ⚠️ Already exists — updating properties')
    else { logErr('   ❌ Failed: HTTP ' + s); return { success: false, logs, error: 'Page creation failed' } }

    let r
    log('\n2️⃣ Setting description...')
    try {
      r = await post_(jcrContent, new URLSearchParams({ 'jcr:description': metaDesc || '' }))
      log('   Description: ' + (ok(r) ? '✅' : '❌ HTTP ' + r.status))
    } catch (e) { logErr('   ❌ ' + e.message) }

    log('\n3️⃣ Setting display date...')
    try {
      if (!publishDate) { logWarn('   ⚠️ No publication date — skipping') }
      else {
        const p = new URLSearchParams({ displayDate: publishDate + 'T00:00:00.000Z', 'displayDate@TypeHint': 'Date' })
        r = await post_(jcrContent, p)
        log('   Display date: ' + (ok(r) ? '✅ ' + publishDate : '❌ HTTP ' + r.status))
      }
    } catch (e) { logErr('   ❌ ' + e.message) }

    log('\n4️⃣ Setting read time...')
    try {
      const rt = readTime || 0
      if (!rt) { logWarn('   ⚠️ No read time — skipping') }
      else {
        const rtCandidates = ['time', 'readListenWatchTime', 'readTime', 'rlwTime']
        const rtProp = (siblingProps && rtCandidates.find(c => c in siblingProps && Number(siblingProps[c]) > 0)) || 'time'
        r = await post_(jcrContent, new URLSearchParams({ [rtProp]: String(rt), [rtProp + '@TypeHint']: 'Long' }))
        log('   Read time: ' + (ok(r) ? '✅ ' + rt + ' min' : '❌ HTTP ' + r.status))
      }
    } catch (e) { logErr('   ❌ ' + e.message) }

    log('\n5️⃣ Setting authors...')
    try {
      if (!authorPaths || !authorPaths.length) { logWarn('   ⚠️ No authors — skipping') }
      else {
        let authorProp = null
        if (siblingAuthors) {
          const items = Object.keys(siblingAuthors).filter(k => k.startsWith('item'))
          if (items.length) {
            const props = Object.keys(siblingAuthors[items[0]]).filter(k => !k.startsWith('jcr:') && !k.startsWith('sling:') && !k.startsWith(':'))
            if (props.length) authorProp = props[0]
          }
        }
        if (!authorProp) {
          const probePath = jcrContent + '/authors/__probe__'
          for (const c of ['profilePath', 'fragmentPath', 'contentFragment', 'fileReference', 'author']) {
            await fetch(probePath, { method: 'POST', headers: { 'CSRF-Token': token, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ 'jcr:primaryType': 'nt:unstructured', [c]: '/probe' }).toString() })
            const probe = await fetch(probePath + '.json', { headers: { 'CSRF-Token': token } }).then(r => r.json()).catch(() => ({}))
            if (probe[c] === '/probe') { authorProp = c; break }
          }
          await fetch(probePath, { method: 'POST', headers: { 'CSRF-Token': token, 'Content-Type': 'application/x-www-form-urlencoded' }, body: ':operation=delete' })
          if (!authorProp) authorProp = 'profilePath'
        }

        await fetch(jcrContent + '/authors', { method: 'POST', headers: { 'CSRF-Token': token, 'Content-Type': 'application/x-www-form-urlencoded' }, body: ':operation=delete' })
        for (let i = 0; i < authorPaths.length; i++) {
          r = await fetch(jcrContent + '/authors/item' + i, { method: 'POST', headers: { 'CSRF-Token': token, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ 'jcr:primaryType': 'nt:unstructured', [authorProp]: authorPaths[i] }).toString() })
          log('   Author ' + (i + 1) + ': ' + (ok(r) ? '✅' : '❌ HTTP ' + r.status) + ' ' + authorPaths[i].split('/').pop())
        }
      }
    } catch (e) { logErr('   ❌ ' + e.message) }

    log('\n6️⃣ Setting thumbnail...')
    try {
      if (!thumbnailDamPath) { logWarn('   ⚠️ No 1x1 banner — skipping') }
      else {
        r = await post_(jcrContent + '/cq:featuredimage', new URLSearchParams({ fileReference: thumbnailDamPath }))
        log('   cq:featuredimage: ' + (ok(r) ? '✅' : '❌ HTTP ' + r.status))
        r = await post_(jcrContent + '/image', new URLSearchParams({ fileReference: thumbnailDamPath }))
        log('   image: ' + (ok(r) ? '✅' : '❌ HTTP ' + r.status))

        if (siblingProps) {
          const extraNodes = Object.entries(siblingProps).filter(([k, v]) =>
            typeof v === 'object' && v !== null && typeof v.fileReference === 'string' &&
            v.fileReference.includes('/content/dam/') && k !== 'image' && k.toLowerCase() !== 'cq:featuredimage'
          )
          for (const [nodeName] of extraNodes) {
            r = await post_(jcrContent + '/' + nodeName, new URLSearchParams({ fileReference: thumbnailDamPath }))
            log('   ' + nodeName + ': ' + (ok(r) ? '✅' : '❌ HTTP ' + r.status))
          }
        }
      }
    } catch (e) { logErr('   ❌ ' + e.message) }

    log('\n7️⃣ Setting tags...')
    try {
      const catToNs = {
        'asset class': 'asset-class', 'research format': 'research-format', 'format': 'research-format',
        'line of business': 'line-of-business', 'theme': 'theme', 'topic': 'topic',
        'marketing program': 'marketing-program', 'campaign': 'page_campaign', 'research type': 'research-type', 'type': 'research-type'
      }
      const researchTypeMap = { 'commentary': 'commentary', 'insights in action': 'product-insight', 'research insights': 'research', 'blog': 'blog' }
      function slugify(str) { return str.toLowerCase().trim().replace(/&/g, '-and-').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') }
      function resolveSlug(namespace, value) {
        if (namespace === 'page_campaign') { const pi = value.indexOf('('); const raw = pi !== -1 ? value.substring(0, pi).trim() : value.trim(); return slugify(raw) }
        if (namespace === 'research-type') { const mapped = researchTypeMap[value.toLowerCase().trim()]; if (mapped) return mapped }
        return slugify(value)
      }

      const pageJson = await fetch(jcrContent + '.json', { headers: { 'CSRF-Token': token } }).then(r => r.json())
      const existingTags = Array.isArray(pageJson['cq:tags']) ? pageJson['cq:tags'] : pageJson['cq:tags'] ? [pageJson['cq:tags']] : []
      log('   Existing tags (' + existingTags.length + ')')

      const newTags = []
      const skipped = []
      const notFound = []

      for (const tag of (tags || [])) {
        const sep = tag.indexOf(' : ')
        if (sep === -1) { notFound.push({ tag, reason: 'bad format' }); continue }
        const category = tag.substring(0, sep).trim()
        const value = tag.substring(sep + 3).trim()
        const namespace = catToNs[category.toLowerCase()]
        if (!namespace) { notFound.push({ tag, reason: 'unknown category "' + category + '"' }); continue }
        const valueSlug = resolveSlug(namespace, value)
        const tagId = namespace + ':' + valueSlug
        if (existingTags.includes(tagId)) { skipped.push({ tag, tagId }); continue }
        const check = await fetch('/content/cq:tags/' + namespace + '/' + valueSlug + '.json', { headers: { 'CSRF-Token': token } })
        if (check.ok) { newTags.push({ tag, tagId }); log('   ✅ "' + tag + '" → ' + tagId) }
        else { notFound.push({ tag, reason: tagId + ' not found (HTTP ' + check.status + ')' }) }
      }

      if (skipped.length) { log('   ⏭ Already on page: ' + skipped.length); skipped.forEach(t => log('     • ' + t.tag)) }
      if (notFound.length) { logWarn('   ⚠️ Skipped (not found): ' + notFound.length); notFound.forEach(t => logWarn('     • ' + t.tag + ' — ' + t.reason)) }

      if (newTags.length === 0) { log('   No new tags to add.') }
      else {
        const allTags = [...existingTags, ...newTags.map(t => t.tagId)]
        log('   Saving ' + allTags.length + ' total...')
        const p = new URLSearchParams()
        allTags.forEach(t => p.append('cq:tags', t))
        p.set('cq:tags@TypeHint', 'String[]')
        r = await post_(jcrContent, p)
        log('   Tags save: ' + (r.status === 200 ? '✅ Done' : '❌ HTTP ' + r.status))
      }
    } catch (e) { logErr('   ❌ Tags error: ' + e.message) }

    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    log('📝 Edit page: /editor.html' + pagePath + '.html')
    log('📂 Sites view: /ui#/aem/sites.html' + parentPath)
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    return { success: true, logs }
  } catch (err) {
    logErr('💥 Fatal error: ' + err.message)
    return { success: false, logs, error: err.message }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// INSERT KEY FINDINGS — finds the first empty RTE after the "Key findings"
// heading RTE in the page's component tree and writes the HTML into it.
//
// AEM text/RTE components use sling:resourceType values that typically
// contain 'text' in the last segment (e.g. core/wcm/components/text,
// webmasters-aem/components/text, etc). We must exclude non-RTE nodes
// like contentfragment, image, title, etc. that may also carry a 'text'
// property.
// ═══════════════════════════════════════════════════════════════════════════
// Insert a "Key findings" bullet list into a blog-post page.
//
// This function is INJECTED into the AEM tab via chrome.scripting (ISOLATED
// world), so it must be self-contained — no closure references.
//
// User-facing logs go into the `logs` array (rendered in the side panel).
// Detailed technical logs go to `console.*` so they show up in the AEM
// tab's DevTools console for debugging without cluttering the side panel.
//
// Property shape and the textAsJson AST format are documented in
// memory/project_insert_key_findings_wip.md — change with care.
async function insertKeyFindingsInAEM(slug, html, textAsJson) {
  const logs = []
  const log = (m) => logs.push({ type: 'log', message: m })
  const logErr = (m) => logs.push({ type: 'error', message: m })
  const logWarn = (m) => logs.push({ type: 'warn', message: m })

  console.groupCollapsed('[KeyFindings] insert into ' + slug)
  try {
    log('Conectando con AEM…')
    const token = (await fetch('/libs/granite/csrf/token.json').then(r => r.json())).token
    if (!token) throw new Error('No se pudo obtener el token CSRF')

    const parentPath = '/content/msci/us/en/research-and-insights/blog-post'
    const jcrContent = parentPath + '/' + slug + '/jcr:content'

    log('Buscando el componente "Key findings" en la página…')
    const pageTree = await fetch(jcrContent + '.infinity.json', {
      headers: { 'CSRF-Token': token }
    }).then(r => r.json())
    if (!pageTree) throw new Error('No se pudo leer la página')

    // ── Walk the JCR tree and collect every richtexteditor node, in
    //    document order, so we can find the heading + its sibling target.
    const RTE_TYPE = 'webmasters-aem/components/richtexteditor'
    const rteNodes = []
    function walk(node, path) {
      if (!node || typeof node !== 'object') return
      if ((node['sling:resourceType'] || '') === RTE_TYPE) {
        rteNodes.push({
          path,
          text: typeof node.text === 'string' ? node.text : '',
          nodeName: path.substring(path.lastIndexOf('/') + 1)
        })
      }
      for (const [k, v] of Object.entries(node)) {
        if (k.startsWith('jcr:') || k.startsWith('sling:') || k.startsWith('cq:') || k.startsWith(':')) continue
        if (typeof v === 'object' && v !== null && !Array.isArray(v)) walk(v, path + '/' + k)
      }
    }
    walk(pageTree, jcrContent)

    console.log('[KeyFindings] RTEs encontrados:', rteNodes.length)
    console.table(rteNodes.map(n => ({
      nodeName: n.nodeName,
      preview: n.text.replace(/<[^>]+>/g, '').substring(0, 60),
      path: n.path
    })))

    if (rteNodes.length === 0) {
      logErr('No se encontraron componentes de texto enriquecido en esta página.')
      return { success: false, logs, error: 'No RTE components found' }
    }

    // ── Locate the "Key findings" heading and its sibling target ──
    // The target is the next RTE within the SAME parent container as
    // the heading. If we can't find that, fall back to the first empty
    // RTE on the page.
    let kfIdx = -1
    for (let i = 0; i < rteNodes.length; i++) {
      const plain = rteNodes[i].text.replace(/<[^>]+>/g, '').toLowerCase().trim()
      if (plain.includes('key finding')) { kfIdx = i; break }
    }

    let targetNode = null
    if (kfIdx !== -1 && kfIdx + 1 < rteNodes.length) {
      const kfParent = rteNodes[kfIdx].path.substring(0, rteNodes[kfIdx].path.lastIndexOf('/'))
      const next = rteNodes[kfIdx + 1]
      const nextParent = next.path.substring(0, next.path.lastIndexOf('/'))
      if (kfParent === nextParent) targetNode = next
    }
    if (!targetNode) {
      targetNode = rteNodes.find(n => !n.text.replace(/<[^>]+>/g, '').trim())
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

    // ── Build the Sling POST payload ──
    // The webmasters-aem RTE has 4 properties that matter:
    //   text         — source HTML (dialog)
    //   derivedDom   — rendered HTML (editor view); equals `text` for bullets
    //   textAsJson   — JSON AST (preview / published renderer)
    //   textIsRich   — string "true"
    // The textAsJson AST shape is built in sidepanel.js
    // buildKeyFindingsPayload() to match what AEM's dialog Done emits.
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
    console.log('[KeyFindings] payload fields:', [...writeParams.keys()].filter(k => k.startsWith('./')))

    const res = await fetch(targetNode.path, {
      method: 'POST',
      headers: {
        'CSRF-Token': token,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
      },
      body: writeParams.toString()
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('[KeyFindings] write failed', res.status, errText)
      logErr('No se pudo escribir el contenido (HTTP ' + res.status + ').')
      return { success: false, logs, error: 'Write failed: HTTP ' + res.status }
    }

    // Verify the write — only failures surface to the side panel; the
    // full property shapes go to the DevTools console.
    try {
      const verify = await fetch(targetNode.path + '.json', {
        headers: { 'CSRF-Token': token }
      }).then(r => r.json())
      console.log('[KeyFindings] verify text       ', verify.text)
      console.log('[KeyFindings] verify derivedDom ', verify.derivedDom)
      console.log('[KeyFindings] verify textAsJson ', verify.textAsJson)
      console.log('[KeyFindings] verify textIsRich ', verify.textIsRich)
      const ok = typeof verify.derivedDom === 'string' && verify.derivedDom.includes('<li') &&
                 typeof verify.textAsJson === 'string' && verify.textAsJson.includes('"LI"')
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

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION HELPERS — quick existence checks against the active AEM tab.
// Used by the side panel after step 1 to decide whether to skip step 2
// (assets already in DAM) and/or step 3 (page already exists).
// ═══════════════════════════════════════════════════════════════════════════

async function checkDamAssetsInAEM(slug) {
  try {
    const damBase = '/content/dam/web/msci-com/research-and-insights/blog-post'
    const folderPath = `${damBase}/${slug}`

    // Read the folder + 1 level of children. 404 → folder doesn't exist.
    const res = await fetch(`${folderPath}.1.json`, { headers: { 'Accept': 'application/json' } })
    if (res.status === 404) {
      return { success: true, exists: false, folderPath }
    }
    if (!res.ok) {
      return { success: false, error: 'HTTP ' + res.status, folderPath }
    }
    const data = await res.json()

    function countAssets(node) {
      if (!node || typeof node !== 'object') return 0
      return Object.keys(node).filter(k => !k.startsWith('jcr:') && !k.startsWith(':')).length
    }

    const hasExhibitsFolder = !!data.exhibits
    const hasBannersFolder = !!data.banners

    let exhibitsCount = 0
    let bannersCount = 0

    if (hasExhibitsFolder) {
      try {
        const er = await fetch(`${folderPath}/exhibits.1.json`)
        if (er.ok) exhibitsCount = countAssets(await er.json())
      } catch (e) {}
    }
    if (hasBannersFolder) {
      try {
        const br = await fetch(`${folderPath}/banners.1.json`)
        if (br.ok) bannersCount = countAssets(await br.json())
      } catch (e) {}
    }

    return {
      success: true,
      exists: hasExhibitsFolder && hasBannersFolder && (exhibitsCount + bannersCount) > 0,
      hasExhibitsFolder,
      hasBannersFolder,
      exhibitsCount,
      bannersCount,
      folderPath
    }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

async function checkPageExistsInAEM(slug) {
  try {
    const parentPath = '/content/msci/us/en/research-and-insights/blog-post'
    const pagePath = `${parentPath}/${slug}`
    const res = await fetch(`${pagePath}/jcr:content.json`, { headers: { 'Accept': 'application/json' } })
    if (res.status === 404) {
      return { success: true, exists: false, pagePath }
    }
    if (!res.ok) {
      return { success: false, error: 'HTTP ' + res.status, pagePath }
    }
    const data = await res.json()
    return {
      success: true,
      exists: true,
      title: data['jcr:title'] || '',
      template: data['cq:template'] || '',
      pagePath
    }
  } catch (err) {
    return { success: false, error: err.message }
  }
}
