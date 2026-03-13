'use client'
import ExhibitAsset from './ExhibitAsset'

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

export default function TabPreview({ article }) {
  const exhibitPaths = article.exhibit_paths || null

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  const typeLabel = { 'blog-post': 'Blog post', 'paper': 'Research Paper', 'quick-take': 'Quick Take', 'podcast': 'Podcast' }

  return (
    <div style={{ backgroundColor: '#fff', fontFamily: '"Helvetica Neue", Arial, sans-serif', fontSize: '16px' }}>

      {/* ── NAVBAR ── */}
      <nav style={{
        borderBottom: '1px solid #e5e5e5', padding: '0 2rem', height: '64px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontWeight: '800', fontSize: '1.3rem', color: '#111', letterSpacing: '-0.02em' }}>MSCI</span>
            <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid #0066cc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0066cc' }} />
            </div>
          </div>
          {['Featured Solutions', 'Data & Analytics', 'Indexes', 'Research & Insights', 'Discover MSCI'].map(item => (
            <span key={item} style={{ fontSize: '0.85rem', color: '#333', cursor: 'pointer' }}>{item}</span>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.85rem', color: '#333', cursor: 'pointer' }}>🔍 Search</span>
          <button style={{
            backgroundColor: '#00b050', color: 'white', border: 'none',
            padding: '0.5rem 1.2rem', borderRadius: '4px', fontSize: '0.85rem',
            fontWeight: '600', cursor: 'pointer'
          }}>
            Get in touch
          </button>
        </div>
      </nav>

      {/* ── BREADCRUMB ── */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1rem 2rem 0' }}>
        <span style={{ fontSize: '0.82rem', color: '#0066cc', cursor: 'pointer' }}>Research & Insights</span>
        <span style={{ fontSize: '0.82rem', color: '#666', margin: '0 0.35rem' }}>/</span>
        <span style={{ fontSize: '0.82rem', color: '#0066cc', cursor: 'pointer' }}>Blog posts</span>
      </div>

      {/* ── HERO ── */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 2rem 0' }}>
        <h1 style={{
          fontSize: '2.5rem', fontWeight: '800', lineHeight: '1.15',
          color: '#111', marginBottom: '1.25rem', marginTop: 0,
          fontFamily: '"Helvetica Neue", Arial, sans-serif'
        }}>
          {article.headline}
        </h1>

        {/* Meta row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem', fontSize: '0.88rem', color: '#555' }}>
          <span>{typeLabel[article.type] || article.type}</span>
          {article.read_time && <><span style={{ color: '#ccc' }}>·</span><span>{article.read_time} min read</span></>}
          {article.authors?.length > 0 && (
            <>
              <span style={{ color: '#ccc' }}>·</span>
              {article.authors.map((a, i) => (
                <span key={i}>
                  <span style={{ color: '#0066cc', cursor: 'pointer', fontWeight: '500' }}>{a.name}</span>
                  {i < article.authors.length - 1 && ', '}
                </span>
              ))}
            </>
          )}
          {article.publish_date && <><span style={{ color: '#ccc' }}>·</span><span>{formatDate(article.publish_date)}</span></>}
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid #e5e5e5', marginBottom: '2rem' }} />
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 2rem' }}>

        {/* Key Findings */}
        {article.bullets?.length > 0 && (
          <div style={{ marginBottom: '2.5rem' }}>
            <h2 style={{
              fontSize: '1.5rem', fontWeight: '800', color: '#111',
              marginBottom: '1rem', marginTop: 0,
              fontFamily: '"Helvetica Neue", Arial, sans-serif'
            }}>
              Key findings
            </h2>
            <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
              {article.bullets.map((b, i) => (
                <li key={i} style={{ marginBottom: '0.6rem', fontSize: '1rem', lineHeight: '1.7', color: '#222' }}>
                  {b}
                </li>
              ))}
            </ul>
            <hr style={{ border: 'none', borderTop: '1px solid #e5e5e5', marginTop: '2rem' }} />
          </div>
        )}

        {/* Body blocks */}
        {article.body_blocks?.map((block, i) => {
          if (block.type === 'text') {
            return (
              <div key={i} style={{ marginBottom: '1.5rem', fontSize: '1rem', lineHeight: '1.8', color: '#222' }}
                dangerouslySetInnerHTML={{ __html: (block.html || '')
                  .replace(/<h2>/g, '<h2 style="font-size:1.6rem;font-weight:800;color:#111;margin:2.5rem 0 1rem;font-family:Helvetica Neue,Arial,sans-serif">')
                  .replace(/<h3>/g, '<h3 style="font-size:1.2rem;font-weight:700;color:#111;margin:1.5rem 0 0.75rem;font-family:Helvetica Neue,Arial,sans-serif">')
                  .replace(/<p>/g, '<p style="margin:0 0 1.25rem;font-size:1rem;line-height:1.8;color:#222">')
                  .replace(/<a /g, '<a style="color:#0066cc;text-decoration:underline" ')
                  .replace(/<sup>/g, '<sup style="font-size:0.7em;color:#555">')
                }} />
            )
          }

          if (block.type === 'exhibit') {
            const exhibit = resolveExhibit(block, exhibitPaths)
            return (
              <div key={i} style={{ margin: '2.5rem 0' }}>
                {block.title && (
                  <h3 style={{
                    fontSize: '1.1rem', fontWeight: '700', color: '#111',
                    marginBottom: '1rem', marginTop: 0,
                    fontFamily: '"Helvetica Neue", Arial, sans-serif'
                  }}>
                    {block.title}
                  </h3>
                )}
                {exhibit ? (
                  <ExhibitAsset exhibit={exhibit} onExpired={() => {}} />
                ) : (
                  <div style={{ backgroundColor: '#f5f5f5', borderRadius: '4px', padding: '2rem', textAlign: 'center', color: '#999', fontSize: '0.85rem' }}>
                    📊 Exhibit — imagen no disponible
                  </div>
                )}
                {block.caption && (
                  <p style={{ fontSize: '0.78rem', color: '#666', marginTop: '0.6rem', lineHeight: '1.5' }}>
                    {block.caption}
                  </p>
                )}
              </div>
            )
          }
          return null
        })}

        {/* ── AUTHORS ── */}
        {article.authors?.length > 0 && (
          <div style={{ borderTop: '1px solid #e5e5e5', paddingTop: '2rem', marginTop: '3rem', marginBottom: '3rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
              {article.authors.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    width: '56px', height: '56px', borderRadius: '50%',
                    backgroundColor: '#e0e0e0', flexShrink: 0, overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.4rem', color: '#aaa'
                  }}>
                    👤
                  </div>
                  <div>
                    <div style={{ fontWeight: '700', color: '#111', fontSize: '0.95rem' }}>{a.name}</div>
                    {a.title && <div style={{ fontSize: '0.82rem', color: '#555', marginTop: '0.15rem' }}>{a.title}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── RELATED CONTENT — 3-col grid ── */}
        {article.related_resources?.length > 0 && (
          <div style={{ borderTop: '1px solid #e5e5e5', paddingTop: '2.5rem', marginBottom: '3rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
              {article.related_resources.map((r, i) => (
                <div key={i} style={{
                  border: '1px solid #e5e5e5', borderRadius: '8px',
                  padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem'
                }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: '700', color: '#111', margin: 0, lineHeight: '1.4' }}>
                    {r.title}
                  </h4>
                  {r.meta_description && (
                    <p style={{ fontSize: '0.85rem', color: '#555', margin: 0, lineHeight: '1.5', flex: 1 }}>
                      {r.meta_description}
                    </p>
                  )}
                  <div>
                    <button style={{
                      backgroundColor: 'white', color: '#111', border: '1px solid #ccc',
                      padding: '0.45rem 1rem', borderRadius: '4px', cursor: 'pointer',
                      fontSize: '0.82rem', fontWeight: '500'
                    }}>
                      {r.cta_label || 'Read more'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── FOOTNOTES ── */}
        {article.footnotes?.length > 0 && (
          <div style={{ borderTop: '1px solid #e5e5e5', paddingTop: '1.5rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {article.footnotes.map((f, i) => (
                <p key={i} style={{ fontSize: '0.82rem', color: '#555', margin: 0, lineHeight: '1.6' }}>
                  <span dangerouslySetInnerHTML={{ __html: `${f.number} ${f.text}`
                    .replace(/<a /g, '<a style="color:#0066cc;text-decoration:underline" ')
                    .replace(/<em>/g, '<em style="font-style:italic">')
                  }} />
                </p>
              ))}
            </div>
          </div>
        )}

        {/* ── DISCLAIMER ── */}
        <div style={{ borderTop: '1px solid #e5e5e5', paddingTop: '1.5rem', marginBottom: '4rem' }}>
          <p style={{ fontSize: '0.78rem', color: '#888', lineHeight: '1.6', margin: 0 }}>
            The content of this page is for informational purposes only and is intended for institutional professionals with the analytical resources and tools necessary to interpret any performance information. Nothing herein is intended to recommend any product, tool or service. For all references to laws, rules or regulations, please note that the information is provided "as is" and does not constitute legal advice or any binding interpretation. Any approach to comply with regulatory or policy initiatives should be discussed with your own legal counsel and/or the relevant competent authority, as needed.
          </p>
        </div>

      </div>

      {/* ── FOOTER ── */}
      <footer style={{ backgroundColor: '#111', color: 'white', padding: '3rem 2rem' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '2rem' }}>
            <span style={{ fontWeight: '800', fontSize: '1.3rem', color: 'white', letterSpacing: '-0.02em' }}>MSCI</span>
            <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'white' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem 3rem', marginBottom: '2rem' }}>
            {['Terms of use', 'Contact us', 'Privacy notice', 'Office locations', 'Legal', 'Index regulation', 'Modern Slavery Statement', 'Resources for issuers', 'Manage cookies', 'Use of ISO standards'].map(item => (
              <span key={item} style={{ fontSize: '0.85rem', color: '#ccc', cursor: 'pointer' }}>{item}</span>
            ))}
          </div>
          <div style={{ borderTop: '1px solid #333', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: '#888' }}>© 2026 MSCI Inc. All rights reserved.</span>
            <div style={{ display: 'flex', gap: '1rem' }}>
              {['𝕏', 'in', '▶'].map((icon, i) => (
                <span key={i} style={{ fontSize: '1rem', color: '#888', cursor: 'pointer' }}>{icon}</span>
              ))}
            </div>
          </div>
        </div>
      </footer>

    </div>
  )
}