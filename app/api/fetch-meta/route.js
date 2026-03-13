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
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; MSCIBot/1.0)',
              'Accept': 'text/html'
            },
            signal: AbortSignal.timeout(8000)
          })

          if (!res.ok) {
            return { url, title: '', metaDescription: '', success: false, reason: `HTTP ${res.status}` }
          }

          const html = await res.text()

          // Extract meta description — only real values, never generate
          const metaMatch =
            html.match(/<meta\s+name=["']description["']\s+content=["']([^"']{10,}?)["']/i) ||
            html.match(/<meta\s+content=["']([^"']{10,}?)["']\s+name=["']description["']/i) ||
            html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']{10,}?)["']/i)

          const metaDescription = metaMatch?.[1]?.trim() || ''

          // Extract title
          const titleMatch = html.match(/<title>([^<]+)<\/title>/i)
          const title = titleMatch?.[1]
            ?.replace(/\s*\|\s*MSCI.*$/i, '')
            ?.trim() || ''

          return {
            url,
            title,
            metaDescription,  // empty string if not found — never invented
            success: true,
            found: !!metaDescription
          }
        } catch (e) {
          return { url, title: '', metaDescription: '', success: false, reason: e.message }
        }
      })
    )

    return NextResponse.json({ results })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}