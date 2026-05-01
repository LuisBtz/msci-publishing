// ─── Enums ─────────────────────────────────────────────────────────────────

export type ArticleType = 'blog-post' | 'paper' | 'quick-take' | 'podcast'
export type ArticleStatus = 'in-progress' | 'in-review' | 'approved' | 'published'

// ─── Authors ────────────────────────────────────────────────────────────────

export interface RawAuthor {
  name: string
}

export interface Author {
  name: string
  slug: string
  content_fragment_path: string
  contributor_url: string
  found: string | null
}

// ─── Body blocks ────────────────────────────────────────────────────────────

export interface TextBlock {
  type: 'text'
  html: string
}

export interface ExhibitBlock {
  type: 'exhibit'
  sharepoint_index: number
  sharepoint_data?: ExhibitItem | null
  exhibit_type?: 'static' | 'interactive'
}

export type BodyBlock = TextBlock | ExhibitBlock

// ─── Exhibits ───────────────────────────────────────────────────────────────

export interface ExhibitFileInfo {
  filename: string
  itemId: string
  downloadUrl: string | null
}

export interface StaticExhibitItem {
  order: number
  type: 'static'
  base_name: string
  desktop?: ExhibitFileInfo
  mobile?: ExhibitFileInfo
}

export interface InteractiveExhibitItem {
  order: number
  type: 'interactive'
  base_name: string
  json?: ExhibitFileInfo
  html?: ExhibitFileInfo
}

export type ExhibitItem = StaticExhibitItem | InteractiveExhibitItem

export interface StaticExhibitSummary {
  index: number
  order: number
  type: 'static'
  base_name: string
  desktop_filename: string | null
  mobile_filename: string | null
}

export interface InteractiveExhibitSummary {
  index: number
  order: number
  type: 'interactive'
  base_name: string
  json_filename: string | null
  html_filename: string | null
}

export type ExhibitSummary = StaticExhibitSummary | InteractiveExhibitSummary

export interface ExhibitPaths {
  items: ExhibitItem[]
  statics: StaticExhibitItem[]
  interactives: InteractiveExhibitItem[]
  summary: ExhibitSummary[]
}

// ─── Banners ────────────────────────────────────────────────────────────────

export interface BannerFileInfo {
  filename: string
  itemId: string
  downloadUrl: string | null
}

export type BannerPaths = Record<string, BannerFileInfo | null | undefined>

// ─── Related resources ──────────────────────────────────────────────────────

export interface RelatedResource {
  url: string
  original_url?: string
  aem_path?: string
  title?: string
  meta_description?: string
}

// ─── Tags ───────────────────────────────────────────────────────────────────

export interface Tags {
  all_tags: string[]
}

// ─── Article (Supabase record) ──────────────────────────────────────────────

export interface Article {
  id: string
  type: ArticleType
  status: ArticleStatus
  headline: string
  slug: string
  final_url: string
  meta_description: string
  read_time: string
  publish_date: string | null
  authors: Author[]
  bullets: string[]
  body_blocks: BodyBlock[]
  footnotes: string[]
  tags: Tags
  related_resources: RelatedResource[]
  sharepoint_folder_url: string | null
  banner_paths: BannerPaths
  exhibit_paths: ExhibitPaths | null
  _body_hash: string | null
  export_json: Record<string, unknown>
  created_at: string
  updated_at: string
}

// ─── UI helpers ─────────────────────────────────────────────────────────────

export interface ExhibitOption {
  value: number
  label: string
}

export interface ParsedExhibitFilename {
  order: number
  kind: 'desktop' | 'mobile' | 'json' | 'html'
  baseName: string
  ext: string
}

// ─── SharePoint Graph API ────────────────────────────────────────────────────

export interface GraphFile {
  id: string
  name: string
  '@microsoft.graph.downloadUrl'?: string
  folder?: Record<string, unknown>
  lastModifiedDateTime?: string
}

// ─── AEM label/color maps ────────────────────────────────────────────────────

export interface ColorToken {
  bg: string
  fg: string
}
