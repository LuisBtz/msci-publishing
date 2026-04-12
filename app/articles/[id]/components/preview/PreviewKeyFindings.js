'use client'
/**
 * PreviewKeyFindings
 *
 * Renders the "Key findings" block at the top of the article body in
 * the preview: MSCI-styled h2 heading and a disc-style bullet list.
 * Returns null when the article has no bullets.
 */
import { t } from '@/lib/msci/styleTokens'
import { type } from '@/lib/msci/typography'

export default function PreviewKeyFindings({ bullets }) {
  if (!bullets || bullets.length === 0) return null
  return (
    <div style={{ marginBottom: '70px' }}>
      <h2 style={{ ...type.h2 }}>Key findings</h2>
      <ul
        style={{
          margin: '16px 0 0',
          paddingLeft: '24px',
          listStyleType: 'disc',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {bullets.map((b, i) => (
          <li key={i} style={{ ...type.bodyArticle }}>
            {b}
          </li>
        ))}
      </ul>
      <hr
        style={{
          border: 'none',
          borderTop: `1px solid ${t.gray300}`,
          margin: '40px 0 0',
        }}
      />
    </div>
  )
}
