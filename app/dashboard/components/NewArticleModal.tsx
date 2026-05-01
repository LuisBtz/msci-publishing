'use client'
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
        backgroundColor: 'rgba(0,0,0,0.45)',
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
          borderRadius: '18px',
          padding: '2rem',
          width: '100%',
          maxWidth: '520px',
          boxShadow: '0px 4px 16px 0px rgba(0,0,0,0.25)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem',
          }}
        >
          <h2 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: '600',
            letterSpacing: '-0.04em',
          }}>
            New Article
          </h2>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              background: 'none',
              border: '1px solid #CCCCCC',
              width: '32px',
              height: '32px',
              borderRadius: '100px',
              fontSize: '14px',
              cursor: loading ? 'not-allowed' : 'pointer',
              color: '#707070',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'inherit',
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
                  backgroundColor: '#FEF0E9',
                  border: '1px solid #F7620E',
                  color: '#F7620E',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  letterSpacing: '-0.02em',
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
                onClick={handleProcess}
                disabled={!canProcess}
                style={{
                  flex: 2,
                  height: '44px',
                  border: 'none',
                  borderRadius: '100px',
                  cursor: canProcess ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  fontWeight: '500',
                  letterSpacing: '-0.02em',
                  backgroundColor: canProcess ? '#1A3FD6' : '#CCCCCC',
                  color: 'white',
                  fontFamily: 'inherit',
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
