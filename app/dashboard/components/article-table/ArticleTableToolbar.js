'use client'
/**
 * ArticleTableToolbar
 *
 * Search + filter + "New Article" button row that sits above the
 * dashboard article table. Fully controlled — the parent owns the
 * filter state and the new-article callback.
 */
export default function ArticleTableToolbar({
  search,
  onSearchChange,
  filterType,
  onFilterTypeChange,
  filterStatus,
  onFilterStatusChange,
  onNewArticle,
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.25rem',
        gap: '1rem',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', flex: 1 }}>
        <input
          type="text"
          placeholder="Search by title..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            padding: '0.5rem 0.85rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '0.85rem',
            minWidth: '220px',
            outline: 'none',
          }}
        />
        <select
          value={filterType}
          onChange={(e) => onFilterTypeChange(e.target.value)}
          style={{
            padding: '0.5rem 0.85rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '0.85rem',
            backgroundColor: 'white',
            outline: 'none',
            cursor: 'pointer',
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
          onChange={(e) => onFilterStatusChange(e.target.value)}
          style={{
            padding: '0.5rem 0.85rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '0.85rem',
            backgroundColor: 'white',
            outline: 'none',
            cursor: 'pointer',
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
          backgroundColor: 'black',
          color: 'white',
          border: 'none',
          padding: '0.6rem 1.2rem',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '0.85rem',
          fontWeight: '600',
          whiteSpace: 'nowrap',
        }}
      >
        + New Article
      </button>
    </div>
  )
}
