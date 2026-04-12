'use client'
/**
 * NewArticleModal
 *
 * Modal shell for creating a new article. Owns only the local input
 * state (which mode is active, folder URL, picked file) and composes
 * the extracted sub-components. All SharePoint / parse / save logic
 * lives in useArticleCreation; each step screen lives in its own file
 * under ./new-article/.
 */
import { useState } from 'react'
import { useArticleCreation } from './new-article/useArticleCreation'
import ModeToggle from './new-article/ModeToggle'
import SharePointInput from './new-article/SharePointInput'
import FileUploadInput from './new-article/FileUploadInput'
import ProcessingState from './new-article/ProcessingState'
import DoneState from './new-article/DoneState'

export default function NewArticleModal({ onClose }) {
  const [mode, setMode] = useState('sharepoint')
  const [folderUrl, setFolderUrl] = useState('')
  const [file, setFile] = useState(null)
  const {
    step,
    statusMsg,
    error,
    loading,
    setError,
    processWithSharePoint,
    processManual,
  } = useArticleCreation()

  const canProcess = mode === 'sharepoint' ? folderUrl.trim().length > 0 : file !== null

  const handleModeChange = (next) => {
    setMode(next)
    setError('')
  }

  const handleProcess = () => {
    if (mode === 'sharepoint') processWithSharePoint(folderUrl)
    else processManual(file)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: '1rem',
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '2rem',
          width: '100%',
          maxWidth: '520px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>New Article</h2>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.2rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              color: '#999',
            }}
          >
            ✕
          </button>
        </div>

        {step === 'input' && (
          <>
            <ModeToggle mode={mode} onChange={handleModeChange} />

            {mode === 'sharepoint' ? (
              <SharePointInput value={folderUrl} onChange={setFolderUrl} />
            ) : (
              <FileUploadInput file={file} onSelect={setFile} onError={setError} />
            )}

            {error && (
              <div
                style={{
                  backgroundColor: '#fff0f0',
                  border: '1px solid #ffcccc',
                  color: '#cc0000',
                  padding: '0.65rem 0.75rem',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                  marginTop: '1rem',
                }}
              >
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button
                onClick={onClose}
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
                onClick={handleProcess}
                disabled={!canProcess}
                style={{
                  flex: 2,
                  padding: '0.65rem',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: canProcess ? 'pointer' : 'not-allowed',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  backgroundColor: canProcess ? 'black' : '#ccc',
                  color: 'white',
                }}
              >
                Process with Claude
              </button>
            </div>
          </>
        )}

        {step === 'processing' && <ProcessingState statusMsg={statusMsg} />}
        {step === 'done' && <DoneState statusMsg={statusMsg} />}
      </div>
    </div>
  )
}
