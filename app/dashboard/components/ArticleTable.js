'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const TYPE_LABELS = {
  'blog-post': 'Blog Post',
  'paper': 'Paper',
  'quick-take': 'Quick Take',
  'podcast': 'Podcast'
}

const TYPE_COLORS = {
  'blog-post': { bg: '#e8f4fd', color: '#1a6fa8' },
  'paper': { bg: '#f0f0ff', color: '#4a4aaa' },
  'quick-take': { bg: '#fff8e8', color: '#a87a1a' },
  'podcast': { bg: '#f0fff4', color: '#1a8a4a' }
}

const STATUS_LABELS = {
  'in-progress': 'In Progress',
  'in-review': 'In Review',
  'approved': 'Approved',
  'published': 'Published'
}

const STATUS_COLORS = {
  'in-progress': { bg: '#fff8e8', color: '#a87a1a' },
  'in-review': { bg: '#e8f4fd', color: '#1a6fa8' },
  'approved': { bg: '#f0fff4', color: '#1a8a4a' },
  'published': { bg: '#f0f0f0', color: '#555' }
}

function Badge({ label, style }) {
  return (
    <span style={{
      fontSize: '0.75rem', fontWeight: '600', padding: '0.25rem 0.6rem',
      borderRadius: '999px', whiteSpace: 'nowrap', ...style
    }}>
      {label}
    </span>
  )
}

export default function ArticleTable({ articles, onNewArticle, onDelete }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [deleteModal, setDeleteModal] = useState(null)

  const filtered = articles.filter(a => {
    const matchSearch = a.headline?.toLowerCase().includes(search.toLowerCase())
    const matchType = filterType === 'all' || a.type === filterType
    const matchStatus = filterStatus === 'all' || a.status === filterStatus
    return matchSearch && matchType && matchStatus
  })

  return (
    <div>
      {/* Toolbar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', flex: 1 }}>
          <input
            type="text"
            placeholder="Search by title..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              padding: '0.5rem 0.85rem', border: '1px solid #ddd', borderRadius: '4px',
              fontSize: '0.85rem', minWidth: '220px', outline: 'none'
            }}
          />
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            style={{
              padding: '0.5rem 0.85rem', border: '1px solid #ddd', borderRadius: '4px',
              fontSize: '0.85rem', backgroundColor: 'white', outline: 'none', cursor: 'pointer'
            }}
          >
            <option value="all">All types</option>
            <option value="blog-post">Blog Post</option>
            <option value="paper">Paper</option>
            <option value="quick-take">Quick Take</option>
            <option value="podcast">Podcast</option>
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            style={{
              padding: '0.5rem 0.85rem', border: '1px solid #ddd', borderRadius: '4px',
              fontSize: '0.85rem', backgroundColor: 'white', outline: 'none', cursor: 'pointer'
            }}
          >
            <option value="all">All statuses</option>
            <option value="in-progress">In Progress</option>
            <option value="in-review">In Review</option>
            <option value="approved">Approved</option>
            <option value="published">Published</option>
          </select>
        </div>

        <button
          onClick={onNewArticle}
          style={{
            backgroundColor: 'black', color: 'white', border: 'none',
            padding: '0.6rem 1.2rem', borderRadius: '4px', cursor: 'pointer',
            fontSize: '0.85rem', fontWeight: '600', whiteSpace: 'nowrap'
          }}
        >
          + New Article
        </button>
      </div>

      {/* Table */}
      <div style={{
        backgroundColor: 'white', borderRadius: '8px',
        border: '1px solid #e5e5e5', overflow: 'hidden'
      }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <p style={{ color: '#999', fontSize: '0.9rem', margin: 0 }}>
              {articles.length === 0
                ? 'No articles yet. Create one with "+ New Article".'
                : 'No articles found for those filters.'}
            </p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e5e5', backgroundColor: '#fafafa' }}>
                {['Title', 'Type', 'Status', 'Assigned to', 'Created at', ''].map((h, i) => (
                  <th key={i} style={{
                    padding: '0.75rem 1rem', textAlign: 'left',
                    fontSize: '0.75rem', fontWeight: '700', color: '#666',
                    textTransform: 'uppercase', letterSpacing: '0.05em'
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => (
                <tr
                  key={a.id}
                  onClick={() => router.push(`/articles/${a.id}`)}
                  style={{
                    borderBottom: i < filtered.length - 1 ? '1px solid #f0f0f0' : 'none',
                    cursor: 'pointer', transition: 'background 0.1s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fafafa'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <td style={{ padding: '0.85rem 1rem', fontSize: '0.9rem', color: '#111', maxWidth: '400px' }}>
                    <span style={{ fontWeight: '500' }}>{a.headline || '—'}</span>
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <Badge
                      label={TYPE_LABELS[a.type] || a.type}
                      style={TYPE_COLORS[a.type] || { bg: '#f0f0f0', color: '#555' }}
                    />
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <Badge
                      label={STATUS_LABELS[a.status] || a.status}
                      style={STATUS_COLORS[a.status] || { bg: '#f0f0f0', color: '#555' }}
                    />
                  </td>
                  <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#666' }}>
                    {a.assigned_to_email || '—'}
                  </td>
                  <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#666' }}>
                    {a.created_at ? new Date(a.created_at).toLocaleDateString('en-US') : '—'}
                  </td>
                  <td style={{ padding: '0.85rem 0.75rem', textAlign: 'right' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteModal({ id: a.id, headline: a.headline })
                      }}
                      style={{
                        background: 'none', border: '1px solid #ffcccc', color: '#cc0000',
                        padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer',
                        fontSize: '0.75rem', fontWeight: '600'
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Count */}
      {articles.length > 0 && (
        <p style={{ fontSize: '0.8rem', color: '#999', marginTop: '0.75rem', textAlign: 'right' }}>
          {filtered.length} of {articles.length} articles
        </p>
      )}

      {/* Modal de confirmación de eliminación */}
      {deleteModal && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 300, padding: '1rem'
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '8px', padding: '2rem',
            width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
          }}>
            <div style={{ fontSize: '2rem', textAlign: 'center', marginBottom: '1rem' }}>🗑️</div>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: '700', textAlign: 'center' }}>
              Delete Article?
            </h3>
            <p style={{ margin: '0 0 1.5rem', fontSize: '0.9rem', color: '#666', textAlign: 'center', lineHeight: '1.5' }}>
              <strong>"{deleteModal.headline}"</strong><br />
              This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setDeleteModal(null)}
                style={{
                  flex: 1, padding: '0.65rem', border: '1px solid #ddd',
                  borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem',
                  backgroundColor: 'white', color: '#333'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDelete(deleteModal.id)
                  setDeleteModal(null)
                }}
                style={{
                  flex: 1, padding: '0.65rem', border: 'none',
                  borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem',
                  fontWeight: '600', backgroundColor: '#cc0000', color: 'white'
                }}
              >
                Yes, delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}