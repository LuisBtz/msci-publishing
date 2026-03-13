import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(req) {
  try {
    const body = await req.json()

    const {
      type, headline, slug, final_url, meta_description,
      read_time, authors, bullets, body_blocks, footnotes,
      related_resources, tags, sharepoint_folder_url,
      banner_paths, exhibit_paths
    } = body

    if (!headline || !slug) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const export_json = {
      meta: {
        exported_at: new Date().toISOString(),
        platform_version: '1.0'
      },
      type, headline, slug, final_url, meta_description,
      read_time, authors, bullets,
      body_blocks: body_blocks || [],
      footnotes,
      tags: tags?.all_tags || [],
      related_resources,
      assets: {
        banners: banner_paths || {},
        exhibits: exhibit_paths || {}
      },
      sharepoint_folder: sharepoint_folder_url || null
    }

    const { data, error } = await supabase
      .from('articles')
      .insert({
        type: type || 'blog-post',
        status: 'in-progress',
        headline,
        slug,
        final_url,
        meta_description,
        read_time,
        bullets: bullets || [],
        body_blocks: body_blocks || [],
        footnotes: footnotes || [],
        authors: authors || [],
        tags: tags || {},
        related_resources: related_resources || [],
        sharepoint_folder_url: sharepoint_folder_url || null,
        banner_paths: banner_paths || {},
        exhibit_paths: exhibit_paths || {},
        export_json
      })
      .select('id')
      .single()

    if (error) throw error

    return NextResponse.json({ id: data.id })

  } catch (err) {
    console.error('Create article error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}