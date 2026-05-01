'use client'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

/* ── Shared styles ─────────────────────────────────────────────────── */

const sidebarStyle: CSSProperties = {
  position: 'sticky',
  top: '56px',
  padding: '1rem',
  borderLeft: '1px solid #E6E6E6',
  backgroundColor: 'white',
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  minHeight: 'calc(100vh - 56px)',
}

const groupStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  padding: '8px 0',
}

const groupLabelStyle = {
  fontSize: '10px',
  fontWeight: '700',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  color: '#999',
  padding: '0 0 4px',
}

const dividerStyle = { height: '1px', backgroundColor: '#F0F0F0' }

const btnBase: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '7px 10px',
  borderRadius: '8px',
  border: '1px solid #E6E6E6',
  background: 'white',
  fontSize: '12px',
  letterSpacing: '-0.01em',
  color: '#222',
  cursor: 'pointer',
  width: '100%',
  textAlign: 'left',
  textDecoration: 'none',
  lineHeight: '1.3',
  fontFamily: 'inherit',
}

const msgStyle = (color) => ({
  fontSize: '11px',
  color,
  margin: '2px 0 0',
  lineHeight: '1.4',
  letterSpacing: '-0.01em',
})

/* ── Component ─────────────────────────────────────────────────────── */

export default function ArticleSidebar({
  article,
  setArticle,
  id,
  previewUrl,
  exportData,
  refreshing,
  refreshError,
  rescanning,
  rescanError,
  rescanMsg,
  reprocessing,
  reprocessError,
  reprocessMsg,
  onPublishAssets,
  onCreatePage,
  onRefreshAssets,
  onRescanExhibits,
  onReprocessDocument,
}) {
  const router = useRouter()
  const [previewCopied, setPreviewCopied] = useState(false)

  const copyPreviewLink = () => {
    navigator.clipboard.writeText(previewUrl)
    setPreviewCopied(true)
    setTimeout(() => setPreviewCopied(false), 2000)
  }

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${article.slug}.json`
    a.click()
  }

  const deleteArticle = async () => {
    if (!confirm('Delete this article? This cannot be undone.')) return
    await supabase.from('articles').delete().eq('id', id)
    router.push('/dashboard')
  }

  const hasSP = !!article.sharepoint_folder_url

  return (
    <aside style={sidebarStyle}>
      {/* ── 1. Preview & Links ──────────────────────────────────────── */}
      <div style={groupStyle}>
        <div style={groupLabelStyle}>Preview & Links</div>

        <a
          href={`/preview/${id}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            ...btnBase,
            backgroundColor: '#F4F5FD',
            borderColor: '#7188EF',
            color: '#1A3FD6',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M2 8s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5z" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" />
          </svg>
          Open preview
        </a>

        <button
          onClick={copyPreviewLink}
          style={{
            ...btnBase,
            color: previewCopied ? '#118A5E' : '#222',
            borderColor: previewCopied ? '#86efac' : '#E6E6E6',
            backgroundColor: previewCopied ? '#f0fff4' : 'white',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            {previewCopied ? (
              <path d="M3 8l4 4 6-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            ) : (
              <path
                d="M10 2h4v4M14 2l-6 6M7 3H3a1 1 0 00-1 1v9a1 1 0 001 1h9a1 1 0 001-1V9"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            )}
          </svg>
          {previewCopied ? 'Link copied!' : 'Copy preview link'}
        </button>

        {hasSP && (
          <a
            href={article.sharepoint_folder_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              ...btnBase,
              backgroundColor: '#F4F5FD',
              borderColor: '#7188EF',
              color: '#1A3FD6',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 4h5l2 2h5a1 1 0 011 1v6a1 1 0 01-1 1H2a1 1 0 01-1-1V5a1 1 0 011-1z"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
            SharePoint folder
          </a>
        )}
      </div>

      <div style={dividerStyle} />

      {/* ── 2. Sync ─────────────────────────────────────────────────── */}
      <div style={groupStyle}>
        <div style={groupLabelStyle}>
          Sync
          {!hasSP && (
            <span style={{ fontWeight: '400', color: '#bbb', marginLeft: '4px', textTransform: 'none', letterSpacing: 0 }}>
              — no SharePoint
            </span>
          )}
        </div>

        <button
          onClick={onReprocessDocument}
          disabled={reprocessing || !hasSP}
          title={
            !hasSP
              ? 'No SharePoint folder URL on this article'
              : 'Re-download and re-parse the Word document to detect changes'
          }
          style={{
            ...btnBase,
            backgroundColor: reprocessing ? '#f8fafc' : '#fffbeb',
            borderColor: '#fde68a',
            color: reprocessing ? '#999' : '#92400e',
            cursor: reprocessing || !hasSP ? 'not-allowed' : 'pointer',
            opacity: !hasSP ? 0.5 : 1,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path
              d="M4 2h5l4 4v8a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <path d="M9 2v4h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <path
              d="M6 10l1.5 1.5L10 9"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {reprocessing ? 'Reprocesando...' : 'Reprocess document'}
        </button>
        {reprocessError && <p style={msgStyle('#C8102E')}>{reprocessError}</p>}
        {reprocessMsg && <p style={msgStyle('#118A5E')}>{reprocessMsg}</p>}

        <button
          onClick={onRefreshAssets}
          disabled={refreshing || !hasSP}
          title={
            !hasSP
              ? 'No SharePoint folder URL on this article'
              : 'Re-download asset URLs from SharePoint'
          }
          style={{
            ...btnBase,
            color: refreshing ? '#999' : '#222',
            cursor: refreshing || !hasSP ? 'not-allowed' : 'pointer',
            opacity: !hasSP ? 0.5 : 1,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path
              d="M3 8a5 5 0 109.9-1M13 3v4h-4"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
          {refreshing ? 'Refreshing...' : 'Refresh assets'}
        </button>
        {refreshError && <p style={msgStyle('#C8102E')}>{refreshError}</p>}

        <button
          onClick={onRescanExhibits}
          disabled={rescanning || !hasSP}
          title={
            !hasSP
              ? 'No SharePoint folder URL on this article'
              : 'Re-read the SharePoint folder and update exhibits'
          }
          style={{
            ...btnBase,
            color: rescanning ? '#999' : '#1A3FD6',
            borderColor: '#7188EF',
            backgroundColor: rescanning ? '#f8fafc' : '#F4F5FD',
            cursor: rescanning || !hasSP ? 'not-allowed' : 'pointer',
            opacity: !hasSP ? 0.5 : 1,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path
              d="M2 8h3l2-5 2 10 2-5h3"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {rescanning ? 'Re-scanning...' : 'Re-scan exhibits'}
        </button>
        {rescanError && <p style={msgStyle('#C8102E')}>{rescanError}</p>}
        {rescanMsg && <p style={msgStyle('#118A5E')}>{rescanMsg}</p>}
      </div>

      <div style={dividerStyle} />

      {/* ── 3. Publish ──────────────────────────────────────────────── */}
      <div style={groupStyle}>
        <div style={groupLabelStyle}>Publish</div>

        <button
          onClick={onPublishAssets}
          style={{
            ...btnBase,
            backgroundColor: '#fff1f2',
            borderColor: '#fecaca',
            color: '#C8102E',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path
              d="M3 8h10M9 4l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
          Publish assets to AEM DAM
        </button>

        <button
          onClick={onCreatePage}
          style={{
            ...btnBase,
            backgroundColor: '#fefce8',
            borderColor: '#fde68a',
            color: '#92400e',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path
              d="M4 2h5l4 4v8a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <path d="M9 2v4h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <path
              d="M6 10h4M8 8v4"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
          Create AEM Page
        </button>

        <button onClick={exportJson} style={btnBase}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 2v8M5 7l3 3 3-3M3 12h10"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
          Export JSON
        </button>
      </div>

      <div style={dividerStyle} />

      {/* ── 4. Settings ─────────────────────────────────────────────── */}
      <div style={groupStyle}>
        <div style={groupLabelStyle}>Settings</div>

        <div style={{ display: 'grid', gap: '4px' }}>
          <label style={{ fontSize: '11px', color: '#999', letterSpacing: '-0.01em' }}>Status</label>
          <select
            value={article.status}
            onChange={async (e) => {
              const { data } = await supabase
                .from('articles')
                .update({ status: e.target.value })
                .eq('id', id)
                .select()
                .single()
              if (data) setArticle(data)
            }}
            style={{
              padding: '5px 8px',
              border: '1px solid #CCCCCC',
              borderRadius: '8px',
              fontSize: '12px',
              letterSpacing: '-0.01em',
              backgroundColor: 'white',
              color: '#222',
              fontFamily: 'inherit',
              outline: 'none',
            }}
          >
            <option value="in-progress">In Progress</option>
            <option value="in-review">In Review</option>
            <option value="approved">Approved</option>
            <option value="published">Published</option>
          </select>
        </div>

        <div style={{ display: 'grid', gap: '4px' }}>
          <label style={{ fontSize: '11px', color: '#999', letterSpacing: '-0.01em' }}>Publication date</label>
          <input
            type="date"
            defaultValue={article.publish_date || ''}
            onChange={async (e) => {
              await supabase.from('articles').update({ publish_date: e.target.value }).eq('id', id)
              setArticle((prev) => ({ ...prev, publish_date: e.target.value }))
            }}
            style={{
              padding: '5px 8px',
              border: '1px solid #CCCCCC',
              borderRadius: '8px',
              fontSize: '12px',
              letterSpacing: '-0.01em',
              width: '100%',
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* ── Spacer + 5. Danger Zone ─────────────────────────────────── */}
      <div style={{ flex: 1 }} />
      <div style={dividerStyle} />

      <div style={{ ...groupStyle, padding: '6px 0' }}>
        <div style={{ ...groupLabelStyle, color: '#C8102E' }}>Danger Zone</div>
        <button
          onClick={deleteArticle}
          style={{
            ...btnBase,
            color: '#C8102E',
            borderColor: '#fecaca',
            fontSize: '11px',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <path
              d="M3 4h10l-1 9H4L3 4zM1 4h14M6 4V2h4v2"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
          Delete article
        </button>
      </div>
    </aside>
  )
}
