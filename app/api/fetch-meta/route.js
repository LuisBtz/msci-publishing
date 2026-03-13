import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    const { urls } = await req.json()
    if (!urls?.length) return NextResponse.json({ results: [] })

    const results = await Promise.all(
      urls.map(async (url) => {
        try {
          const fullUrl = url.startsWith('http') ? url : `https://www.msci.com${url}`
          const res = await fetch(fullUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
          })
          const html = await res.text()

          // Extraer meta description
          const metaMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)
            || html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i)
          const metaDescription = metaMatch?.[1] || ''

          // Extraer título
          const titleMatch = html.match(/<title>([^<]+)<\/title>/i)
          const title = titleMatch?.[1]?.replace(' | MSCI', '').replace(' | MSCI Indexes', '').trim() || ''

          return { url, title, metaDescription, success: true }
        } catch (e) {
          return { url, title: '', metaDescription: '', success: false }
        }
      })
    )

    return NextResponse.json({ results })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}