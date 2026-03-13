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
      setError('El archivo debe ser un .docx')
      setFile(null)
    }
  }

  const processWithSharePoint = async () => {
    setLoading(true)
    setStep('processing')
    setError('')

    try {
      // 1. Leer carpeta de SharePoint
      setStatusMsg('Leyendo carpeta de SharePoint...')
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
        setStatusMsg(`SharePoint leído — ${summary.statics} estáticos, ${summary.interactives} interactivos encontrados. Analizando documento...`)
        await new Promise(r => setTimeout(r, 800))
      }

      if (!spData.exhibitsFound) {
        setStatusMsg('⚠ No se encontraron exhibits — continuando...')
        await new Promise(r => setTimeout(r, 1000))
      }

      // 2. Parsear el .docx con Claude
      setStatusMsg('Claude está analizando el documento...')
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
      setStatusMsg('Guardando artículo...')
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
      setStatusMsg('¡Artículo creado correctamente!')
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
      setStatusMsg('Claude está analizando el documento...')
      const formData = new FormData()
      formData.append('file', file)
      // Sin exhibits al subir manualmente

      const parseRes = await fetch('/api/parse/docx', {
        method: 'POST',
        body: formData
      })
      const parseData = await parseRes.json()
      if (!parseRes.ok) throw new Error(parseData.error || 'Error al parsear documento')

      setStatusMsg('Guardando artículo...')
      const saveRes = await fetch('/api/articles/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parseData)
      })
      const saveData = await saveRes.json()
      if (!saveRes.ok) throw new Error(saveData.error || 'Error al guardar')

      setStep('done')
      setStatusMsg('¡Artículo creado correctamente!')
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
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>Nuevo Artículo</h2>
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
                { id: 'manual', label: '📄 Subir archivo' }
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
                  Pega el link de la carpeta del proyecto en SharePoint (RE-XXXX-...)
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
                  {file ? file.name : 'Click para seleccionar el archivo .docx'}
                </div>
                {!file && <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '0.25rem' }}>Solo archivos .docx</div>}
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
                Cancelar
              </button>
              <button
                onClick={mode === 'sharepoint' ? processWithSharePoint : processManual}
                disabled={!canProcess}
                style={{
                  flex: 2, padding: '0.65rem', border: 'none', borderRadius: '4px',
                  cursor: canProcess ? 'pointer' : 'not-allowed', fontSize: '0.9rem',
                  fontWeight: '600', backgroundColor: canProcess ? 'black' : '#ccc', color: 'white'
                }}>
                Procesar con Claude
              </button>
            </div>
          </>
        )}

        {step === 'processing' && (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚙️</div>
            <p style={{ color: '#333', fontWeight: '600', marginBottom: '0.5rem' }}>Procesando...</p>
            <p style={{ color: '#666', fontSize: '0.9rem', margin: 0, lineHeight: '1.5' }}>{statusMsg}</p>
          </div>
        )}

        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🎉</div>
            <p style={{ color: '#16a34a', fontWeight: '600', marginBottom: '0.5rem' }}>{statusMsg}</p>
            <p style={{ color: '#666', fontSize: '0.85rem', margin: 0 }}>Redirigiendo al artículo...</p>
          </div>
        )}

      </div>
    </div>
  )
}