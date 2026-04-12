# Article Editor (`/articles/[id]`)

Single-article editor view. `page.js` is a thin orchestrator that composes sub-components and hooks.

```
page.js                 → layout + state (useArticleData, useAEMScripts)
hooks/                  → data fetching, AEM script generation
components/
  ArticleTopbar.js      → top navigation bar with badges
  ArticleSidebar.js     → right sidebar with publish actions
  ArticleTabs.js        → Metadata / Content tab switcher
  ScriptModal.js        → dark modal for AEM scripts
  ExhibitAsset.js       → static/interactive exhibit wrapper
  TabPreview.js         → MSCI-styled HTML preview
  tabs/                 → MetadataTab, ContentTab
  sections/             → individual content sections
  blocks/               → TextBlock, ExhibitBlock
  ui/                   → pure visual components (Section, CopyBtn, etc.)
  exhibit/              → VegaChart, ExpiredPlaceholder, vegaLoader
  preview/              → PreviewStyles (MSCI design tokens for preview)
```
