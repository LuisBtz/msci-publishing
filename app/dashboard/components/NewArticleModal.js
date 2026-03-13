'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewArticleModal({ onClose }) {
  const [mode, setMode] = useState('sharepoint')
  const [folderUrl, setFolderUrl] = useState('')
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState('input')
  const [statusMsg, setStatusMsg] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  const handleFileChange = (e) => {
    const f = e.target.files[0]
    if (f && f.name.toLowerCase().endsWith('.docx')) {
      setFile(f)
      setError('')
    } else {
      setError('The file must be a .docx')
      setFile(null)
    }
  }

  const processWithSharePoint = async () => {
    setLoading(true)
    setStep('processing')
    setError('')

    try {
      // 1. Leer carpeta de SharePoint
      setStatusMsg('Reading SharePoint folder...')
      const spRes = await fetch('/api/sharepoint/folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderUrl })
      })
      const spData = await spRes.json()
      if (!spRes.ok) throw new Error(spData.error || 'Error al leer SharePoint')

      // Mostrar resumen de exhibits encontrados
      const { summary } = spData
      if (summary) {
        setStatusMsg(`SharePoint read — ${summary.statics} statics, ${summary.interactives} interactives found. Analyzing document...`)
        await new Promise(r => setTimeout(r, 800))
      }

      if (!spData.exhibitsFound) {
        setStatusMsg('⚠ No exhibits found — continuing...')
        await new Promise(r => setTimeout(r, 1000))
      }

      // 2. Parsear el .docx con Claude
      setStatusMsg('Claude is analyzing the document...')
      const formData = new FormData()
const binaryStr = atob(spData.docx.base64)
const bytes = new Uint8Array(binaryStr.length)
for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
const blob = new Blob([bytes], {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      })
      formData.append('file', blob, spData.docx.filename)
      // Pasar el objeto completo de exhibits (statics + interactives + summary)
      formData.append('exhibits', JSON.stringify(spData.exhibits))

      const parseRes = await fetch('/api/parse/docx', {
        method: 'POST',
        body: formData
      })
      const parseData = await parseRes.json()
      if (!parseRes.ok) throw new Error(parseData.error || 'Error al parsear documento')

      // 3. Guardar en Supabase
      setStatusMsg('Saving article...')
      const saveRes = await fetch('/api/articles/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...parseData,
          sharepoint_folder_url: folderUrl,
          banner_paths: spData.banners,
          exhibit_paths: spData.exhibits  // guardar estructura completa
        })
      })
      const saveData = await saveRes.json()
      if (!saveRes.ok) throw new Error(saveData.error || 'Error al guardar')

      setStep('done')
      setStatusMsg('Article created successfully!')
      setTimeout(() => router.push(`/articles/${saveData.id}`), 1500)

    } catch (err) {
      setError(err.message)
      setStep('input')
      setLoading(false)
    }
  }

  const processManual = async () => {
    if (!file) return
    setLoading(true)
    setStep('processing')
    setError('')

    try {
      setStatusMsg('Claude is analyzing the document...')
      const formData = new FormData()
      formData.append('file', file)
      // Sin exhibits al subir manualmente

      const parseRes = await fetch('/api/parse/docx', {
        method: 'POST',
        body: formData
      })
      const parseData = await parseRes.json()
      if (!parseRes.ok) throw new Error(parseData.error || 'Error al parsear documento')

      setStatusMsg('Saving article...')
      const saveRes = await fetch('/api/articles/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parseData)
      })
      const saveData = await saveRes.json()
      if (!saveRes.ok) throw new Error(saveData.error || 'Error al guardar')

      setStep('done')
      setStatusMsg('Article created successfully!')
      setTimeout(() => router.push(`/articles/${saveData.id}`), 1500)

    } catch (err) {
      setError(err.message)
      setStep('input')
      setLoading(false)
    }
  }

  const canProcess = mode === 'sharepoint' ? folderUrl.trim().length > 0 : file !== null

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200, padding: '1rem'
    }}>
      <div style={{
        backgroundColor: 'white', borderRadius: '8px', padding: '2rem',
        width: '100%', maxWidth: '520px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
      }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>New Article</h2>
          <button onClick={onClose} disabled={loading}
            style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: loading ? 'not-allowed' : 'pointer', color: '#999' }}>
            ✕
          </button>
        </div>

        {step === 'input' && (
          <>
            {/* Mode toggle */}
            <div style={{
              display: 'flex', gap: '0.5rem', marginBottom: '1.5rem',
              backgroundColor: '#f5f5f5', padding: '0.25rem', borderRadius: '6px'
            }}>
              {[
                { id: 'sharepoint', label: '📁 SharePoint' },
                { id: 'manual', label: '📄 Upload file' }
              ].map(m => (
                <button key={m.id} onClick={() => { setMode(m.id); setError('') }}
                  style={{
                    flex: 1, padding: '0.5rem', border: 'none', borderRadius: '4px',
                    cursor: 'pointer', fontSize: '0.85rem',
                    fontWeight: mode === m.id ? '700' : '400',
                    backgroundColor: mode === m.id ? 'white' : 'transparent',
                    color: mode === m.id ? '#111' : '#666',
                    boxShadow: mode === m.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}>
                  {m.label}
                </button>
              ))}
            </div>

            {mode === 'sharepoint' ? (
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.4rem', color: '#333' }}>
                  SharePoint folder URL
                </label>
                <input
                  type="text"
                  value={folderUrl}
                  onChange={e => setFolderUrl(e.target.value)}
                  placeholder="https://onemsci.sharepoint.com/sites/..."
                  style={{
                    width: '100%', padding: '0.65rem 0.75rem', border: '1px solid #ddd',
                    borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box',
                    fontFamily: 'monospace'
                  }}
                />
                <p style={{ fontSize: '0.8rem', color: '#999', marginTop: '0.5rem', marginBottom: 0 }}>
                  Paste the link to the project folder in SharePoint (RE-XXXX-...)
                </p>
              </div>
            ) : (
              <label style={{
                display: 'block', border: '2px dashed #ddd', borderRadius: '8px',
                padding: '2rem', textAlign: 'center', cursor: 'pointer',
                backgroundColor: file ? '#f0fff4' : '#fafafa',
                borderColor: file ? '#86efac' : '#ddd'
              }}>
                <input type="file" accept=".docx" onChange={handleFileChange} style={{ display: 'none' }} />
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{file ? '✅' : '📄'}</div>
                <div style={{ fontSize: '0.9rem', color: file ? '#16a34a' : '#666', fontWeight: file ? '600' : '400' }}>
                  {file ? file.name : 'Click to select the .docx file'}
                </div>
                {!file && <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '0.25rem' }}>Only .docx files</div>}
              </label>
            )}

            {error && (
              <div style={{
                backgroundColor: '#fff0f0', border: '1px solid #ffcccc', color: '#cc0000',
                padding: '0.65rem 0.75rem', borderRadius: '4px', fontSize: '0.85rem', marginTop: '1rem'
              }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button onClick={onClose} style={{
                flex: 1, padding: '0.65rem', border: '1px solid #ddd', borderRadius: '4px',
                cursor: 'pointer', fontSize: '0.9rem', backgroundColor: 'white', color: '#333'
              }}>
                Cancel
              </button>
              <button
                onClick={mode === 'sharepoint' ? processWithSharePoint : processManual}
                disabled={!canProcess}
                style={{
                  flex: 2, padding: '0.65rem', border: 'none', borderRadius: '4px',
                  cursor: canProcess ? 'pointer' : 'not-allowed', fontSize: '0.9rem',
                  fontWeight: '600', backgroundColor: canProcess ? 'black' : '#ccc', color: 'white'
                }}>
                Process with Claude
              </button>
            </div>
          </>
        )}

        {step === 'processing' && (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚙️</div>
            <p style={{ color: '#333', fontWeight: '600', marginBottom: '0.5rem' }}>Processing...</p>
            <p style={{ color: '#666', fontSize: '0.9rem', margin: 0, lineHeight: '1.5' }}>{statusMsg}</p>
          </div>
        )}

        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🎉</div>
            <p style={{ color: '#16a34a', fontWeight: '600', marginBottom: '0.5rem' }}>{statusMsg}</p>
            <p style={{ color: '#666', fontSize: '0.85rem', margin: 0 }}>Redirecting to article...</p>
          </div>
        )}

      </div>
    </div>
  )
}