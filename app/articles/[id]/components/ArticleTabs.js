'use client'
/**
 * ArticleTabs
 *
 * Two-tab pill selector (Metadata / Content) used at the top of the
 * article editor main column. Purely visual — owns no state, just
 * reflects the `active` prop and calls `onChange` on click.
 */
const TABS = [
  { key: 'metadata', label: 'Metadata' },
  { key: 'content', label: 'Content' },
]

export default function ArticleTabs({ active, onChange }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '0',
        borderBottom: '2px solid #e5e5e5',
        marginBottom: '0.25rem',
      }}
    >
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          style={{
            padding: '0.6rem 1.25rem',
            fontSize: '0.82rem',
            fontWeight: '600',
            color: active === tab.key ? '#111' : '#999',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            borderBottom: active === tab.key ? '2px solid #111' : '2px solid transparent',
            marginBottom: '-2px',
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
