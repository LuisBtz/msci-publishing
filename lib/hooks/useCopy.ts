'use client'
import { useState } from 'react'
import { stripHtml } from '@/lib/utils/stripHtml'

export function useCopy() {
  const [copied, setCopied] = useState<Record<string, boolean>>({})

  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text || '')
    setCopied(prev => ({ ...prev, [key]: true }))
    setTimeout(() => setCopied(prev => ({ ...prev, [key]: false })), 2000)
  }

  const copyRich = async (key: string, html: string) => {
    try {
      const blob = new Blob([html], { type: 'text/html' })
      const textBlob = new Blob([stripHtml(html)], { type: 'text/plain' })
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': blob,
          'text/plain': textBlob,
        })
      ])
    } catch {
      // Fallback: select + execCommand('copy') on a detached element.
      const el = document.createElement('div')
      el.innerHTML = html
      el.style.position = 'fixed'
      el.style.left = '-9999px'
      el.style.opacity = '0'
      document.body.appendChild(el)
      const range = document.createRange()
      range.selectNodeContents(el)
      const sel = window.getSelection()!
      sel.removeAllRanges()
      sel.addRange(range)
      document.execCommand('copy')
      sel.removeAllRanges()
      document.body.removeChild(el)
    }
    setCopied(prev => ({ ...prev, [key]: true }))
    setTimeout(() => setCopied(prev => ({ ...prev, [key]: false })), 2000)
  }

  return { copied, copy, copyRich }
}
