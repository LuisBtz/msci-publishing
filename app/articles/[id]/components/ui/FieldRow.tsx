'use client'
/**
 * FieldRow
 *
 * Labeled key/value row used in the MetadataSection card: uppercase
 * label on top, the value below with an optional Copy button. Honors
 * mono (monospaced) and bold flags for presentation parity with the
 * original single-file implementation.
 */
import CopyBtn from './CopyBtn'
import { labelStyle } from './articleStyles'

interface FieldRowProps {
  label: string
  value: string | null | undefined
  mono?: boolean
  bold?: boolean
  copied: boolean
  onCopy: () => void
}

export default function FieldRow({ label, value, mono, bold, copied, onCopy }: FieldRowProps) {
  return (
    <div>
      <span style={{ ...labelStyle, display: 'block', marginBottom: '0.3rem' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
        <span
          style={{
            flex: 1,
            fontSize: mono ? '0.82rem' : '0.875rem',
            lineHeight: '1.5',
            fontFamily: mono ? 'monospace' : 'inherit',
            fontWeight: bold ? '600' : '400',
            color: '#333',
            wordBreak: 'break-all',
          }}
        >
          {value || <span style={{ color: '#ccc' }}>—</span>}
        </span>
        <CopyBtn copied={copied} onCopy={onCopy} />
      </div>
    </div>
  )
}
