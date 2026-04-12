'use client'
/**
 * ContentTab
 *
 * Composition of the content-related sections: key findings, body
 * blocks, footnotes, and related content. Renders inside ArticlePage
 * when the user selects the "Content" tab. Pure layout; all data and
 * handlers come from the page-level orchestrator.
 */
import KeyFindingsSection from '../sections/KeyFindingsSection'
import BodySection from '../sections/BodySection'
import FootnotesSection from '../sections/FootnotesSection'
import RelatedContentSection from '../sections/RelatedContentSection'

export default function ContentTab({
  article,
  exhibitOptions,
  savingBlocks,
  reassignExhibit,
  refreshAssets,
  copied,
  copy,
  copyRich,
}) {
  return (
    <>
      <KeyFindingsSection
        bullets={article.bullets}
        copied={copied}
        copy={copy}
        copyRich={copyRich}
      />
      <BodySection
        bodyBlocks={article.body_blocks}
        exhibitPaths={article.exhibit_paths || null}
        exhibitOptions={exhibitOptions}
        savingBlocks={savingBlocks}
        reassignExhibit={reassignExhibit}
        refreshAssets={refreshAssets}
        copied={copied}
        copy={copy}
        copyRich={copyRich}
      />
      <FootnotesSection
        footnotes={article.footnotes}
        copied={copied}
        copy={copy}
        copyRich={copyRich}
      />
      <RelatedContentSection article={article} copied={copied} copy={copy} />
    </>
  )
}
