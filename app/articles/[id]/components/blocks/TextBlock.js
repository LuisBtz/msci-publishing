'use client'
/**
 * TextBlock
 *
 * Renders one `type: 'text'` body block: the HTML preview (with
 * lightweight inline styling tweaks so headings/links render right in
 * our editor preview) and the two copy actions (rich HTML for AEM RTE
 * paste, and plain stripped-text).
 */
import CopyBtn from '../ui/CopyBtn'
import { wrapBodyHtml } from '@/lib/msci/htmlBuilders'
import { stripHtml } from '@/lib/utils/stripHtml'

// Local, preview-only HTML tweaks so the in-app rendering looks close
// to AEM without actually dropping MSCI inline styles into the preview.
function decoratePreviewHtml(html) {
  return (html || '')
    .replace(/<h2>/g, '<h2 style="font-size:1.1rem;font-weight:700;color:#111;margin:1rem 0 0.5rem">')
    .replace(/<h3>/g, '<h3 style="font-size:1rem;font-weight:700;color:#111;margin:0.75rem 0 0.4rem">')
    .replace(/<a /g, '<a style="color:#c8102e;text-decoration:underline" ')
    .replace(/<sup>/g, '<sup style="font-size:0.7em;color:#c8102e;font-weight:600">')
}

export default function TextBlock({ block, blockIdx, copied, copy, copyRich }) {
  return (
    <div
      style={{
        backgroundColor: 'white',
        border: '1px solid #e5e5e5',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#ccc',
              display: 'inline-block',
            }}
          />
          <span
            style={{
              fontSize: '11px',
              fontWeight: '600',
              color: '#999',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Text block {blockIdx + 1}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <CopyBtn
            label="Copy"
            copied={copied[`block_rich_${blockIdx}`]}
            onCopy={() => copyRich(`block_rich_${blockIdx}`, wrapBodyHtml(block.html))}
          />
          <CopyBtn
            label="Copy plain text"
            copied={copied[`block_${blockIdx}`]}
            onCopy={() => copy(`block_${blockIdx}`, stripHtml(block.html))}
          />
        </div>
      </div>
      <div
        style={{ padding: '12px', fontSize: '0.875rem', lineHeight: '1.7', color: '#333' }}
        dangerouslySetInnerHTML={{ __html: decoratePreviewHtml(block.html) }}
      />
    </div>
  )
}
