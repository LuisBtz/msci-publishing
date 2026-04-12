'use client'
/**
 * FileRow
 *
 * Compact row that shows a small label (Desktop/Mobile/JSON/HTML) and
 * the corresponding filename in monospace. Used inside ExhibitBlock to
 * enumerate the files backing a static or interactive exhibit.
 */
import CopyBtn from './CopyBtn'

export default function FileRow({ label, filename, copied, onCopy }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <span style={{ fontSize: '0.72rem', color: '#999', minWidth: '52px' }}>{label}</span>
      <code style={{ flex: 1, fontSize: '0.78rem', color: '#444' }}>{filename}</code>
      {onCopy && <CopyBtn copied={copied} onCopy={onCopy} />}
    </div>
  )
}
