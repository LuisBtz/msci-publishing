'use client'
/**
 * DeleteConfirmModal
 *
 * Confirmation dialog shown before actually deleting an article from
 * the dashboard. Controlled: the parent owns the `target` article and
 * decides when to show/hide. Calls `onConfirm(id)` when the user
 * confirms.
 */
export default function DeleteConfirmModal({ target, onCancel, onConfirm }) {
  if (!target) return null
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
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
          borderRadius: '8px',
          padding: '2rem',
          width: '100%',
          maxWidth: '420px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ fontSize: '2rem', textAlign: 'center', marginBottom: '1rem' }}>🗑️</div>
        <h3
          style={{
            margin: '0 0 0.5rem',
            fontSize: '1rem',
            fontWeight: '700',
            textAlign: 'center',
          }}
        >
          Delete Article?
        </h3>
        <p
          style={{
            margin: '0 0 1.5rem',
            fontSize: '0.9rem',
            color: '#666',
            textAlign: 'center',
            lineHeight: '1.5',
          }}
        >
          <strong>&quot;{target.headline}&quot;</strong>
          <br />
          This action cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '0.65rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              backgroundColor: 'white',
              color: '#333',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(target.id)}
            style={{
              flex: 1,
              padding: '0.65rem',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: '600',
              backgroundColor: '#cc0000',
              color: 'white',
            }}
          >
            Yes, delete
          </button>
        </div>
      </div>
    </div>
  )
}
