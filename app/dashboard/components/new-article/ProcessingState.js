'use client'
/**
 * ProcessingState
 *
 * Empty "working..." screen shown while the NewArticleModal is
 * running its multi-step pipeline (read SharePoint → parse DOCX with
 * Claude → save to Supabase). The parent passes down the current
 * status message which may update several times during the flow.
 */
export default function ProcessingState({ statusMsg }) {
  return (
    <div style={{ textAlign: 'center', padding: '2rem 0' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚙️</div>
      <p style={{ color: '#333', fontWeight: '600', marginBottom: '0.5rem' }}>Processing...</p>
      <p style={{ color: '#666', fontSize: '0.9rem', margin: 0, lineHeight: '1.5' }}>
        {statusMsg}
      </p>
    </div>
  )
}
