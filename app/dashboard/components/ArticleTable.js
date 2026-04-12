'use client'
/**
 * ArticleTable
 *
 * Dashboard table listing every article visible to the current user.
 * Owns the local filter state and composes the toolbar, row, and
 * delete-confirmation dialog sub-components. Labels and colors come
 * from lib/aem/labels.
 */
import { useState } from 'react'
import ArticleTableToolbar from './article-table/ArticleTableToolbar'
import ArticleRow from './article-table/ArticleRow'
import DeleteConfirmModal from './article-table/DeleteConfirmModal'

const COLUMN_HEADERS = ['Title', 'Type', 'Status', 'Assigned to', 'Created at', '']

export default function ArticleTable({ articles, onNewArticle, onDelete }) {
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [deleteTarget, setDeleteTarget] = useState(null)

  const filtered = articles.filter((a) => {
    const matchSearch = a.headline?.toLowerCase().includes(search.toLowerCase())
    const matchType = filterType === 'all' || a.type === filterType
    const matchStatus = filterStatus === 'all' || a.status === filterStatus
    return matchSearch && matchType && matchStatus
  })

  const handleConfirmDelete = (id) => {
    onDelete(id)
    setDeleteTarget(null)
  }

  return (
    <div>
      <ArticleTableToolbar
        search={search}
        onSearchChange={setSearch}
        filterType={filterType}
        onFilterTypeChange={setFilterType}
        filterStatus={filterStatus}
        onFilterStatusChange={setFilterStatus}
        onNewArticle={onNewArticle}
      />

      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          border: '1px solid #e5e5e5',
          overflow: 'hidden',
        }}
      >
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
                {COLUMN_HEADERS.map((h, i) => (
                  <th
                    key={i}
                    style={{
                      padding: '0.75rem 1rem',
                      textAlign: 'left',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      color: '#666',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => (
                <ArticleRow
                  key={a.id}
                  article={a}
                  isLast={i === filtered.length - 1}
                  onRequestDelete={setDeleteTarget}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {articles.length > 0 && (
        <p
          style={{
            fontSize: '0.8rem',
            color: '#999',
            marginTop: '0.75rem',
            textAlign: 'right',
          }}
        >
          {filtered.length} of {articles.length} articles
        </p>
      )}

      <DeleteConfirmModal
        target={deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
