import type { ArticleType } from '@/types'

const URL_PREFIXES: Record<ArticleType, string> = {
  'blog-post': '/research-and-insights/blog-post/',
  paper: '/research-and-insights/paper/',
  'quick-take': '/research-and-insights/quick-take/',
  podcast: '/research-and-insights/podcast/',
}

export function buildArticleFinalUrl(type: ArticleType | string, slug: string): string {
  const prefix = URL_PREFIXES[type] || URL_PREFIXES['blog-post']
  return `https://www.msci.com${prefix}${slug}`
}
