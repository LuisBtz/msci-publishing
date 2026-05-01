// Augment the Window type for vega CDN globals
declare global {
  interface Window {
    vega: unknown
    vegaLite: unknown
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vegaEmbed: any
    __vegaEmbedPromise: Promise<unknown> | undefined
  }
}

const VEGA_SCRIPTS = [
  {
    id: 'vega-script',
    src: 'https://cdn.jsdelivr.net/npm/vega@5.22.1/build/vega.min.js',
    check: () => window.vega,
  },
  {
    id: 'vega-lite-script',
    src: 'https://cdn.jsdelivr.net/npm/vega-lite@4.17.0/build/vega-lite.min.js',
    check: () => window.vegaLite,
  },
  {
    id: 'vega-embed-script',
    src: 'https://cdn.jsdelivr.net/npm/vega-embed@6.21.0/build/vega-embed.min.js',
    check: () => window.vegaEmbed,
  },
]

function loadScript({ id, src, check }: { id: string; src: string; check: () => unknown }) {
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

export function loadVegaEmbed() {
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR'))
  if (window.vegaEmbed) return Promise.resolve(window.vegaEmbed)
  if (window.__vegaEmbedPromise) return window.__vegaEmbedPromise

  window.__vegaEmbedPromise = VEGA_SCRIPTS.reduce(
    (p, script) => p.then(() => loadScript(script)),
    Promise.resolve()
  ).then(() => window.vegaEmbed)

  return window.__vegaEmbedPromise
}
