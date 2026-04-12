'use client'
/**
 * RelatedContentSection
 *
 * Renders the article's related-resources list. Each card shows title,
 * meta description, original URL, mapped AEM path, and CTA label —
 * using RelatedRow for consistent copy-to-clipboard behavior. Also
 * surfaces an optional `related_warning` banner so editors notice when
 * the extractor flagged a problem with the resources.
 *
 * AEM path defaulting uses getAemPath, so rows stay accurate even when
 * the stored record was written before the URL mapper existed.
 */
import Section from '../ui/Section'
import RelatedRow from '../ui/RelatedRow'
import { getDisplayUrl, getAemPath } from '@/lib/aem/urls'

export default function RelatedContentSection({ article, copied, copy }) {
  return (
    <Section title="Related Content">
      {article.related_warning && (
        <div
          style={{
            marginBottom: '0.75rem',
            padding: '0.6rem 0.75rem',
            backgroundColor: '#fffbeb',
            border: '1px solid #fcd34d',
            borderRadius: '6px',
            fontSize: '0.8rem',
            color: '#92400e',
          }}
        >
          ⚠ {article.related_warning}
        </div>
      )}
      {article.related_resources?.length > 0 ? (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {article.related_resources.map((r, i) => {
            const displayUrl = getDisplayUrl(r.original_url || r.url)
            const aemPath = r.aem_path || getAemPath(r.original_url || r.url)
            return (
              <div
                key={i}
                style={{
                  padding: '0.875rem',
                  backgroundColor: '#fafafa',
                  borderRadius: '6px',
                  border: '1px solid #ebebeb',
                  display: 'grid',
                  gap: '0.6rem',
                }}
              >
                <RelatedRow
                  label="Title"
                  value={r.title}
                  copied={copied[`rt_${i}`]}
                  onCopy={() => copy(`rt_${i}`, r.title)}
                />
                <RelatedRow
                  label="Meta Description"
                  value={r.meta_description}
                  missing={!r.meta_description}
                  copied={copied[`rm_${i}`]}
                  onCopy={() => copy(`rm_${i}`, r.meta_description)}
                />
                <RelatedRow
                  label="Original URL"
                  value={displayUrl}
                  link
                  copied={copied[`ro_${i}`]}
                  onCopy={() => copy(`ro_${i}`, displayUrl)}
                />
                <RelatedRow
                  label="AEM Path"
                  value={aemPath}
                  mono
                  copied={copied[`ru_${i}`]}
                  onCopy={() => copy(`ru_${i}`, aemPath)}
                />
                <RelatedRow
                  label="CTA Label"
                  value={r.cta_label || 'Read more'}
                  copied={copied[`rc_${i}`]}
                  onCopy={() => copy(`rc_${i}`, r.cta_label || 'Read more')}
                />
              </div>
            )
          })}
        </div>
      ) : (
        <p style={{ color: '#999', fontSize: '0.875rem', margin: 0 }}>No related resources.</p>
      )}
    </Section>
  )
}
