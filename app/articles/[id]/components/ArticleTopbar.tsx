'use client'
import type { CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { TYPE_LABELS, STATUS_LABELS } from '@/lib/aem/labels'

const topbarStyle: CSSProperties = {
  backgroundColor: '#1A3FD6',
  color: 'white',
  padding: '0 1.5rem',
  height: '56px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  position: 'sticky',
  top: 0,
  zIndex: 100,
  gap: '1rem',
}

export default function ArticleTopbar({ article }) {
  const router = useRouter()
  return (
    <div style={topbarStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
        <button
          onClick={() => router.push('/dashboard')}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.65)',
            cursor: 'pointer',
            fontSize: '13px',
            flexShrink: 0,
            letterSpacing: '-0.02em',
            fontFamily: 'inherit',
            fontWeight: '500',
            padding: 0,
          }}
        >
          ← Articles
        </button>
        <span style={{ color: 'rgba(255,255,255,0.25)' }}>|</span>
        <span
          style={{
            fontSize: '14px',
            color: 'rgba(255,255,255,0.85)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            letterSpacing: '-0.02em',
          }}
        >
          {article.headline}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        <span
          style={{
            fontSize: '12px',
            fontWeight: '500',
            padding: '3px 10px',
            borderRadius: '100px',
            backgroundColor: 'rgba(255,255,255,0.15)',
            color: 'rgba(255,255,255,0.9)',
            letterSpacing: '-0.01em',
          }}
        >
          {TYPE_LABELS[article.type] || article.type}
        </span>
        <span
          style={{
            fontSize: '12px',
            fontWeight: '500',
            padding: '3px 10px',
            borderRadius: '100px',
            backgroundColor: 'rgba(255,255,255,0.25)',
            color: 'white',
            letterSpacing: '-0.01em',
          }}
        >
          {STATUS_LABELS[article.status] || article.status}
        </span>
      </div>
    </div>
  )
}
