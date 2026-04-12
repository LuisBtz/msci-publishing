'use client'
/**
 * KeyFindingsSection
 *
 * Card showing the article bullets ("key findings") with two copy
 * actions: rich HTML (AEM RTE paste, built via buildKeyFindingsHtml)
 * and plain numbered text. Hidden entirely when there are no bullets.
 */
import Section from '../ui/Section'
import CopyBtn from '../ui/CopyBtn'
import { buildKeyFindingsHtml } from '@/lib/msci/htmlBuilders'

export default function KeyFindingsSection({ bullets, copied, copy, copyRich }) {
  if (!bullets || bullets.length === 0) return null

  return (
    <Section title="Key Findings">
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginBottom: '0.5rem',
          gap: '0.4rem',
        }}
      >
        <CopyBtn
          label="Copy"
          copied={copied['bullets_rich']}
          onCopy={() => copyRich('bullets_rich', buildKeyFindingsHtml(bullets))}
        />
        <CopyBtn
          label="Copy plain text"
          copied={copied['bullets']}
          onCopy={() => copy('bullets', bullets.map((b, i) => `${i + 1}. ${b}`).join('\n'))}
        />
      </div>
      <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'grid', gap: '0.4rem' }}>
        {bullets.map((b, i) => (
          <li key={i} style={{ fontSize: '0.875rem', color: '#333', lineHeight: '1.6' }}>
            {b}
          </li>
        ))}
      </ul>
    </Section>
  )
}
