import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { readSharepointFolder } from '@/app/api/sharepoint/folder/route'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Re-escanea la carpeta de SharePoint y reconstruye exhibit_paths. Los
// title/caption de cada exhibit block vienen del Word y ya están en la
// posición correcta — NO se tocan. Lo único que cambia es a qué archivo de
// SharePoint apunta cada slot:
//
//   N-ésimo exhibit block del body  →  items[N]  (archivo con filename-(N+1))
//
// Esto hace un match exacto por posición: si el autor renombra los archivos
// en SharePoint para corregir el orden, el rescan enlaza cada slot del Word
// con el chart correcto sin reordenar texto.
export async function POST(req: Request) {
  try {
    const { articleId } = await req.json()
    if (!articleId) return NextResponse.json({ error: 'No articleId provided' }, { status: 400 })

    const { data: article, error } = await supabase
      .from('articles')
      .select('id, sharepoint_folder_url, body_blocks, export_json')
      .eq('id', articleId)
      .single()

    if (error || !article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }
    if (!article.sharepoint_folder_url) {
      return NextResponse.json({
        error: 'This article has no SharePoint folder URL — cannot rescan.'
      }, { status: 400 })
    }

    // Releer la carpeta completa (exhibits + banners)
    const { banners, exhibitPaths } = await readSharepointFolder(article.sharepoint_folder_url)
    const items = exhibitPaths.items || []

    // Reasignar sharepoint_index secuencialmente y enlazar con items[]
    // preservando title, caption y demás metadata del block original.
    let exhibitPos = 0
    const updatedBodyBlocks = (article.body_blocks || []).map(block => {
      if (block.type !== 'exhibit') return block
      const idx = exhibitPos++
      const item = items[idx] || null
      return {
        ...block,
        sharepoint_index: idx,
        sharepoint_data: item,
        exhibit_type: item?.type ?? block.exhibit_type ?? null,
        match_confidence: 'high'
      }
    })

    // Actualizar export_json si existe, manteniendo su shape
    let updatedExportJson = article.export_json || null
    if (updatedExportJson) {
      updatedExportJson = {
        ...updatedExportJson,
        body_blocks: updatedBodyBlocks,
        assets: {
          ...(updatedExportJson.assets || {}),
          banners,
          exhibits: exhibitPaths
        }
      }
    }

    const updatePayload: Record<string, unknown> = {
      exhibit_paths: exhibitPaths,
      banner_paths: banners,
      body_blocks: updatedBodyBlocks
    }
    if (updatedExportJson) updatePayload.export_json = updatedExportJson

    await supabase.from('articles').update(updatePayload).eq('id', articleId)

    return NextResponse.json({
      success: true,
      exhibit_paths: exhibitPaths,
      banner_paths: banners,
      body_blocks: updatedBodyBlocks,
      summary: {
        statics: exhibitPaths.statics.length,
        interactives: exhibitPaths.interactives.length,
        total: items.length
      }
    })

  } catch (err) {
    console.error('Rescan exhibits error:', err)
    const status = (err as any).status || 500
    return NextResponse.json({ error: (err as Error).message }, { status })
  }
}
