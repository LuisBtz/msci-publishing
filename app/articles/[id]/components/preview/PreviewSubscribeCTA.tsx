'use client'
/**
 * PreviewSubscribeCTA
 *
 * Static "Subscribe today" marketing card in the preview. Reproduces
 * the msci.com CTA block — input and button are disabled, this is
 * only here so editors can judge surrounding spacing in context.
 */
import { t } from '@/lib/msci/styleTokens'
import { type } from '@/lib/msci/typography'

export default function PreviewSubscribeCTA() {
  return (
    <div
      style={{
        backgroundColor: t.brandblue700,
        color: t.white,
        borderRadius: '18px',
        padding: '70px',
        marginBottom: '70px',
      }}
    >
      <div style={{ ...type.h1, color: t.brandblue300 }}>Subscribe</div>
      <div style={{ ...type.h1, color: t.white, marginBottom: '40px' }}>today.</div>
      <p
        style={{
          ...type.bodyArticle,
          color: t.white,
          marginBottom: '32px',
          maxWidth: '600px',
        }}
      >
        Join thousands of investment professionals who receive our research and insights.
      </p>
      <div style={{ display: 'flex', gap: '12px', maxWidth: '600px' }}>
        <input
          placeholder="Enter your email"
          disabled
          style={{
            flex: 1,
            height: '60px',
            borderRadius: '999px',
            border: 'none',
            backgroundColor: t.brandblue100,
            padding: '0 24px',
            fontFamily: t.font,
            fontSize: '16px',
            color: t.black,
          }}
        />
        <button
          style={{
            height: '60px',
            padding: '0 32px',
            borderRadius: '999px',
            border: 'none',
            backgroundColor: t.brandturquoise700,
            color: t.black,
            fontFamily: t.font,
            fontSize: '16px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Subscribe
        </button>
      </div>
    </div>
  )
}
