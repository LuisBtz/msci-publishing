'use client'
/**
 * TabPreview
 *
 * Shell that composes the msci.com article preview from its per-section
 * sub-components (navbar, hero, key findings, body blocks, authors,
 * subscribe CTA, related content, footnotes, disclaimer, footer).
 *
 * All design tokens and typography live in lib/msci/; exhibit
 * resolution lives in lib/exhibits/resolveExhibit. This file exists
 * only to lay out the big-picture structure of a published page.
 */
import { t } from '@/lib/msci/styleTokens'
import PreviewNavbar from './preview/PreviewNavbar'
import PreviewHero from './preview/PreviewHero'
import PreviewKeyFindings from './preview/PreviewKeyFindings'
import PreviewBodyBlocks from './preview/PreviewBodyBlocks'
import PreviewAuthors from './preview/PreviewAuthors'
import PreviewSubscribeCTA from './preview/PreviewSubscribeCTA'
import PreviewRelated from './preview/PreviewRelated'
import PreviewFootnotes from './preview/PreviewFootnotes'
import PreviewDisclaimer from './preview/PreviewDisclaimer'
import PreviewFooter from './preview/PreviewFooter'

export default function TabPreview({ article }) {
  const exhibitPaths = article.exhibit_paths || null

  return (
    <div style={{ backgroundColor: t.white, fontFamily: t.font, color: t.black }}>
      <PreviewNavbar />
      <PreviewHero article={article} />

      <section style={{ backgroundColor: t.white }}>
        <div
          style={{
            maxWidth: t.maxW,
            margin: '0 auto',
            padding: `70px ${t.padX} 40px`,
          }}
        >
          <PreviewKeyFindings bullets={article.bullets} />
          <PreviewBodyBlocks bodyBlocks={article.body_blocks} exhibitPaths={exhibitPaths} />
          <PreviewAuthors authors={article.authors} />
          <PreviewSubscribeCTA />
          <PreviewRelated resources={article.related_resources} />
          <PreviewFootnotes footnotes={article.footnotes} />
          <PreviewDisclaimer />
        </div>
      </section>

      <PreviewFooter />
    </div>
  )
}
