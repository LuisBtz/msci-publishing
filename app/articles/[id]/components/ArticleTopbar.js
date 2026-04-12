'use client'
/**
 * ArticleTopbar
 *
 * Sticky black bar at the top of the article editor: back-to-dashboard
 * button, truncated headline, and type/status badges. No logic beyond
 * the single click that pushes /dashboard — all text values come from
 * props.
 */
import { useRouter } from 'next/navigation'
import { TYPE_LABELS, STATUS_LABELS } from '@/lib/aem/labels'

const topbarStyle = {
  backgroundColor: 'black',
  color: 'white',
  padding: '0 1.5rem',
  height: '52px',
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
            color: '#999',
            cursor: 'pointer',
            fontSize: '0.8rem',
            flexShrink: 0,
          }}
        >
          ← Articles
        </button>
        <span style={{ color: '#333' }}>|</span>
        <span
          style={{
            fontSize: '0.85rem',
            color: '#ccc',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {article.headline}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: '600',
            padding: '0.2rem 0.6rem',
            borderRadius: '999px',
            backgroundColor: '#222',
            color: '#ccc',
          }}
        >
          {TYPE_LABELS[article.type] || article.type}
        </span>
        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: '600',
            padding: '0.2rem 0.6rem',
            borderRadius: '999px',
            backgroundColor: '#333',
            color: '#fff',
          }}
        >
          {STATUS_LABELS[article.status] || article.status}
        </span>
      </div>
    </div>
  )
}
