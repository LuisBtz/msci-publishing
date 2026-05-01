'use client'
/**
 * PreviewHero
 *
 * Blue hero band at the top of the article preview. Shows breadcrumb,
 * the headline (at MSCI's h1 scale), and the metadata row (type label,
 * read time, authors, publish date). All values come from the article
 * record — no data fetching of its own.
 */
import { t } from '@/lib/msci/styleTokens'
import { type } from '@/lib/msci/typography'

const TYPE_LABELS = {
  'blog-post': 'Blog post',
  'paper': 'Research Paper',
  'quick-take': 'Quick Take',
  'podcast': 'Podcast',
}

function Dot() {
  return (
    <span
      style={{
        width: '4px',
        height: '4px',
        borderRadius: '50%',
        backgroundColor: t.white,
        display: 'inline-block',
        flexShrink: 0,
      }}
    />
  )
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function PreviewHero({ article }) {
  return (
    <section style={{ backgroundColor: t.brandblue700, color: t.white }}>
      <div
        style={{
          maxWidth: t.maxW,
          margin: '0 auto',
          padding: `40px ${t.padX} 70px`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '40px',
          }}
        >
          <span style={{ ...type.bodyS, color: t.white, cursor: 'pointer' }}>
            Research & Insights
          </span>
          <span style={{ ...type.bodyS, color: t.white }}>/</span>
          <span style={{ ...type.bodyS, color: t.white, cursor: 'pointer' }}>Blog posts</span>
        </div>

        <h1 style={{ ...type.h1, color: t.white, maxWidth: '1100px' }}>{article.headline}</h1>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '12px',
            marginTop: '40px',
          }}
        >
          <span style={{ ...type.bodyS, color: t.white }}>
            {TYPE_LABELS[article.type] || article.type}
          </span>
          {article.read_time && (
            <>
              <Dot />
              <span style={{ ...type.bodyS, color: t.white }}>{article.read_time} min read</span>
            </>
          )}
          {article.authors?.length > 0 && (
            <>
              <Dot />
              {article.authors.map((a, i) => (
                <span key={i} style={{ ...type.bodyS, color: t.white }}>
                  <span style={{ textDecoration: 'underline', cursor: 'pointer' }}>{a.name}</span>
                  {i < article.authors.length - 1 && ', '}
                </span>
              ))}
            </>
          )}
          {article.publish_date && (
            <>
              <Dot />
              <span style={{ ...type.bodyS, color: t.white }}>{formatDate(article.publish_date)}</span>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
