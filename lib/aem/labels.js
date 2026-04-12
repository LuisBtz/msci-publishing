/**
 * AEM labels + colors
 *
 * Display labels and chip colors for article `type` and `status` enums.
 * Shared by the dashboard table, the article editor header, and the
 * Chrome side panel so naming stays consistent everywhere the user sees
 * an article surface.
 */

export const TYPE_LABELS = {
  'blog-post': 'Blog Post',
  'paper': 'Paper',
  'quick-take': 'Quick Take',
  'podcast': 'Podcast',
}

export const TYPE_COLORS = {
  'blog-post': { bg: '#eef2ff', fg: '#4338ca' },
  'paper': { bg: '#ecfdf5', fg: '#047857' },
  'quick-take': { bg: '#fff7ed', fg: '#c2410c' },
  'podcast': { bg: '#fef2f2', fg: '#b91c1c' },
}

export const STATUS_LABELS = {
  'in-progress': 'In Progress',
  'in-review': 'In Review',
  'approved': 'Approved',
  'published': 'Published',
}

export const STATUS_COLORS = {
  'in-progress': { bg: '#fef3c7', fg: '#92400e' },
  'in-review': { bg: '#dbeafe', fg: '#1e40af' },
  'approved': { bg: '#dcfce7', fg: '#166534' },
  'published': { bg: '#f3f4f6', fg: '#374151' },
}
