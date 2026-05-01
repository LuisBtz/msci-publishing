import type { ArticleType, ArticleStatus, ColorToken } from '@/types'

export const TYPE_LABELS: Record<ArticleType, string> = {
  'blog-post': 'Blog Post',
  'paper': 'Paper',
  'quick-take': 'Quick Take',
  'podcast': 'Podcast',
}

export const TYPE_COLORS: Record<ArticleType, ColorToken> = {
  'blog-post': { bg: '#eef2ff', fg: '#4338ca' },
  'paper': { bg: '#ecfdf5', fg: '#047857' },
  'quick-take': { bg: '#fff7ed', fg: '#c2410c' },
  'podcast': { bg: '#fef2f2', fg: '#b91c1c' },
}

export const STATUS_LABELS: Record<ArticleStatus, string> = {
  'in-progress': 'In Progress',
  'in-review': 'In Review',
  'approved': 'Approved',
  'published': 'Published',
}

export const STATUS_COLORS: Record<ArticleStatus, ColorToken> = {
  'in-progress': { bg: '#fef3c7', fg: '#92400e' },
  'in-review': { bg: '#dbeafe', fg: '#1e40af' },
  'approved': { bg: '#dcfce7', fg: '#166534' },
  'published': { bg: '#f3f4f6', fg: '#374151' },
}
