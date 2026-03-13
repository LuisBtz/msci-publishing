'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/useAuth'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import TabPreview from './components/TabPreview'
import ExhibitAsset from './components/ExhibitAsset'

function useCopy() {
  const [copied, setCopied] = useState({})
  const copy = (key, text) => {
    navigator.clipboard.writeText(text || '')
    setCopied(prev => ({ ...prev, [key]: true }))
    setTimeout(() => setCopied(prev => ({ ...prev, [key]: false })), 2000)
  }
  return { copied, copy }
}

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

export default function ArticlePage() {
  const { user, loading } = useAuth()
  const { id } = useParams()
  const router = useRouter()
  const [article, setArticle] = useState(null)
  const [loadingArticle, setLoadingArticle] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('overview')
  const [fetchingMeta, setFetchingMeta] = useState(false)
  const [publishScript, setPublishScript] = useState('')
  const [showPublishScript, setShowPublishScript] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState('')
  const [exhibitOverrides, setExhibitOverrides] = useState({})
  const { copied, copy } = useCopy()

  useEffect(() => { if (user && id) fetchArticle() }, [user, id])

  const fetchArticle = async () => {
    const { data, error } = await supabase.from('articles').select('*').eq('id', id).single()
    if (error) setError('Artículo no encontrado')
    else {
      setArticle(data)
      // Do not auto-fetch meta descriptions to keep initial processing lightweight.
    // Users can fetch meta on demand via the Related Content section.
    }
    setLoadingArticle(false)
  }

  const [metaLoading, setMetaLoading] = useState({})

  const fetchMetaForResource = async (index) => {
    const resource = article.related_resources?.[index]
    if (!resource) return

    const url = getDisplayUrl(resource.original_url || resource.url)
    if (!url) return

    setMetaLoading(prev => ({ ...prev, [index]: true }))
    try {
      const res = await fetch('/api/fetch-meta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: [url] })
      })
      const { results } = await res.json()
      const meta = results?.[0]
      if (meta) {
        const updated = (article.related_resources || []).map((r, i) => {
          if (i !== index) return r
          return {
            ...r,
            meta_description: r.meta_description && r.meta_description.trim().length > 0
              ? r.meta_description
              : (meta.metaDescription || ''),
            title: r.title && r.title.trim().length > 0 ? r.title : (meta.title || '')
          }
        })
        await supabase.from('articles').update({ related_resources: updated }).eq('id', id)
        setArticle(prev => ({ ...prev, related_resources: updated }))
      }
    } catch (e) {
      console.error('Error fetching meta:', e)
    }
    setMetaLoading(prev => ({ ...prev, [index]: false }))
  }

  const refreshAssets = async () => {
    setRefreshing(true)
    setRefreshError('')
    try {
      const res = await fetch('/api/sharepoint/refresh-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: id })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al refrescar')
      setArticle(prev => ({
        ...prev,
        exhibit_paths: data.exhibit_paths,
        banner_paths: data.banner_paths,
        body_blocks: data.body_blocks
      }))
    } catch (err) {
      setRefreshError(err.message)
    }
    setRefreshing(false)
  }

  const publishToAEM = () => {
    const bodyHtml = (article.body_blocks || []).map(block => {
      if (block.type === 'text') return block.html || ''
      if (block.type === 'exhibit') {
        const resolvedIdx = block.sharepoint_index ?? block.exhibit_index
        const exhibit = resolveExhibit({ ...block, sharepoint_index: resolvedIdx }, exhibitPaths)
        const filename = exhibit?.exhibit_type === 'static'
          ? exhibit?.desktop?.filename
          : exhibit?.json?.filename
        return [
          block.title ? `<h3>${block.title}</h3>` : '',
          `<!-- EXHIBIT: ${filename || 'unknown'} -->`,
          block.caption ? `<p class="caption">${block.caption}</p>` : ''
        ].filter(Boolean).join('')
      }
      return ''
    }).join('\n')

    // Build exhibits asset list
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

    // Build banners asset list — only .webp files
    const bannerAssets = []
    if (article.banner_paths) {
      Object.values(article.banner_paths).forEach(b => {
        if (b?.downloadUrl && b?.filename?.endsWith('.webp')) {
          bannerAssets.push({ url: b.downloadUrl, filename: b.filename })
        }
      })
    }

    const cfPayload = {
      properties: {
        'cq:model': '/conf/global/settings/dam/cfm/models/blog-post-test',
        'title': article.headline,
        'elements': {
          'headline': { 'value': article.headline || '' },
          'slug': { 'value': article.slug || '' },
          'publishDate': { 'value': article.publish_date || '' },
          'body': { 'value': bodyHtml, ':type': 'text/html' }
        }
      }
    }

    const exhibitsJson = JSON.stringify(exhibitAssets).replace(/\\/g, '\\\\').replace(/`/g, '\\`')
    const bannersJson = JSON.stringify(bannerAssets).replace(/\\/g, '\\\\').replace(/`/g, '\\`')
    const cfJson = JSON.stringify(cfPayload).replace(/\\/g, '\\\\').replace(/`/g, '\\`')
    const slug = article.slug
    const title = article.headline

    const script = `
(async () => {
  const token = (await fetch('/libs/granite/csrf/token.json').then(r=>r.json())).token;
  const h = { 'Content-Type': 'application/json', 'CSRF-Token': token };
  const base = '/api/assets/test-fragments/blog-posts';

  // Helper: upload a file from URL to AEM path
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

  // Helper: create folder
  async function createFolder(path, title) {
    const r = await fetch(path, { method: 'POST', headers: h, body: JSON.stringify({ class: 'assetFolder', properties: { title } }) });
    return r.status;
  }

  // 1. Create article folder
  let s = await createFolder(\`\${base}/${slug}\`, \`${title}\`);
  console.log('1. Article folder:', s, s===201?'✅ Created':s===409?'⚠ Exists':'❌');

  // 2. Create exhibits subfolder
  s = await createFolder(\`\${base}/${slug}/exhibits\`, 'Exhibits');
  console.log('2. Exhibits folder:', s, s===201?'✅ Created':s===409?'⚠ Exists':'❌');

  // 3. Create banners subfolder
  s = await createFolder(\`\${base}/${slug}/banners\`, 'Banners');
  console.log('3. Banners folder:', s, s===201?'✅ Created':s===409?'⚠ Exists':'❌');

  // 4. Create Content Fragment
  s = await fetch(\`\${base}/${slug}/${slug}\`, { method: 'POST', headers: h, body: \`${cfJson}\` }).then(r=>r.status);
  console.log('4. Content Fragment:', s, s===201?'✅ Created':s===409?'⚠ Exists':'❌');

  // 5. Upload exhibits
  const exhibits = JSON.parse(\`${exhibitsJson}\`);
  console.log(\`5. Uploading \${exhibits.length} exhibit(s)...\`);
  for (const a of exhibits) {
    s = await uploadAsset(a.url, \`\${base}/${slug}/exhibits/\${a.filename}\`);
    console.log(\`   \${a.filename}:\`, s, s===201?'✅':s===409?'⚠ Exists':'❌');
  }

  // 6. Upload banners
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

  const TYPE_LABELS = { 'blog-post': 'Blog Post', 'paper': 'Paper', 'quick-take': 'Quick Take', 'podcast': 'Podcast' }
  const STATUS_LABELS = { 'in-progress': 'In Progress', 'in-review': 'In Review', 'approved': 'Approved', 'published': 'Published' }
  const STATUS_COLORS = { 'in-progress': '#a87a1a', 'in-review': '#1a6fa8', 'approved': '#1a8a4a', 'published': '#555' }
  const wordTags = article.tags?.all_tags || []
  const getAemPath = (url) => {
    if (!url) return url
    // Already an AEM path
    if (url.startsWith('/content/')) return url

    try {
      const parsed = new URL(url, 'https://www.msci.com')
      const hostname = parsed.hostname.toLowerCase()
      const pathname = parsed.pathname

      // External URLs remain absolute
      if (!hostname.endsWith('msci.com')) return url
      if (hostname === 'support.msci.com') return url

      // /indexes/index/[NUMERIC_ID] stays absolute
      if (pathname.startsWith('/indexes/index/')) return url

      // /indexes/... → /content/ipc/us/en/indexes/...
      if (pathname.startsWith('/indexes/')) return `/content/ipc/us/en${pathname}`

      // Default → /content/msci/us/en/...
      return `/content/msci/us/en${pathname}`
    } catch {
      return url
    }
  }

  const getDisplayUrl = (url) => {
    if (!url) return ''

    // If already an AEM path, reconstruct msci.com link
    if (url.startsWith('/content/ipc/us/en/indexes')) {
      return `https://www.msci.com${url.replace('/content/ipc/us/en', '/indexes')}`
    }
    if (url.startsWith('/content/msci/us/en')) {
      return `https://www.msci.com${url.replace('/content/msci/us/en', '')}`
    }

    // If it's a relative path, assume msci.com base
    if (url.startsWith('/')) {
      return `https://www.msci.com${url}`
    }

    return url
  }

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

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'content', label: 'Content' },
    { id: 'preview', label: '👁 Preview' },
  ]

  return (
    <div style={{ fontFamily: 'sans-serif', minHeight: '100vh', backgroundColor: '#f5f5f5' }}>

      {/* Header */}
      <div style={{
        backgroundColor: 'black', color: 'white', padding: '0 2rem', height: '56px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        position: 'sticky', top: 0, zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => router.push('/dashboard')}
            style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '0.85rem' }}>
            ← Dashboard
          </button>
          <span style={{ color: '#444' }}>|</span>
          <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>MSCI</span>
          <span style={{ color: '#999', fontSize: '0.85rem' }}>Research Publishing Platform</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '600', padding: '0.25rem 0.6rem', borderRadius: '999px', backgroundColor: '#222', color: '#ccc' }}>
            {TYPE_LABELS[article.type] || article.type}
          </span>
          <span style={{ fontSize: '0.75rem', fontWeight: '600', padding: '0.25rem 0.6rem', borderRadius: '999px', backgroundColor: STATUS_COLORS[article.status] || '#555', color: 'white' }}>
            {STATUS_LABELS[article.status] || article.status}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e5e5', position: 'sticky', top: '56px', zIndex: 99 }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 2rem', display: 'flex' }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              padding: '1rem 1.25rem', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: '0.875rem', fontWeight: activeTab === tab.id ? '700' : '400',
              color: activeTab === tab.id ? '#111' : '#666',
              borderBottom: activeTab === tab.id ? '2px solid black' : '2px solid transparent',
              whiteSpace: 'nowrap'
            }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Preview — full width */}
      {activeTab === 'preview' ? (
        <div style={{ backgroundColor: 'white', minHeight: 'calc(100vh - 112px)' }}>
          <TabPreview article={article} />
        </div>
      ) : (
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>

          {/* ── OVERVIEW TAB ── */}
          {activeTab === 'overview' && (
            <div style={{ display: 'grid', gap: '1rem' }}>

              <Section title="Título">
                <FieldRow value={article.headline} bold copied={copied['headline']} onCopy={() => copy('headline', article.headline)} />
              </Section>

              <Section title="Slug">
                <FieldRow value={article.slug} mono copied={copied['slug']} onCopy={() => copy('slug', article.slug)} />
              </Section>

              <Section title="URL Final">
                <FieldRow value={article.final_url} mono copied={copied['url']} onCopy={() => copy('url', article.final_url)} />
              </Section>

              <Section title="Tags AEM">
                <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: '#666' }}>{wordTags.length} tags from document</span>
                  <CopyBtn label="Copy all" copied={copied['tags']} onCopy={() => copy('tags', wordTags.join(', '))} />
                </div>
                {wordTags.length > 0 ? (
                  <>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.75rem' }}>
                      {wordTags.map((tag, i) => (
                        <button key={i} onClick={() => copy(`tag_${i}`, tag)} title="Click para copiar" style={{
                          fontSize: '0.78rem', padding: '0.2rem 0.6rem', borderRadius: '4px',
                          backgroundColor: copied[`tag_${i}`] ? '#f0fff4' : '#f0f0f0',
                          color: copied[`tag_${i}`] ? '#16a34a' : '#333',
                          border: copied[`tag_${i}`] ? '1px solid #86efac' : '1px solid #e0e0e0',
                          cursor: 'pointer', fontWeight: copied[`tag_${i}`] ? '600' : '400', transition: 'all 0.15s'
                        }}>
                          {copied[`tag_${i}`] ? '✓ ' : ''}{tag}
                        </button>
                      ))}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#999', margin: 0 }}>
                      💡 Click each tag to copy individually, or use "Copy all".
                    </p>
                  </>
                ) : (
                  <p style={{ color: '#cc0000', fontSize: '0.85rem', margin: 0 }}>
                    ⚠ No tags found. Delete this article and process it again.
                  </p>
                )}
              </Section>

              {article.read_time && (
                <Section title="Read Time (minutes)">
                  <FieldRow value={String(article.read_time)} mono bold copied={copied['read_time']} onCopy={() => copy('read_time', String(article.read_time))} />
                </Section>
              )}

              <Section title="Meta Description">
                <FieldRow value={article.meta_description} copied={copied['meta']} onCopy={() => copy('meta', article.meta_description)} />
                <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.4rem' }}>
                  {article.meta_description?.length || 0} caracteres
                </div>
              </Section>

              <Section title="Authors">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {article.authors?.map((a, i) => (
                    <div key={i} style={{ padding: '0.75rem', backgroundColor: '#fafafa', borderRadius: '6px', border: '1px solid #e5e5e5' }}>
                      <div style={{ fontWeight: '600', fontSize: '0.95rem', color: '#111', marginBottom: '0.5rem' }}>{a.name}</div>
                      <div style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', color: '#999', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                        Content Fragment Path
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <code style={{
                          flex: 1, fontSize: '0.8rem', fontFamily: 'monospace', color: '#1a6fa8',
                          wordBreak: 'break-all', backgroundColor: '#f0f7ff', padding: '0.4rem 0.6rem',
                          borderRadius: '4px', border: '1px solid #bee3f8', display: 'block', lineHeight: '1.5'
                        }}>
                          {a.content_fragment_path}
                        </code>
                        <CopyBtn copied={copied[`author_${i}`]} onCopy={() => copy(`author_${i}`, a.content_fragment_path)} />
                      </div>
                    </div>
                  ))}
                </div>
              </Section>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <Section title="Estado">
                  <select value={article.status}
                    onChange={async e => {
                      const { data } = await supabase.from('articles').update({ status: e.target.value }).eq('id', id).select().single()
                      if (data) setArticle(data)
                    }}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.9rem', backgroundColor: 'white' }}>
                    <option value="in-progress">In Progress</option>
                    <option value="in-review">In Review</option>
                    <option value="approved">Approved</option>
                    <option value="published">Published</option>
                  </select>
                </Section>
                <Section title="Publication Date">
                  <input type="date" defaultValue={article.publish_date || ''}
                    onChange={async e => {
                      await supabase.from('articles').update({ publish_date: e.target.value }).eq('id', id)
                      setArticle(prev => ({ ...prev, publish_date: e.target.value }))
                    }}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                </Section>
              </div>

            </div>
          )}

          {/* ── CONTENT TAB ── */}
          {activeTab === 'content' && (
            <div style={{ display: 'grid', gap: '1rem' }}>

              {/* Bullets */}
              {article.bullets?.length > 0 && (
                <Section title="Key Findings">
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
                    <CopyBtn label="Copy all bullets" copied={copied['bullets']}
                      onCopy={() => copy('bullets', article.bullets.map((b, i) => `${i + 1}. ${b}`).join('\n'))} />
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                    {article.bullets.map((b, i) => (
                      <li key={i} style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: '#333', lineHeight: '1.5' }}>{b}</li>
                    ))}
                  </ul>
                </Section>
              )}

              {/* Body blocks */}
              {article.body_blocks?.map((block, blockIdx) => {

                if (block.type === 'text') {
                  return (
                    <Section key={blockIdx} title="Bloque de texto">
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
                        <CopyBtn label="Copy HTML" copied={copied[`block_${blockIdx}`]}
                          onCopy={() => copy(`block_${blockIdx}`, block.html)} />
                      </div>
                      <div style={{
                        fontSize: '0.9rem', lineHeight: '1.7', color: '#333',
                        padding: '1rem', backgroundColor: '#fafafa', borderRadius: '4px', border: '1px solid #eee'
                      }}
                        dangerouslySetInnerHTML={{ __html: (block.html || '')
                          .replace(/<h2>/g, '<h2 style="font-size:1.25rem;font-weight:700;color:#111;margin:1.5rem 0 0.75rem;line-height:1.3">')
                          .replace(/<h3>/g, '<h3 style="font-size:1.05rem;font-weight:700;color:#111;margin:1.25rem 0 0.5rem;line-height:1.3">')
                          .replace(/<a /g, '<a style="color:#c8102e;text-decoration:underline" ')
                          .replace(/<sup>/g, '<sup style="font-size:0.7em;color:#c8102e;font-weight:600">')
                        }} />
                    </Section>
                  )
                }

                if (block.type === 'exhibit') {
                  const overrideIdx = exhibitOverrides[blockIdx]
                  const resolvedIdx = overrideIdx ?? block.sharepoint_index ?? block.exhibit_index
                  const exhibit = resolveExhibit({ ...block, sharepoint_index: resolvedIdx }, exhibitPaths)

                  return (
                    <Section key={blockIdx} title="Exhibit">

                      {/* Título H3 */}
                      <div style={{ marginBottom: '0.75rem' }}>
                        <label style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', color: '#999', display: 'block', marginBottom: '0.25rem' }}>
                          Título (H3)
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ flex: 1, fontSize: '1.05rem', fontWeight: '700', color: '#111', lineHeight: '1.3' }}>{block.title}</span>
                          <CopyBtn copied={copied[`etitle_${blockIdx}`]}
                            onCopy={() => copy(`etitle_${blockIdx}`, `<h3>${block.title}</h3>`)} />
                        </div>
                      </div>

                      {/* Imagen */}
                      <div style={{ marginBottom: '0.75rem' }}>
                        <ExhibitAsset exhibit={exhibit} onExpired={refreshAssets} />
                      </div>

                      {/* Archivos + dropdown */}
                      <div style={{ backgroundColor: '#f5f5f5', borderRadius: '6px', padding: '1rem', marginBottom: '0.75rem', border: '1px solid #e5e5e5' }}>
                        {exhibit ? (
                          <div>
                            <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{
                                fontSize: '0.72rem', fontWeight: '700', padding: '0.2rem 0.5rem',
                                borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.05em',
                                backgroundColor: exhibit.exhibit_type === 'interactive' ? '#fef3c7' : '#e0f2fe',
                                color: exhibit.exhibit_type === 'interactive' ? '#92400e' : '#0369a1'
                              }}>
                                {exhibit.exhibit_type === 'interactive' ? '⚡ Interactive' : '🖼 Static SVG'}
                              </span>
                              {block.match_confidence === 'low' && (
                                <span style={{ fontSize: '0.72rem', color: '#a87a1a', fontWeight: '600' }}>
                                  ⚠ Uncertain match — verify file
                                </span>
                              )}
                            </div>

                            {exhibit.exhibit_type === 'static' ? (
                              <div style={{ display: 'grid', gap: '0.35rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span style={{ fontSize: '0.75rem', color: '#666', minWidth: '60px' }}>Desktop:</span>
                                  <code style={{ flex: 1, fontSize: '0.78rem', color: '#333' }}>{exhibit.desktop?.filename}</code>
                                  <CopyBtn copied={copied[`edesk_${blockIdx}`]}
                                    onCopy={() => copy(`edesk_${blockIdx}`, exhibit.desktop?.filename || '')} />
                                </div>
                                {exhibit.mobile && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.75rem', color: '#666', minWidth: '60px' }}>Mobile:</span>
                                    <code style={{ flex: 1, fontSize: '0.78rem', color: '#333' }}>{exhibit.mobile?.filename}</code>
                                    <CopyBtn copied={copied[`emob_${blockIdx}`]}
                                      onCopy={() => copy(`emob_${blockIdx}`, exhibit.mobile?.filename || '')} />
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div style={{ display: 'grid', gap: '0.35rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span style={{ fontSize: '0.75rem', color: '#666', minWidth: '40px' }}>JSON:</span>
                                  <code style={{ flex: 1, fontSize: '0.78rem', color: '#333' }}>{exhibit.json?.filename}</code>
                                  <CopyBtn copied={copied[`ejson_${blockIdx}`]}
                                    onCopy={() => copy(`ejson_${blockIdx}`, exhibit.json?.filename || '')} />
                                </div>
                                {exhibit.html && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.75rem', color: '#666', minWidth: '40px' }}>HTML:</span>
                                    <code style={{ flex: 1, fontSize: '0.78rem', color: '#333' }}>{exhibit.html?.filename}</code>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p style={{ color: '#999', fontSize: '0.85rem', margin: 0 }}>
                            ⚠ No se encontró archivo en SharePoint para este exhibit.
                          </p>
                        )}

                        {/* Dropdown override */}
                        {exhibitOptions.length > 0 && (
                          <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e0e0e0' }}>
                            <label style={{ fontSize: '0.72rem', color: '#999', display: 'block', marginBottom: '0.35rem', fontWeight: '600', textTransform: 'uppercase' }}>
                              Assign file manually
                            </label>
                            <select
                              value={overrideIdx ?? resolvedIdx ?? ''}
                              onChange={e => setExhibitOverrides(prev => ({ ...prev, [blockIdx]: parseInt(e.target.value) }))}
                              style={{ width: '100%', padding: '0.4rem 0.5rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.8rem', backgroundColor: 'white' }}>
                              {exhibitOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Caption */}
                      {block.caption && (
                        <div>
                          <label style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', color: '#999', display: 'block', marginBottom: '0.25rem' }}>Caption</label>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                            <span style={{ flex: 1, fontSize: '0.82rem', color: '#666', lineHeight: '1.5', fontStyle: 'italic' }}>{block.caption}</span>
                            <CopyBtn copied={copied[`ecap_${blockIdx}`]} onCopy={() => copy(`ecap_${blockIdx}`, block.caption)} />
                          </div>
                        </div>
                      )}

                    </Section>
                  )
                }

                return null
              })}

              {/* Footnotes */}
              {article.footnotes?.length > 0 && (
                <Section title={`Footnotes (${article.footnotes.length})`}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
                    <CopyBtn label="Copy HTML" copied={copied['footnotes']}
                      onCopy={() => copy('footnotes', article.footnotes.map(f => `<p>${f.number} ${f.text}</p>`).join('\n'))} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {article.footnotes.map((f, i) => (
                      <div key={i} style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start' }}>
                        <span style={{ flexShrink: 0, fontSize: '0.82rem', color: '#555', paddingTop: '1px' }}>{f.number}</span>
                        <span style={{ fontSize: '0.82rem', color: '#555', lineHeight: '1.6' }}
                          dangerouslySetInnerHTML={{ __html: f.text
                            .replace(/<a /g, '<a style="color:#c8102e;text-decoration:underline" ')
                            .replace(/<em>/g, '<em style="font-style:italic">')
                          }} />
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Related Content */}
                    <Section title={fetchingMeta ? 'Related Content — fetching meta descriptions...' : 'Related Content'}>
                    {article.related_warning && (
                        <div style={{
                        marginBottom: '1rem', padding: '0.6rem 0.75rem',
                        backgroundColor: '#fffbeb', border: '1px solid #fcd34d',
                        borderRadius: '6px', fontSize: '0.8rem', color: '#92400e', fontWeight: '500'
                        }}>
                        ⚠ {article.related_warning}
                        </div>
                    )}
                    {article.related_resources?.length > 0 ? (
                        <div style={{ display: 'grid', gap: '1rem' }}>
                        {article.related_resources.map((r, i) => (
                        <div key={i} style={{ padding: '1rem', backgroundColor: '#fafafa', borderRadius: '6px', border: '1px solid #e5e5e5' }}>
                        <div style={{ marginBottom: '0.75rem' }}>
                          <label style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', color: '#999', display: 'block', marginBottom: '0.25rem' }}>Title</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ flex: 1, fontSize: '0.9rem', color: '#111', fontWeight: '500' }}>{r.title}</span>
                            <CopyBtn copied={copied[`rt_${i}`]} onCopy={() => copy(`rt_${i}`, r.title)} />
                          </div>
                        </div>
                        <div style={{ marginBottom: '0.75rem' }}>
                          <label style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', color: '#999', display: 'block', marginBottom: '0.25rem' }}>Meta Description</label>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                            <span style={{ flex: 1, fontSize: '0.85rem', color: r.meta_description ? '#555' : '#cc0000', lineHeight: '1.5', fontStyle: r.meta_description ? 'normal' : 'italic' }}>
                              {r.meta_description || '⚠ No meta description available yet.'}
                            </span>
                            {!r.meta_description && (
                              <button
                                onClick={() => fetchMetaForResource(i)}
                                disabled={metaLoading[i]}
                                style={{
                                  padding: '0.3rem 0.6rem', borderRadius: '4px', border: '1px solid #ddd',
                                  backgroundColor: metaLoading[i] ? '#f0f0f0' : 'white', cursor: metaLoading[i] ? 'not-allowed' : 'pointer',
                                  fontSize: '0.75rem', fontWeight: '600', color: '#111'
                                }}
                              >
                                {metaLoading[i] ? 'Fetching…' : 'Fetch meta'}
                              </button>
                            )}
                            {r.meta_description && <CopyBtn copied={copied[`rm_${i}`]} onCopy={() => copy(`rm_${i}`, r.meta_description)} />}
                          </div>
                        </div>
                        <div style={{ marginBottom: '0.75rem' }}>
                          <label style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', color: '#999', display: 'block', marginBottom: '0.25rem' }}>Original URL</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <a href={getDisplayUrl(r.original_url || r.url)} target="_blank" rel="noreferrer" style={{ flex: 1, fontSize: '0.8rem', color: '#0066cc', wordBreak: 'break-all' }}>
                              {getDisplayUrl(r.original_url || r.url)}
                            </a>
                            <CopyBtn copied={copied[`ro_${i}`]} onCopy={() => copy(`ro_${i}`, getDisplayUrl(r.original_url || r.url))} />
                          </div>
                        </div>
                        <div style={{ marginBottom: '0.75rem' }}>
                          <label style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', color: '#999', display: 'block', marginBottom: '0.25rem' }}>AEM Path</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <code style={{ flex: 1, fontSize: '0.8rem', fontFamily: 'monospace', color: '#1a6fa8', wordBreak: 'break-all' }}>{r.aem_path || getAemPath(r.original_url || r.url)}</code>
                            <CopyBtn copied={copied[`ru_${i}`]} onCopy={() => copy(`ru_${i}`, r.aem_path || getAemPath(r.original_url || r.url))} />
                          </div>
                        </div>
                        <div>
                          <label style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', color: '#999', display: 'block', marginBottom: '0.25rem' }}>CTA Label</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ flex: 1, fontSize: '0.85rem', color: '#333', fontWeight: '500' }}>{r.cta_label || 'Read more'}</span>
                            <CopyBtn copied={copied[`rc_${i}`]} onCopy={() => copy(`rc_${i}`, r.cta_label || 'Read more')} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: '#999', fontSize: '0.9rem', margin: 0 }}>No related resources.</p>
                )}
              </Section>

              {/* Refresh Assets */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
                padding: '0.75rem 1rem', backgroundColor: '#f9fafb', border: '1px solid #e5e5e5', borderRadius: '8px'
              }}>
                <div>
                  <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#111' }}>SharePoint Assets</span>
                  <span style={{ fontSize: '0.78rem', color: '#999', marginLeft: '0.5rem' }}>Links expire ~1 hour after processing</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {refreshError && <span style={{ fontSize: '0.78rem', color: '#cc0000' }}>{refreshError}</span>}
                  <button onClick={refreshAssets} disabled={refreshing} style={{
                    backgroundColor: refreshing ? '#999' : '#111', color: 'white', border: 'none',
                    padding: '0.45rem 1rem', borderRadius: '4px', cursor: refreshing ? 'not-allowed' : 'pointer',
                    fontSize: '0.8rem', fontWeight: '600', whiteSpace: 'nowrap'
                  }}>
                    {refreshing ? '⏳ Refreshing...' : '🔄 Refresh assets'}
                  </button>
                </div>
              </div>

              {/* Export + Publish */}
              <div style={{ marginTop: '0.5rem', borderTop: '1px solid #e5e5e5', paddingTop: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#111', marginBottom: '0.25rem' }}>Export & Publish</div>
                    <div style={{ fontSize: '0.75rem', color: '#999' }}>Generate a script ready to run in the AEM console</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button onClick={() => {
                      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url; a.download = `${article.slug}.json`; a.click()
                    }} style={{ backgroundColor: 'white', color: '#333', border: '1px solid #ddd', padding: '0.65rem 1.2rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}>
                      ↓ Export JSON
                    </button>
                    <button onClick={publishToAEM} style={{ backgroundColor: '#c8102e', color: 'white', border: 'none', padding: '0.65rem 1.2rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}>
                      🚀 Publish to AEM
                    </button>
                  </div>
                </div>

                {showPublishScript && publishScript && (
                  <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <p style={{ fontSize: '0.85rem', fontWeight: '600', color: '#0c4a6e', margin: 0 }}>🚀 Script ready for AEM</p>
                      <CopyBtn label="Copy script" copied={copied['script']} onCopy={() => copy('script', publishScript)} />
                    </div>
                    <p style={{ fontSize: '0.8rem', color: '#075985', margin: '0 0 0.75rem', lineHeight: '1.6' }}>
                      1. Open AEM:{' '}
                      <a href="https://author-p125318-e1369672.adobeaemcloud.com" target="_blank" rel="noreferrer" style={{ color: '#1a6fa8' }}>
                        author-p125318-e1369672.adobeaemcloud.com
                      </a><br />
                      2. Open DevTools (F12) → Console<br />
                      3. Paste the script and press Enter — if you see <strong>Status: 201</strong> ✅ it was created
                    </p>
                    <code style={{
                      display: 'block', backgroundColor: '#e0f2fe', padding: '0.75rem', borderRadius: '4px',
                      fontSize: '0.72rem', wordBreak: 'break-all', lineHeight: '1.5', color: '#0c4a6e',
                      maxHeight: '120px', overflowY: 'auto', whiteSpace: 'pre-wrap'
                    }}>
                      {publishScript}
                    </code>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>
      )}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <h2 style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#999', marginBottom: '0.5rem', marginTop: 0 }}>
        {title}
      </h2>
      <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e5e5e5', padding: '1rem' }}>
        {children}
      </div>
    </div>
  )
}

function FieldRow({ value, mono, bold, copied, onCopy }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
      <span style={{
        flex: 1, fontSize: mono ? '0.85rem' : '0.9rem', lineHeight: '1.5',
        fontFamily: mono ? 'monospace' : 'inherit',
        fontWeight: bold ? '600' : '400',
        color: '#333', wordBreak: 'break-all'
      }}>
        {value || <span style={{ color: '#999' }}>—</span>}
      </span>
      <CopyBtn copied={copied} onCopy={onCopy} />
    </div>
  )
}

function CopyBtn({ onCopy, copied, label = 'Copy' }) {
  return (
    <button onClick={onCopy} style={{
      flexShrink: 0, padding: '0.3rem 0.7rem', fontSize: '0.75rem',
      border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer',
      backgroundColor: copied ? '#f0fff4' : 'white',
      color: copied ? '#16a34a' : '#666',
      whiteSpace: 'nowrap', fontWeight: copied ? '600' : '400'
    }}>
      {copied ? '✓ Copiado' : label}
    </button>
  )
}