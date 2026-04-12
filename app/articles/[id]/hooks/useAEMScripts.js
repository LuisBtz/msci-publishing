'use client'
/**
 * useAEMScripts
 *
 * Stateful wrapper over the two pure AEM script builders
 * (buildPublishAssetsScript, buildCreatePageScript). Owns the modal
 * state — which script is currently showing, its label, and whether
 * the modal is open — so the article page only needs to call
 * `showPublishScript(article)` / `showCreatePageScript(article)` and
 * render `<ScriptModal {...scripts} />`.
 */
import { useState } from 'react'
import { buildPublishAssetsScript } from '@/lib/aem/scripts/buildPublishAssetsScript'
import { buildCreatePageScript } from '@/lib/aem/scripts/buildCreatePageScript'

export function useAEMScripts() {
  const [script, setScript] = useState('')
  const [label, setLabel] = useState('AEM Publish Script')
  const [open, setOpen] = useState(false)

  const showPublishScript = (article) => {
    setScript(buildPublishAssetsScript(article))
    setLabel('Publish Assets to AEM DAM')
    setOpen(true)
  }

  const showCreatePageScript = (article) => {
    setScript(buildCreatePageScript(article))
    setLabel('AEM Create Page Script')
    setOpen(true)
  }

  const close = () => setOpen(false)

  return { script, label, open, showPublishScript, showCreatePageScript, close }
}
