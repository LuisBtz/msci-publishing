'use client'
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

      <div style={{
        backgroundColor: 'white',
        borderRadius: '18px',
        border: '1px solid #E6E6E6',
        boxShadow: '0px 4px 4px 0px rgba(0,0,0,0.10)',
        overflow: 'hidden',
      }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <p style={{ color: '#999', fontSize: '14px', letterSpacing: '-0.02em' }}>
              {articles.length === 0
                ? 'No articles yet. Create one with "+ New Article".'
                : 'No articles found for those filters.'}
            </p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #000' }}>
                {COLUMN_HEADERS.map((h, i) => (
                  <th
                    key={i}
                    style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#000',
                      letterSpacing: '-0.02em',
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
        <p style={{
          fontSize: '12px',
          color: '#999',
          marginTop: '0.75rem',
          textAlign: 'right',
          letterSpacing: '-0.01em',
        }}>
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
