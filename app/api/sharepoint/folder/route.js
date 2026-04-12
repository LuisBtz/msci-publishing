import { NextResponse } from 'next/server'
import { graphRequest, downloadFile, listFolder, DRIVE_ID } from '@/lib/graph'
import { buildExhibitPaths } from '@/lib/exhibits/exhibit-parser'

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

// Locate the Charts/Exhibits folder (case-insensitive) inside a listing.
function findExhibitsFolder(rootFiles) {
  for (const folderName of ['Charts', 'Exhibits']) {
    const match = rootFiles.find(
      f => f.folder && f.name.toLowerCase() === folderName.toLowerCase()
    )
    if (match) return match
  }
  return null
}

// Reads the SharePoint folder and returns the full exhibit_paths payload.
// Exported so /api/sharepoint/rescan-exhibits can reuse exactly the same logic.
export async function readSharepointFolder(folderUrl) {
  const folderPath = extractFolderPath(folderUrl)
  if (!folderPath) {
    const err = new Error('URL de SharePoint inválida')
    err.status = 400
    throw err
  }

  const encodedPath = encodeURIComponent(folderPath)
  const folderItem = await graphRequest(`/drives/${DRIVE_ID}/root:${encodedPath}`)
  const rootFiles = await listFolder(folderItem.id)

  // ── Docx de intake (más reciente con "package" en el nombre) ────────────
  const docxFiles = rootFiles.filter(f =>
    f.name.toLowerCase().endsWith('.docx') &&
    f.name.toLowerCase().includes('package')
  )
  const docxFile = docxFiles.sort((a, b) =>
    new Date(b.lastModifiedDateTime) - new Date(a.lastModifiedDateTime)
  )[0] || null

  // ── Banners (webp) ───────────────────────────────────────────────────────
  const banners = {}
  try {
    const bannersFolder = rootFiles.find(f =>
      f.folder && f.name.toLowerCase() === 'banners'
    )
    if (bannersFolder) {
      const bannerSubItems = await listFolder(bannersFolder.id)
      const webpFolder = bannerSubItems.find(f =>
        f.folder && f.name.toLowerCase() === 'webp'
      )
      const bannerFiles = webpFolder
        ? await listFolder(webpFolder.id)
        : bannerSubItems.filter(f => f.name.endsWith('.webp'))

      for (const f of bannerFiles) {
        if (f.name.endsWith('.webp')) {
          banners[f.name] = {
            filename: f.name,
            itemId: f.id,
            downloadUrl: f['@microsoft.graph.downloadUrl'] || null
          }
        }
      }
    }
  } catch (e) {
    console.log('No banners found:', e.message)
  }

  // ── Exhibits (static + interactive) desde Charts/ o Exhibits/ ────────────
  let exhibitPaths = { items: [], statics: [], interactives: [], summary: [] }
  const exhibitsFolder = findExhibitsFolder(rootFiles)
  if (exhibitsFolder) {
    try {
      const files = await listFolder(exhibitsFolder.id)
      exhibitPaths = buildExhibitPaths(files)
    } catch (e) {
      console.log('Error reading exhibits folder:', e.message)
    }
  }

  return { rootFiles, folderItem, docxFile, banners, exhibitPaths }
}

export async function POST(req) {
  try {
    const { folderUrl } = await req.json()
    if (!folderUrl) return NextResponse.json({ error: 'No folder URL provided' }, { status: 400 })

    const { docxFile, banners, exhibitPaths } = await readSharepointFolder(folderUrl)

    if (!docxFile) {
      return NextResponse.json({
        error: 'No se encontró el documento de intake (.docx con "package" en el nombre)'
      }, { status: 404 })
    }

    const docxBuffer = await downloadFile(docxFile.id)
    const docxBase64 = docxBuffer.toString('base64')

    const staticsCount = exhibitPaths.statics.length
    const interactivesCount = exhibitPaths.interactives.length

    return NextResponse.json({
      docx: {
        filename: docxFile.name,
        base64: docxBase64
      },
      banners,
      exhibits: exhibitPaths,
      exhibitsFound: exhibitPaths.items.length > 0,
      bannersFound: Object.keys(banners).length > 0,
      summary: {
        statics: staticsCount,
        interactives: interactivesCount,
        total: exhibitPaths.items.length
      }
    })

  } catch (err) {
    console.error('SharePoint error:', err)
    const status = err.status || 500
    return NextResponse.json({ error: err.message }, { status })
  }
}
