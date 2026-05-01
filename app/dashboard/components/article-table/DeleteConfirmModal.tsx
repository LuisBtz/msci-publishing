'use client'

export default function DeleteConfirmModal({ target, onCancel, onConfirm }) {
  if (!target) return null
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 300,
        padding: '1rem',
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '18px',
          padding: '2rem',
          width: '100%',
          maxWidth: '420px',
          boxShadow: '0px 4px 16px 0px rgba(0,0,0,0.25)',
        }}
      >
        <h3 style={{
          margin: '0 0 0.5rem',
          fontSize: '18px',
          fontWeight: '600',
          letterSpacing: '-0.04em',
          textAlign: 'center',
        }}>
          Delete article?
        </h3>
        <p style={{
          margin: '0 0 1.5rem',
          fontSize: '14px',
          color: '#707070',
          textAlign: 'center',
          lineHeight: '1.5',
          letterSpacing: '-0.02em',
        }}>
          <strong style={{ color: '#000' }}>&quot;{target.headline}&quot;</strong>
          <br />
          This action cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              height: '44px',
              border: '1.5px solid #CCCCCC',
              borderRadius: '100px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              letterSpacing: '-0.02em',
              backgroundColor: 'white',
              color: '#222',
              fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(target.id)}
            style={{
              flex: 1,
              height: '44px',
              border: 'none',
              borderRadius: '100px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              letterSpacing: '-0.02em',
              backgroundColor: '#C8102E',
              color: 'white',
              fontFamily: 'inherit',
            }}
          >
            Yes, delete
          </button>
        </div>
      </div>
    </div>
  )
}
