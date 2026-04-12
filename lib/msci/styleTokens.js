/**
 * MSCI style tokens
 *
 * Typography and color values extracted from the real computed styles on
 * msci.com. Two token buckets live here:
 *
 *   MSCI_STYLES  — the inlineable map used when we write HTML into AEM
 *                  rich-text editors (AEM strips unknown classes so we
 *                  must inline every property). Consumed by lib/msci/htmlBuilders.
 *
 *   t            — the design-token object used by the in-app preview
 *                  (TabPreview) to render the article 1:1 with msci.com.
 *
 * Keep them in sync whenever MSCI updates their site styles.
 */

// --- Inlineable styles for AEM RTE paste ------------------------------------
export const MSCI_STYLES = {
  bodyArticle: {
    'font-size': '20px',
    'line-height': '32px',
    'font-weight': '400',
    'font-family': "'Noto Sans', sans-serif",
    'color': '#1a1a1a',
  },
  headline2: {
    'font-size': '28px',
    'line-height': '36px',
    'font-weight': '600',
    'font-family': "'Noto Sans', sans-serif",
    'color': '#1a1a1a',
  },
  headline3: {
    'font-size': '22px',
    'line-height': '30px',
    'font-weight': '600',
    'font-family': "'Noto Sans', sans-serif",
    'color': '#1a1a1a',
  },
  caption: {
    'font-size': '14px',
    'line-height': '22px',
    'font-weight': '400',
    'font-family': "'Noto Sans', sans-serif",
    'color': '#555555',
  },
  footnote: {
    'font-size': '14px',
    'line-height': '20px',
    'font-weight': '400',
    'font-family': "'Noto Sans', sans-serif",
    'color': '#555555',
  },
  bulletItem: {
    'font-size': '20px',
    'line-height': '32px',
    'font-weight': '400',
    'font-family': "'Noto Sans', sans-serif",
    'color': '#1a1a1a',
  },
  sup: {
    'font-size': '0.7em',
    'color': '#c8102e',
    'font-weight': '600',
    'vertical-align': 'super',
    'line-height': '0',
  },
  link: {
    'color': '#c8102e',
    'text-decoration': 'underline',
  },
}

// --- In-app preview design tokens -------------------------------------------
// Mirrors the real computed styles from msci.com (colors, layout, font).
export const t = {
  // Colors
  brandblue700: 'rgb(26, 63, 214)',
  brandblue300: 'rgb(174, 186, 240)',
  brandblue100: 'rgb(244, 245, 253)',
  brandturquoise700: 'rgb(0, 196, 179)',
  black: 'rgb(0, 0, 0)',
  white: 'rgb(255, 255, 255)',
  gray50: 'rgb(245, 245, 245)',
  gray300: 'rgb(204, 204, 204)',
  gray700: 'rgb(112, 112, 112)',
  // Layout
  maxW: '1440px',
  padX: '70px', // lg:ms-mx-17-5
  // Font
  font: 'var(--font-inter), Inter, Arial, sans-serif',
}
