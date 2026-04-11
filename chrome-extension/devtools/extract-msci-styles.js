/*
 * MSCI live-page style extractor
 * ------------------------------
 * Pegar este script en la consola de DevTools mientras estás en
 *   https://www.msci.com/research-and-insights/blog-post/<slug>
 *
 * Descarga un archivo JSON con todo lo necesario para clonar los estilos
 * en el preview de la plataforma de publishing.
 *
 * No hace requests externos: solo lee el DOM y los stylesheets ya cargados.
 */
(() => {
  const OUT = {
    meta: {
      url: location.href,
      title: document.title,
      capturedAt: new Date().toISOString(),
      viewport: { w: window.innerWidth, h: window.innerHeight, dpr: devicePixelRatio },
    },
    rootVars: {},
    htmlVars: {},
    bodyComputed: {},
    fontFaces: [],
    loadedFonts: [],
    containers: {},
    tagSamples: {},          // first-of-tag computed styles inside article
    componentSamples: {},    // curated selectors → computed style
    classCatalog: {},        // className → computed style (first match in article)
    skeleton: null,          // class/tag tree of the article (no text)
    rawArticleHtml: null,    // sanitized inner HTML of the article (classes only)
    stylesheetSummary: [],
  };

  // ── Properties que nos importan al medir un nodo ────────────────────────────
  const PROPS = [
    'display','position','boxSizing','width','maxWidth','minWidth','height','maxHeight',
    'margin','marginTop','marginRight','marginBottom','marginLeft',
    'padding','paddingTop','paddingRight','paddingBottom','paddingLeft',
    'border','borderTop','borderRight','borderBottom','borderLeft',
    'borderRadius','borderColor','borderStyle','borderWidth',
    'background','backgroundColor','backgroundImage',
    'color','opacity',
    'fontFamily','fontSize','fontWeight','fontStyle','lineHeight','letterSpacing','textTransform',
    'textAlign','textDecoration','textDecorationColor','whiteSpace','wordBreak',
    'flex','flexDirection','flexWrap','justifyContent','alignItems','gap','rowGap','columnGap',
    'gridTemplateColumns','gridTemplateRows',
    'listStyle','listStyleType','listStylePosition',
    'boxShadow','transform','transition','cursor','overflow',
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

  // ── 1. CSS variables del :root y <html> ─────────────────────────────────────
  const collectVars = (el) => {
    const out = {};
    const cs = getComputedStyle(el);
    for (let i = 0; i < cs.length; i++) {
      const name = cs[i];
      if (name.startsWith('--')) out[name] = cs.getPropertyValue(name).trim();
    }
    return out;
  };
  OUT.rootVars = collectVars(document.documentElement);
  OUT.htmlVars = collectVars(document.body);
  OUT.bodyComputed = computed(document.body);

  // ── 2. @font-face y fonts cargadas ──────────────────────────────────────────
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules || []) {
        if (rule.type === CSSRule.FONT_FACE_RULE) {
          OUT.fontFaces.push(rule.cssText);
        }
      }
    } catch (e) { /* CORS-protected sheet, ignore */ }
  }
  if (document.fonts) {
    document.fonts.forEach(f => {
      OUT.loadedFonts.push({
        family: f.family, weight: f.weight, style: f.style, status: f.status,
      });
    });
  }

  // ── 3. Stylesheet summary (URLs de los CSS de MSCI) ─────────────────────────
  for (const sheet of document.styleSheets) {
    OUT.stylesheetSummary.push({
      href: sheet.href,
      media: sheet.media?.mediaText || '',
      ruleCount: (() => { try { return (sheet.cssRules || []).length; } catch { return -1; } })(),
    });
  }

  // ── 4. Detectar el contenedor principal del artículo ────────────────────────
  const articleEl =
    document.querySelector('main article') ||
    document.querySelector('article') ||
    document.querySelector('[role="main"]') ||
    document.querySelector('main') ||
    document.body;

  OUT.containers = {
    articleTag: articleEl.tagName.toLowerCase(),
    articleClass: articleEl.className,
    articleComputed: computed(articleEl),
    parentComputed: computed(articleEl.parentElement),
    bodyWidth: document.body.getBoundingClientRect().width,
    articleWidth: articleEl.getBoundingClientRect().width,
  };

  // ── 5. Sample del primer elemento de cada tag dentro del artículo ───────────
  const TAGS = [
    'h1','h2','h3','h4','h5','h6',
    'p','a','span','strong','em','sup','sub','small',
    'ul','ol','li','blockquote',
    'figure','figcaption','img','picture','svg',
    'hr','table','thead','tbody','tr','th','td',
    'button','nav','header','footer','section','aside','article','div',
  ];
  for (const tag of TAGS) {
    const el = articleEl.querySelector(tag);
    if (el) {
      OUT.tagSamples[tag] = {
        className: el.className,
        computed: computed(el),
        rect: el.getBoundingClientRect().toJSON?.() || null,
      };
    }
  }

  // ── 6. Componentes curados por selectores comunes en AEM ────────────────────
  const COMPONENT_SELECTORS = {
    breadcrumb: '[class*="breadcrumb" i], nav[aria-label*="breadcrumb" i]',
    heroTitle: 'main h1, article h1, [class*="hero" i] h1',
    metaRow: '[class*="byline" i], [class*="article-meta" i], [class*="meta" i]',
    keyFindings: '[class*="key-findings" i], [class*="highlights" i], [class*="key" i][class*="finding" i]',
    bodyText: '[class*="article-body" i] p, [class*="rte" i] p, .text p',
    exhibit: '[class*="exhibit" i], [class*="figure" i], figure',
    exhibitCaption: '[class*="exhibit" i] figcaption, figure figcaption, [class*="caption" i]',
    footnote: '[class*="footnote" i] li, [class*="footnote" i] p',
    disclaimer: '[class*="disclaimer" i]',
    relatedCard: '[class*="related" i] [class*="card" i], [class*="related-content" i] article',
    authorBio: '[class*="author" i][class*="bio" i], [class*="author-card" i]',
    cta: '[class*="subscribe" i], [class*="cta" i] a, [class*="cta" i] button',
  };
  for (const [name, sel] of Object.entries(COMPONENT_SELECTORS)) {
    const el = document.querySelector(sel);
    if (el) {
      OUT.componentSamples[name] = {
        selectorMatched: sel,
        tag: el.tagName.toLowerCase(),
        className: el.className,
        computed: computed(el),
        outerHtmlPreview: el.outerHTML.slice(0, 600),
      };
    }
  }

  // ── 7. Catálogo de clases únicas dentro del artículo ────────────────────────
  const seenClasses = new Set();
  articleEl.querySelectorAll('*').forEach(el => {
    if (typeof el.className !== 'string') return;
    el.className.split(/\s+/).filter(Boolean).forEach(cls => {
      if (seenClasses.has(cls)) return;
      seenClasses.add(cls);
      OUT.classCatalog[cls] = {
        tag: el.tagName.toLowerCase(),
        computed: computed(el),
      };
    });
  });

  // ── 8. Skeleton del DOM (tag + classes, sin texto) ──────────────────────────
  const skeleton = (el, depth = 0, maxDepth = 12) => {
    if (depth > maxDepth) return { tag: el.tagName.toLowerCase(), truncated: true };
    const node = {
      tag: el.tagName.toLowerCase(),
      class: el.className && typeof el.className === 'string' ? el.className : undefined,
      id: el.id || undefined,
      children: [],
    };
    for (const child of el.children) node.children.push(skeleton(child, depth + 1, maxDepth));
    if (node.children.length === 0) delete node.children;
    return node;
  };
  OUT.skeleton = skeleton(articleEl);

  // ── 9. Sanitized HTML del artículo (texto reemplazado por placeholders) ─────
  const clone = articleEl.cloneNode(true);
  const walk = (n) => {
    if (n.nodeType === Node.TEXT_NODE) {
      const t = n.nodeValue.trim();
      if (t.length > 0) n.nodeValue = `[TEXT:${t.length}ch]`;
    } else if (n.nodeType === Node.ELEMENT_NODE) {
      // Strip src/href from any media to keep file small but keep structure
      if (n.tagName === 'IMG') n.setAttribute('src', '[IMG]');
      if (n.tagName === 'A') n.setAttribute('href', '[HREF]');
      [...n.childNodes].forEach(walk);
    }
  };
  walk(clone);
  OUT.rawArticleHtml = clone.outerHTML;

  // ── Descargar JSON ──────────────────────────────────────────────────────────
  const blob = new Blob([JSON.stringify(OUT, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `msci-styles-${location.pathname.split('/').filter(Boolean).pop() || 'page'}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  console.log('[MSCI extractor] done — JSON descargado.', OUT);
  return OUT;
})();
