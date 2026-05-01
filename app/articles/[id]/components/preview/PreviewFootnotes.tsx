'use client'
/**
 * PreviewFootnotes
 *
 * Renders the article footnotes at the bottom of the preview as a
 * stacked list of caption-sized paragraphs. Inline-rewrites <a> and
 * <em> so embedded anchors get the MSCI brand color and italics
 * render correctly. Returns null when there are no footnotes.
 */
import { t } from '@/lib/msci/styleTokens'
import { type } from '@/lib/msci/typography'

export default function PreviewFootnotes({ footnotes }) {
  if (!footnotes || footnotes.length === 0) return null

  return (
    <div
      style={{
        borderTop: `1px solid ${t.gray300}`,
        paddingTop: '40px',
        marginBottom: '40px',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {footnotes.map((f, i) => (
          <p key={i} style={{ ...type.caption, color: t.black, margin: 0 }}>
            <span
              dangerouslySetInnerHTML={{
                __html: `${f.number} ${f.text}`
                  .replace(
                    /<a /g,
                    `<a style="color:${t.brandblue700};text-decoration:underline" `
                  )
                  .replace(/<em>/g, '<em style="font-style:italic">'),
              }}
            />
          </p>
        ))}
      </div>
    </div>
  )
}
