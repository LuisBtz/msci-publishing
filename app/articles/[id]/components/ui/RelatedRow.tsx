'use client'
/**
 * RelatedRow
 *
 * Label + value row specific to the Related Content section. Renders
 * the value as a link when `link` is true, highlights missing values
 * in red with italic "⚠ No meta description" placeholder, and hides
 * the Copy button for missing rows so the user is nudged to fix
 * them instead of copying an empty string.
 */
import CopyBtn from './CopyBtn'
import { labelStyle } from './articleStyles'

interface RelatedRowProps {
  label: string
  value: string | null | undefined
  mono?: boolean
  link?: boolean
  missing?: boolean
  copied: boolean
  onCopy?: () => void
}

export default function RelatedRow({ label, value, mono, link, missing, copied, onCopy }: RelatedRowProps) {
  return (
    <div>
      <span style={{ ...labelStyle, display: 'block', marginBottom: '0.2rem' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
        {link ? (
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            style={{
              flex: 1,
              fontSize: '0.82rem',
              color: '#0066cc',
              wordBreak: 'break-all',
              lineHeight: '1.5',
            }}
          >
            {value}
          </a>
        ) : (
          <span
            style={{
              flex: 1,
              fontSize: '0.82rem',
              lineHeight: '1.5',
              wordBreak: 'break-all',
              fontFamily: mono ? 'monospace' : 'inherit',
              color: missing ? '#cc0000' : mono ? '#1a6fa8' : '#444',
              fontStyle: missing ? 'italic' : 'normal',
            }}
          >
            {value || '⚠ No meta description available.'}
          </span>
        )}
        {onCopy && !missing && <CopyBtn copied={copied} onCopy={onCopy} />}
      </div>
    </div>
  )
}
