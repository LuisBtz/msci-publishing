'use client'
/**
 * PreviewFooter
 *
 * Static mock of the msci.com global footer — logo, legal-links grid,
 * and copyright line. Purely visual; none of the links are real.
 */
import { t } from '@/lib/msci/styleTokens'
import { type } from '@/lib/msci/typography'

const FOOTER_LINKS = [
  'Terms of use',
  'Contact us',
  'Privacy notice',
  'Office locations',
  'Legal',
  'Index regulation',
  'Modern Slavery Statement',
  'Resources for issuers',
  'Manage cookies',
  'Use of ISO standards',
]

export default function PreviewFooter() {
  return (
    <footer style={{ backgroundColor: t.black, color: t.white }}>
      <div
        style={{
          maxWidth: t.maxW,
          margin: '0 auto',
          padding: `70px ${t.padX}`,
        }}
      >
        <div style={{ marginBottom: '40px' }}>
          <img
            src="/msci-logo_with_title_white2.svg"
            alt="MSCI"
            style={{ height: '32px', width: 'auto', display: 'block' }}
          />
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '16px 32px',
            marginBottom: '40px',
          }}
        >
          {FOOTER_LINKS.map((item) => (
            <span
              key={item}
              style={{ ...type.bodyS, color: t.white, cursor: 'pointer' }}
            >
              {item}
            </span>
          ))}
        </div>
        <div
          style={{
            borderTop: `1px solid ${t.gray700}`,
            paddingTop: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ ...type.caption, color: t.gray300 }}>
            © 2026 MSCI Inc. All rights reserved.
          </span>
        </div>
      </div>
    </footer>
  )
}
