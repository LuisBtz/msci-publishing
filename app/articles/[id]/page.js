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
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState('')
  const [exhibitOverrides, setExhibitOverrides] = useState({})
  const [previewCopied, setPreviewCopied] = useState(false)
  const { copied, copy, copyRich } = useCopy()

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

  const publishToAEM = () => {
    const exhibitPaths = article.exhibit_paths || null
    const bodyHtml = (article.body_blocks || []).map(block => {
      if (block.type === 'text') return block.html || ''
      if (block.type === 'exhibit') {
        const resolvedIdx = block.sharepoint_index ?? block.exhibit_index
        const exhibit = resolveExhibit({ ...block, sharepoint_index: resolvedIdx }, exhibitPaths)
        const filename = exhibit?.exhibit_type === 'static' ? exhibit?.desktop?.filename : exhibit?.json?.filename
        return [
          block.title ? `<h3>${block.title}</h3>` : '',
          `<!-- EXHIBIT: ${filename || 'unknown'} -->`,
          block.caption ? `<p class="caption">${block.caption}</p>` : ''
        ].filter(Boolean).join('')
      }
      return ''
    }).join('\n')

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

    const cfPayload = {
      properties: {
        'cq:model': '/conf/global/settings/dam/cfm/models/blog-post-test',
        title: article.headline,
        elements: {
          headline: { value: article.headline || '' },
          slug: { value: article.slug || '' },
          publishDate: { value: article.publish_date || '' },
          body: { value: bodyHtml, ':type': 'text/html' }
        }
      }
    }

    const esc = s => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`')
    const exhibitsJson = esc(JSON.stringify(exhibitAssets))
    const bannersJson = esc(JSON.stringify(bannerAssets))
    const cfJson = esc(JSON.stringify(cfPayload))
    const slug = article.slug
    const title = article.headline

    const script = `
(async () => {
  const token = (await fetch('/libs/granite/csrf/token.json').then(r=>r.json())).token;
  const h = { 'Content-Type': 'application/json', 'CSRF-Token': token };
  const base = '/api/assets/test-fragments/blog-posts';
  async function uploadAsset(url, destPath) {
    try {
      const blob = await fetch(url).then(r => r.blob());
      const fd = new FormData();
      fd.append('file', blob, destPath.split('/').pop());
      fd.append('fileName', destPath.split('/').pop());
      const r = await fetch(destPath, { method: 'POST', headers: { 'CSRF-Token': token }, body: fd });
      return r.status;
    } catch(e) { return e.message; }
  }
  async function createFolder(path, title) {
    const r = await fetch(path, { method: 'POST', headers: h, body: JSON.stringify({ class: 'assetFolder', properties: { title } }) });
    return r.status;
  }
  let s = await createFolder(\`\${base}/${slug}\`, \`${title}\`);
  console.log('1. Article folder:', s, s===201?'✅ Created':s===409?'⚠ Exists':'❌');
  s = await createFolder(\`\${base}/${slug}/exhibits\`, 'Exhibits');
  console.log('2. Exhibits folder:', s, s===201?'✅ Created':s===409?'⚠ Exists':'❌');
  s = await createFolder(\`\${base}/${slug}/banners\`, 'Banners');
  console.log('3. Banners folder:', s, s===201?'✅ Created':s===409?'⚠ Exists':'❌');
  s = await fetch(\`\${base}/${slug}/${slug}\`, { method: 'POST', headers: h, body: \`${cfJson}\` }).then(r=>r.status);
  console.log('4. Content Fragment:', s, s===201?'✅ Created':s===409?'⚠ Exists':'❌');
  const exhibits = JSON.parse(\`${exhibitsJson}\`);
  console.log(\`5. Uploading \${exhibits.length} exhibit(s)...\`);
  for (const a of exhibits) {
    s = await uploadAsset(a.url, \`\${base}/${slug}/exhibits/\${a.filename}\`);
    console.log(\`   \${a.filename}:\`, s, s===201?'✅':s===409?'⚠ Exists':'❌');
  }
  const banners = JSON.parse(\`${bannersJson}\`);
  console.log(\`6. Uploading \${banners.length} banner(s)...\`);
  for (const a of banners) {
    s = await uploadAsset(a.url, \`\${base}/${slug}/banners/\${a.filename}\`);
    console.log(\`   \${a.filename}:\`, s, s===201?'✅':s===409?'⚠ Exists':'❌');
  }
  console.log('\\n✅ Done! View at: /ui#/aem/assets.html/content/dam/test-fragments/blog-posts/${slug}');
})();
`.trim()

    setPublishScript(script)
    setShowPublishScript(true)
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
  const exhibitOptions = exhibitPaths?.summary?.map((e, i) => ({
    value: i,
    label: e.type === 'static'
      ? `[Static] ${e.base_name} (${e.desktop_filename})`
      : `[Interactive] ${e.base_name} (${e.json_filename})`
  })) || []

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
      alignItems: 'start'
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

          {/* Key Findings */}
          {article.bullets?.length > 0 && (
            <Section title="Key Findings">
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem', gap: '0.4rem' }}>
                <CopyBtn label="Copy styled" copied={copied['bullets_rich']}
                  onCopy={() => copyRich('bullets_rich', buildKeyFindingsHtml(article.bullets))} />
                <CopyBtn label="Copy text" copied={copied['bullets']}
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
                        <CopyBtn label="Copy styled" copied={copied[`block_rich_${blockIdx}`]}
                          onCopy={() => copyRich(`block_rich_${blockIdx}`, wrapBodyHtml(block.html))} />
                        <CopyBtn label="Copy HTML" copied={copied[`block_${blockIdx}`]}
                          onCopy={() => copy(`block_${blockIdx}`, block.html)} />
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
                  const overrideIdx = exhibitOverrides[blockIdx]
                  const resolvedIdx = overrideIdx ?? block.sharepoint_index ?? block.exhibit_index
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
                            <CopyBtn label="Styled" copied={copied[`etitle_rich_${blockIdx}`]}
                              onCopy={() => copyRich(`etitle_rich_${blockIdx}`, `<p><span style="${inlineStyle(MSCI_STYLES.headline3)}">${block.title}</span></p>`)} />
                            <CopyBtn copied={copied[`etitle_${blockIdx}`]} onCopy={() => copy(`etitle_${blockIdx}`, `<h3>${block.title}</h3>`)} />
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
                              <select value={overrideIdx ?? resolvedIdx ?? ''}
                                onChange={e => setExhibitOverrides(prev => ({ ...prev, [blockIdx]: parseInt(e.target.value) }))}
                                style={{ width: '100%', padding: '0.35rem 0.5rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.8rem', backgroundColor: 'white' }}>
                                {exhibitOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                              </select>
                            </div>
                          )}
                        </div>
                        {block.caption && (
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                            <span style={{ flex: 1, fontSize: '0.82rem', color: '#666', lineHeight: '1.5', fontStyle: 'italic' }}>{block.caption}</span>
                            <CopyBtn label="Styled" copied={copied[`ecap_rich_${blockIdx}`]}
                              onCopy={() => copyRich(`ecap_rich_${blockIdx}`, buildCaptionHtml(block.caption))} />
                            <CopyBtn copied={copied[`ecap_${blockIdx}`]} onCopy={() => copy(`ecap_${blockIdx}`, block.caption)} />
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
                <CopyBtn label="Copy styled" copied={copied['footnotes_rich']}
                  onCopy={() => copyRich('footnotes_rich', buildFootnotesHtml(article.footnotes))} />
                <CopyBtn label="Copy HTML" copied={copied['footnotes']}
                  onCopy={() => copy('footnotes', article.footnotes.map(f => `<p>${f.number} ${f.text}</p>`).join('\n'))} />
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

          {/* AEM Script output */}
          {showPublishScript && publishScript && (
            <Section title="AEM Publish Script">
              <div style={{ backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <p style={{ fontSize: '0.85rem', fontWeight: '600', color: '#0c4a6e', margin: 0 }}>Script ready for AEM console</p>
                  <CopyBtn label="Copy script" copied={copied['script']} onCopy={() => copy('script', publishScript)} />
                </div>
                <p style={{ fontSize: '0.8rem', color: '#075985', margin: '0 0 0.75rem', lineHeight: '1.6' }}>
                  1. Open{' '}
                  <a href="https://author-p125318-e1369672.adobeaemcloud.com" target="_blank" rel="noreferrer" style={{ color: '#1a6fa8' }}>
                    AEM Author
                  </a><br />
                  2. DevTools (F12) → Console<br />
                  3. Paste the script and press Enter
                </p>
                <code style={{
                  display: 'block', backgroundColor: '#e0f2fe', padding: '0.75rem', borderRadius: '4px',
                  fontSize: '0.72rem', wordBreak: 'break-all', lineHeight: '1.5', color: '#0c4a6e',
                  maxHeight: '120px', overflowY: 'auto', whiteSpace: 'pre-wrap'
                }}>
                  {publishScript}
                </code>
              </div>
            </Section>
          )}

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

          <div style={s.sideDivider} />
          <div style={s.sideLabel}>Publish</div>

          <button onClick={publishToAEM} style={{ ...s.actionBtn, backgroundColor: '#fff1f2', borderColor: '#fecaca', color: '#c8102e' }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            Publish to AEM
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