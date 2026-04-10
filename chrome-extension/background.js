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
