'use client'
/**
 * ModeToggle
 *
 * Pill-style segmented control that switches the NewArticleModal
 * between the SharePoint URL flow and the direct file-upload flow.
 * Purely visual: parent owns `mode` and the change callback.
 */
const MODES = [
  { id: 'sharepoint', label: '📁 SharePoint' },
  { id: 'manual', label: '📄 Upload file' },
]

export default function ModeToggle({ mode, onChange }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '1.5rem',
        backgroundColor: '#f5f5f5',
        padding: '0.25rem',
        borderRadius: '6px',
      }}
    >
      {MODES.map((m) => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          style={{
            flex: 1,
            padding: '0.5rem',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: mode === m.id ? '700' : '400',
            backgroundColor: mode === m.id ? 'white' : 'transparent',
            color: mode === m.id ? '#111' : '#666',
            boxShadow: mode === m.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          }}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}
