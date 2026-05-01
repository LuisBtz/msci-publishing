'use client'

const TABS = [
  { key: 'metadata', label: 'Metadata' },
  { key: 'content', label: 'Content' },
  { key: 'report', label: 'Report' },
]

export default function ArticleTabs({ active, onChange }) {
  return (
    <div style={{
      display: 'flex',
      borderBottom: '1px solid #CCCCCC',
      marginBottom: '0.25rem',
      gap: 0,
    }}>
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          style={{
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: '500',
            color: active === tab.key ? '#000' : '#707070',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            borderBottom: active === tab.key ? '2px solid #222222' : '2px solid transparent',
            marginBottom: '-1px',
            letterSpacing: '-0.02em',
            fontFamily: 'inherit',
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
