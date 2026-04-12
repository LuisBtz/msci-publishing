'use client'
/**
 * DoneState
 *
 * Success screen shown briefly before useArticleCreation redirects
 * the user to the freshly-created article page.
 */
export default function DoneState({ statusMsg }) {
  return (
    <div style={{ textAlign: 'center', padding: '2rem 0' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🎉</div>
      <p style={{ color: '#16a34a', fontWeight: '600', marginBottom: '0.5rem' }}>{statusMsg}</p>
      <p style={{ color: '#666', fontSize: '0.85rem', margin: 0 }}>Redirecting to article...</p>
    </div>
  )
}
