import { NextResponse } from 'next/server'

const AEM_HOST = 'https://author-p125318-e1369672.adobeaemcloud.com'
const AEM_MODEL = '/conf/global/settings/dam/cfm/models/blog-post-test'
const AEM_BASE_PATH = '/api/assets/test-fragments'

export async function POST(req) {
  try {
    const { article, csrfToken } = await req.json()
    if (!article) return NextResponse.json({ error: 'No article data' }, { status: 400 })
    if (!csrfToken) return NextResponse.json({ error: 'No CSRF token' }, { status: 400 })

    // Mapear el JSON del artículo al payload de AEM Content Fragment
    const payload = {
      properties: {
        'cq:model': AEM_MODEL,
        'title': article.headline,
        'elements': {
          'headline': {
            'value': article.headline || ''
          },
          'slug': {
            'value': article.slug || ''
          },
          'publishDate': {
            'value': article.publish_date || ''
          },
          'body': {
            'value': article.body_blocks
              ?.filter(b => b.type === 'text')
              ?.map(b => b.html)
              ?.join('\n') || '',
            ':type': 'text/html'
          }
        }
      }
    }

    // POST a AEM
    const aemRes = await fetch(
      `${AEM_HOST}${AEM_BASE_PATH}/${article.slug}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CSRF-Token': csrfToken
        },
        body: JSON.stringify(payload)
      }
    )

    const responseText = await aemRes.text()
    let responseData
    try {
      responseData = JSON.parse(responseText)
    } catch {
      responseData = { raw: responseText }
    }

    if (aemRes.status === 201) {
      return NextResponse.json({
        success: true,
        status: 201,
        message: 'Content Fragment creado exitosamente en AEM',
        path: `${AEM_BASE_PATH}/${article.slug}`,
        aemUrl: `${AEM_HOST}/ui#/aem/assets.html/content/dam/test-fragments`
      })
    } else if (aemRes.status === 409) {
      return NextResponse.json({
        success: false,
        status: 409,
        message: 'Ya existe un Content Fragment con este slug en AEM',
        data: responseData
      })
    } else {
      return NextResponse.json({
        success: false,
        status: aemRes.status,
        message: `Error al crear en AEM: ${aemRes.status}`,
        data: responseData
      })
    }

  } catch (err) {
    console.error('AEM publish error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}