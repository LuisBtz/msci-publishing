'use client'
/**
 * useArticleCreation
 *
 * Data hook powering the NewArticleModal. Exposes two entry points:
 *
 *   - processWithSharePoint(folderUrl): reads the SharePoint folder,
 *     extracts the .docx + exhibits/banners, parses the document with
 *     Claude (/api/parse/docx), and persists via /api/articles/create.
 *
 *   - processManual(file): same pipeline but without SharePoint; the
 *     caller uploads a .docx directly and exhibit_paths stays empty.
 *
 * Owns the loading state machine (input → processing → done), the
 * current status message, and any error. On success, redirects to
 * the new article after a short delay.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Convert the base64 payload returned by /api/sharepoint/folder into
// a Blob compatible with FormData. Extracted so the flow function
// stays readable.
function base64ToDocxBlob(base64) {
  const binaryStr = atob(base64)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
  return new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}

export function useArticleCreation() {
  const router = useRouter()
  const [step, setStep] = useState('input')
  const [statusMsg, setStatusMsg] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const goDone = (id) => {
    setStep('done')
    setStatusMsg('Article created successfully!')
    setTimeout(() => router.push(`/articles/${id}`), 1500)
  }

  const goError = (err) => {
    setError(err.message)
    setStep('input')
    setLoading(false)
  }

  const processWithSharePoint = async (folderUrl) => {
    setLoading(true)
    setStep('processing')
    setError('')

    try {
      setStatusMsg('Reading SharePoint folder...')
      const spRes = await fetch('/api/sharepoint/folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderUrl }),
      })
      const spData = await spRes.json()
      if (!spRes.ok) throw new Error(spData.error || 'Error al leer SharePoint')

      if (spData.summary) {
        setStatusMsg(
          `SharePoint read — ${spData.summary.statics} statics, ${spData.summary.interactives} interactives found. Analyzing document...`
        )
        await new Promise((r) => setTimeout(r, 800))
      }
      if (!spData.exhibitsFound) {
        setStatusMsg('⚠ No exhibits found — continuing...')
        await new Promise((r) => setTimeout(r, 1000))
      }

      setStatusMsg('Claude is analyzing the document...')
      const formData = new FormData()
      const blob = base64ToDocxBlob(spData.docx.base64)
      formData.append('file', blob, spData.docx.filename)
      formData.append('exhibits', JSON.stringify(spData.exhibits))

      const parseRes = await fetch('/api/parse/docx', { method: 'POST', body: formData })
      const parseData = await parseRes.json()
      if (!parseRes.ok) throw new Error(parseData.error || 'Error al parsear documento')

      setStatusMsg('Saving article...')
      const saveRes = await fetch('/api/articles/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...parseData,
          sharepoint_folder_url: folderUrl,
          banner_paths: spData.banners,
          exhibit_paths: spData.exhibits,
        }),
      })
      const saveData = await saveRes.json()
      if (!saveRes.ok) throw new Error(saveData.error || 'Error al guardar')

      goDone(saveData.id)
    } catch (err) {
      goError(err)
    }
  }

  const processManual = async (file) => {
    if (!file) return
    setLoading(true)
    setStep('processing')
    setError('')

    try {
      setStatusMsg('Claude is analyzing the document...')
      const formData = new FormData()
      formData.append('file', file)

      const parseRes = await fetch('/api/parse/docx', { method: 'POST', body: formData })
      const parseData = await parseRes.json()
      if (!parseRes.ok) throw new Error(parseData.error || 'Error al parsear documento')

      setStatusMsg('Saving article...')
      const saveRes = await fetch('/api/articles/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parseData),
      })
      const saveData = await saveRes.json()
      if (!saveRes.ok) throw new Error(saveData.error || 'Error al guardar')

      goDone(saveData.id)
    } catch (err) {
      goError(err)
    }
  }

  return {
    step,
    statusMsg,
    error,
    loading,
    setError,
    processWithSharePoint,
    processManual,
  }
}
