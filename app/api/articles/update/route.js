import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

/**
 * OPTIONS /api/articles/update — CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

/**
 * PATCH /api/articles/update
 *
 * Updates an article's slug and/or publish_report in Supabase.
 * Used by the Chrome extension sidebar to persist the publishing
 * report and custom slug changes.
 *
 * Body: { id: string, slug?: string, publish_report?: object }
 */
export async function PATCH(req) {
  try {
    const body = await req.json()
    const { id, slug, publish_report } = body

    if (!id) {
      return NextResponse.json({ error: 'Missing article id' }, { status: 400, headers: corsHeaders })
    }

    const updates = {}
    if (slug !== undefined) updates.slug = slug
    if (publish_report !== undefined) updates.publish_report = publish_report

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400, headers: corsHeaders })
    }

    const { data, error } = await supabase
      .from('articles')
      .update(updates)
      .eq('id', id)
      .select('id,slug,publish_report')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders })
    }

    return NextResponse.json({ success: true, article: data }, { headers: corsHeaders })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders })
  }
}
