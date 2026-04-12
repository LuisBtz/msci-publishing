'use client'
/**
 * AuthorsSection
 *
 * Card listing the article's authors with their AEM content-fragment
 * paths so editors can copy each path individually into the AEM
 * Authors multifield. Returns nothing if the article has no authors.
 */
import Section from '../ui/Section'
import CopyBtn from '../ui/CopyBtn'

export default function AuthorsSection({ authors, copied, copy }) {
  if (!authors || authors.length === 0) {
    return (
      <Section title="Authors">
        <p style={{ color: '#999', fontSize: '0.85rem', margin: 0 }}>No authors.</p>
      </Section>
    )
  }

  return (
    <Section title="Authors">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {authors.map((a, i) => (
          <div key={i}>
            <div
              style={{
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#111',
                marginBottom: '0.35rem',
              }}
            >
              {a.name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <code
                style={{
                  flex: 1,
                  fontSize: '0.78rem',
                  fontFamily: 'monospace',
                  color: '#1a6fa8',
                  backgroundColor: '#f0f7ff',
                  padding: '0.35rem 0.6rem',
                  borderRadius: '4px',
                  border: '1px solid #bee3f8',
                  wordBreak: 'break-all',
                  lineHeight: '1.5',
                }}
              >
                {a.content_fragment_path}
              </code>
              <CopyBtn
                copied={copied[`author_${i}`]}
                onCopy={() => copy(`author_${i}`, a.content_fragment_path)}
              />
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}
