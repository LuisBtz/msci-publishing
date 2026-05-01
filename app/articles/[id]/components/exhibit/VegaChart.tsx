'use client'
/**
 * VegaChart
 *
 * Renders an interactive Vega-Lite@4 chart from a JSON spec URL.
 * Handles the full lifecycle: fetch the spec, load pinned Vega
 * libraries via vegaLoader, mount into a ref'd container, resize via
 * ResizeObserver when the viewport changes, and finalize on unmount.
 *
 * The wrapper replicates msci.com's visual container:
 *   - 16:9 aspect ratio on the outer flex box,
 *   - child SVG stretches to 100% width,
 *   - any vega-bindings (select dropdowns) are pinned to the bottom
 *     with the MSCI body-s typography.
 *
 * When the spec fetch or embed fails, falls back to ExpiredPlaceholder
 * and fires onExpired so the parent can prompt for a SharePoint
 * asset refresh.
 */
import { useState, useEffect, useRef } from 'react'
import { loadVegaEmbed } from './vegaLoader'
import ExpiredPlaceholder from './ExpiredPlaceholder'

// Local stylesheet injected once per VegaChart instance. The selectors
// that React style objects cannot express (child combinator `>`, the
// data-URI dropdown arrow, etc.) live here so the chart matches the
// real msci.com look 1:1.
const VEGA_WRAPPER_CSS = `
  .msci-vega-wrapper .vega-embed {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  .msci-vega-wrapper .vega-embed > svg,
  .msci-vega-wrapper .vega-embed > canvas {
    width: 100% !important;
    height: auto !important;
    flex: 1 1 auto;
    min-height: 0;
    margin: auto 0;
  }
  .msci-vega-wrapper canvas { max-width: 100% !important; }
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
`

export default function VegaChart({ jsonUrl, filename, onExpired }) {
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const containerRef = useRef(null)
  const viewRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)

    Promise.all([
      fetch(jsonUrl).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      }),
      loadVegaEmbed(),
    ])
      .then(([spec, vegaEmbed]) => {
        if (cancelled || !containerRef.current) return
        return vegaEmbed(containerRef.current, spec, {
          actions: false,
          renderer: 'svg',
        }).then((result) => {
          if (cancelled) {
            result.view?.finalize?.()
            return
          }
          viewRef.current = result.view
          if (typeof ResizeObserver !== 'undefined') {
            const ro = new ResizeObserver(() => {
              try {
                result.view.resize().runAsync()
              } catch {}
            })
            ro.observe(containerRef.current)
            viewRef.current.__ro = ro
          }
        })
      })
      .catch((err) => {
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

  return (
    <>
      <style>{VEGA_WRAPPER_CSS}</style>
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
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#999',
              fontSize: '14px',
            }}
          >
            Loading interactive visualization…
          </div>
        )}
      </div>
    </>
  )
}
