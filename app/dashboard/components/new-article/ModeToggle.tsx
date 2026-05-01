'use client'

const MODES = [
  { id: 'sharepoint', label: '📁 SharePoint' },
  { id: 'manual', label: '📄 Upload file' },
]

export default function ModeToggle({ mode, onChange }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 0,
        marginBottom: '1.5rem',
        backgroundColor: '#F4F5FD',
        padding: '4px',
        borderRadius: '100px',
        border: '1px solid #E6E6E6',
      }}
    >
      {MODES.map((m) => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          style={{
            flex: 1,
            height: '34px',
            border: 'none',
            borderRadius: '100px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: mode === m.id ? '600' : '400',
            backgroundColor: mode === m.id ? 'white' : 'transparent',
            color: mode === m.id ? '#1A3FD6' : '#707070',
            boxShadow: mode === m.id ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
            letterSpacing: '-0.02em',
            fontFamily: 'inherit',
            transition: 'all 0.15s',
          }}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}
