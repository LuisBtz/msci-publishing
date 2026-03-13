'use client'
import { useState, useEffect, useRef } from 'react'

// Renderiza un exhibit — static SVG/webp o interactive Vega JSON
export default function ExhibitAsset({ exhibit, onExpired }) {
  const [imgError, setImgError] = useState(false)
  const [jsonData, setJsonData] = useState(null)
  const [jsonError, setJsonError] = useState(false)
  const [loadingJson, setLoadingJson] = useState(false)
  const vegaRef = useRef(null)
  const vegaViewRef = useRef(null)

  const type = exhibit?.exhibit_type || exhibit?.type

  // ── Static SVG/webp ──────────────────────────────────────────────────────
  if (type === 'static') {
    const url = exhibit?.desktop?.downloadUrl
    if (!url || imgError) {
      return <ExpiredPlaceholder onExpired={onExpired} filename={exhibit?.desktop?.filename} />
    }
    return (
      <div>
        <div style={{ marginBottom: '0.35rem' }}>
          <span style={{ fontSize: '0.72rem', color: '#999', fontWeight: '600', textTransform: 'uppercase' }}>Desktop</span>
        </div>
        <img
          src={url}
          alt={exhibit?.desktop?.filename || 'Exhibit'}
          onError={() => { setImgError(true); onExpired?.() }}
          style={{ width: '100%', borderRadius: '4px', border: '1px solid #e5e5e5', display: 'block' }}
        />
        {exhibit?.mobile?.downloadUrl && (
          <div style={{ marginTop: '0.5rem' }}>
            <span style={{ fontSize: '0.72rem', color: '#999', fontWeight: '600', textTransform: 'uppercase' }}>Mobile</span>
            <img
              src={exhibit.mobile.downloadUrl}
              alt={exhibit.mobile.filename || 'Exhibit mobile'}
              style={{ width: '180px', marginTop: '0.35rem', borderRadius: '4px', border: '1px solid #e5e5e5', display: 'block' }}
            />
          </div>
        )}
      </div>
    )
  }

  // ── Interactive Vega JSON ────────────────────────────────────────────────
  if (type === 'interactive') {
    const jsonUrl = exhibit?.json?.downloadUrl

    if (!jsonUrl || jsonError) {
      return <ExpiredPlaceholder onExpired={onExpired} filename={exhibit?.json?.filename} />
    }

    return <VegaChart jsonUrl={jsonUrl} filename={exhibit?.json?.filename} onExpired={onExpired} />
  }

  return (
    <div style={{ padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '4px', textAlign: 'center', color: '#999', fontSize: '0.85rem' }}>
      Tipo de exhibit no reconocido
    </div>
  )
}

// Vega chart loader
function VegaChart({ jsonUrl, filename, onExpired }) {
  const [spec, setSpec] = useState(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const containerRef = useRef(null)
  const viewRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)

    fetch(jsonUrl)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => { if (!cancelled) setSpec(data) })
      .catch(() => {
        if (!cancelled) { setError(true); onExpired?.() }
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [jsonUrl])

  useEffect(() => {
    if (!spec || !containerRef.current) return

    // Limpiar view anterior
    if (viewRef.current) {
      viewRef.current.finalize()
      viewRef.current = null
    }

    const renderVega = () => {
      if (!window.vega || !containerRef.current) return
      try {
        const view = new window.vega.View(window.vega.parse(spec), {
          renderer: 'canvas',
          container: containerRef.current,
          hover: true
        })
        view.runAsync()
        viewRef.current = view
      } catch (err) {
        console.error('Vega render error:', err)
        setError(true)
      }
    }

    if (window.vega) {
      renderVega()
    } else {
      // Cargar Vega via script tag
      const existing = document.getElementById('vega-script')
      if (existing) {
        existing.addEventListener('load', renderVega)
        return
      }
      const s = document.createElement('script')
      s.id = 'vega-script'
      s.src = 'https://cdn.jsdelivr.net/npm/vega@5/build/vega.min.js'
      s.onload = renderVega
      s.onerror = () => setError(true)
      document.head.appendChild(s)
    }

    return () => {
      if (viewRef.current) {
        viewRef.current.finalize()
        viewRef.current = null
      }
    }
  }, [spec])

  if (loading) return (
    <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
      <p style={{ color: '#999', fontSize: '0.85rem', margin: 0 }}>⏳ Cargando visualización interactiva...</p>
    </div>
  )

  if (error) return <ExpiredPlaceholder onExpired={onExpired} filename={filename} />

  return (
    <div>
      <div ref={containerRef} style={{ width: '100%', overflow: 'auto' }} />
      <p style={{ fontSize: '0.72rem', color: '#999', marginTop: '0.5rem', margin: '0.5rem 0 0' }}>
        ⚡ Interactive — {filename}
      </p>
    </div>
  )
}

// ── Placeholder cuando la URL expiró ────────────────────────────────────────
function ExpiredPlaceholder({ onExpired, filename }) {
  return (
    <div style={{
      padding: '1.5rem', backgroundColor: '#fff8e8', borderRadius: '4px',
      border: '1px dashed #fbbf24', textAlign: 'center'
    }}>
      <p style={{ fontSize: '0.85rem', color: '#92400e', margin: '0 0 0.5rem', fontWeight: '600' }}>
        ⏰ URL expirada
      </p>
      {filename && (
        <p style={{ fontSize: '0.78rem', color: '#78350f', margin: '0 0 0.75rem', fontFamily: 'monospace' }}>
          {filename}
        </p>
      )}
      <button
        onClick={onExpired}
        style={{
          backgroundColor: '#f59e0b', color: 'white', border: 'none',
          padding: '0.4rem 0.9rem', borderRadius: '4px', cursor: 'pointer',
          fontSize: '0.8rem', fontWeight: '600'
        }}
      >
        🔄 Refresh assets
      </button>
    </div>
  )
}