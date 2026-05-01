'use client'

export default function ArticleTableToolbar({
  search,
  onSearchChange,
  filterType,
  onFilterTypeChange,
  filterStatus,
  onFilterStatusChange,
  onNewArticle,
}) {
  const inputStyle = {
    padding: '8px 14px',
    border: '1px solid #CCCCCC',
    borderRadius: '8px',
    fontSize: '14px',
    letterSpacing: '-0.02em',
    outline: 'none',
    fontFamily: 'inherit',
    backgroundColor: 'white',
    color: '#222',
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '1.25rem',
      gap: '1rem',
      flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
        <input
          type="text"
          placeholder="Search by title..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{ ...inputStyle, minWidth: '220px' }}
        />
        <select
          value={filterType}
          onChange={(e) => onFilterTypeChange(e.target.value)}
          style={{ ...inputStyle, cursor: 'pointer' }}
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
          style={{ ...inputStyle, cursor: 'pointer' }}
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
          backgroundColor: '#1A3FD6',
          color: 'white',
          border: 'none',
          height: '40px',
          padding: '0 20px',
          borderRadius: '100px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '500',
          letterSpacing: '-0.02em',
          whiteSpace: 'nowrap',
          fontFamily: 'inherit',
        }}
      >
        + New Article
      </button>
    </div>
  )
}
