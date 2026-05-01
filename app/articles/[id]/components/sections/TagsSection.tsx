'use client'
/**
 * TagsSection
 *
 * Card listing the article's AEM tags as pill buttons. Clicking a pill
 * copies that individual tag; the header button copies all tags as a
 * comma-separated string. Shows a red warning when no tags were
 * extracted so editors know to reprocess the DOCX.
 */
import Section from '../ui/Section'
import CopyBtn from '../ui/CopyBtn'

export default function TagsSection({ tags, copied, copy }) {
  return (
    <Section title="Tags AEM">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.6rem',
        }}
      >
        <span style={{ fontSize: '0.78rem', color: '#999' }}>{tags.length} tags</span>
        <CopyBtn
          label="Copy all"
          copied={copied['tags']}
          onCopy={() => copy('tags', tags.join(', '))}
        />
      </div>
      {tags.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
          {tags.map((tag, i) => (
            <button
              key={i}
              onClick={() => copy(`tag_${i}`, tag)}
              style={{
                fontSize: '0.78rem',
                padding: '0.2rem 0.65rem',
                borderRadius: '20px',
                backgroundColor: copied[`tag_${i}`] ? '#f0fff4' : '#f2f2f2',
                color: copied[`tag_${i}`] ? '#16a34a' : '#444',
                border: copied[`tag_${i}`] ? '1px solid #86efac' : '1px solid #e5e5e5',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {copied[`tag_${i}`] ? '✓ ' : ''}
              {tag}
            </button>
          ))}
        </div>
      ) : (
        <p style={{ color: '#cc0000', fontSize: '0.85rem', margin: 0 }}>
          ⚠ No tags found — reprocess the article.
        </p>
      )}
    </Section>
  )
}
