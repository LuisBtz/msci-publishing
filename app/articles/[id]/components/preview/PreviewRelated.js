'use client'
/**
 * PreviewRelated
 *
 * 3-column "Related content" grid in the preview. Each card shows
 * title, meta description, and a CTA button. Returns null when the
 * article has no related_resources.
 */
import { t } from '@/lib/msci/styleTokens'
import { type } from '@/lib/msci/typography'

export default function PreviewRelated({ resources }) {
  if (!resources || resources.length === 0) return null
  return (
    <div style={{ marginBottom: '70px' }}>
      <h2 style={{ ...type.h2, marginBottom: '40px' }}>Related content</h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '24px',
        }}
      >
        {resources.map((r, i) => (
          <div
            key={i}
            style={{
              backgroundColor: t.gray50,
              borderRadius: '18px',
              padding: '40px',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
            }}
          >
            <h4 style={{ ...type.h4 }}>{r.title}</h4>
            {r.meta_description && (
              <p style={{ ...type.bodyS, color: t.black, margin: 0, flex: 1 }}>
                {r.meta_description}
              </p>
            )}
            <div>
              <button
                style={{
                  backgroundColor: 'transparent',
                  color: t.black,
                  border: `1px solid ${t.black}`,
                  borderRadius: '999px',
                  padding: '0 24px',
                  height: '48px',
                  fontFamily: t.font,
                  fontSize: '16px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {r.cta_label || 'Read more'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
