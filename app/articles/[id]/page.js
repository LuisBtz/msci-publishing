'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/useAuth'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import ExhibitAsset from './components/ExhibitAsset'

// ─── MSCI Style Definitions (adjust values if needed from DevTools) ─────────
const MSCI_STYLES = {
  bodyArticle: {
    'font-size': '20px',
    'line-height': '32px',
    'font-weight': '400',
    'font-family': "'Noto Sans', sans-serif",
    'color': '#1a1a1a',
  },
  headline2: {
    'font-size': '28px',
    'line-height': '36px',
    'font-weight': '600',
    'font-family': "'Noto Sans', sans-serif",
    'color': '#1a1a1a',
  },
  headline3: {
    'font-size': '22px',
    'line-height': '30px',
    'font-weight': '600',
    'font-family': "'Noto Sans', sans-serif",
    'color': '#1a1a1a',
  },
  caption: {
    'font-size': '14px',
    'line-height': '22px',
    'font-weight': '400',
    'font-family': "'Noto Sans', sans-serif",
    'color': '#555555',
  },
  footnote: {
    'font-size': '14px',
    'line-height': '20px',
    'font-weight': '400',
    'font-family': "'Noto Sans', sans-serif",
    'color': '#555555',
  },
  bulletItem: {
    'font-size': '20px',
    'line-height': '32px',
    'font-weight': '400',
    'font-family': "'Noto Sans', sans-serif",
    'color': '#1a1a1a',
  },
  sup: {
    'font-size': '0.7em',
    'color': '#c8102e',
    'font-weight': '600',
    'vertical-align': 'super',
    'line-height': '0',
  },
  link: {
    'color': '#c8102e',
    'text-decoration': 'underline',
  },
}

function inlineStyle(styleObj) {
  return Object.entries(styleObj).map(([k, v]) => `${k}:${v}`).join(';')
}

// ─── Rich HTML builders for AEM RTE paste ───────────────────────────────────

function wrapBodyHtml(html) {
  // Wrap each <p> content in body-article spans, convert <h2>/<h3> to spans
  let out = html
  // h2 → span headline2
  out = out.replace(/<h2>([\s\S]*?)<\/h2>/gi, (_, inner) =>
    `<p><span style="${inlineStyle(MSCI_STYLES.headline2)}">${inner}</span></p>`
  )
  // h3 → span headline3
  out = out.replace(/<h3>([\s\S]*?)<\/h3>/gi, (_, inner) =>
    `<p><span style="${inlineStyle(MSCI_STYLES.headline3)}">${inner}</span></p>`
  )
  // <sup> → inline styled sup
  out = out.replace(/<sup>([\s\S]*?)<\/sup>/gi, (_, inner) =>
    `<sup style="${inlineStyle(MSCI_STYLES.sup)}">${inner}</sup>`
  )
  // <a> → inline styled links
  out = out.replace(/<a\s/gi, `<a style="${inlineStyle(MSCI_STYLES.link)}" `)
  // Wrap paragraph text content in body-article span
  out = out.replace(/<p>([\s\S]*?)<\/p>/gi, (match, inner) => {
    // Skip if already wrapped with a headline span
    if (inner.includes(inlineStyle(MSCI_STYLES.headline2)) || inner.includes(inlineStyle(MSCI_STYLES.headline3))) {
      return match
    }
    return `<p><span style="${inlineStyle(MSCI_STYLES.bodyArticle)}">${inner}</span></p>`
  })
  return out
}

function buildKeyFindingsHtml(bullets) {
  const lis = bullets.map(b =>
    `<li style="margin-bottom:16px"><span style="${inlineStyle(MSCI_STYLES.bulletItem)}">${b}</span></li>`
  ).join('')
  return `<ul style="list-style-type:disc;padding-left:24px;margin:16px 0">${lis}</ul>`
}

function buildFootnotesHtml(footnotes) {
  return footnotes.map(f => {
    const text = f.text.replace(/<a\s/gi, `<a style="${inlineStyle(MSCI_STYLES.link)}" `)
    return `<p><span style="${inlineStyle(MSCI_STYLES.footnote)}">${f.number}&nbsp;${text}</span></p>`
  }).join('')
}

function buildCaptionHtml(caption) {
  return `<p><span style="${inlineStyle(MSCI_STYLES.caption)}">${caption}</span></p>`
}

// ─── Copy utilities ─────────────────────────────────────────────────────────

function useCopy() {
  const [copied, setCopied] = useState({})

  const copy = (key, text) => {
    navigator.clipboard.writeText(text || '')
    setCopied(prev => ({ ...prev, [key]: true }))
    setTimeout(() => setCopied(prev => ({ ...prev, [key]: false })), 2000)
  }

  const copyRich = async (key, html) => {
    try {
      const blob = new Blob([html], { type: 'text/html' })
      const textBlob = new Blob([stripHtml(html)], { type: 'text/plain' })
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': blob,
          'text/plain': textBlob,
        })
      ])
    } catch {
      // Fallback: use range selection method
      const el = document.createElement('div')
      el.innerHTML = html
      el.style.position = 'fixed'
      el.style.left = '-9999px'
      el.style.opacity = '0'
      document.body.appendChild(el)
      const range = document.createRange()
      range.selectNodeContents(el)
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(range)
      document.execCommand('copy')
      sel.removeAllRanges()
      document.body.removeChild(el)
    }
    setCopied(prev => ({ ...prev, [key]: true }))
    setTimeout(() => setCopied(prev => ({ ...prev, [key]: false })), 2000)
  }

  return { copied, copy, copyRich }
}

function stripHtml(html) {
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  return tmp.textContent || tmp.innerText || ''
}

// ─── Exhibit resolver ───────────────────────────────────────────────────────

function resolveExhibit(block, exhibitPaths) {
  if (!exhibitPaths) return null
  const idx = block.sharepoint_index ?? block.exhibit_index
  if (idx == null) return null

  // New format: items[] is authoritative (sorted by filename order suffix).
  if (Array.isArray(exhibitPaths.items)) {
    const item = exhibitPaths.items[idx]
    return item ? { ...item, exhibit_type: item.type } : null
  }

  // Legacy format fallback.
  const { statics = [], interactives = [], summary = [] } = exhibitPaths
  const summaryItem = summary[idx]
  if (!summaryItem) return null
  if (summaryItem.type === 'static') {
    const s = statics[idx]
    return s ? { ...s, exhibit_type: 'static' } : null
  }
  if (summaryItem.type === 'interactive') {
    const iIdx = idx - statics.length
    const iv = interactives[iIdx]
    return iv ? { ...iv, exhibit_type: 'interactive' } : null
  }
  return null
}

const TYPE_LABELS = { 'blog-post': 'Blog Post', 'paper': 'Paper', 'quick-take': 'Quick Take', 'podcast': 'Podcast' }
const STATUS_LABELS = { 'in-progress': 'In Progress', 'in-review': 'In Review', 'approved': 'Approved', 'published': 'Published' }

export default function ArticlePage() {
  const { user, loading } = useAuth()
  const { id } = useParams()
  const router = useRouter()
  const [article, setArticle] = useState(null)
  const [loadingArticle, setLoadingArticle] = useState(true)
  const [error, setError] = useState('')
  const [publishScript, setPublishScript] = useState('')
  const [showPublishScript, setShowPublishScript] = useState(false)
  const [scriptLabel, setScriptLabel] = useState('AEM Publish Script')
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState('')
  const [rescanning, setRescanning] = useState(false)
  const [rescanError, setRescanError] = useState('')
  const [rescanMsg, setRescanMsg] = useState('')
  const [savingBlocks, setSavingBlocks] = useState(false)
  const [previewCopied, setPreviewCopied] = useState(false)
  const { copied, copy, copyRich } = useCopy()
  const [activeTab, setActiveTab] = useState('metadata')

  const previewUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/preview/${id}`
    : `/preview/${id}`

  const copyPreviewLink = () => {
    navigator.clipboard.writeText(previewUrl)
    setPreviewCopied(true)
    setTimeout(() => setPreviewCopied(false), 2000)
  }

  const getDisplayUrl = (url) => {
    if (!url) return ''
    if (url.startsWith('/content/ipc/us/en/indexes')) return `https://www.msci.com${url.replace('/content/ipc/us/en', '/indexes')}`
    if (url.startsWith('/content/msci/us/en')) return `https://www.msci.com${url.replace('/content/msci/us/en', '')}`
    if (url.startsWith('/')) return `https://www.msci.com${url}`
    return url
  }

  const getAemPath = (url) => {
    if (!url) return url
    if (url.startsWith('/content/')) return url
    try {
      const parsed = new URL(url, 'https://www.msci.com')
      const hostname = parsed.hostname.toLowerCase()
      const pathname = parsed.pathname
      if (!hostname.endsWith('msci.com')) return url
      if (hostname === 'support.msci.com') return url
      if (pathname.startsWith('/indexes/index/')) return url
      if (pathname.startsWith('/indexes/')) return `/content/ipc/us/en${pathname}`
      return `/content/msci/us/en${pathname}`
    } catch { return url }
  }

  const fetchMissingMetas = async (articleData, indices) => {
    const resources = articleData.related_resources || []
    const updates = await Promise.all(
      indices.map(async (i) => {
        const r = resources[i]
        const url = getDisplayUrl(r.original_url || r.url)
        if (!url) return null
        try {
          const res = await fetch('/api/fetch-meta', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls: [url] })
          })
          const { results } = await res.json()
          const meta = results?.[0]
          if (!meta) return null
          return { index: i, meta_description: meta.metaDescription || '', title: r.title?.trim() ? r.title : (meta.title || r.title) }
        } catch { return null }
      })
    )
    const updated = resources.map((r, i) => {
      const update = updates.find(u => u?.index === i)
      if (!update) return r
      return { ...r, meta_description: update.meta_description || r.meta_description, title: update.title || r.title }
    })
    await supabase.from('articles').update({ related_resources: updated }).eq('id', id)
    setArticle(prev => ({ ...prev, related_resources: updated }))
  }

  const fetchArticle = async () => {
    const { data, error } = await supabase.from('articles').select('*').eq('id', id).single()
    if (error) setError('Artículo no encontrado')
    else {
      setArticle(data)
      const missing = (data.related_resources || [])
        .map((r, i) => ({ r, i }))
        .filter(({ r }) => !r.meta_description || r.meta_description.trim() === '')
      if (missing.length > 0) fetchMissingMetas(data, missing.map(({ i }) => i))
    }
    setLoadingArticle(false)
  }

  useEffect(() => { if (user && id) fetchArticle() }, [user, id])

  // Persiste un cambio en body_blocks → Supabase + estado local (preview se actualiza)
  const updateBodyBlocks = async (mutator) => {
    const next = mutator(article.body_blocks || [])
    setArticle(prev => ({ ...prev, body_blocks: next }))
    setSavingBlocks(true)
    try {
      await supabase.from('articles').update({ body_blocks: next }).eq('id', id)
    } finally {
      setSavingBlocks(false)
    }
  }

  const reassignExhibit = (blockIdx, newSharepointIdx) => {
    return updateBodyBlocks(blocks => blocks.map((b, i) => {
      if (i !== blockIdx || b.type !== 'exhibit') return b
      return { ...b, sharepoint_index: newSharepointIdx }
    }))
  }

  const refreshAssets = async () => {
    setRefreshing(true)
    setRefreshError('')
    try {
      const res = await fetch('/api/sharepoint/refresh-assets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: id })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al refrescar')
      setArticle(prev => ({ ...prev, exhibit_paths: data.exhibit_paths, banner_paths: data.banner_paths, body_blocks: data.body_blocks }))
    } catch (err) { setRefreshError(err.message) }
    setRefreshing(false)
  }

  // Re-escanea la carpeta de SharePoint: detecta archivos nuevos/modificados,
  // reconstruye exhibit_paths (items[] + legacy shapes) y actualiza
  // body_blocks + export_json con los datos frescos.
  const rescanExhibits = async () => {
    setRescanning(true)
    setRescanError('')
    setRescanMsg('')
    try {
      const res = await fetch('/api/sharepoint/rescan-exhibits', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: id })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al re-escanear')
      setArticle(prev => ({
        ...prev,
        exhibit_paths: data.exhibit_paths,
        banner_paths: data.banner_paths,
        body_blocks: data.body_blocks
      }))
      setRescanMsg(`✓ ${data.summary.total} exhibit(s) (${data.summary.statics} static, ${data.summary.interactives} interactive)`)
      setTimeout(() => setRescanMsg(''), 4000)
    } catch (err) { setRescanError(err.message) }
    setRescanning(false)
  }

  const publishAssetsToDAM = () => {
    const exhibitPaths = article.exhibit_paths || null

    const exhibitAssets = []
    if (exhibitPaths) {
      const { statics = [], interactives = [] } = exhibitPaths
      statics.forEach(e => {
        if (e.desktop?.downloadUrl) exhibitAssets.push({ url: e.desktop.downloadUrl, filename: e.desktop.filename })
        if (e.mobile?.downloadUrl) exhibitAssets.push({ url: e.mobile.downloadUrl, filename: e.mobile.filename })
      })
      interactives.forEach(e => {
        if (e.json?.downloadUrl) exhibitAssets.push({ url: e.json.downloadUrl, filename: e.json.filename })
      })
    }

    const bannerAssets = []
    if (article.banner_paths) {
      Object.values(article.banner_paths).forEach(b => {
        if (b?.downloadUrl && b?.filename?.endsWith('.webp')) bannerAssets.push({ url: b.downloadUrl, filename: b.filename })
      })
    }

    const esc = s => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`')
    const exhibitsJson = esc(JSON.stringify(exhibitAssets))
    const bannersJson = esc(JSON.stringify(bannerAssets))
    const slug = article.slug
    const title = article.headline

    const script = `
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

    setPublishScript(script)
    setShowPublishScript(true)
    setScriptLabel('Publish Assets to AEM DAM')
  }

  const createAEMPage = () => {
    const slug = article.slug || ''
    const esc = s => (s || '').replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$')
    const title = esc(article.headline || '')
    const metaDesc = esc(article.meta_description || '')
    const readTime = article.read_time ? parseInt(article.read_time, 10) : ''
    const publishDate = article.publish_date || ''
    const parentPath = '/content/msci/us/en/research-and-insights/blog-post'
    const damBase = '/content/dam/web/msci-com/research-and-insights/blog-post'
    const authors = article.authors || []
    const toAuthorSlug = name => (name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const contributorBase = '/content/dam/web/msci-com/research-and-insights/contributor'
    const authorsJson = esc(JSON.stringify(authors.map(a => {
      if (a.content_fragment_path) return a.content_fragment_path
      const slug = toAuthorSlug(a.name)
      return slug ? `${contributorBase}/${slug}/${slug}` : null
    }).filter(Boolean)))
    const tags = article.tags?.all_tags || []
    const tagsJson = esc(JSON.stringify(tags))
    const allBanners = Object.values(article.banner_paths || {})
    const banner1x1 = allBanners.find(b => b?.filename?.includes('1x1'))
    const thumbnailDamPath = banner1x1?.filename ? `${damBase}/${slug}/banners/${banner1x1.filename}` : ''

    const script = `
(async () => {
  const token = (await fetch('/libs/granite/csrf/token.json').then(r=>r.json())).token;
  const templatePath = '/conf/webmasters-aem/settings/wcm/templates/research-page2';
  const parentPath = '${parentPath}';
  const pagePath = parentPath + '/${slug}';
  const jcrContent = pagePath + '/jcr:content';
  const siblingBase = '/content/msci/us/en/research-and-insights/blog-post';
  let r;

  async function post(path, params) {
    return fetch(path, { method: 'POST', headers: { 'CSRF-Token': token, 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() });
  }
  const ok = r => r.status === 200 || r.status === 201;

  // ── Discovery: one sibling fetch used by steps 4, 5 and 6 ──
  let siblingProps = null;    // flat jcr:content properties of a reference sibling
  let siblingAuthors = null;  // authors.2.json of that sibling
  try {
    const list = await fetch(siblingBase + '.1.json', { headers: { 'CSRF-Token': token } }).then(r => r.json());
    for (const key of Object.keys(list).filter(k => !k.startsWith('jcr:') && !k.startsWith(':')).slice(0, 20)) {
      try {
        const props = await fetch(siblingBase + '/' + key + '/jcr:content.2.json', { headers: { 'CSRF-Token': token } }).then(r => r.json());
        const authRes = await fetch(siblingBase + '/' + key + '/jcr:content/authors.2.json', { headers: { 'CSRF-Token': token } });
        if (authRes.ok) { siblingAuthors = await authRes.json(); siblingProps = props; break; }
      } catch(e) { /* try next */ }
    }
  } catch(e) { /* no siblings */ }

  // ── Step 1: Create page ──
  console.log('1️⃣ Creating page "${slug}"...');
  const s = (await fetch('/bin/wcmcommand', { method: 'POST', headers: { 'CSRF-Token': token, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ cmd: 'createPage', parentPath, title: \`${title}\`, label: '${slug}', template: templatePath }).toString() })).status;
  if (s === 200 || s === 201) { console.log('   ✅ Created'); }
  else if (s === 500) { console.log('   ⚠️ Already exists — updating properties'); }
  else { console.error('   ❌ Failed: HTTP', s); return; }

  // ── Step 2: Description ──
  console.log('2️⃣ Setting description...');
  try {
    r = await post(jcrContent, new URLSearchParams({ 'jcr:description': \`${metaDesc}\` }));
    console.log('   Description:', ok(r) ? '✅' : '❌ ' + r.status);
  } catch(e) { console.error('   ❌', e.message); }

  // ── Step 3: Display Date ──
  console.log('3️⃣ Setting display date...');
  try {
    const pubDate = '${publishDate}';
    if (!pubDate) { console.log('   ⚠️ No publication date — skipping'); } else {
      const p = new URLSearchParams({ displayDate: pubDate + 'T00:00:00.000Z', 'displayDate@TypeHint': 'Date' });
      r = await post(jcrContent, p);
      console.log('   Display date:', ok(r) ? '✅ ' + pubDate : '❌ ' + r.status);
    }
  } catch(e) { console.error('   ❌', e.message); }

  // ── Step 4: Read/Listen/Watch Time ──
  console.log('4️⃣ Setting read time...');
  try {
    const rt = ${readTime || 0};
    if (!rt) { console.log('   ⚠️ No read time — skipping'); } else {
      const rtCandidates = ['time', 'readListenWatchTime', 'readTime', 'rlwTime'];
      const rtProp = (siblingProps && rtCandidates.find(c => c in siblingProps && Number(siblingProps[c]) > 0)) || 'time';
      r = await post(jcrContent, new URLSearchParams({ [rtProp]: String(rt), [rtProp + '@TypeHint']: 'Long' }));
      console.log('   Read time:', ok(r) ? '✅ ' + rt + ' min' : '❌ ' + r.status);
    }
  } catch(e) { console.error('   ❌', e.message); }

  // ── Step 5: Authors ──
  console.log('5️⃣ Setting authors...');
  try {
    const authorPaths = JSON.parse(\`${authorsJson}\`);
    if (!authorPaths.length) { console.log('   ⚠️ No authors — skipping'); } else {
      // Discover author property name from sibling, fallback to probe
      let authorProp = null;
      if (siblingAuthors) {
        const items = Object.keys(siblingAuthors).filter(k => k.startsWith('item'));
        if (items.length) {
          const props = Object.keys(siblingAuthors[items[0]]).filter(k => !k.startsWith('jcr:') && !k.startsWith('sling:') && !k.startsWith(':'));
          if (props.length) authorProp = props[0];
        }
      }
      if (!authorProp) {
        const probePath = jcrContent + '/authors/__probe__';
        for (const c of ['profilePath', 'fragmentPath', 'contentFragment', 'fileReference', 'author']) {
          await fetch(probePath, { method: 'POST', headers: { 'CSRF-Token': token, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ 'jcr:primaryType': 'nt:unstructured', [c]: '/probe' }).toString() });
          const probe = await fetch(probePath + '.json', { headers: { 'CSRF-Token': token } }).then(r => r.json()).catch(() => ({}));
          if (probe[c] === '/probe') { authorProp = c; break; }
        }
        await fetch(probePath, { method: 'POST', headers: { 'CSRF-Token': token, 'Content-Type': 'application/x-www-form-urlencoded' }, body: ':operation=delete' });
        if (!authorProp) { authorProp = 'profilePath'; }
      }

      await fetch(jcrContent + '/authors', { method: 'POST', headers: { 'CSRF-Token': token, 'Content-Type': 'application/x-www-form-urlencoded' }, body: ':operation=delete' });
      for (let i = 0; i < authorPaths.length; i++) {
        r = await fetch(jcrContent + '/authors/item' + i, { method: 'POST', headers: { 'CSRF-Token': token, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ 'jcr:primaryType': 'nt:unstructured', [authorProp]: authorPaths[i] }).toString() });
        console.log('   Author ' + (i + 1) + ':', ok(r) ? '✅' : '❌ ' + r.status, authorPaths[i].split('/').pop());
      }
    }
  } catch(e) { console.error('   ❌', e.message); }

  // ── Step 6: Thumbnail ──
  console.log('6️⃣ Setting thumbnail...');
  try {
    const thumbPath = '${thumbnailDamPath}';
    if (!thumbPath) { console.log('   ⚠️ No 1x1 banner — skipping'); } else {
      // Set the two standard image nodes
      r = await post(jcrContent + '/cq:featuredimage', new URLSearchParams({ fileReference: thumbPath }));
      console.log('   cq:featuredimage:', ok(r) ? '✅' : '❌ ' + r.status);
      r = await post(jcrContent + '/image', new URLSearchParams({ fileReference: thumbPath }));
      console.log('   image:', ok(r) ? '✅' : '❌ ' + r.status);

      // Set any extra image node found in siblings (e.g. cq:featuredImage with capital I)
      if (siblingProps) {
        const extraNodes = Object.entries(siblingProps).filter(([k, v]) =>
          typeof v === 'object' && v !== null && typeof v.fileReference === 'string' &&
          v.fileReference.includes('/content/dam/') && k !== 'image' && k.toLowerCase() !== 'cq:featuredimage'
        );
        for (const [nodeName] of extraNodes) {
          r = await post(jcrContent + '/' + nodeName, new URLSearchParams({ fileReference: thumbPath }));
          console.log('   ' + nodeName + ':', ok(r) ? '✅' : '❌ ' + r.status);
        }
      }
    }
  } catch(e) { console.error('   ❌', e.message); }

  // ── Step 7: Tags (direct mapping, preserve existing) ──
  console.log('7️⃣ Setting tags...');
  try {
    // Category → AEM namespace mapping
    const catToNs = {
      'asset class': 'asset-class',
      'research format': 'research-format',
      'format': 'research-format',
      'line of business': 'line-of-business',
      'theme': 'theme',
      'topic': 'topic',
      'marketing program': 'marketing-program',
      'campaign': 'page_campaign',
      'research type': 'research-type',
      'type': 'research-type',
    };

    // Research Type: extracted name → AEM slug
    const researchTypeMap = {
      'commentary': 'commentary',
      'insights in action': 'product-insight',
      'research insights': 'research',
      'blog': 'blog',
    };

    function slugify(str) {
      return str.toLowerCase().trim()
        .replace(/&/g, '-and-')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }

    function resolveSlug(namespace, value) {
      // Campaign: use only text before parenthesis as slug
      if (namespace === 'page_campaign') {
        const parenIdx = value.indexOf('(');
        const raw = parenIdx !== -1 ? value.substring(0, parenIdx).trim() : value.trim();
        return slugify(raw);
      }
      // Research Type: use manual mapping
      if (namespace === 'research-type') {
        const mapped = researchTypeMap[value.toLowerCase().trim()];
        if (mapped) return mapped;
      }
      return slugify(value);
    }

    // 6a. Read existing tags from page
    const pageJson = await fetch(jcrContent + '.json', { headers: { 'CSRF-Token': token } }).then(r => r.json());
    const existingTags = Array.isArray(pageJson['cq:tags']) ? pageJson['cq:tags']
      : pageJson['cq:tags'] ? [pageJson['cq:tags']] : [];
    console.log('   Existing tags (' + existingTags.length + '):');
    existingTags.forEach(t => console.log('     ✓', t));

    // 6b. Resolve each article tag
    const articleTags = JSON.parse(\`${tagsJson}\`);
    const newTags = [];
    const skipped = [];
    const notFound = [];

    for (const tag of articleTags) {
      const sep = tag.indexOf(' : ');
      if (sep === -1) { notFound.push({ tag, reason: 'bad format (no " : " separator)' }); continue; }
      const category = tag.substring(0, sep).trim();
      const value = tag.substring(sep + 3).trim();
      const namespace = catToNs[category.toLowerCase()];
      if (!namespace) { notFound.push({ tag, reason: 'unknown category "' + category + '"' }); continue; }

      const valueSlug = resolveSlug(namespace, value);
      const tagId = namespace + ':' + valueSlug;

      // Already on page?
      if (existingTags.includes(tagId)) {
        skipped.push({ tag, tagId });
        continue;
      }

      // Verify tag exists in AEM
      const check = await fetch('/content/cq:tags/' + namespace + '/' + valueSlug + '.json', {
        headers: { 'CSRF-Token': token }
      });
      if (check.ok) {
        newTags.push({ tag, tagId });
        console.log('   ✅ "' + tag + '" → ' + tagId);
      } else {
        notFound.push({ tag, reason: tagId + ' does not exist in AEM (HTTP ' + check.status + ')' });
      }
    }

    if (skipped.length) {
      console.log('   \\n   Already on page (' + skipped.length + '):');
      skipped.forEach(t => console.log('     ⏭', t.tag, '→', t.tagId));
    }
    if (notFound.length) {
      console.log('   \\n   Skipped — not found (' + notFound.length + '):');
      notFound.forEach(t => console.log('     ⚠️', t.tag, '—', t.reason));
    }

    // 6c. Merge and save
    if (newTags.length === 0) {
      console.log('   \\n   No new tags to add.');
    } else {
      const allTags = [...existingTags, ...newTags.map(t => t.tagId)];
      console.log('   \\n   Saving ' + allTags.length + ' total (' + existingTags.length + ' existing + ' + newTags.length + ' new)...');
      const p = new URLSearchParams();
      allTags.forEach(t => p.append('cq:tags', t));
      p.set('cq:tags@TypeHint', 'String[]');
      r = await post(jcrContent, p);
      console.log('   Tags save:', ok(r) ? '✅ Done' : '❌ Status ' + r.status);
      if (!ok(r)) console.log('   Response:', await r.text());
    }
  } catch(e) { console.error('   ❌ Tags error:', e.message, e); }

  // ── Summary ──
  console.log('\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📝 Edit page: /editor.html' + pagePath + '.html');
  console.log('📂 Sites view: /ui#/aem/sites.html' + parentPath);
  console.log('🖼 DAM assets: /ui#/aem/assets.html${damBase}/${slug}');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
})();
`.trim()

    setPublishScript(script)
    setShowPublishScript(true)
    setScriptLabel('AEM Create Page Script')
  }

  if (loading || loadingArticle) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <p style={{ color: '#999' }}>Cargando...</p>
    </div>
  )
  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <p style={{ color: '#cc0000' }}>{error}</p>
    </div>
  )

  const wordTags = article.tags?.all_tags || []
  const exhibitPaths = article.exhibit_paths || null
  const exhibitOptions = (exhibitPaths?.items || exhibitPaths?.summary || []).map((e, i) => {
    const order = e.order != null ? `#${e.order} ` : ''
    if (e.type === 'static') {
      const filename = e.desktop_filename || e.desktop?.filename || ''
      return { value: i, label: `${order}[Static] ${e.base_name} (${filename})` }
    }
    const filename = e.json_filename || e.json?.filename || ''
    return { value: i, label: `${order}[Interactive] ${e.base_name} (${filename})` }
  })

  const exportData = {
    meta: { exported_at: new Date().toISOString(), platform_version: '1.0', article_id: id },
    type: article.type, status: article.status, headline: article.headline,
    slug: article.slug, final_url: article.final_url, meta_description: article.meta_description,
    read_time: article.read_time, publish_date: article.publish_date,
    authors: article.authors, bullets: article.bullets, body_blocks: article.body_blocks,
    footnotes: article.footnotes, tags: wordTags, related_resources: article.related_resources,
    assets: { banners: article.banner_paths || {}, exhibits: exhibitPaths },
    sharepoint_folder: article.sharepoint_folder_url
  }

  // ─── Styles ───────────────────────────────────────────────────────────────
  const s = {
    topbar: {
      backgroundColor: 'black', color: 'white', padding: '0 1.5rem', height: '52px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      position: 'sticky', top: 0, zIndex: 100, gap: '1rem'
    },
    layout: {
      display: 'grid', gridTemplateColumns: '1fr 220px', minHeight: 'calc(100vh - 52px)',
      alignItems: 'start', maxWidth: '1400px', margin: '0 auto'
    },
    main: {
      padding: '1.5rem 2rem', display: 'grid', gap: '1rem', minWidth: 0
    },
    sidebar: {
      position: 'sticky', top: '52px', padding: '1rem', borderLeft: '1px solid #e5e5e5',
      backgroundColor: 'white', display: 'flex', flexDirection: 'column', gap: '6px',
      minHeight: 'calc(100vh - 52px)'
    },
    sideLabel: {
      fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em',
      color: '#999', padding: '8px 0 4px', marginTop: '4px'
    },
    sideDivider: { height: '1px', backgroundColor: '#f0f0f0', margin: '4px 0' },
    actionBtn: {
      display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px',
      borderRadius: '6px', border: '1px solid #e0e0e0', background: 'white',
      fontSize: '12px', color: '#222', cursor: 'pointer', width: '100%',
      textAlign: 'left', textDecoration: 'none'
    },
  }

  return (
    <div style={{ fontFamily: 'sans-serif', minHeight: '100vh', backgroundColor: '#f5f5f5' }}>

      {/* ── Topbar ── */}
      <div style={s.topbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
          <button onClick={() => router.push('/dashboard')}
            style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '0.8rem', flexShrink: 0 }}>
            ← Articles
          </button>
          <span style={{ color: '#333' }}>|</span>
          <span style={{ fontSize: '0.85rem', color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {article.headline}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          <span style={{ fontSize: '0.72rem', fontWeight: '600', padding: '0.2rem 0.6rem', borderRadius: '999px', backgroundColor: '#222', color: '#ccc' }}>
            {TYPE_LABELS[article.type] || article.type}
          </span>
          <span style={{ fontSize: '0.72rem', fontWeight: '600', padding: '0.2rem 0.6rem', borderRadius: '999px', backgroundColor: '#333', color: '#fff' }}>
            {STATUS_LABELS[article.status] || article.status}
          </span>
        </div>
      </div>

      <div style={s.layout}>

        {/* ── Main content ── */}
        <div style={s.main}>

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: '0', borderBottom: '2px solid #e5e5e5', marginBottom: '0.25rem' }}>
            {[{ key: 'metadata', label: 'Metadata' }, { key: 'content', label: 'Content' }].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                padding: '0.6rem 1.25rem', fontSize: '0.82rem', fontWeight: '600',
                color: activeTab === tab.key ? '#111' : '#999',
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: activeTab === tab.key ? '2px solid #111' : '2px solid transparent',
                marginBottom: '-2px'
              }}>
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'metadata' && (<>

          {/* Metadata */}
          <Section title="Metadata">
            <FieldRow label="Headline" value={article.headline} bold copied={copied['headline']} onCopy={() => copy('headline', article.headline)} />
            <Divider />
            <FieldRow label="Slug" value={article.slug} mono copied={copied['slug']} onCopy={() => copy('slug', article.slug)} />
            <Divider />
            <FieldRow label="Final URL" value={article.final_url} mono copied={copied['url']} onCopy={() => copy('url', article.final_url)} />
            <Divider />
            <FieldRow label="Read time" value={article.read_time ? String(article.read_time) : null} mono copied={copied['rt']} onCopy={() => copy('rt', String(article.read_time))} />
            <Divider />
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={labelStyle}>Meta description</span>
                <span style={{ fontSize: '0.72rem', color: '#bbb' }}>{article.meta_description?.length || 0} / 160</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <span style={{ flex: 1, fontSize: '0.875rem', color: '#333', lineHeight: '1.6' }}>
                  {article.meta_description || <span style={{ color: '#bbb' }}>—</span>}
                </span>
                <CopyBtn copied={copied['meta']} onCopy={() => copy('meta', article.meta_description)} />
              </div>
            </div>
          </Section>

          {/* Tags */}
          <Section title="Tags AEM">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <span style={{ fontSize: '0.78rem', color: '#999' }}>{wordTags.length} tags</span>
              <CopyBtn label="Copy all" copied={copied['tags']} onCopy={() => copy('tags', wordTags.join(', '))} />
            </div>
            {wordTags.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                {wordTags.map((tag, i) => (
                  <button key={i} onClick={() => copy(`tag_${i}`, tag)} style={{
                    fontSize: '0.78rem', padding: '0.2rem 0.65rem', borderRadius: '20px',
                    backgroundColor: copied[`tag_${i}`] ? '#f0fff4' : '#f2f2f2',
                    color: copied[`tag_${i}`] ? '#16a34a' : '#444',
                    border: copied[`tag_${i}`] ? '1px solid #86efac' : '1px solid #e5e5e5',
                    cursor: 'pointer', transition: 'all 0.15s'
                  }}>
                    {copied[`tag_${i}`] ? '✓ ' : ''}{tag}
                  </button>
                ))}
              </div>
            ) : (
              <p style={{ color: '#cc0000', fontSize: '0.85rem', margin: 0 }}>⚠ No tags found — reprocess the article.</p>
            )}
          </Section>

          {/* Authors */}
          <Section title="Authors">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {article.authors?.map((a, i) => (
                <div key={i}>
                  <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#111', marginBottom: '0.35rem' }}>{a.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <code style={{
                      flex: 1, fontSize: '0.78rem', fontFamily: 'monospace', color: '#1a6fa8',
                      backgroundColor: '#f0f7ff', padding: '0.35rem 0.6rem', borderRadius: '4px',
                      border: '1px solid #bee3f8', wordBreak: 'break-all', lineHeight: '1.5'
                    }}>
                      {a.content_fragment_path}
                    </code>
                    <CopyBtn copied={copied[`author_${i}`]} onCopy={() => copy(`author_${i}`, a.content_fragment_path)} />
                  </div>
                </div>
              ))}
            </div>
          </Section>

          </>)}

          {activeTab === 'content' && (<>

          {/* Key Findings */}
          {article.bullets?.length > 0 && (
            <Section title="Key Findings">
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem', gap: '0.4rem' }}>
                <CopyBtn label="Copy" copied={copied['bullets_rich']}
                  onCopy={() => copyRich('bullets_rich', buildKeyFindingsHtml(article.bullets))} />
                <CopyBtn label="Copy plain text" copied={copied['bullets']}
                  onCopy={() => copy('bullets', article.bullets.map((b, i) => `${i + 1}. ${b}`).join('\n'))} />
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'grid', gap: '0.4rem' }}>
                {article.bullets.map((b, i) => (
                  <li key={i} style={{ fontSize: '0.875rem', color: '#333', lineHeight: '1.6' }}>{b}</li>
                ))}
              </ul>
            </Section>
          )}

          {/* Body blocks */}
          <div>
            <h2 style={sectionTitleStyle}>Body</h2>
            <div style={{ display: 'grid', gap: '8px' }}>
              {article.body_blocks?.map((block, blockIdx) => {

                if (block.type === 'text') return (
                  <div key={blockIdx} style={{ backgroundColor: 'white', border: '1px solid #e5e5e5', borderRadius: '8px', overflow: 'hidden' }}>
                    <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ccc', display: 'inline-block' }} />
                        <span style={{ fontSize: '11px', fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Text block {blockIdx + 1}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <CopyBtn label="Copy" copied={copied[`block_rich_${blockIdx}`]}
                          onCopy={() => copyRich(`block_rich_${blockIdx}`, wrapBodyHtml(block.html))} />
                        <CopyBtn label="Copy plain text" copied={copied[`block_${blockIdx}`]}
                          onCopy={() => copy(`block_${blockIdx}`, stripHtml(block.html))} />
                      </div>
                    </div>
                    <div style={{ padding: '12px', fontSize: '0.875rem', lineHeight: '1.7', color: '#333' }}
                      dangerouslySetInnerHTML={{ __html: (block.html || '')
                        .replace(/<h2>/g, '<h2 style="font-size:1.1rem;font-weight:700;color:#111;margin:1rem 0 0.5rem">')
                        .replace(/<h3>/g, '<h3 style="font-size:1rem;font-weight:700;color:#111;margin:0.75rem 0 0.4rem">')
                        .replace(/<a /g, '<a style="color:#c8102e;text-decoration:underline" ')
                        .replace(/<sup>/g, '<sup style="font-size:0.7em;color:#c8102e;font-weight:600">')
                      }} />
                  </div>
                )

                if (block.type === 'exhibit') {
                  const resolvedIdx = block.sharepoint_index ?? block.exhibit_index
                  const exhibit = resolveExhibit({ ...block, sharepoint_index: resolvedIdx }, exhibitPaths)
                  return (
                    <div key={blockIdx} style={{ backgroundColor: 'white', border: '1px solid #e5e5e5', borderRadius: '8px', overflow: 'hidden' }}>
                      <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#1D9E75', display: 'inline-block' }} />
                          <span style={{ fontSize: '11px', fontWeight: '600', color: '#1D9E75', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Exhibit</span>
                          {block.match_confidence === 'low' && (
                            <span style={{ fontSize: '11px', color: '#a87a1a', fontWeight: '600' }}>⚠ Uncertain match</span>
                          )}
                        </div>
                      </div>
                      <div style={{ padding: '12px', display: 'grid', gap: '10px' }}>
                        {block.title && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ flex: 1, fontSize: '1rem', fontWeight: '700', color: '#111' }}>{block.title}</span>
                            <CopyBtn label="Copy" copied={copied[`etitle_rich_${blockIdx}`]}
                              onCopy={() => copyRich(`etitle_rich_${blockIdx}`, `<p><span style="${inlineStyle(MSCI_STYLES.headline3)}">${block.title}</span></p>`)} />
                            <CopyBtn label="Copy plain text" copied={copied[`etitle_${blockIdx}`]} onCopy={() => copy(`etitle_${blockIdx}`, block.title)} />
                          </div>
                        )}
                        <ExhibitAsset exhibit={exhibit} onExpired={refreshAssets} />
                        <div style={{ backgroundColor: '#f9fafb', borderRadius: '6px', padding: '0.75rem', border: '1px solid #eee' }}>
                          {exhibit ? (
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.5rem' }}>
                                <span style={{
                                  fontSize: '0.72rem', fontWeight: '700', padding: '0.15rem 0.5rem',
                                  borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.04em',
                                  backgroundColor: exhibit.exhibit_type === 'interactive' ? '#fef3c7' : '#e0f2fe',
                                  color: exhibit.exhibit_type === 'interactive' ? '#92400e' : '#0369a1'
                                }}>
                                  {exhibit.exhibit_type === 'interactive' ? '⚡ Interactive' : '🖼 Static'}
                                </span>
                              </div>
                              {exhibit.exhibit_type === 'static' ? (
                                <div style={{ display: 'grid', gap: '0.35rem' }}>
                                  <FileRow label="Desktop" filename={exhibit.desktop?.filename} copied={copied[`edesk_${blockIdx}`]} onCopy={() => copy(`edesk_${blockIdx}`, exhibit.desktop?.filename || '')} />
                                  {exhibit.mobile && <FileRow label="Mobile" filename={exhibit.mobile?.filename} copied={copied[`emob_${blockIdx}`]} onCopy={() => copy(`emob_${blockIdx}`, exhibit.mobile?.filename || '')} />}
                                </div>
                              ) : (
                                <div style={{ display: 'grid', gap: '0.35rem' }}>
                                  <FileRow label="JSON" filename={exhibit.json?.filename} copied={copied[`ejson_${blockIdx}`]} onCopy={() => copy(`ejson_${blockIdx}`, exhibit.json?.filename || '')} />
                                  {exhibit.html && <FileRow label="HTML" filename={exhibit.html?.filename} />}
                                </div>
                              )}
                            </div>
                          ) : (
                            <p style={{ color: '#999', fontSize: '0.85rem', margin: 0 }}>⚠ No SharePoint file found for this exhibit.</p>
                          )}
                          {exhibitOptions.length > 0 && (
                            <div style={{ marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid #e5e5e5' }}>
                              <label style={{ fontSize: '0.72rem', color: '#999', display: 'block', marginBottom: '0.3rem', fontWeight: '600', textTransform: 'uppercase' }}>Override assignment</label>
                              <select value={resolvedIdx ?? ''}
                                onChange={e => reassignExhibit(blockIdx, parseInt(e.target.value))}
                                disabled={savingBlocks}
                                style={{ width: '100%', padding: '0.35rem 0.5rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.8rem', backgroundColor: 'white' }}>
                                {exhibitOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                              </select>
                            </div>
                          )}
                        </div>
                        {block.caption && (
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                            <span style={{ flex: 1, fontSize: '0.82rem', color: '#666', lineHeight: '1.5', fontStyle: 'italic' }}>{block.caption}</span>
                            <CopyBtn label="Copy" copied={copied[`ecap_rich_${blockIdx}`]}
                              onCopy={() => copyRich(`ecap_rich_${blockIdx}`, buildCaptionHtml(block.caption))} />
                            <CopyBtn label="Copy plain text" copied={copied[`ecap_${blockIdx}`]} onCopy={() => copy(`ecap_${blockIdx}`, block.caption)} />
                          </div>
                        )}
                      </div>
                    </div>
                  )
                }
                return null
              })}
            </div>
          </div>

          {/* Footnotes */}
          {article.footnotes?.length > 0 && (
            <Section title={`Footnotes (${article.footnotes.length})`}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem', gap: '0.4rem' }}>
                <CopyBtn label="Copy" copied={copied['footnotes_rich']}
                  onCopy={() => copyRich('footnotes_rich', buildFootnotesHtml(article.footnotes))} />
                <CopyBtn label="Copy plain text" copied={copied['footnotes']}
                  onCopy={() => copy('footnotes', article.footnotes.map(f => `${f.number} ${stripHtml(f.text)}`).join('\n'))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {article.footnotes.map((f, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.4rem' }}>
                    <span style={{ flexShrink: 0, fontSize: '0.82rem', color: '#555' }}>{f.number}</span>
                    <span style={{ fontSize: '0.82rem', color: '#555', lineHeight: '1.6' }}
                      dangerouslySetInnerHTML={{ __html: f.text.replace(/<a /g, '<a style="color:#c8102e;text-decoration:underline" ') }} />
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Related Content */}
          <Section title="Related Content">
            {article.related_warning && (
              <div style={{ marginBottom: '0.75rem', padding: '0.6rem 0.75rem', backgroundColor: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '6px', fontSize: '0.8rem', color: '#92400e' }}>
                ⚠ {article.related_warning}
              </div>
            )}
            {article.related_resources?.length > 0 ? (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {article.related_resources.map((r, i) => (
                  <div key={i} style={{ padding: '0.875rem', backgroundColor: '#fafafa', borderRadius: '6px', border: '1px solid #ebebeb', display: 'grid', gap: '0.6rem' }}>
                    <RelatedRow label="Title" value={r.title} copied={copied[`rt_${i}`]} onCopy={() => copy(`rt_${i}`, r.title)} />
                    <RelatedRow label="Meta Description" value={r.meta_description} missing={!r.meta_description} copied={copied[`rm_${i}`]} onCopy={() => copy(`rm_${i}`, r.meta_description)} />
                    <RelatedRow label="Original URL" value={getDisplayUrl(r.original_url || r.url)} link copied={copied[`ro_${i}`]} onCopy={() => copy(`ro_${i}`, getDisplayUrl(r.original_url || r.url))} />
                    <RelatedRow label="AEM Path" value={r.aem_path || getAemPath(r.original_url || r.url)} mono copied={copied[`ru_${i}`]} onCopy={() => copy(`ru_${i}`, r.aem_path || getAemPath(r.original_url || r.url))} />
                    <RelatedRow label="CTA Label" value={r.cta_label || 'Read more'} copied={copied[`rc_${i}`]} onCopy={() => copy(`rc_${i}`, r.cta_label || 'Read more')} />
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#999', fontSize: '0.875rem', margin: 0 }}>No related resources.</p>
            )}
          </Section>

          </>)}

        </div>

        {/* ── Sidebar ── */}
        <aside style={s.sidebar}>

          <div style={s.sideLabel}>Preview</div>

          <a href={`/preview/${id}`} target="_blank" rel="noopener noreferrer" style={{
            ...s.actionBtn, backgroundColor: '#f0f7ff', borderColor: '#bee3f8', color: '#1a6fa8'
          }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M2 8s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5z" stroke="currentColor" strokeWidth="1.2"/>
              <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
            Open preview
          </a>

          <button onClick={copyPreviewLink} style={{
            ...s.actionBtn,
            color: previewCopied ? '#16a34a' : '#222',
            borderColor: previewCopied ? '#86efac' : '#e0e0e0',
            backgroundColor: previewCopied ? '#f0fff4' : 'white'
          }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              {previewCopied
                ? <path d="M3 8l4 4 6-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                : <path d="M10 2h4v4M14 2l-6 6M7 3H3a1 1 0 00-1 1v9a1 1 0 001 1h9a1 1 0 001-1V9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              }
            </svg>
            {previewCopied ? 'Link copied!' : 'Copy preview link'}
          </button>

          {article.sharepoint_folder_url && (
            <a href={article.sharepoint_folder_url} target="_blank" rel="noopener noreferrer" style={{
              ...s.actionBtn, backgroundColor: '#f3f0ff', borderColor: '#ddd6fe', color: '#6d28d9'
            }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h5l2 2h5a1 1 0 011 1v6a1 1 0 01-1 1H2a1 1 0 01-1-1V5a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              SharePoint folder
            </a>
          )}

          <div style={s.sideDivider} />
          <div style={s.sideLabel}>Publish</div>

          <button onClick={publishAssetsToDAM} style={{ ...s.actionBtn, backgroundColor: '#fff1f2', borderColor: '#fecaca', color: '#c8102e' }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            Publish assets to AEM DAM
          </button>

          <button onClick={createAEMPage} style={{ ...s.actionBtn, backgroundColor: '#fefce8', borderColor: '#fde68a', color: '#92400e' }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M4 2h5l4 4v8a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <path d="M9 2v4h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <path d="M6 10h4M8 8v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            Create AEM Page
          </button>

          <button onClick={() => {
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url; a.download = `${article.slug}.json`; a.click()
          }} style={s.actionBtn}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M8 2v8M5 7l3 3 3-3M3 12h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            Export JSON
          </button>

          <button onClick={refreshAssets} disabled={refreshing} style={{
            ...s.actionBtn, color: refreshing ? '#999' : '#222', cursor: refreshing ? 'not-allowed' : 'pointer'
          }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M3 8a5 5 0 109.9-1M13 3v4h-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            {refreshing ? 'Refreshing...' : 'Refresh assets'}
          </button>
          {refreshError && <p style={{ fontSize: '11px', color: '#cc0000', margin: '2px 0 0' }}>{refreshError}</p>}

          <button onClick={rescanExhibits} disabled={rescanning || !article.sharepoint_folder_url} style={{
            ...s.actionBtn,
            color: rescanning ? '#999' : '#0369a1',
            borderColor: '#bae6fd',
            backgroundColor: rescanning ? '#f8fafc' : '#f0f9ff',
            cursor: (rescanning || !article.sharepoint_folder_url) ? 'not-allowed' : 'pointer',
            opacity: !article.sharepoint_folder_url ? 0.5 : 1
          }} title={!article.sharepoint_folder_url ? 'No SharePoint folder URL on this article' : 'Re-read the SharePoint folder and update exhibits'}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M2 8h3l2-5 2 10 2-5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {rescanning ? 'Re-scanning...' : 'Re-scan exhibits'}
          </button>
          {rescanError && <p style={{ fontSize: '11px', color: '#cc0000', margin: '2px 0 0' }}>{rescanError}</p>}
          {rescanMsg && <p style={{ fontSize: '11px', color: '#16a34a', margin: '2px 0 0' }}>{rescanMsg}</p>}

          <div style={s.sideDivider} />
          <div style={s.sideLabel}>Settings</div>

          <div style={{ display: 'grid', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: '#999' }}>Status</label>
            <select value={article.status}
              onChange={async e => {
                const { data } = await supabase.from('articles').update({ status: e.target.value }).eq('id', id).select().single()
                if (data) setArticle(data)
              }}
              style={{ padding: '5px 8px', border: '1px solid #ddd', borderRadius: '5px', fontSize: '12px', backgroundColor: 'white', color: '#222' }}>
              <option value="in-progress">In Progress</option>
              <option value="in-review">In Review</option>
              <option value="approved">Approved</option>
              <option value="published">Published</option>
            </select>
          </div>

          <div style={{ display: 'grid', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: '#999' }}>Publication date</label>
            <input type="date" defaultValue={article.publish_date || ''}
              onChange={async e => {
                await supabase.from('articles').update({ publish_date: e.target.value }).eq('id', id)
                setArticle(prev => ({ ...prev, publish_date: e.target.value }))
              }}
              style={{ padding: '5px 8px', border: '1px solid #ddd', borderRadius: '5px', fontSize: '12px', width: '100%' }} />
          </div>

          <div style={{ flex: 1 }} />
          <div style={s.sideDivider} />

          <button onClick={async () => {
            if (!confirm('Delete this article? This cannot be undone.')) return
            await supabase.from('articles').delete().eq('id', id)
            router.push('/dashboard')
          }} style={{ ...s.actionBtn, color: '#cc0000', borderColor: '#fecaca', fontSize: '11px' }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M3 4h10l-1 9H4L3 4zM1 4h14M6 4V2h4v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            Delete article
          </button>

        </aside>
      </div>

      {/* AEM Script fullscreen modal */}
      {showPublishScript && publishScript && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '2rem',
        }} onClick={() => setShowPublishScript(false)}>
          <div style={{
            backgroundColor: '#0f172a', borderRadius: '16px',
            width: '100%', maxWidth: '820px', maxHeight: '90vh',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
            overflow: 'hidden',
          }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{
              padding: '1.25rem 1.5rem', borderBottom: '1px solid #1e293b',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9' }}>{scriptLabel}</h2>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  Paste in AEM Author DevTools console (F12)
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button onClick={() => copy('script', publishScript)} style={{
                  padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  fontSize: '0.85rem', fontWeight: 600,
                  backgroundColor: copied['script'] ? '#065f46' : '#3b82f6',
                  color: 'white', transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                  {copied['script'] ? (
                    <><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>Copied!</>
                  ) : (
                    <><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.3"/><path d="M3 11V3a1 1 0 011-1h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>Copy script</>
                  )}
                </button>
                <button onClick={() => setShowPublishScript(false)} style={{
                  padding: '8px', borderRadius: '8px', border: '1px solid #334155',
                  backgroundColor: 'transparent', color: '#94a3b8', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </button>
              </div>
            </div>
            {/* Steps */}
            <div style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid #1e293b', display: 'flex', gap: '1.5rem' }}>
              {['Open AEM Author', 'DevTools (F12) \u2192 Console', 'Paste & Enter'].map((step, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    width: '22px', height: '22px', borderRadius: '50%',
                    backgroundColor: '#1e293b', color: '#94a3b8',
                    fontSize: '0.7rem', fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{i + 1}</span>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{step}</span>
                </div>
              ))}
            </div>
            {/* Code */}
            <div style={{ flex: 1, overflow: 'auto', padding: '1.25rem 1.5rem' }}>
              <pre style={{
                margin: 0, fontSize: '0.82rem', lineHeight: '1.65',
                color: '#e2e8f0', fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>{publishScript}</pre>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// ─── Shared sub-components ────────────────────────────────────────────────────

const labelStyle = { fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#999' }
const sectionTitleStyle = { fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#999', marginBottom: '0.5rem', marginTop: 0 }

function Section({ title, children }) {
  return (
    <div>
      <h2 style={sectionTitleStyle}>{title}</h2>
      <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e5e5e5', padding: '1rem' }}>
        {children}
      </div>
    </div>
  )
}

function Divider() {
  return <div style={{ height: '1px', backgroundColor: '#f5f5f5', margin: '0.65rem 0' }} />
}

function FieldRow({ label, value, mono, bold, copied, onCopy }) {
  return (
    <div>
      <span style={{ ...labelStyle, display: 'block', marginBottom: '0.3rem' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
        <span style={{
          flex: 1, fontSize: mono ? '0.82rem' : '0.875rem', lineHeight: '1.5',
          fontFamily: mono ? 'monospace' : 'inherit', fontWeight: bold ? '600' : '400',
          color: '#333', wordBreak: 'break-all'
        }}>
          {value || <span style={{ color: '#ccc' }}>—</span>}
        </span>
        <CopyBtn copied={copied} onCopy={onCopy} />
      </div>
    </div>
  )
}

function FileRow({ label, filename, copied, onCopy }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <span style={{ fontSize: '0.72rem', color: '#999', minWidth: '52px' }}>{label}</span>
      <code style={{ flex: 1, fontSize: '0.78rem', color: '#444' }}>{filename}</code>
      {onCopy && <CopyBtn copied={copied} onCopy={onCopy} />}
    </div>
  )
}

function RelatedRow({ label, value, mono, link, missing, copied, onCopy }) {
  return (
    <div>
      <span style={{ ...labelStyle, display: 'block', marginBottom: '0.2rem' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
        {link ? (
          <a href={value} target="_blank" rel="noreferrer" style={{ flex: 1, fontSize: '0.82rem', color: '#0066cc', wordBreak: 'break-all', lineHeight: '1.5' }}>{value}</a>
        ) : (
          <span style={{
            flex: 1, fontSize: '0.82rem', lineHeight: '1.5', wordBreak: 'break-all',
            fontFamily: mono ? 'monospace' : 'inherit',
            color: missing ? '#cc0000' : mono ? '#1a6fa8' : '#444',
            fontStyle: missing ? 'italic' : 'normal'
          }}>
            {value || '⚠ No meta description available.'}
          </span>
        )}
        {onCopy && !missing && <CopyBtn copied={copied} onCopy={onCopy} />}
      </div>
    </div>
  )
}

function CopyBtn({ onCopy, copied, label = 'Copy' }) {
  return (
    <button onClick={onCopy} style={{
      flexShrink: 0, padding: '0.25rem 0.6rem', fontSize: '0.72rem',
      border: '1px solid', borderRadius: '4px', cursor: 'pointer',
      backgroundColor: copied ? '#f0fff4' : 'white',
      borderColor: copied ? '#86efac' : '#e0e0e0',
      color: copied ? '#16a34a' : '#666',
      whiteSpace: 'nowrap', fontWeight: copied ? '600' : '400', transition: 'all 0.15s'
    }}>
      {copied ? '✓' : label}
    </button>
  )
}