'use client'
/**
 * ExhibitAsset
 *
 * Dispatcher that picks the right renderer for an exhibit based on
 * its `exhibit_type`:
 *
 *   - static       → <picture> with desktop + mobile sources (falls
 *                    back to ExpiredPlaceholder on load error).
 *   - interactive  → <VegaChart> rendering the JSON spec via the
 *                    pinned Vega / Vega-Lite loader.
 *   - anything else → tiny "type not recognized" stub.
 *
 * All the heavy lifting lives in ./exhibit/ (VegaChart, vegaLoader,
 * ExpiredPlaceholder). This file is just the type switch.
 */
import { useState } from 'react'
import VegaChart from './exhibit/VegaChart'
import ExpiredPlaceholder from './exhibit/ExpiredPlaceholder'

function StaticExhibit({ exhibit, onExpired }) {
  const [imgError, setImgError] = useState(false)
  const desktopUrl = exhibit?.desktop?.downloadUrl
  const mobileUrl = exhibit?.mobile?.downloadUrl

  if (!desktopUrl || imgError) {
    return <ExpiredPlaceholder onExpired={onExpired} filename={exhibit?.desktop?.filename} />
  }

  return (
    <picture>
      {mobileUrl && <source media="(max-width: 768px)" srcSet={mobileUrl} />}
      <img
        src={desktopUrl}
        alt={exhibit?.desktop?.filename || 'Exhibit'}
        onError={() => {
          setImgError(true)
          onExpired?.()
        }}
        style={{ width: '100%', display: 'block', border: 'none' }}
      />
    </picture>
  )
}

export default function ExhibitAsset({ exhibit, onExpired }) {
  const type = exhibit?.exhibit_type || exhibit?.type

  if (type === 'static') {
    return <StaticExhibit exhibit={exhibit} onExpired={onExpired} />
  }

  if (type === 'interactive') {
    const jsonUrl = exhibit?.json?.downloadUrl
    if (!jsonUrl) {
      return <ExpiredPlaceholder onExpired={onExpired} filename={exhibit?.json?.filename} />
    }
    return (
      <VegaChart
        jsonUrl={jsonUrl}
        filename={exhibit?.json?.filename}
        onExpired={onExpired}
      />
    )
  }

  return (
    <div
      style={{
        padding: '1rem',
        backgroundColor: '#f5f5f5',
        borderRadius: '4px',
        textAlign: 'center',
        color: '#999',
        fontSize: '0.85rem',
      }}
    >
      Tipo de exhibit no reconocido
    </div>
  )
}
