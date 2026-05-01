'use client'
/**
 * ScriptModal
 *
 * Fullscreen dark overlay that displays an AEM DevTools script for
 * the user to copy and paste into the AEM Author console. Receives
 * the already-generated script string from useAEMScripts — this
 * component does no generation itself, only presentation + copy.
 *
 * Dismissed by clicking the backdrop or the close button.
 */

export default function ScriptModal({ open, script, label, onClose, copied, copy }) {
  if (!open || !script) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#0f172a',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '820px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9' }}>
              {label}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Paste in AEM Author DevTools console (F12)
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              onClick={() => copy('script', script)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600,
                backgroundColor: copied['script'] ? '#065f46' : '#1A3FD6',
                color: 'white',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {copied['script'] ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M3 8l4 4 6-7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <rect
                      x="5"
                      y="5"
                      width="8"
                      height="8"
                      rx="1"
                      stroke="currentColor"
                      strokeWidth="1.3"
                    />
                    <path
                      d="M3 11V3a1 1 0 011-1h8"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                    />
                  </svg>
                  Copy script
                </>
              )}
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '8px',
                borderRadius: '8px',
                border: '1px solid #334155',
                backgroundColor: 'transparent',
                color: '#94a3b8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M4 4l8 8M12 4l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>
        <div
          style={{
            padding: '0.75rem 1.5rem',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            gap: '1.5rem',
          }}
        >
          {['Open AEM Author', 'DevTools (F12) \u2192 Console', 'Paste & Enter'].map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  backgroundColor: '#1e293b',
                  color: '#94a3b8',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {i + 1}
              </span>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{step}</span>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '1.25rem 1.5rem' }}>
          <pre
            style={{
              margin: 0,
              fontSize: '0.82rem',
              lineHeight: '1.65',
              color: '#e2e8f0',
              fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {script}
          </pre>
        </div>
      </div>
    </div>
  )
}
