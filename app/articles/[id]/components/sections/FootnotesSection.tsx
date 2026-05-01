'use client'
/**
 * FootnotesSection
 *
 * Card listing the article's footnotes with rich + plain copy actions.
 * The rich copy uses buildFootnotesHtml (inline MSCI styles for AEM
 * paste). Hidden entirely when there are no footnotes.
 */
import Section from '../ui/Section'
import CopyBtn from '../ui/CopyBtn'
import { buildFootnotesHtml } from '@/lib/msci/htmlBuilders'
import { stripHtml } from '@/lib/utils/stripHtml'

export default function FootnotesSection({ footnotes, copied, copy, copyRich }) {
  if (!footnotes || footnotes.length === 0) return null

  return (
    <Section title={`Footnotes (${footnotes.length})`}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginBottom: '0.5rem',
          gap: '0.4rem',
        }}
      >
        <CopyBtn
          label="Copy"
          copied={copied['footnotes_rich']}
          onCopy={() => copyRich('footnotes_rich', buildFootnotesHtml(footnotes))}
        />
        <CopyBtn
          label="Copy plain text"
          copied={copied['footnotes']}
          onCopy={() =>
            copy(
              'footnotes',
              footnotes.map((f) => `${f.number} ${stripHtml(f.text)}`).join('\n')
            )
          }
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {footnotes.map((f, i) => (
          <div key={i} style={{ display: 'flex', gap: '0.4rem' }}>
            <span style={{ flexShrink: 0, fontSize: '0.82rem', color: '#555' }}>{f.number}</span>
            <span
              style={{ fontSize: '0.82rem', color: '#555', lineHeight: '1.6' }}
              dangerouslySetInnerHTML={{
                __html: f.text.replace(
                  /<a /g,
                  '<a style="color:#c8102e;text-decoration:underline" '
                ),
              }}
            />
          </div>
        ))}
      </div>
    </Section>
  )
}
