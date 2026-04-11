// ── Shared exhibit parser ────────────────────────────────────────────────────
// All exhibits (static + interactive) live in the same Charts/Exhibits folder
// and carry a numeric order suffix at the end of their filename:
//
//   1600px-IPO-analysis2_Desktop-1.svg   → order 1, static desktop
//   900px-IPO-analysis2_Mobile-1.svg     → order 1, static mobile
//   1600px-IPO-count-rack_Desktop-2.svg  → order 2, static desktop
//   IPO_security_weights-4.json          → order 4, interactive
//
// The order number is authoritative and matches the order of appearance in
// the blog post (1 = first exhibit in the document, 2 = second, …).

// Parse a single filename into {order, kind, baseName, ext} or null if it
// does not look like an exhibit file.
export function parseExhibitFilename(filename) {
  const m = filename.match(/^(.*?)-(\d+)\.(svg|webp|json|html)$/i)
  if (!m) return null
  const [, rawName, orderStr, extRaw] = m
  const order = parseInt(orderStr, 10)
  const ext = extRaw.toLowerCase()

  let kind = null
  let baseName = rawName

  if (ext === 'svg' || ext === 'webp') {
    // Strip pixel prefix ("1600px-", "900px-", …)
    const stripped = rawName.replace(/^\d+px-/, '')
    if (/_Desktop$/i.test(stripped)) {
      kind = 'desktop'
      baseName = stripped.replace(/_Desktop$/i, '')
    } else if (/_Mobile$/i.test(stripped)) {
      kind = 'mobile'
      baseName = stripped.replace(/_Mobile$/i, '')
    } else {
      // Static image without an explicit Desktop/Mobile marker → treat as desktop
      kind = 'desktop'
      baseName = stripped
    }
  } else if (ext === 'json') {
    kind = 'json'
  } else if (ext === 'html') {
    kind = 'html'
  }

  return { order, kind, baseName, ext }
}

// Build the authoritative items[] array from a raw list of files in the
// Charts/Exhibits folder. Items are sorted by their order number.
export function buildExhibitItems(files) {
  const byOrder = new Map()

  for (const f of files) {
    const meta = parseExhibitFilename(f.name)
    if (!meta) continue
    const { order, kind, baseName } = meta

    if (!byOrder.has(order)) {
      byOrder.set(order, { order, type: null, base_name: baseName })
    }
    const entry = byOrder.get(order)

    const fileInfo = {
      filename: f.name,
      itemId: f.id,
      downloadUrl: f['@microsoft.graph.downloadUrl'] || null
    }

    if (kind === 'desktop' || kind === 'mobile') {
      entry.type = 'static'
      entry[kind] = fileInfo
      if (!entry.base_name || entry.base_name === '') entry.base_name = baseName
    } else if (kind === 'json') {
      entry.type = 'interactive'
      entry.json = fileInfo
      if (!entry.base_name || entry.base_name === '') entry.base_name = baseName
    } else if (kind === 'html') {
      // An html file supplements an interactive json. If no type yet, assume interactive.
      if (!entry.type) entry.type = 'interactive'
      entry.html = fileInfo
      if (!entry.base_name || entry.base_name === '') entry.base_name = baseName
    }
  }

  return Array.from(byOrder.values())
    .filter(e => e.type !== null)
    .sort((a, b) => a.order - b.order)
}

// Build the full exhibit_paths object: items[] is authoritative,
// statics/interactives/summary are derived for backward compatibility with
// the chrome extension (asset uploads) and existing UI dropdowns.
export function buildExhibitPaths(files) {
  const items = buildExhibitItems(files)

  const statics = items
    .filter(i => i.type === 'static')
    .map(i => ({
      type: 'static',
      base_name: i.base_name,
      order: i.order,
      desktop: i.desktop || null,
      mobile: i.mobile || null
    }))

  const interactives = items
    .filter(i => i.type === 'interactive')
    .map(i => ({
      type: 'interactive',
      base_name: i.base_name,
      order: i.order,
      json: i.json || null,
      html: i.html || null
    }))

  // summary parallel to items[] — used by the UI dropdown and by the
  // enrichment step in /api/parse/docx.
  const summary = items.map((i, idx) => {
    if (i.type === 'static') {
      return {
        index: idx,
        order: i.order,
        type: 'static',
        base_name: i.base_name,
        desktop_filename: i.desktop?.filename || null,
        mobile_filename: i.mobile?.filename || null
      }
    }
    return {
      index: idx,
      order: i.order,
      type: 'interactive',
      base_name: i.base_name,
      json_filename: i.json?.filename || null,
      html_filename: i.html?.filename || null
    }
  })

  return { items, statics, interactives, summary }
}
