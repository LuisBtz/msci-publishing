'use client'
/**
 * ArticleRow
 *
 * A single row of the dashboard article table. Renders the headline,
 * type/status badges, assignee, created date and a delete button.
 * Clicking anywhere on the row (except the delete button) navigates
 * to the article editor.
 */
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
        borderBottom: isLast ? 'none' : '1px solid #f0f0f0',
        cursor: 'pointer',
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fafafa')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      <td
        style={{
          padding: '0.85rem 1rem',
          fontSize: '0.9rem',
          color: '#111',
          maxWidth: '400px',
        }}
      >
        <span style={{ fontWeight: '500' }}>{article.headline || '—'}</span>
      </td>
      <td style={{ padding: '0.85rem 1rem' }}>
        <Badge
          label={TYPE_LABELS[article.type] || article.type}
          colors={TYPE_COLORS[article.type]}
        />
      </td>
      <td style={{ padding: '0.85rem 1rem' }}>
        <Badge
          label={STATUS_LABELS[article.status] || article.status}
          colors={STATUS_COLORS[article.status]}
        />
      </td>
      <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#666' }}>
        {article.assigned_to_email || '—'}
      </td>
      <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#666' }}>
        {article.created_at ? new Date(article.created_at).toLocaleDateString('en-US') : '—'}
      </td>
      <td style={{ padding: '0.85rem 0.75rem', textAlign: 'right' }}>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRequestDelete({ id: article.id, headline: article.headline })
          }}
          style={{
            background: 'none',
            border: '1px solid #ffcccc',
            color: '#cc0000',
            padding: '0.3rem 0.6rem',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.75rem',
            fontWeight: '600',
          }}
        >
          Delete
        </button>
      </td>
    </tr>
  )
}
