/**
 * getAssets
 *
 * Flattens the article's SharePoint exhibit_paths + banner_paths
 * into the flat { url, filename } arrays that the AEM publishing
 * injected function expects. Supports both the current items[] model
 * and the legacy statics/interactives shape. Filters banners to .webp
 * only (the other sizes are aliases that AEM derives from the 1x1 hero).
 */
export function getAssets(article) {
    const exhibitPaths = article.exhibit_paths || null;
    const exhibitAssets = [];
    if (exhibitPaths) {
        // Prefer items[] (current authoritative model)
        if (Array.isArray(exhibitPaths.items) && exhibitPaths.items.length > 0) {
            for (const item of exhibitPaths.items) {
                if (item.type === 'static') {
                    if (item.desktop?.downloadUrl)
                        exhibitAssets.push({ url: item.desktop.downloadUrl, filename: item.desktop.filename });
                    if (item.mobile?.downloadUrl)
                        exhibitAssets.push({ url: item.mobile.downloadUrl, filename: item.mobile.filename });
                }
                else if (item.type === 'interactive') {
                    if (item.json?.downloadUrl)
                        exhibitAssets.push({ url: item.json.downloadUrl, filename: item.json.filename });
                }
            }
        }
        else {
            // Legacy fallback: statics[] / interactives[]
            const { statics = [], interactives = [] } = exhibitPaths;
            statics.forEach((e) => {
                if (e.desktop?.downloadUrl)
                    exhibitAssets.push({ url: e.desktop.downloadUrl, filename: e.desktop.filename });
                if (e.mobile?.downloadUrl)
                    exhibitAssets.push({ url: e.mobile.downloadUrl, filename: e.mobile.filename });
            });
            interactives.forEach((e) => {
                if (e.json?.downloadUrl)
                    exhibitAssets.push({ url: e.json.downloadUrl, filename: e.json.filename });
            });
        }
    }
    const bannerAssets = [];
    if (article.banner_paths) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;
        Object.values(article.banner_paths).forEach((b) => {
            if (b?.downloadUrl && b?.filename?.endsWith('.webp'))
                bannerAssets.push({ url: b.downloadUrl, filename: b.filename });
        });
    }
    return { exhibitAssets, bannerAssets };
}
