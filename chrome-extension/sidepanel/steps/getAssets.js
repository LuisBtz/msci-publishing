/**
 * getAssets
 *
 * Flattens the article's SharePoint exhibit_paths + banner_paths
 * into the flat { url, filename } arrays that the AEM publishing
 * injected function expects. Filters banners to .webp only (the
 * other sizes are aliases that AEM derives from the 1x1 hero).
 */
export function getAssets(article) {
  const exhibitPaths = article.exhibit_paths || null
  const exhibitAssets = []
  if (exhibitPaths) {
    const { statics = [], interactives = [] } = exhibitPaths
    statics.forEach((e) => {
      if (e.desktop?.downloadUrl)
        exhibitAssets.push({ url: e.desktop.downloadUrl, filename: e.desktop.filename })
      if (e.mobile?.downloadUrl)
        exhibitAssets.push({ url: e.mobile.downloadUrl, filename: e.mobile.filename })
    })
    interactives.forEach((e) => {
      if (e.json?.downloadUrl)
        exhibitAssets.push({ url: e.json.downloadUrl, filename: e.json.filename })
    })
  }
  const bannerAssets = []
  if (article.banner_paths) {
    Object.values(article.banner_paths).forEach((b) => {
      if (b?.downloadUrl && b?.filename?.endsWith('.webp'))
        bannerAssets.push({ url: b.downloadUrl, filename: b.filename })
    })
  }
  return { exhibitAssets, bannerAssets }
}
