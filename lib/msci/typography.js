/**
 * MSCI typography tokens
 *
 * Typography scale extracted from real computed styles on msci.com and
 * consumed by the in-app preview (TabPreview). Each entry is a CSS-in-JS
 * style object suitable for `<element style={...}>`. The font family
 * reference points at the design tokens defined in styleTokens.js.
 */

import { t } from './styleTokens'

export const type = {
  h1: {
    fontFamily: t.font, fontSize: '64px', lineHeight: '70.4px',
    fontWeight: 600, letterSpacing: '-3.84px', margin: 0,
  },
  h2: {
    fontFamily: t.font, fontSize: '42px', lineHeight: '50.4px',
    fontWeight: 600, letterSpacing: '-2.1px', margin: 0,
  },
  h3: {
    fontFamily: t.font, fontSize: '32px', lineHeight: '41.6px',
    fontWeight: 600, letterSpacing: '-1.28px', margin: 0,
  },
  h4: {
    fontFamily: t.font, fontSize: '28px', lineHeight: '36.4px',
    fontWeight: 400, letterSpacing: '-0.84px', margin: 0,
  },
  bodyArticle: {
    fontFamily: t.font, fontSize: '20px', lineHeight: '32px',
    fontWeight: 400, letterSpacing: '-0.4px', color: t.black,
  },
  bodyS: {
    fontFamily: t.font, fontSize: '16px', lineHeight: '24px',
    fontWeight: 400, letterSpacing: '-0.32px', color: t.black,
  },
  caption: {
    fontFamily: t.font, fontSize: '14px', lineHeight: '21px',
    fontWeight: 400, letterSpacing: '-0.28px', color: t.black,
  },
}
