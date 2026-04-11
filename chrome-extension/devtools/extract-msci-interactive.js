/*
 * MSCI live-page interactive (Vega) extractor
 * --------------------------------------------
 * Pegar en DevTools de https://www.msci.com/research-and-insights/blog-post/<slug>
 * en una página que TENGA un exhibit interactivo (no estático).
 *
 * Captura:
 *  - Spec JSON cargado por vega-embed (lo busca en performance entries)
 *  - DOM hierarchy y computed styles del contenedor del chart
 *  - Bounding box del contenedor (para entender el ancho real)
 *  - Config / options pasados a vega-embed (lo intenta inferir del view)
 *  - Versiones de vega/vega-lite/vega-embed cargadas
 *
 * Descarga un JSON con todo. No hace requests adicionales salvo (opcionalmente)
 * para descargar los .json de spec que ya fueron cacheados por el browser.
 */
(async () => {
  const OUT = {
    meta: {
      url: location.href,
      capturedAt: new Date().toISOString(),
      viewport: { w: window.innerWidth, h: window.innerHeight, dpr: devicePixelRatio },
    },
    versions: {
      vega: window.vega?.version || null,
      vegaLite: window.vegaLite?.version || null,
      vegaEmbed: window.vegaEmbed?.version || null,
    },
    candidates: [],     // contenedores de chart encontrados
    specUrls: [],       // URLs de specs detectadas en performance
    specs: [],          // specs JSON descargadas (cacheadas)
    networkJson: [],    // todos los .json fetched en performance
  };

  // ── Properties que medimos en cada contenedor ──────────────────────────────
  const PROPS = [
    'display','position','boxSizing','width','maxWidth','minWidth','height','maxHeight',
    'margin','marginTop','marginRight','marginBottom','marginLeft',
    'padding','paddingTop','paddingRight','paddingBottom','paddingLeft',
    'overflow','overflowX','overflowY',
    'background','backgroundColor',
    'flex','flexDirection','justifyContent','alignItems','gap',
    'gridTemplateColumns',
  ];

  const computed = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const out = {};
    for (const p of PROPS) {
      const v = cs[p];
      if (v && v !== 'normal' && v !== 'auto' && v !== 'none' && v !== '0px' && v !== 'rgba(0, 0, 0, 0)') {
        out[p] = v;
      }
    }
    return out;
  };

  const rectOf = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  };

  // ── 1. Buscar contenedores candidatos ──────────────────────────────────────
  const selectors = [
    '.vega-embed',
    '[class*="vega" i]',
    '[class*="interactive" i] canvas',
    '[class*="interactive" i] svg',
    '[class*="exhibit" i] canvas',
    '[class*="exhibit" i] svg',
    'canvas',
  ];
  const seen = new Set();
  for (const sel of selectors) {
    document.querySelectorAll(sel).forEach(el => {
      // Subir al wrapper más cercano que parezca el contenedor del chart
      let target = el;
      if (target.tagName === 'CANVAS' || target.tagName === 'svg') {
        target = target.closest('.vega-embed') || target.parentElement || target;
      }
      if (seen.has(target)) return;
      seen.add(target);

      // Recolectar ancestros con sus styles para entender la cadena de width
      const ancestors = [];
      let cur = target;
      let depth = 0;
      while (cur && depth < 6) {
        ancestors.push({
          tag: cur.tagName.toLowerCase(),
          class: typeof cur.className === 'string' ? cur.className : (cur.className?.baseVal || ''),
          id: cur.id || '',
          rect: rectOf(cur),
          computed: computed(cur),
        });
        cur = cur.parentElement;
        depth++;
      }

      OUT.candidates.push({
        matchedBy: sel,
        tag: target.tagName.toLowerCase(),
        class: typeof target.className === 'string' ? target.className : (target.className?.baseVal || ''),
        id: target.id || '',
        rect: rectOf(target),
        computed: computed(target),
        innerHtmlPreview: (target.outerHTML || '').slice(0, 800),
        ancestors,
      });
    });
  }

  // ── 2. Buscar specs en performance entries (resources cargadas) ────────────
  try {
    const entries = performance.getEntriesByType('resource');
    for (const e of entries) {
      const u = e.name;
      if (!u) continue;
      if (u.endsWith('.json') || u.includes('.json?') || u.includes('/vega') || u.includes('/spec')) {
        OUT.networkJson.push({
          url: u,
          duration: e.duration,
          size: e.transferSize,
          initiatorType: e.initiatorType,
        });
        // Heurística: probablemente sea un spec si está en /content/dam o tiene "exhibit" en el path
        if (/exhibit|chart|interactive|vega|spec/i.test(u) || /\/dam\//i.test(u)) {
          OUT.specUrls.push(u);
        }
      }
    }
  } catch (e) {
    OUT.networkJson.push({ error: String(e) });
  }

  // ── 3. Descargar specs (las que ya estén cacheadas no harán roundtrip) ────
  for (const url of OUT.specUrls.slice(0, 8)) {
    try {
      const r = await fetch(url, { credentials: 'same-origin' });
      if (!r.ok) {
        OUT.specs.push({ url, error: `HTTP ${r.status}` });
        continue;
      }
      const ct = r.headers.get('content-type') || '';
      if (!ct.includes('json')) {
        OUT.specs.push({ url, skipped: 'not json', contentType: ct });
        continue;
      }
      const json = await r.json();
      OUT.specs.push({
        url,
        keys: Object.keys(json),
        $schema: json.$schema || null,
        width: json.width,
        height: json.height,
        autosize: json.autosize,
        config: json.config ? Object.keys(json.config) : null,
        padding: json.padding,
        // Spec completo (puede ser grande)
        spec: json,
      });
    } catch (e) {
      OUT.specs.push({ url, error: String(e) });
    }
  }

  // ── 4. Intentar inferir el view de vega-embed ─────────────────────────────
  // vega-embed crea un wrapper .vega-embed y guarda el view en propiedades
  // internas. No es API estable, pero podemos intentar.
  OUT.candidates.forEach((c, i) => {
    try {
      const el = document.querySelectorAll(c.matchedBy)[i];
      if (!el) return;
      // vega-embed: el view a veces queda en el container o en el script padre
      // Buscamos canvas con propiedad __vega_view__ o similar
      const canvas = el.querySelector?.('canvas') || (el.tagName === 'CANVAS' ? el : null);
      if (canvas) {
        c.canvasRect = rectOf(canvas);
        c.canvasResolution = {
          intrinsicW: canvas.width,
          intrinsicH: canvas.height,
          cssW: canvas.getBoundingClientRect().width,
          cssH: canvas.getBoundingClientRect().height,
        };
      }
    } catch (e) { /* ignore */ }
  });

  // ── 5. Descargar JSON ──────────────────────────────────────────────────────
  const blob = new Blob([JSON.stringify(OUT, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `msci-interactive-${location.pathname.split('/').filter(Boolean).pop() || 'page'}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  console.log('[MSCI interactive extractor] done.', OUT);
  return OUT;
})();
