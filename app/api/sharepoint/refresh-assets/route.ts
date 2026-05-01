import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { graphRequest, DRIVE_ID } from '@/lib/graph'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function refreshItemUrl(itemId: string | null): Promise<string | null> {
  if (!itemId) return null
  try {
    const data = await graphRequest(`/drives/${DRIVE_ID}/items/${itemId}`)
    return data['@microsoft.graph.downloadUrl'] || null
  } catch {
    return null
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function refreshItemParts(item: any) {
  if (!item) return item
  const out = { ...item }
  if (item.desktop) out.desktop = { ...item.desktop, downloadUrl: await refreshItemUrl(item.desktop.itemId) }
  if (item.mobile)  out.mobile  = { ...item.mobile,  downloadUrl: await refreshItemUrl(item.mobile.itemId) }
  if (item.json)    out.json    = { ...item.json,    downloadUrl: await refreshItemUrl(item.json.itemId) }
  if (item.html)    out.html    = { ...item.html,    downloadUrl: await refreshItemUrl(item.html.itemId) }
  return out
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function refreshExhibitPaths(exhibits: any) {
  if (!exhibits) return exhibits

  const items = exhibits.items || []
  const refreshedItems = await Promise.all(items.map(refreshItemParts))

  const refreshedStatics = await Promise.all(
    (exhibits.statics || []).map(refreshItemParts)
  )
  const refreshedInteractives = await Promise.all(
    (exhibits.interactives || []).map(refreshItemParts)
  )

  return {
    items: refreshedItems,
    statics: refreshedStatics,
    interactives: refreshedInteractives,
    summary: exhibits.summary || []
  }
}

export async function POST(req: Request) {
  try {
    const { articleId } = await req.json()
    if (!articleId) return NextResponse.json({ error: 'No articleId provided' }, { status: 400 })

    const { data: article, error } = await supabase
      .from('articles')
      .select('id, exhibit_paths, banner_paths, body_blocks')
      .eq('id', articleId)
      .single()

    if (error || !article) return NextResponse.json({ error: 'Article not found' }, { status: 404 })

    const refreshedExhibits = await refreshExhibitPaths(article.exhibit_paths)

    const refreshedBanners: Record<string, unknown> = {}
    if (article.banner_paths) {
      for (const [ratio, banner] of Object.entries(article.banner_paths as Record<string, any>)) {
        refreshedBanners[ratio] = {
          ...banner,
          downloadUrl: banner.itemId ? await refreshItemUrl(banner.itemId) : banner.downloadUrl
        }
      }
    }

    // Refrescar downloadUrls dentro de body_blocks.sharepoint_data
    let refreshedBodyBlocks = article.body_blocks || []
    if (refreshedBodyBlocks.length > 0) {
      refreshedBodyBlocks = await Promise.all(
        refreshedBodyBlocks.map(async (block) => {
          if (block.type !== 'exhibit' || !block.sharepoint_data) return block
          return { ...block, sharepoint_data: await refreshItemParts(block.sharepoint_data) }
        })
      )
    }

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
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
