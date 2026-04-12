'use client'
/**
 * Badge
 *
 * Pill-shaped label used inside the ArticleTable rows to show the
 * type and status of each article. Consumes the `{ bg, fg }` color
 * shape from lib/aem/labels.js.
 */
export default function Badge({ label, colors }) {
  const { bg = '#f0f0f0', fg = '#555' } = colors || {}
  return (
    <span
      style={{
        fontSize: '0.75rem',
        fontWeight: '600',
        padding: '0.25rem 0.6rem',
        borderRadius: '999px',
        whiteSpace: 'nowrap',
        backgroundColor: bg,
        color: fg,
      }}
    >
      {label}
    </span>
  )
}
