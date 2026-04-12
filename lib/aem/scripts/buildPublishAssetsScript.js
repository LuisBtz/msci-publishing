/**
 * buildPublishAssetsScript
 *
 * Generates the DevTools snippet that uploads an article's exhibits and
 * banners into AEM DAM via the Assets API + Direct Binary Upload flow.
 * The snippet is meant to be pasted into an AEM Author DevTools console
 * so it runs with the user's AEM session cookies.
 *
 * Inputs: the full article record (slug, headline, banner_paths,
 * exhibit_paths). Output: a self-contained async IIFE string.
 *
 * This used to live inline inside ArticlePage. It is extracted here so
 * the page component stays thin and so the script can be regenerated
 * identically from other surfaces if needed.
 */

// Escape backticks/backslashes so the generated script can safely embed
// JSON-stringified asset lists inside a template literal.
function esc(s) {
  return s.replace(/\\/g, '\\\\').replace(/`/g, '\\`')
}

// Flatten exhibit_paths into the { url, filename } list the snippet
// uploads one by one. Supports only the legacy statics/interactives
// shape because the snippet always receives downloadUrl pairs.
function collectExhibitAssets(exhibitPaths) {
  const out = []
  if (!exhibitPaths) return out
  const { statics = [], interactives = [] } = exhibitPaths
  statics.forEach(e => {
    if (e.desktop?.downloadUrl) out.push({ url: e.desktop.downloadUrl, filename: e.desktop.filename })
    if (e.mobile?.downloadUrl) out.push({ url: e.mobile.downloadUrl, filename: e.mobile.filename })
  })
  interactives.forEach(e => {
    if (e.json?.downloadUrl) out.push({ url: e.json.downloadUrl, filename: e.json.filename })
  })
  return out
}

// Only .webp banners are uploaded — other formats are discarded.
function collectBannerAssets(bannerPaths) {
  const out = []
  if (!bannerPaths) return out
  Object.values(bannerPaths).forEach(b => {
    if (b?.downloadUrl && b?.filename?.endsWith('.webp')) {
      out.push({ url: b.downloadUrl, filename: b.filename })
    }
  })
  return out
}

export function buildPublishAssetsScript(article) {
  const exhibitAssets = collectExhibitAssets(article.exhibit_paths || null)
  const bannerAssets = collectBannerAssets(article.banner_paths)
  const exhibitsJson = esc(JSON.stringify(exhibitAssets))
  const bannersJson = esc(JSON.stringify(bannerAssets))
  const slug = article.slug
  const title = article.headline

  return `
(async () => {
  const token = (await fetch('/libs/granite/csrf/token.json').then(r=>r.json())).token;
  const apiBase  = '/api/assets/web/msci-com/research-and-insights/blog-post';
  const damBase  = '/content/dam/web/msci-com/research-and-insights/blog-post';
  const mimeMap  = { webp:'image/webp', jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', gif:'image/gif', svg:'image/svg+xml', json:'application/json' };

  // Create folder via Assets API (unchanged — works fine)
  async function createFolder(path, title) {
    const r = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CSRF-Token': token },
      body: JSON.stringify({ class: 'assetFolder', properties: { title } })
    });
    return r.status;
  }

  // Direct Binary Upload — required by AEM Cloud Service to trigger full asset processing
  async function uploadAsset(sourceUrl, damFolderPath, filename) {
    try {
      // 1. Fetch source binary
      const srcRes = await fetch(sourceUrl);
      if (!srcRes.ok) return { ok: false, detail: 'source fetch failed: HTTP ' + srcRes.status };
      const buffer = await srcRes.arrayBuffer();
      if (!buffer.byteLength) return { ok: false, detail: 'empty response from source URL' };
      const ext = filename.split('.').pop().toLowerCase();
      const mime = mimeMap[ext] || 'application/octet-stream';

      // 2. Initiate upload — AEM returns a pre-signed blob storage URI
      const initRes = await fetch(damFolderPath + '.initiateUpload.json', {
        method: 'POST',
        headers: { 'CSRF-Token': token, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ fileName: filename, fileSize: String(buffer.byteLength) }).toString()
      });
      if (!initRes.ok) {
        const txt = await initRes.text();
        return { ok: false, detail: 'initiate failed HTTP ' + initRes.status + ': ' + txt.slice(0, 200) };
      }
      const initData = await initRes.json();
      const fileInfo = initData.files?.[0];
      if (!fileInfo?.uploadURIs?.length) return { ok: false, detail: 'no uploadURIs in initiate response: ' + JSON.stringify(initData).slice(0, 200) };

      // 3. PUT binary directly to blob storage (Azure/S3 — no AEM auth needed)
      const putRes = await fetch(fileInfo.uploadURIs[0], {
        method: 'PUT',
        headers: { 'Content-Type': mime },
        body: buffer
      });
      if (!putRes.ok) return { ok: false, detail: 'blob PUT failed: HTTP ' + putRes.status };

      // 4. Complete upload — triggers AEM asset processing pipeline (thumbnails, renditions, metadata)
      const completeRes = await fetch(initData.completeURI, {
        method: 'POST',
        headers: { 'CSRF-Token': token, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ fileName: filename, fileSize: String(buffer.byteLength), mimeType: mime, uploadToken: fileInfo.uploadToken, replace: 'true' }).toString()
      });
      return { ok: completeRes.ok, status: completeRes.status, size: buffer.byteLength, mime };
    } catch(e) { return { ok: false, detail: e.message }; }
  }

  function logResult(filename, res) {
    if (res.ok) console.log(\`   ✅ \${filename} (\${Math.round(res.size/1024)}KB, \${res.mime})\`);
    else console.log(\`   ❌ \${filename} — \${res.detail || 'HTTP ' + res.status}\`);
  }

  let s;
  s = await createFolder(\`\${apiBase}/${slug}\`, \`${title}\`);
  console.log('1. Article folder:', s===201?'✅ Created':s===409?'⚠ Exists':'❌ '+s);
  s = await createFolder(\`\${apiBase}/${slug}/exhibits\`, 'Exhibits');
  console.log('2. Exhibits folder:', s===201?'✅ Created':s===409?'⚠ Exists':'❌ '+s);
  s = await createFolder(\`\${apiBase}/${slug}/banners\`, 'Banners');
  console.log('3. Banners folder:', s===201?'✅ Created':s===409?'⚠ Exists':'❌ '+s);

  const exhibits = JSON.parse(\`${exhibitsJson}\`);
  console.log(\`4. Uploading \${exhibits.length} exhibit(s)...\`);
  for (const a of exhibits) {
    logResult(a.filename, await uploadAsset(a.url, \`\${damBase}/${slug}/exhibits\`, a.filename));
  }

  const banners = JSON.parse(\`${bannersJson}\`);
  console.log(\`5. Uploading \${banners.length} banner(s)...\`);
  for (const a of banners) {
    logResult(a.filename, await uploadAsset(a.url, \`\${damBase}/${slug}/banners\`, a.filename));
  }

  console.log('\\n✅ Done! View at: /ui#/aem/assets.html/content/dam/web/msci-com/research-and-insights/blog-post/${slug}');
})();
`.trim()
}
