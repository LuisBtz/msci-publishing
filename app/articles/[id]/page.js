'use client'
/**
 * ArticlePage
 *
 * Editor view for a single article. Loads the record from Supabase,
 * renders the Metadata / Content tabs, and exposes all publishing
 * actions in the right-hand sidebar. This file is intentionally a
 * thin orchestrator:
 *
 *   - useArticleData  → data fetch + writes (Supabase, SharePoint APIs)
 *   - useAEMScripts   → AEM DevTools script generation + modal state
 *   - useCopy         → clipboard helpers with transient copied flags
 *
 * All visual pieces live under ./components and are composed here.
 */
import { useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { useCopy } from '@/lib/hooks/useCopy'
import { useArticleData } from './hooks/useArticleData'
import { useAEMScripts } from './hooks/useAEMScripts'
import ArticleTopbar from './components/ArticleTopbar'
import ArticleSidebar from './components/ArticleSidebar'
import ArticleTabs from './components/ArticleTabs'
import MetadataTab from './components/tabs/MetadataTab'
import ContentTab from './components/tabs/ContentTab'
import ReportTab from './components/tabs/ReportTab'
import ScriptModal from './components/ScriptModal'

const layoutStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 220px',
  minHeight: 'calc(100vh - 52px)',
  alignItems: 'start',
  maxWidth: '1400px',
  margin: '0 auto',
}

const mainStyle = {
  padding: '1.5rem 2rem',
  display: 'grid',
  gap: '1rem',
  minWidth: 0,
}

export default function ArticlePage() {
  const { user, loading: authLoading } = useAuth()
  const { id } = useParams()
  const [activeTab, setActiveTab] = useState('metadata')
  const { copied, copy, copyRich } = useCopy()

  const {
    article,
    setArticle,
    loading: loadingArticle,
    error,
    refreshing,
    refreshError,
    rescanning,
    rescanError,
    rescanMsg,
    savingBlocks,
    reprocessing,
    reprocessError,
    reprocessMsg,
    refreshAssets,
    rescanExhibits,
    reprocessDocument,
    reassignExhibit,
  } = useArticleData(id, user)

  const scripts = useAEMScripts()

  const previewUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/preview/${id}`
      : `/preview/${id}`

  const exhibitOptions = useMemo(() => {
    const exhibitPaths = article?.exhibit_paths
    if (!exhibitPaths) return []
    return (exhibitPaths.items || exhibitPaths.summary || []).map((e, i) => {
      const order = e.order != null ? `#${e.order} ` : ''
      if (e.type === 'static') {
        const filename = e.desktop_filename || e.desktop?.filename || ''
        return { value: i, label: `${order}[Static] ${e.base_name} (${filename})` }
      }
      const filename = e.json_filename || e.json?.filename || ''
      return { value: i, label: `${order}[Interactive] ${e.base_name} (${filename})` }
    })
  }, [article?.exhibit_paths])

  const exportData = useMemo(() => {
    if (!article) return null
    const wordTags = article.tags?.all_tags || []
    return {
      meta: {
        exported_at: new Date().toISOString(),
        platform_version: '1.0',
        article_id: id,
      },
      type: article.type,
      status: article.status,
      headline: article.headline,
      slug: article.slug,
      final_url: article.final_url,
      meta_description: article.meta_description,
      read_time: article.read_time,
      publish_date: article.publish_date,
      authors: article.authors,
      bullets: article.bullets,
      body_blocks: article.body_blocks,
      footnotes: article.footnotes,
      tags: wordTags,
      related_resources: article.related_resources,
      assets: { banners: article.banner_paths || {}, exhibits: article.exhibit_paths || null },
      sharepoint_folder: article.sharepoint_folder_url,
    }
  }, [article, id])

  if (authLoading || loadingArticle) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
        }}
      >
        <p style={{ color: '#999' }}>Cargando...</p>
      </div>
    )
  }
  if (error) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
        }}
      >
        <p style={{ color: '#cc0000' }}>{error}</p>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: 'sans-serif', minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <ArticleTopbar article={article} />

      <div style={layoutStyle}>
        <div style={mainStyle}>
          <ArticleTabs active={activeTab} onChange={setActiveTab} />

          {activeTab === 'metadata' && (
            <MetadataTab article={article} copied={copied} copy={copy} />
          )}

          {activeTab === 'content' && (
            <ContentTab
              article={article}
              exhibitOptions={exhibitOptions}
              savingBlocks={savingBlocks}
              reassignExhibit={reassignExhibit}
              refreshAssets={refreshAssets}
              copied={copied}
              copy={copy}
              copyRich={copyRich}
            />
          )}

          {activeTab === 'report' && <ReportTab article={article} />}
        </div>

        <ArticleSidebar
          article={article}
          setArticle={setArticle}
          id={id}
          previewUrl={previewUrl}
          exportData={exportData}
          refreshing={refreshing}
          refreshError={refreshError}
          rescanning={rescanning}
          rescanError={rescanError}
          rescanMsg={rescanMsg}
          reprocessing={reprocessing}
          reprocessError={reprocessError}
          reprocessMsg={reprocessMsg}
          onPublishAssets={() => scripts.showPublishScript(article)}
          onCreatePage={() => scripts.showCreatePageScript(article)}
          onRefreshAssets={refreshAssets}
          onRescanExhibits={rescanExhibits}
          onReprocessDocument={reprocessDocument}
        />
      </div>

      <ScriptModal
        open={scripts.open}
        script={scripts.script}
        label={scripts.label}
        onClose={scripts.close}
        copied={copied}
        copy={copy}
      />
    </div>
  )
}
