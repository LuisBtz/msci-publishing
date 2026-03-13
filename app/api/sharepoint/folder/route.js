import { NextResponse } from 'next/server'
import { graphRequest, downloadFile, listFolder, DRIVE_ID } from '@/lib/graph'

function extractFolderPath(sharepointUrl) {
  try {
    const url = new URL(sharepointUrl)
    const idParam = url.searchParams.get('id')
    if (!idParam) return null
    const fullPath = decodeURIComponent(idParam)
    const marker = 'Shared Documents'
    const markerIndex = fullPath.indexOf(marker)
    if (markerIndex !== -1) {
      return fullPath.substring(markerIndex + marker.length)
    }
    return fullPath
  } catch { return null }
}

// Agrupa archivos estáticos en pares Desktop/Mobile
function groupStaticExhibits(files) {
  const desktopFiles = files.filter(f =>
    (f.name.endsWith('.svg') || f.name.endsWith('.webp')) &&
    f.name.includes('_Desktop')
  )

  return desktopFiles.map(desktop => {
    // Extraer el identificador base: 1600px-GICS_Desktop.svg → GICS
    const baseName = desktop.name
      .replace(/^\d+px-/, '')     // quitar prefijo de pixels
      .replace('_Desktop.svg', '')
      .replace('_Desktop.webp', '')

    // Buscar el par mobile
    const mobile = files.find(f =>
      f.name.includes('_Mobile') &&
      f.name.includes(baseName)
    )

    return {
      type: 'static',
      base_name: baseName,
      desktop: {
        filename: desktop.name,
        itemId: desktop.id,
        downloadUrl: desktop['@microsoft.graph.downloadUrl'] || null
      },
      mobile: mobile ? {
        filename: mobile.name,
        itemId: mobile.id,
        downloadUrl: mobile['@microsoft.graph.downloadUrl'] || null
      } : null
    }
  }).sort((a, b) => a.base_name.localeCompare(b.base_name))
}

// Agrupa archivos interactivos en pares JSON/HTML
// Toma solo la versión más reciente de cada nombre base
function groupInteractiveExhibits(files) {
  const jsonFiles = files.filter(f =>
    f.name.endsWith('.json') &&
    !f.name.includes('_Desktop') &&
    !f.name.includes('_Mobile')
  )

  // Agrupar por nombre base (sin el número de versión al final)
  // IPO_security_weights.json y IPO_security_weights 2.json → mismo grupo
  const groups = {}
  jsonFiles.forEach(f => {
    // Extraer nombre base quitando el número de versión " 2", " 3", etc.
    const baseName = f.name
      .replace(/\.json$/, '')
      .replace(/\s+\d+$/, '')  // quitar " 2", " 3", etc al final
      .trim()

    if (!groups[baseName]) groups[baseName] = []
    groups[baseName].push(f)
  })

  // Para cada grupo, tomar el más reciente por fecha
  return Object.entries(groups).map(([baseName, versions]) => {
    const latest = versions.sort((a, b) =>
      new Date(b.lastModifiedDateTime) - new Date(a.lastModifiedDateTime)
    )[0]

    // Buscar el par HTML del mismo archivo
    const htmlName = latest.name.replace('.json', '.html')
    const htmlFile = files.find(f => f.name === htmlName)

    return {
      type: 'interactive',
      base_name: baseName,
      json: {
        filename: latest.name,
        itemId: latest.id,
        downloadUrl: latest['@microsoft.graph.downloadUrl'] || null
      },
      html: htmlFile ? {
        filename: htmlFile.name,
        itemId: htmlFile.id,
        downloadUrl: htmlFile['@microsoft.graph.downloadUrl'] || null
      } : null
    }
  }).sort((a, b) => a.base_name.localeCompare(b.base_name))
}

export async function POST(req) {
  try {
    const { folderUrl } = await req.json()
    if (!folderUrl) return NextResponse.json({ error: 'No folder URL provided' }, { status: 400 })

    const folderPath = extractFolderPath(folderUrl)
    if (!folderPath) return NextResponse.json({ error: 'URL de SharePoint inválida' }, { status: 400 })

    // Obtener el item de la carpeta
    const encodedPath = encodeURIComponent(folderPath)
    const folderItem = await graphRequest(`/drives/${DRIVE_ID}/root:${encodedPath}`)
    const folderId = folderItem.id

    // Listar contenido de la carpeta raíz
    const rootFiles = await listFolder(folderId)

    // Encontrar el .docx con "package" más reciente
    const docxFiles = rootFiles.filter(f =>
      f.name.toLowerCase().endsWith('.docx') &&
      f.name.toLowerCase().includes('package')
    )
    const docxFile = docxFiles.sort((a, b) =>
      new Date(b.lastModifiedDateTime) - new Date(a.lastModifiedDateTime)
    )[0]

    if (!docxFile) {
      return NextResponse.json({
        error: 'No se encontró el documento de intake (.docx con "package" en el nombre)'
      }, { status: 404 })
    }

    // Descargar el .docx
    const docxBuffer = await downloadFile(docxFile.id)
    const docxBase64 = docxBuffer.toString('base64')

    // ── BANNERS ──────────────────────────────────────────────────────────────
    let banners = {}
    try {
      const bannersFolder = rootFiles.find(f =>
        f.name.toLowerCase() === 'banners' && f.folder
      )
      if (bannersFolder) {
        const bannerSubItems = await listFolder(bannersFolder.id)
        const webpFolder = bannerSubItems.find(f =>
          f.name.toLowerCase() === 'webp' && f.folder
        )
        const bannerFiles = webpFolder
          ? await listFolder(webpFolder.id)
          : bannerSubItems.filter(f => f.name.endsWith('.webp'))

        bannerFiles.forEach(f => {
          if (f.name.endsWith('.webp')) {
            const ratio = f.name.match(/^(\d+x\d+)_/)?.[1] || f.name.replace('.webp', '')
            banners[ratio] = {
              filename: f.name,
              itemId: f.id,
              downloadUrl: f['@microsoft.graph.downloadUrl'] || null
            }
          }
        })
      }
    } catch (e) {
      console.log('No banners found:', e.message)
    }

    // ── EXHIBITS ESTÁTICOS (desde /Charts/ o /Exhibits/) ─────────────────────
    let staticExhibits = []
    for (const folderName of ['Charts', 'Exhibits']) {
      try {
        const exhibitFolder = rootFiles.find(f =>
          f.name.toLowerCase() === folderName.toLowerCase() && f.folder
        )
        if (exhibitFolder) {
          const files = await listFolder(exhibitFolder.id)
          staticExhibits = groupStaticExhibits(files)
          console.log(`Found ${staticExhibits.length} static exhibits in /${folderName}/`)
          break
        }
      } catch (e) {
        console.log(`No ${folderName} folder:`, e.message)
      }
    }

    // ── EXHIBITS INTERACTIVOS (desde la raíz del proyecto) ───────────────────
    const interactiveExhibits = groupInteractiveExhibits(rootFiles)
    console.log(`Found ${interactiveExhibits.length} interactive exhibits in root`)

    // ── COMBINAR todos los exhibits con su tipo ───────────────────────────────
    // Los interactivos y los estáticos se mantienen separados
    // El matching con el orden del Word lo hace Claude en el siguiente paso
    const allExhibits = {
      statics: staticExhibits,
      interactives: interactiveExhibits,
      // Lista plana para facilitar el matching de Claude
      summary: [
        ...staticExhibits.map((e, i) => ({
          index: i,
          type: 'static',
          base_name: e.base_name,
          desktop_filename: e.desktop.filename,
          mobile_filename: e.mobile?.filename || null
        })),
        ...interactiveExhibits.map((e, i) => ({
          index: staticExhibits.length + i,
          type: 'interactive',
          base_name: e.base_name,
          json_filename: e.json.filename,
          html_filename: e.html?.filename || null
        }))
      ]
    }

    return NextResponse.json({
      docx: {
        filename: docxFile.name,
        base64: docxBase64
      },
      banners,
      exhibits: allExhibits,
      exhibitsFound: staticExhibits.length > 0 || interactiveExhibits.length > 0,
      bannersFound: Object.keys(banners).length > 0,
      summary: {
        statics: staticExhibits.length,
        interactives: interactiveExhibits.length,
        total: staticExhibits.length + interactiveExhibits.length
      }
    })

  } catch (err) {
    console.error('SharePoint error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}