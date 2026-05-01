'use client'
/**
 * PreviewAuthors
 *
 * 2-column author grid at the bottom of the preview body. Each card
 * shows a placeholder avatar (first character) and the author name +
 * title. Returns null when there are no authors.
 */
import { t } from '@/lib/msci/styleTokens'
import { type } from '@/lib/msci/typography'

export default function PreviewAuthors({ authors }) {
  if (!authors || authors.length === 0) return null
  return (
    <div
      style={{
        borderTop: `1px solid ${t.gray300}`,
        paddingTop: '40px',
        marginTop: '70px',
        marginBottom: '70px',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          rowGap: '40px',
          columnGap: '64px',
        }}
      >
        {authors.map((a, i) => (
          <div
            key={i}
            style={{ display: 'flex', alignItems: 'center', gap: '20px' }}
          >
            <div
              style={{
                width: '100px',
                height: '100px',
                borderRadius: '50%',
                backgroundColor: t.gray50,
                flexShrink: 0,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: t.gray700,
                fontSize: '32px',
              }}
            >
              {(a.name || '?').charAt(0)}
            </div>
            <div>
              <div style={{ ...type.bodyArticle, fontWeight: 600 }}>{a.name}</div>
              {a.title && (
                <div style={{ ...type.bodyS, color: t.gray700, marginTop: '4px' }}>
                  {a.title}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
