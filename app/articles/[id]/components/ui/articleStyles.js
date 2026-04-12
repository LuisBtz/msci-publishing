/**
 * Shared inline-style constants for the article editor UI
 *
 * These values were previously sprinkled as local variables inside
 * page.js. Centralizing them here keeps the label/section heading look
 * identical across MetadataTab, ContentTab and the various Row/Section
 * primitives without repeating the same object literal.
 */

export const labelStyle = {
  fontSize: '0.72rem',
  fontWeight: '700',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#999',
}

export const sectionTitleStyle = {
  fontSize: '0.7rem',
  fontWeight: '700',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#999',
  marginBottom: '0.5rem',
  marginTop: 0,
}
