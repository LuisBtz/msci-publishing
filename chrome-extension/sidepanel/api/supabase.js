/**
 * Supabase REST helpers
 *
 * The side panel reads directly from Supabase REST (no SDK) so the
 * extension bundle stays small. loadArticles pulls the full list of
 * non-published articles with every field the step screens need, and
 * writes the result into shared state.
 */
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js'
import { setArticles } from '../state.js'
import { renderArticles } from '../ui/articleList.js'

async function supabaseFetch(endpoint) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) throw new Error(`Supabase error: ${res.status}`)
  return res.json()
}

const ARTICLE_SELECT =
  'id,headline,slug,status,type,publish_date,authors,tags,meta_description,read_time,' +
  'exhibit_paths,banner_paths,body_blocks,footnotes,bullets,related_resources,final_url,' +
  'sharepoint_folder_url,updated_at,publish_report'

export async function loadArticles() {
  const list = document.getElementById('articles-list')
  list.innerHTML = '<div class="loading-spinner">Loading articles...</div>'
  try {
    const data = await supabaseFetch(
      `articles?status=neq.published&order=created_at.desc&select=${ARTICLE_SELECT}`
    )
    setArticles(data)
    renderArticles()
  } catch (err) {
    list.innerHTML = `<div class="empty-state">Error loading articles: ${err.message}</div>`
  }
}
