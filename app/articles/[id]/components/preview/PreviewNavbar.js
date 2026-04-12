'use client'
/**
 * PreviewNavbar
 *
 * Static mock of the msci.com global navigation rendered at the top of
 * the preview. No real navigation behavior — the links are purely
 * visual so editors can judge the article in its final template.
 */
import { t } from '@/lib/msci/styleTokens'
import { type } from '@/lib/msci/typography'

const NAV_ITEMS = [
  'Featured Solutions',
  'Data & Analytics',
  'Indexes',
  'Research & Insights',
  'Discover MSCI',
]

export default function PreviewNavbar() {
  return (
    <nav
      style={{
        height: '72px',
        display: 'flex',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        backgroundColor: t.brandblue700,
        zIndex: 50,
      }}
    >
      <div
        style={{
          maxWidth: t.maxW,
          width: '100%',
          margin: '0 auto',
          padding: `0 ${t.padX}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
          <img
            src="/msci-logo_with_title_white2.svg"
            alt="MSCI"
            style={{ height: '28px', width: 'auto', display: 'block' }}
          />
          {NAV_ITEMS.map((item) => (
            <span key={item} style={{ ...type.bodyS, color: t.white, cursor: 'pointer' }}>
              {item}
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <span style={{ ...type.bodyS, color: t.white, cursor: 'pointer' }}>Search</span>
          <button
            style={{
              backgroundColor: t.brandturquoise700,
              color: t.black,
              border: 'none',
              padding: '0 24px',
              height: '48px',
              borderRadius: '999px',
              fontFamily: t.font,
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Get in touch
          </button>
        </div>
      </div>
    </nav>
  )
}
