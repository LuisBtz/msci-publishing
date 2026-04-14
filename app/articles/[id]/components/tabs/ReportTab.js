'use client'
/**
 * ReportTab
 *
 * Displays the publish_report stored on the article after the Chrome
 * extension sidebar completes the automated publishing process.
 * Shows links, metadata summary, and any errors from the run.
 */

const sectionStyle = {
  background: '#fff',
  border: '1px solid #e5e5e5',
  borderRadius: '8px',
  padding: '1rem',
  marginBottom: '0.75rem',
}

const labelStyle = {
  fontSize: '0.7rem',
  fontWeight: '700',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: '#999',
  marginBottom: '0.5rem',
}

const rowStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '0.5rem',
  padding: '0.25rem 0',
  fontSize: '0.82rem',
}

const rowLabelStyle = {
  fontWeight: '600',
  color: '#666',
  minWidth: '100px',
  flexShrink: 0,
  fontSize: '0.75rem',
}

const linkStyle = {
  color: '#c8102e',
  textDecoration: 'none',
  fontSize: '0.8rem',
  wordBreak: 'break-all',
}

const statGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: '0.5rem',
}

const statStyle = {
  textAlign: 'center',
  padding: '0.6rem 0.25rem',
  background: '#f7f7f8',
  borderRadius: '6px',
}

const statNumStyle = {
  display: 'block',
  fontSize: '1.25rem',
  fontWeight: '700',
  color: '#1a1a1a',
}

const statLabelStyle = {
  fontSize: '0.65rem',
  color: '#999',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

export default function ReportTab({ article }) {
  const report = article?.publish_report

  if (!report) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#999' }}>
        <p style={{ fontSize: '0.9rem' }}>No publish report available yet.</p>
        <p style={{ fontSize: '0.78rem', marginTop: '0.5rem' }}>
          Run the automated publishing process from the Chrome extension sidebar to generate a report.
        </p>
      </div>
    )
  }

  const hasErrors = report.errors && report.errors.length > 0
  const durationSec = report.duration_ms ? (report.duration_ms / 1000).toFixed(1) : null
  const publishedAt = report.published_at
    ? new Date(report.published_at).toLocaleString()
    : null

  return (
    <>
      {/* Status */}
      <div
        style={{
          ...sectionStyle,
          background: hasErrors ? '#fffbeb' : '#f0fdf4',
          borderColor: hasErrors ? '#fde68a' : '#bbf7d0',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}
      >
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: hasErrors ? '#eab308' : '#22c55e',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: '700',
            fontSize: '1rem',
            flexShrink: 0,
          }}
        >
          {hasErrors ? '!' : '\u2713'}
        </div>
        <div>
          <div style={{ fontWeight: '600', fontSize: '0.85rem', color: hasErrors ? '#92400e' : '#065f46' }}>
            {hasErrors ? 'Published with errors' : 'Published successfully'}
          </div>
          {publishedAt && (
            <div style={{ fontSize: '0.72rem', color: hasErrors ? '#a16207' : '#047857', marginTop: '2px' }}>
              {publishedAt}{durationSec && ` \u2014 ${durationSec}s`}
            </div>
          )}
        </div>
      </div>

      {/* Links */}
      <div style={sectionStyle}>
        <div style={labelStyle}>Links</div>
        {report.dam_url && (
          <div style={rowStyle}>
            <span style={rowLabelStyle}>DAM Folder</span>
            <a href={report.dam_url} target="_blank" rel="noreferrer" style={linkStyle}>
              {report.dam_folder || 'Open'}
            </a>
          </div>
        )}
        {report.sites_url && (
          <div style={rowStyle}>
            <span style={rowLabelStyle}>Sites (AEM)</span>
            <a href={report.sites_url} target="_blank" rel="noreferrer" style={linkStyle}>
              {report.sites_url}
            </a>
          </div>
        )}
        {report.editor_url && (
          <div style={rowStyle}>
            <span style={rowLabelStyle}>Editor</span>
            <a href={report.editor_url} target="_blank" rel="noreferrer" style={linkStyle}>
              {report.editor_url}
            </a>
          </div>
        )}
        {report.preview_url && (
          <div style={rowStyle}>
            <span style={rowLabelStyle}>Preview</span>
            <a href={report.preview_url} target="_blank" rel="noreferrer" style={linkStyle}>
              {report.preview_url}
            </a>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div style={sectionStyle}>
        <div style={labelStyle}>Metadata</div>
        <div style={rowStyle}>
          <span style={rowLabelStyle}>Title</span>
          <span>{report.title || '\u2014'}</span>
        </div>
        <div style={rowStyle}>
          <span style={rowLabelStyle}>Slug</span>
          <code style={{ fontSize: '0.78rem', background: '#f0f0f0', padding: '1px 4px', borderRadius: '3px' }}>
            {report.slug || '\u2014'}
          </code>
        </div>
        <div style={rowStyle}>
          <span style={rowLabelStyle}>Description</span>
          <span style={{ fontSize: '0.78rem', color: '#555', lineHeight: 1.4 }}>
            {report.meta_description || '\u2014'}
          </span>
        </div>
        <div style={rowStyle}>
          <span style={rowLabelStyle}>Tags</span>
          <span>{report.tags?.length || 0} tag(s)</span>
        </div>
      </div>

      {/* Summary stats */}
      <div style={sectionStyle}>
        <div style={labelStyle}>Summary</div>
        <div style={statGridStyle}>
          <div style={statStyle}>
            <span style={statNumStyle}>{report.assets_uploaded?.exhibits || 0}</span>
            <span style={statLabelStyle}>Exhibits</span>
          </div>
          <div style={statStyle}>
            <span style={statNumStyle}>{report.assets_uploaded?.banners || 0}</span>
            <span style={statLabelStyle}>Banners</span>
          </div>
          <div style={statStyle}>
            <span style={statNumStyle}>{report.content_injected?.length || 0}</span>
            <span style={statLabelStyle}>Modules</span>
          </div>
          <div style={statStyle}>
            <span style={statNumStyle}>{report.containers_cleaned || 0}</span>
            <span style={statLabelStyle}>Cleaned</span>
          </div>
        </div>
      </div>

      {/* Errors */}
      {hasErrors && (
        <div style={{ ...sectionStyle, borderColor: '#fecaca', background: '#fef2f2' }}>
          <div style={{ ...labelStyle, color: '#dc2626' }}>Errors</div>
          <ul style={{ paddingLeft: '1rem', margin: 0 }}>
            {report.errors.map((e, i) => (
              <li key={i} style={{ fontSize: '0.8rem', color: '#dc2626', marginBottom: '4px' }}>
                {e}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
