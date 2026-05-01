import type {
  GraphFile,
  ParsedExhibitFilename,
  ExhibitFileInfo,
  ExhibitItem,
  StaticExhibitItem,
  InteractiveExhibitItem,
  ExhibitPaths,
  ExhibitSummary,
} from '@/types'

export function parseExhibitFilename(filename: string): ParsedExhibitFilename | null {
  const m = filename.match(/^(.*?)-(\d+)\.(svg|webp|json|html)$/i)
  if (!m) return null
  const [, rawName, orderStr, extRaw] = m
  const order = parseInt(orderStr, 10)
  const ext = extRaw.toLowerCase()

  let kind: ParsedExhibitFilename['kind'] | null = null
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildExhibitItems(files: GraphFile[]): ExhibitItem[] {
  const byOrder = new Map<number, any>()

  for (const f of files) {
    const meta = parseExhibitFilename(f.name)
    if (!meta) continue
    const { order, kind, baseName } = meta

    if (!byOrder.has(order)) {
      byOrder.set(order, { order, type: null, base_name: baseName })
    }
    const entry = byOrder.get(order)

    const fileInfo: ExhibitFileInfo = {
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

export function buildExhibitPaths(files: GraphFile[]): ExhibitPaths {
  const items = buildExhibitItems(files)

  const statics = items
    .filter((i): i is StaticExhibitItem => i.type === 'static')
    .map(i => ({
      type: 'static' as const,
      base_name: i.base_name,
      order: i.order,
      desktop: i.desktop || null,
      mobile: i.mobile || null
    }))

  const interactives = items
    .filter((i): i is InteractiveExhibitItem => i.type === 'interactive')
    .map(i => ({
      type: 'interactive' as const,
      base_name: i.base_name,
      order: i.order,
      json: i.json || null,
      html: i.html || null
    }))

  const summary: ExhibitSummary[] = items.map((i, idx) => {
    if (i.type === 'static') {
      return {
        index: idx,
        order: i.order,
        type: 'static' as const,
        base_name: i.base_name,
        desktop_filename: (i as StaticExhibitItem).desktop?.filename || null,
        mobile_filename: (i as StaticExhibitItem).mobile?.filename || null
      }
    }
    return {
      index: idx,
      order: i.order,
      type: 'interactive' as const,
      base_name: i.base_name,
      json_filename: (i as InteractiveExhibitItem).json?.filename || null,
      html_filename: (i as InteractiveExhibitItem).html?.filename || null
    }
  })

  return { items, statics, interactives, summary }
}
