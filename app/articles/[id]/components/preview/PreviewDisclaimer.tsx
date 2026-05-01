'use client'
/**
 * PreviewDisclaimer
 *
 * Fixed legal boilerplate shown under every article preview. The copy
 * is hard-coded because it does not vary per article on msci.com. If
 * legal updates the wording, edit it here.
 */
import { t } from '@/lib/msci/styleTokens'
import { type } from '@/lib/msci/typography'

export default function PreviewDisclaimer() {
  return (
    <div
      style={{
        borderTop: `1px solid ${t.gray300}`,
        paddingTop: '40px',
        marginBottom: '70px',
      }}
    >
      <p style={{ ...type.caption, color: t.gray700, margin: 0 }}>
        The content of this page is for informational purposes only and is intended for
        institutional professionals with the analytical resources and tools necessary to
        interpret any performance information. Nothing herein is intended to recommend any
        product, tool or service. For all references to laws, rules or regulations, please
        note that the information is provided &quot;as is&quot; and does not constitute legal
        advice or any binding interpretation. Any approach to comply with regulatory or
        policy initiatives should be discussed with your own legal counsel and/or the
        relevant competent authority, as needed.
      </p>
    </div>
  )
}
