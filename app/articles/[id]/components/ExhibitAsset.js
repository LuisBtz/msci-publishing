'use client'
import { useState, useEffect, useRef } from 'react'

// Renderiza un exhibit — static SVG/webp o interactive Vega/Vega-Lite JSON
export default function ExhibitAsset({ exhibit, onExpired }) {
  const [imgError, setImgError] = useState(false)

  const type = exhibit?.exhibit_type || exhibit?.type

  // ── Static SVG/webp (responsive: desktop en >768px, mobile en <=768px) ───
  if (type === 'static') {
    const desktopUrl = exhibit?.desktop?.downloadUrl
    const mobileUrl = exhibit?.mobile?.downloadUrl
    if (!desktopUrl || imgError) {
      return <ExpiredPlaceholder onExpired={onExpired} filename={exhibit?.desktop?.filename} />
    }
    return (
      <picture>
        {mobileUrl && (
          <source media="(max-width: 768px)" srcSet={mobileUrl} />
        )}
        <img
          src={desktopUrl}
          alt={exhibit?.desktop?.filename || 'Exhibit'}
          onError={() => { setImgError(true); onExpired?.() }}
          style={{ width: '100%', display: 'block', border: 'none' }}
        />
      </picture>
    )
  }

  // ── Interactive Vega / Vega-Lite JSON ────────────────────────────────────
  if (type === 'interactive') {
    const jsonUrl = exhibit?.json?.downloadUrl
    if (!jsonUrl) {
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

// ── Vega-Embed loader ──────────────────────────────────────────────────────
// Versiones EXACTAS que usa msci.com (verificado vía DevTools extractor).
// Mantenerlas pinned es importante: los specs son vega-lite@4, no @5.
const VEGA_SCRIPTS = [
  { id: 'vega-script', src: 'https://cdn.jsdelivr.net/npm/vega@5.22.1/build/vega.min.js', check: () => window.vega },
  { id: 'vega-lite-script', src: 'https://cdn.jsdelivr.net/npm/vega-lite@4.17.0/build/vega-lite.min.js', check: () => window.vegaLite },
  { id: 'vega-embed-script', src: 'https://cdn.jsdelivr.net/npm/vega-embed@6.21.0/build/vega-embed.min.js', check: () => window.vegaEmbed },
]

function loadScript({ id, src, check }) {
  return new Promise((resolve, reject) => {
    if (check()) return resolve(check())
    const existing = document.getElementById(id)
    if (existing) {
      existing.addEventListener('load', () => resolve(check()))
      existing.addEventListener('error', reject)
      return
    }
    const s = document.createElement('script')
    s.id = id
    s.src = src
    s.async = false
    s.onload = () => resolve(check())
    s.onerror = reject
    document.head.appendChild(s)
  })
}

function loadVegaEmbed() {
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR'))
  if (window.vegaEmbed) return Promise.resolve(window.vegaEmbed)
  if (window.__vegaEmbedPromise) return window.__vegaEmbedPromise

  // Cargar secuencialmente: vega → vega-lite → vega-embed
  window.__vegaEmbedPromise = VEGA_SCRIPTS.reduce(
    (p, script) => p.then(() => loadScript(script)),
    Promise.resolve()
  ).then(() => window.vegaEmbed)

  return window.__vegaEmbedPromise
}

function VegaChart({ jsonUrl, filename, onExpired }) {
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const containerRef = useRef(null)
  const viewRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)

    Promise.all([
      fetch(jsonUrl).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      }),
      loadVegaEmbed(),
    ])
      .then(([spec, vegaEmbed]) => {
        if (cancelled || !containerRef.current) return
        // Pasamos el spec tal cual — msci.com no lo modifica.
        // El wrapper aplica aspect-ratio + svg{width:100%} para que llene
        // el contenedor sin tocar el spec.
        return vegaEmbed(containerRef.current, spec, {
          actions: false,
          renderer: 'svg',
        }).then(result => {
          if (cancelled) {
            result.view?.finalize?.()
            return
          }
          viewRef.current = result.view
          // Re-render en resize del contenedor (responsive a viewport changes)
          if (typeof ResizeObserver !== 'undefined') {
            const ro = new ResizeObserver(() => {
              try { result.view.resize().runAsync() } catch {}
            })
            ro.observe(containerRef.current)
            viewRef.current.__ro = ro
          }
        })
      })
      .catch(err => {
        if (cancelled) return
        console.error('Vega render error:', err)
        setError(true)
        onExpired?.()
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      if (viewRef.current) {
        viewRef.current.__ro?.disconnect?.()
        viewRef.current.finalize?.()
        viewRef.current = null
      }
    }
  }, [jsonUrl])

  if (error) return <ExpiredPlaceholder onExpired={onExpired} filename={filename} />

  // Wrapper que replica el contenedor de msci.com:
  //   ms-body-s-lg          → 16px / 24 / -0.32px tipografía
  //   ms-aspect-[16/9]      → mínimo aspect ratio 16/9
  //   ms-w-full             → 100% del padre
  //   [&>svg]:ms-w-full     → SVG hijo llena el ancho
  //   [&>svg]:ms-h-full     → SVG hijo llena el alto
  // El styled tag inyecta el selector `> svg` y `> form.vega-bindings` que
  // los inline styles no pueden expresar.
  return (
    <>
      <style>{`
        .msci-vega-wrapper .vega-embed {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        /* Chart (svg/canvas) ocupa el espacio disponible y queda centrado verticalmente */
        .msci-vega-wrapper .vega-embed > svg,
        .msci-vega-wrapper .vega-embed > canvas {
          width: 100% !important;
          height: auto !important;
          flex: 1 1 auto;
          min-height: 0;
          margin: auto 0;
        }
        .msci-vega-wrapper canvas { max-width: 100% !important; }
        /* Bindings (dropdown) anclado al fondo */
        .msci-vega-wrapper .vega-bindings {
          margin-top: auto;
          padding-top: 8px;
          font-family: var(--font-inter), Inter, Arial, sans-serif;
          font-size: 16px; line-height: 24px; letter-spacing: -0.32px;
          color: rgb(0, 0, 0);
        }
        .msci-vega-wrapper .vega-bind { display: flex; align-items: center; gap: 8px; }
        .msci-vega-wrapper .vega-bind label { display: inline-flex; align-items: center; gap: 8px; }
        .msci-vega-wrapper .vega-bind select {
          font-family: inherit; font-size: 16px; padding: 4px 24px 4px 8px;
          border: none; outline: none; background: transparent;
          color: rgb(0, 0, 0); cursor: pointer;
          appearance: none; -webkit-appearance: none; -moz-appearance: none;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'><path d='M2 4l4 4 4-4' stroke='black' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>");
          background-repeat: no-repeat;
          background-position: right 4px center;
        }
        .msci-vega-wrapper .vega-bind select:focus { outline: none; box-shadow: none; }
      `}</style>
      <div
        className="msci-vega-wrapper"
        style={{
          width: '100%',
          aspectRatio: '16 / 9',
          fontFamily: 'var(--font-inter), Inter, Arial, sans-serif',
          fontSize: '16px',
          lineHeight: '24px',
          letterSpacing: '-0.32px',
          color: 'rgb(0, 0, 0)',
          position: 'relative',
          display: 'flex',
        }}
      >
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: '#999', fontSize: '14px',
          }}>
            Loading interactive visualization…
          </div>
        )}
      </div>
    </>
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
        URL expirada
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
        Refresh assets
      </button>
    </div>
  )
}
