import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { graphRequest, DRIVE_ID } from '@/lib/graph'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Regenera el downloadUrl de un item usando su itemId
async function refreshItemUrl(itemId) {
  try {
    const data = await graphRequest(`/drives/${DRIVE_ID}/items/${itemId}`)
    return data['@microsoft.graph.downloadUrl'] || null
  } catch {
    return null
  }
}

// Recorre la estructura de exhibits y regenera todos los downloadUrls
async function refreshExhibitUrls(exhibits) {
  if (!exhibits) return exhibits

  const { statics = [], interactives = [], summary = [] } = exhibits

  const refreshedStatics = await Promise.all(
    statics.map(async (e) => ({
      ...e,
      desktop: e.desktop ? {
        ...e.desktop,
        downloadUrl: await refreshItemUrl(e.desktop.itemId)
      } : null,
      mobile: e.mobile ? {
        ...e.mobile,
        downloadUrl: await refreshItemUrl(e.mobile.itemId)
      } : null
    }))
  )

  const refreshedInteractives = await Promise.all(
    interactives.map(async (e) => ({
      ...e,
      json: e.json ? {
        ...e.json,
        downloadUrl: await refreshItemUrl(e.json.itemId)
      } : null,
      html: e.html ? {
        ...e.html,
        downloadUrl: await refreshItemUrl(e.html.itemId)
      } : null
    }))
  )

  return {
    statics: refreshedStatics,
    interactives: refreshedInteractives,
    summary
  }
}

export async function POST(req) {
  try {
    const { articleId } = await req.json()
    if (!articleId) return NextResponse.json({ error: 'No articleId provided' }, { status: 400 })

    // Obtener el artículo
    const { data: article, error } = await supabase
      .from('articles')
      .select('id, exhibit_paths, banner_paths')
      .eq('id', articleId)
      .single()

    if (error || !article) return NextResponse.json({ error: 'Article not found' }, { status: 404 })

    // Regenerar URLs de exhibits
    const refreshedExhibits = await refreshExhibitUrls(article.exhibit_paths)

    // Regenerar URLs de banners
    const refreshedBanners = {}
    if (article.banner_paths) {
      for (const [ratio, banner] of Object.entries(article.banner_paths)) {
        refreshedBanners[ratio] = {
          ...banner,
          downloadUrl: banner.itemId ? await refreshItemUrl(banner.itemId) : banner.downloadUrl
        }
      }
    }

    // También actualizar los downloadUrls dentro de body_blocks
    const { data: fullArticle } = await supabase
      .from('articles')
      .select('body_blocks')
      .eq('id', articleId)
      .single()

    let refreshedBodyBlocks = fullArticle?.body_blocks || []
    if (refreshedBodyBlocks.length > 0) {
      refreshedBodyBlocks = await Promise.all(
        refreshedBodyBlocks.map(async (block) => {
          if (block.type !== 'exhibit' || !block.sharepoint_data) return block

          const sd = block.sharepoint_data
          if (sd.exhibit_type === 'static' || sd.type === 'static') {
            return {
              ...block,
              sharepoint_data: {
                ...sd,
                desktop: sd.desktop ? { ...sd.desktop, downloadUrl: await refreshItemUrl(sd.desktop.itemId) } : null,
                mobile: sd.mobile ? { ...sd.mobile, downloadUrl: await refreshItemUrl(sd.mobile.itemId) } : null
              }
            }
          }
          if (sd.exhibit_type === 'interactive' || sd.type === 'interactive') {
            return {
              ...block,
              sharepoint_data: {
                ...sd,
                json: sd.json ? { ...sd.json, downloadUrl: await refreshItemUrl(sd.json.itemId) } : null,
                html: sd.html ? { ...sd.html, downloadUrl: await refreshItemUrl(sd.html.itemId) } : null
              }
            }
          }
          return block
        })
      )
    }

    // Guardar todo en Supabase
    await supabase.from('articles').update({
      exhibit_paths: refreshedExhibits,
      banner_paths: refreshedBanners,
      body_blocks: refreshedBodyBlocks
    }).eq('id', articleId)

    return NextResponse.json({
      success: true,
      exhibit_paths: refreshedExhibits,
      banner_paths: refreshedBanners,
      body_blocks: refreshedBodyBlocks
    })

  } catch (err) {
    console.error('Refresh assets error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}