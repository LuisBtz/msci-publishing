'use client'
/**
 * SharePointInput
 *
 * Text field where the user pastes a SharePoint folder URL. Controlled
 * input — value and onChange come from the parent modal. No validation
 * here; the real check happens server-side in /api/sharepoint/folder.
 */
export default function SharePointInput({ value, onChange }) {
  return (
    <div>
      <label
        style={{
          display: 'block',
          fontSize: '0.85rem',
          fontWeight: '600',
          marginBottom: '0.4rem',
          color: '#333',
        }}
      >
        SharePoint folder URL
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://onemsci.sharepoint.com/sites/..."
        style={{
          width: '100%',
          padding: '0.65rem 0.75rem',
          border: '1px solid #ddd',
          borderRadius: '4px',
          fontSize: '0.85rem',
          boxSizing: 'border-box',
          fontFamily: 'monospace',
        }}
      />
      <p
        style={{
          fontSize: '0.8rem',
          color: '#999',
          marginTop: '0.5rem',
          marginBottom: 0,
        }}
      >
        Paste the link to the project folder in SharePoint (RE-XXXX-...)
      </p>
    </div>
  )
}
