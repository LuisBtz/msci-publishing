'use client'
/**
 * ExpiredPlaceholder
 *
 * Warning card shown when an exhibit's SharePoint download URL has
 * expired (or the image fails to load). Exposes a "Refresh assets"
 * button that calls the onExpired callback provided by the parent —
 * typically wired up to the page-level refreshAssets action which
 * re-reads SharePoint and re-issues fresh download URLs.
 */
export default function ExpiredPlaceholder({ onExpired, filename }) {
  return (
    <div
      style={{
        padding: '1.5rem',
        backgroundColor: '#fff8e8',
        borderRadius: '4px',
        border: '1px dashed #fbbf24',
        textAlign: 'center',
      }}
    >
      <p
        style={{
          fontSize: '0.85rem',
          color: '#92400e',
          margin: '0 0 0.5rem',
          fontWeight: '600',
        }}
      >
        URL expirada
      </p>
      {filename && (
        <p
          style={{
            fontSize: '0.78rem',
            color: '#78350f',
            margin: '0 0 0.75rem',
            fontFamily: 'monospace',
          }}
        >
          {filename}
        </p>
      )}
      <button
        onClick={onExpired}
        style={{
          backgroundColor: '#f59e0b',
          color: 'white',
          border: 'none',
          padding: '0.4rem 0.9rem',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '0.8rem',
          fontWeight: '600',
        }}
      >
        Refresh assets
      </button>
    </div>
  )
}
