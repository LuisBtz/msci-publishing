/**
 * publishAssetsInAEM (INJECTED)
 *
 * Serialized into the AEM Author tab via chrome.scripting to create
 * the article's DAM folder tree and upload exhibit + banner assets
 * through AEM's initiateUpload / complete flow.
 *
 * SELF-CONTAINED: chrome.scripting.executeScript stringifies this
 * function with Function.prototype.toString() and re-parses it in
 * the page, so it MUST NOT reference anything from its module
 * (no imports, no outer constants, no logger instances).
 *
 * Returns { success, logs, error? } so the side panel can render
 * the step-by-step progress.
 */
export async function publishAssetsInAEM(slug, title, exhibitAssets, bannerAssets) {
  const logs = []
  const log = (m) => logs.push({ type: 'log', message: m })
  const logErr = (m) => logs.push({ type: 'error', message: m })
  const logWarn = (m) => logs.push({ type: 'warn', message: m })

  try {
    log('🔑 Fetching CSRF token...')
    const token = (await fetch('/libs/granite/csrf/token.json').then((r) => r.json())).token
    if (!token) throw new Error('Could not get CSRF token')

    const apiBase = '/api/assets/web/msci-com/research-and-insights/blog-post'
    const damBase = '/content/dam/web/msci-com/research-and-insights/blog-post'
    const mimeMap = {
      webp: 'image/webp',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      json: 'application/json',
    }

    async function createFolder(path, folderTitle) {
      const r = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CSRF-Token': token },
        body: JSON.stringify({ class: 'assetFolder', properties: { title: folderTitle } }),
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
          body: new URLSearchParams({ fileName: filename, fileSize: String(buffer.byteLength) }).toString(),
        })
        if (!initRes.ok) {
          const txt = await initRes.text()
          return { ok: false, detail: 'initiate failed HTTP ' + initRes.status + ': ' + txt.slice(0, 200) }
        }
        const initData = await initRes.json()
        const fileInfo = initData.files && initData.files[0]
        if (!fileInfo || !fileInfo.uploadURIs || !fileInfo.uploadURIs.length) {
          return { ok: false, detail: 'no uploadURIs in response' }
        }

        const putRes = await fetch(fileInfo.uploadURIs[0], {
          method: 'PUT',
          headers: { 'Content-Type': mime },
          body: buffer,
        })
        if (!putRes.ok) return { ok: false, detail: 'blob PUT failed: HTTP ' + putRes.status }

        const completeRes = await fetch(initData.completeURI, {
          method: 'POST',
          headers: { 'CSRF-Token': token, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            fileName: filename,
            fileSize: String(buffer.byteLength),
            mimeType: mime,
            uploadToken: fileInfo.uploadToken,
            replace: 'true',
          }).toString(),
        })
        return { ok: completeRes.ok, status: completeRes.status, size: buffer.byteLength, mime }
      } catch (e) {
        return { ok: false, detail: e.message }
      }
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
