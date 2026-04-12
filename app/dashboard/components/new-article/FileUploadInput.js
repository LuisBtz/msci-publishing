'use client'
/**
 * FileUploadInput
 *
 * Large dashed dropzone that accepts a .docx file. Validates the
 * extension locally and bubbles either the selected file or the
 * validation error up to the parent. Visually swaps between "empty"
 * and "file selected" states.
 */
export default function FileUploadInput({ file, onSelect, onError }) {
  const handleChange = (e) => {
    const f = e.target.files[0]
    if (f && f.name.toLowerCase().endsWith('.docx')) {
      onSelect(f)
      onError('')
    } else {
      onError('The file must be a .docx')
      onSelect(null)
    }
  }

  return (
    <label
      style={{
        display: 'block',
        border: '2px dashed #ddd',
        borderRadius: '8px',
        padding: '2rem',
        textAlign: 'center',
        cursor: 'pointer',
        backgroundColor: file ? '#f0fff4' : '#fafafa',
        borderColor: file ? '#86efac' : '#ddd',
      }}
    >
      <input type="file" accept=".docx" onChange={handleChange} style={{ display: 'none' }} />
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{file ? '✅' : '📄'}</div>
      <div
        style={{
          fontSize: '0.9rem',
          color: file ? '#16a34a' : '#666',
          fontWeight: file ? '600' : '400',
        }}
      >
        {file ? file.name : 'Click to select the .docx file'}
      </div>
      {!file && (
        <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '0.25rem' }}>
          Only .docx files
        </div>
      )}
    </label>
  )
}
