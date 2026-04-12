'use client'
/**
 * MetadataTab
 *
 * Composition of the three metadata-related sections: core metadata,
 * AEM tags, and authors. Renders inside ArticlePage when the user
 * selects the "Metadata" tab. Pure layout; all data and copy handlers
 * are passed in from the page-level orchestrator.
 */
import MetadataSection from '../sections/MetadataSection'
import TagsSection from '../sections/TagsSection'
import AuthorsSection from '../sections/AuthorsSection'

export default function MetadataTab({ article, copied, copy }) {
  const tags = article.tags?.all_tags || []
  return (
    <>
      <MetadataSection article={article} copied={copied} copy={copy} />
      <TagsSection tags={tags} copied={copied} copy={copy} />
      <AuthorsSection authors={article.authors} copied={copied} copy={copy} />
    </>
  )
}
