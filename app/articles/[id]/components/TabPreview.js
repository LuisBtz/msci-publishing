'use client'
import ExhibitAsset from './ExhibitAsset'

// ── Design tokens extraídos de msci.com (computed styles reales) ──────────────
const t = {
  // Colors
  brandblue700: 'rgb(26, 63, 214)',
  brandblue300: 'rgb(174, 186, 240)',
  brandblue100: 'rgb(244, 245, 253)',
  brandturquoise700: 'rgb(0, 196, 179)',
  black: 'rgb(0, 0, 0)',
  white: 'rgb(255, 255, 255)',
  gray50: 'rgb(245, 245, 245)',
  gray300: 'rgb(204, 204, 204)',
  gray700: 'rgb(112, 112, 112)',
  // Layout
  maxW: '1440px',
  padX: '70px',           // lg:ms-mx-17-5
  // Font
  font: 'var(--font-inter), Inter, Arial, sans-serif',
}

// ── Helpers para tipografía MSCI (computed exacto) ────────────────────────────
const type = {
  h1: {
    fontFamily: t.font, fontSize: '64px', lineHeight: '70.4px',
    fontWeight: 600, letterSpacing: '-3.84px', margin: 0,
  },
  h2: {
    fontFamily: t.font, fontSize: '42px', lineHeight: '50.4px',
    fontWeight: 600, letterSpacing: '-2.1px', margin: 0,
  },
  h3: {
    fontFamily: t.font, fontSize: '32px', lineHeight: '41.6px',
    fontWeight: 600, letterSpacing: '-1.28px', margin: 0,
  },
  h4: {
    fontFamily: t.font, fontSize: '28px', lineHeight: '36.4px',
    fontWeight: 400, letterSpacing: '-0.84px', margin: 0,
  },
  bodyArticle: {
    fontFamily: t.font, fontSize: '20px', lineHeight: '32px',
    fontWeight: 400, letterSpacing: '-0.4px', color: t.black,
  },
  bodyS: {
    fontFamily: t.font, fontSize: '16px', lineHeight: '24px',
    fontWeight: 400, letterSpacing: '-0.32px', color: t.black,
  },
  caption: {
    fontFamily: t.font, fontSize: '14px', lineHeight: '21px',
    fontWeight: 400, letterSpacing: '-0.28px', color: t.black,
  },
}

function resolveExhibit(block, exhibitPaths) {
  if (!exhibitPaths) return null
  const idx = block.sharepoint_index ?? block.exhibit_index
  if (idx == null) return null

  // New format: items[] is authoritative.
  if (Array.isArray(exhibitPaths.items)) {
    const item = exhibitPaths.items[idx]
    return item ? { ...item, exhibit_type: item.type } : null
  }

  // Legacy fallback.
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

// CSS strings que inyectan tipografía MSCI dentro del HTML del bloque body
const styleH2InBody = `font-family:${t.font};font-size:42px;line-height:50.4px;font-weight:600;letter-spacing:-2.1px;color:${t.black};margin:48px 0 16px 0;`
const styleH3InBody = `font-family:${t.font};font-size:32px;line-height:41.6px;font-weight:600;letter-spacing:-1.28px;color:${t.black};margin:40px 0 16px 0;`
const stylePInBody  = `font-family:${t.font};font-size:20px;line-height:32px;font-weight:400;letter-spacing:-0.4px;color:${t.black};margin:0 0 16px 0;`
const styleAInBody  = `color:${t.brandblue700};text-decoration:underline;`
const styleSupBody  = `font-size:15px;letter-spacing:-0.4px;`

export default function TabPreview({ article }) {
  const exhibitPaths = article.exhibit_paths || null

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  const typeLabel = { 'blog-post': 'Blog post', 'paper': 'Research Paper', 'quick-take': 'Quick Take', 'podcast': 'Podcast' }

  const Dot = () => (
    <span style={{
      width: '4px', height: '4px', borderRadius: '50%',
      backgroundColor: t.white, display: 'inline-block', flexShrink: 0,
    }} />
  )

  return (
    <div style={{ backgroundColor: t.white, fontFamily: t.font, color: t.black }}>

      {/* ── NAVBAR (template mock) ─────────────────────────────────────────── */}
      <nav style={{
        height: '72px', display: 'flex', alignItems: 'center',
        position: 'sticky', top: 0, backgroundColor: t.brandblue700, zIndex: 50,
      }}>
        <div style={{
          maxWidth: t.maxW, width: '100%', margin: '0 auto',
          padding: `0 ${t.padX}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
            <img
              src="/msci-logo_with_title_white2.svg"
              alt="MSCI"
              style={{ height: '28px', width: 'auto', display: 'block' }}
            />
            {['Featured Solutions', 'Data & Analytics', 'Indexes', 'Research & Insights', 'Discover MSCI'].map(item => (
              <span key={item} style={{ ...type.bodyS, color: t.white, cursor: 'pointer' }}>{item}</span>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <span style={{ ...type.bodyS, color: t.white, cursor: 'pointer' }}>Search</span>
            <button style={{
              backgroundColor: t.brandturquoise700, color: t.black, border: 'none',
              padding: '0 24px', height: '48px', borderRadius: '999px',
              fontFamily: t.font, fontSize: '16px', fontWeight: 600, cursor: 'pointer',
            }}>
              Get in touch
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO (brandblue-700 background) ────────────────────────────────── */}
      <section style={{ backgroundColor: t.brandblue700, color: t.white }}>
        <div style={{
          maxWidth: t.maxW, margin: '0 auto',
          padding: `40px ${t.padX} 70px`,
        }}>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '40px' }}>
            <span style={{ ...type.bodyS, color: t.white, cursor: 'pointer' }}>Research & Insights</span>
            <span style={{ ...type.bodyS, color: t.white }}>/</span>
            <span style={{ ...type.bodyS, color: t.white, cursor: 'pointer' }}>Blog posts</span>
          </div>

          {/* Headline */}
          <h1 style={{ ...type.h1, color: t.white, maxWidth: '1100px' }}>
            {article.headline}
          </h1>

          {/* Meta row */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center',
            gap: '12px', marginTop: '40px',
          }}>
            <span style={{ ...type.bodyS, color: t.white }}>{typeLabel[article.type] || article.type}</span>
            {article.read_time && (<><Dot /><span style={{ ...type.bodyS, color: t.white }}>{article.read_time} min read</span></>)}
            {article.authors?.length > 0 && (
              <>
                <Dot />
                {article.authors.map((a, i) => (
                  <span key={i} style={{ ...type.bodyS, color: t.white }}>
                    <span style={{ textDecoration: 'underline', cursor: 'pointer' }}>{a.name}</span>
                    {i < article.authors.length - 1 && ', '}
                  </span>
                ))}
              </>
            )}
            {article.publish_date && (<><Dot /><span style={{ ...type.bodyS, color: t.white }}>{formatDate(article.publish_date)}</span></>)}
          </div>
        </div>
      </section>

      {/* ── WHITE CONTENT SECTION ──────────────────────────────────────────── */}
      <section style={{ backgroundColor: t.white }}>
        <div style={{
          maxWidth: t.maxW, margin: '0 auto',
          padding: `70px ${t.padX} 40px`,
        }}>

          {/* Key Findings */}
          {article.bullets?.length > 0 && (
            <div style={{ marginBottom: '70px' }}>
              <h2 style={{ ...type.h2 }}>Key findings</h2>
              <ul style={{
                margin: '16px 0 0', paddingLeft: '24px',
                listStyleType: 'disc', display: 'flex', flexDirection: 'column', gap: '16px',
              }}>
                {article.bullets.map((b, i) => (
                  <li key={i} style={{ ...type.bodyArticle }}>{b}</li>
                ))}
              </ul>
              <hr style={{
                border: 'none', borderTop: `1px solid ${t.gray300}`,
                margin: '40px 0 0',
              }} />
            </div>
          )}

          {/* Body blocks */}
          {article.body_blocks?.map((block, i) => {
            if (block.type === 'text') {
              const html = (block.html || '')
                .replace(/<h2>/g, `<h2 style="${styleH2InBody}">`)
                .replace(/<h3>/g, `<h3 style="${styleH3InBody}">`)
                .replace(/<p>/g, `<p style="${stylePInBody}">`)
                .replace(/<a /g, `<a style="${styleAInBody}" `)
                .replace(/<sup>/g, `<sup style="${styleSupBody}">`)
              return (
                <div
                  key={i}
                  style={{ ...type.bodyArticle, marginBottom: '16px' }}
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              )
            }

            if (block.type === 'exhibit') {
              const exhibit = resolveExhibit(block, exhibitPaths)
              return (
                <div key={i} style={{ margin: '48px 0' }}>
                  {block.title && (
                    <h3 style={{ ...type.h3, marginBottom: '24px' }}>{block.title}</h3>
                  )}
                  {exhibit ? (
                    <ExhibitAsset exhibit={exhibit} onExpired={() => {}} />
                  ) : (
                    <div style={{
                      backgroundColor: t.gray50, borderRadius: '8px',
                      padding: '40px', textAlign: 'center', color: t.gray700,
                      ...type.bodyS,
                    }}>
                      Exhibit — image not available
                    </div>
                  )}
                  {block.caption && (
                    <p style={{
                      ...type.bodyS, color: t.gray700,
                      marginTop: '16px', marginBottom: 0,
                    }}>
                      {block.caption}
                    </p>
                  )}
                </div>
              )
            }
            return null
          })}

          {/* ── AUTHORS (2-col grid) ─────────────────────────────────────── */}
          {article.authors?.length > 0 && (
            <div style={{
              borderTop: `1px solid ${t.gray300}`,
              paddingTop: '40px', marginTop: '70px', marginBottom: '70px',
            }}>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
                rowGap: '40px', columnGap: '64px',
              }}>
                {article.authors.map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{
                      width: '100px', height: '100px', borderRadius: '50%',
                      backgroundColor: t.gray50, flexShrink: 0, overflow: 'hidden',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: t.gray700, fontSize: '32px',
                    }}>
                      {(a.name || '?').charAt(0)}
                    </div>
                    <div>
                      <div style={{ ...type.bodyArticle, fontWeight: 600 }}>{a.name}</div>
                      {a.title && <div style={{ ...type.bodyS, color: t.gray700, marginTop: '4px' }}>{a.title}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── SUBSCRIBE TODAY CTA (template mock) ───────────────────────── */}
          <div style={{
            backgroundColor: t.brandblue700, color: t.white,
            borderRadius: '18px', padding: '70px',
            marginBottom: '70px',
          }}>
            <div style={{ ...type.h1, color: t.brandblue300 }}>Subscribe</div>
            <div style={{ ...type.h1, color: t.white, marginBottom: '40px' }}>today.</div>
            <p style={{ ...type.bodyArticle, color: t.white, marginBottom: '32px', maxWidth: '600px' }}>
              Join thousands of investment professionals who receive our research and insights.
            </p>
            <div style={{ display: 'flex', gap: '12px', maxWidth: '600px' }}>
              <input
                placeholder="Enter your email"
                disabled
                style={{
                  flex: 1, height: '60px', borderRadius: '999px',
                  border: 'none', backgroundColor: t.brandblue100,
                  padding: '0 24px', fontFamily: t.font, fontSize: '16px',
                  color: t.black,
                }}
              />
              <button style={{
                height: '60px', padding: '0 32px', borderRadius: '999px',
                border: 'none', backgroundColor: t.brandturquoise700, color: t.black,
                fontFamily: t.font, fontSize: '16px', fontWeight: 600, cursor: 'pointer',
              }}>
                Subscribe
              </button>
            </div>
          </div>

          {/* ── RELATED CONTENT (3-col grid, gray-50 cards) ─────────────── */}
          {article.related_resources?.length > 0 && (
            <div style={{ marginBottom: '70px' }}>
              <h2 style={{ ...type.h2, marginBottom: '40px' }}>Related content</h2>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px',
              }}>
                {article.related_resources.map((r, i) => (
                  <div key={i} style={{
                    backgroundColor: t.gray50, borderRadius: '18px',
                    padding: '40px', display: 'flex', flexDirection: 'column', gap: '24px',
                  }}>
                    <h4 style={{ ...type.h4 }}>{r.title}</h4>
                    {r.meta_description && (
                      <p style={{ ...type.bodyS, color: t.black, margin: 0, flex: 1 }}>
                        {r.meta_description}
                      </p>
                    )}
                    <div>
                      <button style={{
                        backgroundColor: 'transparent', color: t.black,
                        border: `1px solid ${t.black}`, borderRadius: '999px',
                        padding: '0 24px', height: '48px',
                        fontFamily: t.font, fontSize: '16px', fontWeight: 500, cursor: 'pointer',
                      }}>
                        {r.cta_label || 'Read more'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── FOOTNOTES (caption 14px) ─────────────────────────────────── */}
          {article.footnotes?.length > 0 && (
            <div style={{
              borderTop: `1px solid ${t.gray300}`,
              paddingTop: '40px', marginBottom: '40px',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {article.footnotes.map((f, i) => (
                  <p key={i} style={{ ...type.caption, color: t.black, margin: 0 }}>
                    <span dangerouslySetInnerHTML={{ __html: `${f.number} ${f.text}`
                      .replace(/<a /g, `<a style="color:${t.brandblue700};text-decoration:underline" `)
                      .replace(/<em>/g, '<em style="font-style:italic">')
                    }} />
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* ── DISCLAIMER ───────────────────────────────────────────────── */}
          <div style={{
            borderTop: `1px solid ${t.gray300}`,
            paddingTop: '40px', marginBottom: '70px',
          }}>
            <p style={{ ...type.caption, color: t.gray700, margin: 0 }}>
              The content of this page is for informational purposes only and is intended for institutional professionals with the analytical resources and tools necessary to interpret any performance information. Nothing herein is intended to recommend any product, tool or service. For all references to laws, rules or regulations, please note that the information is provided "as is" and does not constitute legal advice or any binding interpretation. Any approach to comply with regulatory or policy initiatives should be discussed with your own legal counsel and/or the relevant competent authority, as needed.
            </p>
          </div>

        </div>
      </section>

      {/* ── FOOTER (template mock) ───────────────────────────────────────── */}
      <footer style={{ backgroundColor: t.black, color: t.white }}>
        <div style={{
          maxWidth: t.maxW, margin: '0 auto',
          padding: `70px ${t.padX}`,
        }}>
          <div style={{ marginBottom: '40px' }}>
            <img
              src="/msci-logo_with_title_white2.svg"
              alt="MSCI"
              style={{ height: '32px', width: 'auto', display: 'block' }}
            />
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '16px 32px', marginBottom: '40px',
          }}>
            {['Terms of use', 'Contact us', 'Privacy notice', 'Office locations', 'Legal', 'Index regulation', 'Modern Slavery Statement', 'Resources for issuers', 'Manage cookies', 'Use of ISO standards'].map(item => (
              <span key={item} style={{ ...type.bodyS, color: t.white, cursor: 'pointer' }}>{item}</span>
            ))}
          </div>
          <div style={{
            borderTop: `1px solid ${t.gray700}`, paddingTop: '24px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ ...type.caption, color: t.gray300 }}>© 2026 MSCI Inc. All rights reserved.</span>
          </div>
        </div>
      </footer>

    </div>
  )
}
