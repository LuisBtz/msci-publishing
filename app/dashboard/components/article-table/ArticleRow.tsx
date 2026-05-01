'use client'
import { useRouter } from 'next/navigation'
import {
  TYPE_LABELS,
  TYPE_COLORS,
  STATUS_LABELS,
  STATUS_COLORS,
} from '@/lib/aem/labels'
import Badge from './Badge'

export default function ArticleRow({ article, isLast, onRequestDelete }) {
  const router = useRouter()

  return (
    <tr
      onClick={() => router.push(`/articles/${article.id}`)}
      style={{
        borderBottom: isLast ? 'none' : '1px solid #F0F0F0',
        cursor: 'pointer',
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F4F5FD')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      <td style={{
        padding: '14px 16px',
        fontSize: '14px',
        color: '#000',
        maxWidth: '400px',
        letterSpacing: '-0.02em',
      }}>
        <span style={{ fontWeight: '500' }}>{article.headline || '—'}</span>
      </td>
      <td style={{ padding: '14px 16px' }}>
        <Badge
          label={TYPE_LABELS[article.type] || article.type}
          colors={TYPE_COLORS[article.type]}
        />
      </td>
      <td style={{ padding: '14px 16px' }}>
        <Badge
          label={STATUS_LABELS[article.status] || article.status}
          colors={STATUS_COLORS[article.status]}
        />
      </td>
      <td style={{ padding: '14px 16px', fontSize: '13px', color: '#707070', letterSpacing: '-0.02em' }}>
        {article.assigned_to_email || '—'}
      </td>
      <td style={{ padding: '14px 16px', fontSize: '13px', color: '#707070', letterSpacing: '-0.02em' }}>
        {article.created_at ? new Date(article.created_at).toLocaleDateString('en-US') : '—'}
      </td>
      <td style={{ padding: '14px 12px', textAlign: 'right' }}>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRequestDelete({ id: article.id, headline: article.headline })
          }}
          style={{
            background: 'none',
            border: '1px solid #fecaca',
            color: '#cc0000',
            padding: '4px 10px',
            borderRadius: '100px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '500',
            letterSpacing: '-0.01em',
            fontFamily: 'inherit',
          }}
        >
          Delete
        </button>
      </td>
    </tr>
  )
}
