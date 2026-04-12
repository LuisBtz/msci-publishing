'use client'
/**
 * CopyBtn
 *
 * Tiny button used next to editable values throughout the article
 * editor. Shows either the provided label or a green "✓" when the
 * parent has flagged the key as recently copied. Pure presentation —
 * all copy behavior lives in the useCopy hook.
 */
export default function CopyBtn({ onCopy, copied, label = 'Copy' }) {
  return (
    <button
      onClick={onCopy}
      style={{
        flexShrink: 0,
        padding: '0.25rem 0.6rem',
        fontSize: '0.72rem',
        border: '1px solid',
        borderRadius: '4px',
        cursor: 'pointer',
        backgroundColor: copied ? '#f0fff4' : 'white',
        borderColor: copied ? '#86efac' : '#e0e0e0',
        color: copied ? '#16a34a' : '#666',
        whiteSpace: 'nowrap',
        fontWeight: copied ? '600' : '400',
        transition: 'all 0.15s',
      }}
    >
      {copied ? '✓' : label}
    </button>
  )
}
