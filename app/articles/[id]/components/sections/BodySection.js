'use client'
/**
 * BodySection
 *
 * Renders the article body as a vertical stack of blocks. Each entry
 * in `body_blocks` is dispatched by `type` to TextBlock or ExhibitBlock;
 * unknown types are skipped. This component is a thin iterator — all
 * per-block logic lives in the block components themselves.
 */
import { sectionTitleStyle } from '../ui/articleStyles'
import TextBlock from '../blocks/TextBlock'
import ExhibitBlock from '../blocks/ExhibitBlock'

export default function BodySection({
  bodyBlocks,
  exhibitPaths,
  exhibitOptions,
  savingBlocks,
  reassignExhibit,
  refreshAssets,
  copied,
  copy,
  copyRich,
}) {
  return (
    <div>
      <h2 style={sectionTitleStyle}>Body</h2>
      <div style={{ display: 'grid', gap: '8px' }}>
        {bodyBlocks?.map((block, blockIdx) => {
          if (block.type === 'text') {
            return (
              <TextBlock
                key={blockIdx}
                block={block}
                blockIdx={blockIdx}
                copied={copied}
                copy={copy}
                copyRich={copyRich}
              />
            )
          }
          if (block.type === 'exhibit') {
            return (
              <ExhibitBlock
                key={blockIdx}
                block={block}
                blockIdx={blockIdx}
                exhibitPaths={exhibitPaths}
                exhibitOptions={exhibitOptions}
                savingBlocks={savingBlocks}
                reassignExhibit={reassignExhibit}
                refreshAssets={refreshAssets}
                copied={copied}
                copy={copy}
                copyRich={copyRich}
              />
            )
          }
          return null
        })}
      </div>
    </div>
  )
}
