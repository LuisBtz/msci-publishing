'use client'
/**
 * PreviewBodyBlocks
 *
 * Iterates over article.body_blocks and renders each block in the
 * preview:
 *  - text  → raw HTML rewritten with decorateBodyHtml so headings,
 *           paragraphs, links and sups all pick up MSCI typography.
 *  - exhibit → the resolved ExhibitAsset (static image or interactive
 *             chart) plus optional title and caption.
 *
 * Exhibit resolution is centralized in lib/exhibits/resolveExhibit.
 */
import ExhibitAsset from '../ExhibitAsset'
import { resolveExhibit } from '@/lib/exhibits/resolveExhibit'
import { t } from '@/lib/msci/styleTokens'
import { type } from '@/lib/msci/typography'
import { decorateBodyHtml } from './previewHtmlStyles'

export default function PreviewBodyBlocks({ bodyBlocks, exhibitPaths }) {
  if (!bodyBlocks?.length) return null

  return (
    <>
      {bodyBlocks.map((block, i) => {
        if (block.type === 'text') {
          return (
            <div
              key={i}
              style={{ ...type.bodyArticle, marginBottom: '16px' }}
              dangerouslySetInnerHTML={{ __html: decorateBodyHtml(block.html) }}
            />
          )
        }

        if (block.type === 'exhibit') {
          const exhibit = resolveExhibit(block, exhibitPaths)
          return (
            <div key={i} style={{ margin: '48px 0' }}>
              {block.title && (
                <h3 style={{ ...type.h3, marginBottom: '24px' }}>{block.title}</h3>
              )}
              {exhibit ? (
                <ExhibitAsset exhibit={exhibit} onExpired={() => {}} />
              ) : (
                <div
                  style={{
                    backgroundColor: t.gray50,
                    borderRadius: '8px',
                    padding: '40px',
                    textAlign: 'center',
                    color: t.gray700,
                    ...type.bodyS,
                  }}
                >
                  Exhibit — image not available
                </div>
              )}
              {block.caption && (
                <p
                  style={{
                    ...type.bodyS,
                    color: t.gray700,
                    marginTop: '16px',
                    marginBottom: 0,
                  }}
                >
                  {block.caption}
                </p>
              )}
            </div>
          )
        }
        return null
      })}
    </>
  )
}
