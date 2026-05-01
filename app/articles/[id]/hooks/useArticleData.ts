'use client'
/**
 * useArticleData
 *
 * Data hook for the single-article editor. Owns all Supabase reads and
 * writes for a given article id: initial fetch, fetching missing meta
 * descriptions for related resources, refreshing SharePoint assets,
 * rescanning the exhibit folder, persisting body_blocks mutations, and
 * reassigning an exhibit block to a different SharePoint index.
 *
 * Returns { article, setArticle, loading, error, refreshing, refreshError,
 * rescanning, rescanError, rescanMsg, savingBlocks, refreshAssets,
 * rescanExhibits, updateBodyBlocks, reassignExhibit }.
 *
 * Side effect: on article load, any related_resources missing a
 * meta_description are back-filled in the background via /api/fetch-meta.
 */
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { getDisplayUrl } from '@/lib/aem/urls'

export function useArticleData(id, user) {
  const [article, setArticle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState('')
  const [rescanning, setRescanning] = useState(false)
  const [rescanError, setRescanError] = useState('')
  const [rescanMsg, setRescanMsg] = useState('')
  const [savingBlocks, setSavingBlocks] = useState(false)
  const [reprocessing, setReprocessing] = useState(false)
  const [reprocessError, setReprocessError] = useState('')
  const [reprocessMsg, setReprocessMsg] = useState('')

  const fetchMissingMetas = async (articleData, indices) => {
    const resources = articleData.related_resources || []
    const updates = await Promise.all(
      indices.map(async (i) => {
        const r = resources[i]
        const url = getDisplayUrl(r.original_url || r.url)
        if (!url) return null
        try {
          const res = await fetch('/api/fetch-meta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls: [url] }),
          })
          const { results } = await res.json()
          const meta = results?.[0]
          if (!meta) return null
          return {
            index: i,
            meta_description: meta.metaDescription || '',
            title: r.title?.trim() ? r.title : meta.title || r.title,
          }
        } catch {
          return null
        }
      })
    )
    const updated = resources.map((r, i) => {
      const update = updates.find((u) => u?.index === i)
      if (!update) return r
      return {
        ...r,
        meta_description: update.meta_description || r.meta_description,
        title: update.title || r.title,
      }
    })
    await supabase.from('articles').update({ related_resources: updated }).eq('id', id)
    setArticle((prev) => ({ ...prev, related_resources: updated }))
  }

  const fetchArticle = async () => {
    const { data, error: fetchErr } = await supabase
      .from('articles')
      .select('*')
      .eq('id', id)
      .single()
    if (fetchErr) {
      setError('Artículo no encontrado')
    } else {
      setArticle(data)
      const missing = (data.related_resources || [])
        .map((r, i) => ({ r, i }))
        .filter(({ r }) => !r.meta_description || r.meta_description.trim() === '')
      if (missing.length > 0) fetchMissingMetas(data, missing.map(({ i }) => i))
    }
    setLoading(false)
  }

  useEffect(() => {
    if (user && id) fetchArticle()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id])

  const updateBodyBlocks = async (mutator) => {
    const next = mutator(article.body_blocks || [])
    setArticle((prev) => ({ ...prev, body_blocks: next }))
    setSavingBlocks(true)
    try {
      await supabase.from('articles').update({ body_blocks: next }).eq('id', id)
    } finally {
      setSavingBlocks(false)
    }
  }

  const reassignExhibit = (blockIdx, newSharepointIdx) =>
    updateBodyBlocks((blocks) =>
      blocks.map((b, i) => {
        if (i !== blockIdx || b.type !== 'exhibit') return b
        return { ...b, sharepoint_index: newSharepointIdx }
      })
    )

  const refreshAssets = async () => {
    setRefreshing(true)
    setRefreshError('')
    try {
      const res = await fetch('/api/sharepoint/refresh-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al refrescar')
      setArticle((prev) => ({
        ...prev,
        exhibit_paths: data.exhibit_paths,
        banner_paths: data.banner_paths,
        body_blocks: data.body_blocks,
      }))
    } catch (err) {
      setRefreshError(err.message)
    }
    setRefreshing(false)
  }

  const rescanExhibits = async () => {
    setRescanning(true)
    setRescanError('')
    setRescanMsg('')
    try {
      const res = await fetch('/api/sharepoint/rescan-exhibits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al re-escanear')
      setArticle((prev) => ({
        ...prev,
        exhibit_paths: data.exhibit_paths,
        banner_paths: data.banner_paths,
        body_blocks: data.body_blocks,
      }))
      setRescanMsg(
        `✓ ${data.summary.total} exhibit(s) (${data.summary.statics} static, ${data.summary.interactives} interactive)`
      )
      setTimeout(() => setRescanMsg(''), 4000)
    } catch (err) {
      setRescanError(err.message)
    }
    setRescanning(false)
  }

  const reprocessDocument = async () => {
    setReprocessing(true)
    setReprocessError('')
    setReprocessMsg('')
    try {
      const res = await fetch('/api/parse/docx/reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al reprocesar')

      // Always reload from Supabase to get the updated data
      const { data: updated } = await supabase
        .from('articles')
        .select('*')
        .eq('id', id)
        .single()
      if (updated) setArticle(updated)

      if (data.changes.has_any_change) {
        setReprocessMsg('✓ Documento reprocesado y actualizado')
      } else {
        setReprocessMsg('✓ Sin cambios — el documento no ha sido modificado')
      }
      setTimeout(() => setReprocessMsg(''), 5000)
    } catch (err) {
      setReprocessError(err.message)
    }
    setReprocessing(false)
  }

  return {
    article,
    setArticle,
    loading,
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
    updateBodyBlocks,
    reassignExhibit,
  }
}
