'use client'
/**
 * ExhibitBlock
 *
 * Renders one `type: 'exhibit'` body block: the exhibit title (with a
 * rich + plain copy pair), the live exhibit preview via ExhibitAsset,
 * the SharePoint file metadata (desktop/mobile for static, JSON/HTML
 * for interactive), the manual "Override assignment" dropdown that
 * lets an editor swap in a different exhibit from the folder, and the
 * optional caption with its copy actions.
 *
 * All data mutations are delegated up via reassignExhibit; this
 * component only reads savingBlocks to disable the select while a
 * write is in flight.
 */
import ExhibitAsset from '../ExhibitAsset'
import CopyBtn from '../ui/CopyBtn'
import FileRow from '../ui/FileRow'
import { resolveExhibit } from '@/lib/exhibits/resolveExhibit'
import { buildCaptionHtml, inlineStyle } from '@/lib/msci/htmlBuilders'
import { MSCI_STYLES } from '@/lib/msci/styleTokens'

export default function ExhibitBlock({
  block,
  blockIdx,
  exhibitPaths,
  exhibitOptions,
  savingBlocks,
  reassignExhibit,
  refreshAssets,
  copied,
  copy,
  copyRich,
}) {
  const resolvedIdx = block.sharepoint_index ?? block.exhibit_index
  const exhibit = resolveExhibit({ ...block, sharepoint_index: resolvedIdx }, exhibitPaths)

  return (
    <div
      style={{
        backgroundColor: 'white',
        border: '1px solid #e5e5e5',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#1D9E75',
              display: 'inline-block',
            }}
          />
          <span
            style={{
              fontSize: '11px',
              fontWeight: '600',
              color: '#1D9E75',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Exhibit
          </span>
          {block.match_confidence === 'low' && (
            <span style={{ fontSize: '11px', color: '#a87a1a', fontWeight: '600' }}>
              ⚠ Uncertain match
            </span>
          )}
        </div>
      </div>
      <div style={{ padding: '12px', display: 'grid', gap: '10px' }}>
        {block.title && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ flex: 1, fontSize: '1rem', fontWeight: '700', color: '#111' }}>
              {block.title}
            </span>
            <CopyBtn
              label="Copy"
              copied={copied[`etitle_rich_${blockIdx}`]}
              onCopy={() =>
                copyRich(
                  `etitle_rich_${blockIdx}`,
                  `<p><span style="${inlineStyle(MSCI_STYLES.headline3)}">${block.title}</span></p>`
                )
              }
            />
            <CopyBtn
              label="Copy plain text"
              copied={copied[`etitle_${blockIdx}`]}
              onCopy={() => copy(`etitle_${blockIdx}`, block.title)}
            />
          </div>
        )}
        <ExhibitAsset exhibit={exhibit} onExpired={refreshAssets} />
        <div
          style={{
            backgroundColor: '#f9fafb',
            borderRadius: '6px',
            padding: '0.75rem',
            border: '1px solid #eee',
          }}
        >
          {exhibit ? (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '0.5rem',
                }}
              >
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: '700',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    backgroundColor:
                      exhibit.exhibit_type === 'interactive' ? '#fef3c7' : '#e0f2fe',
                    color: exhibit.exhibit_type === 'interactive' ? '#92400e' : '#0369a1',
                  }}
                >
                  {exhibit.exhibit_type === 'interactive' ? '⚡ Interactive' : '🖼 Static'}
                </span>
              </div>
              {exhibit.exhibit_type === 'static' ? (
                <div style={{ display: 'grid', gap: '0.35rem' }}>
                  <FileRow
                    label="Desktop"
                    filename={exhibit.desktop?.filename}
                    copied={copied[`edesk_${blockIdx}`]}
                    onCopy={() =>
                      copy(`edesk_${blockIdx}`, exhibit.desktop?.filename || '')
                    }
                  />
                  {exhibit.mobile && (
                    <FileRow
                      label="Mobile"
                      filename={exhibit.mobile?.filename}
                      copied={copied[`emob_${blockIdx}`]}
                      onCopy={() =>
                        copy(`emob_${blockIdx}`, exhibit.mobile?.filename || '')
                      }
                    />
                  )}
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '0.35rem' }}>
                  <FileRow
                    label="JSON"
                    filename={exhibit.json?.filename}
                    copied={copied[`ejson_${blockIdx}`]}
                    onCopy={() =>
                      copy(`ejson_${blockIdx}`, exhibit.json?.filename || '')
                    }
                  />
                  {exhibit.html && <FileRow label="HTML" filename={exhibit.html?.filename} />}
                </div>
              )}
            </div>
          ) : (
            <p style={{ color: '#999', fontSize: '0.85rem', margin: 0 }}>
              ⚠ No SharePoint file found for this exhibit.
            </p>
          )}
          {exhibitOptions.length > 0 && (
            <div
              style={{
                marginTop: '0.6rem',
                paddingTop: '0.6rem',
                borderTop: '1px solid #e5e5e5',
              }}
            >
              <label
                style={{
                  fontSize: '0.72rem',
                  color: '#999',
                  display: 'block',
                  marginBottom: '0.3rem',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                }}
              >
                Override assignment
              </label>
              <select
                value={resolvedIdx ?? ''}
                onChange={(e) => reassignExhibit(blockIdx, parseInt(e.target.value))}
                disabled={savingBlocks}
                style={{
                  width: '100%',
                  padding: '0.35rem 0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '0.8rem',
                  backgroundColor: 'white',
                }}
              >
                {exhibitOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        {block.caption && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <span
              style={{
                flex: 1,
                fontSize: '0.82rem',
                color: '#666',
                lineHeight: '1.5',
                fontStyle: 'italic',
              }}
            >
              {block.caption}
            </span>
            <CopyBtn
              label="Copy"
              copied={copied[`ecap_rich_${blockIdx}`]}
              onCopy={() => copyRich(`ecap_rich_${blockIdx}`, buildCaptionHtml(block.caption))}
            />
            <CopyBtn
              label="Copy plain text"
              copied={copied[`ecap_${blockIdx}`]}
              onCopy={() => copy(`ecap_${blockIdx}`, block.caption)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
