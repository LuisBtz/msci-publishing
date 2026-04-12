'use client'
/**
 * MetadataSection
 *
 * Renders the article's core metadata card (headline, slug, final URL,
 * read time, meta description). Pure presentational — receives the
 * article and the copy helpers from the parent tab and delegates row
 * rendering to FieldRow / CopyBtn.
 */
import Section from '../ui/Section'
import Divider from '../ui/Divider'
import FieldRow from '../ui/FieldRow'
import CopyBtn from '../ui/CopyBtn'
import { labelStyle } from '../ui/articleStyles'

export default function MetadataSection({ article, copied, copy }) {
  return (
    <Section title="Metadata">
      <FieldRow
        label="Headline"
        value={article.headline}
        bold
        copied={copied['headline']}
        onCopy={() => copy('headline', article.headline)}
      />
      <Divider />
      <FieldRow
        label="Slug"
        value={article.slug}
        mono
        copied={copied['slug']}
        onCopy={() => copy('slug', article.slug)}
      />
      <Divider />
      <FieldRow
        label="Final URL"
        value={article.final_url}
        mono
        copied={copied['url']}
        onCopy={() => copy('url', article.final_url)}
      />
      <Divider />
      <FieldRow
        label="Read time"
        value={article.read_time ? String(article.read_time) : null}
        mono
        copied={copied['rt']}
        onCopy={() => copy('rt', String(article.read_time))}
      />
      <Divider />
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.35rem',
          }}
        >
          <span style={labelStyle}>Meta description</span>
          <span style={{ fontSize: '0.72rem', color: '#bbb' }}>
            {article.meta_description?.length || 0} / 160
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
          <span style={{ flex: 1, fontSize: '0.875rem', color: '#333', lineHeight: '1.6' }}>
            {article.meta_description || <span style={{ color: '#bbb' }}>—</span>}
          </span>
          <CopyBtn
            copied={copied['meta']}
            onCopy={() => copy('meta', article.meta_description)}
          />
        </div>
      </div>
    </Section>
  )
}
