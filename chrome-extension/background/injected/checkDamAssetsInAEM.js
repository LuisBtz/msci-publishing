/**
 * checkDamAssetsInAEM (INJECTED)
 *
 * Quick existence check for an article's DAM folder. Returns whether
 * the /content/dam/.../blog-post/<slug> folder exists and how many
 * assets live under its exhibits/ and banners/ subfolders. Used by
 * the side panel after step 1 to decide whether step 2 (publish
 * assets) can be skipped.
 *
 * SELF-CONTAINED: serialized via chrome.scripting.
 */
export async function checkDamAssetsInAEM(slug) {
    try {
        const damBase = '/content/dam/web/msci-com/research-and-insights/blog-post';
        const folderPath = `${damBase}/${slug}`;
        const res = await fetch(`${folderPath}.1.json`, { headers: { Accept: 'application/json' } });
        if (res.status === 404) {
            return { success: true, exists: false, folderPath };
        }
        if (!res.ok) {
            return { success: false, error: 'HTTP ' + res.status, folderPath };
        }
        const data = await res.json();
        function countAssets(node) {
            if (!node || typeof node !== 'object')
                return 0;
            return Object.keys(node).filter((k) => !k.startsWith('jcr:') && !k.startsWith(':')).length;
        }
        const hasExhibitsFolder = !!data.exhibits;
        const hasBannersFolder = !!data.banners;
        let exhibitsCount = 0;
        let bannersCount = 0;
        if (hasExhibitsFolder) {
            try {
                const er = await fetch(`${folderPath}/exhibits.1.json`);
                if (er.ok)
                    exhibitsCount = countAssets(await er.json());
            }
            catch (e) { }
        }
        if (hasBannersFolder) {
            try {
                const br = await fetch(`${folderPath}/banners.1.json`);
                if (br.ok)
                    bannersCount = countAssets(await br.json());
            }
            catch (e) { }
        }
        return {
            success: true,
            exists: hasExhibitsFolder && hasBannersFolder && exhibitsCount + bannersCount > 0,
            hasExhibitsFolder,
            hasBannersFolder,
            exhibitsCount,
            bannersCount,
            folderPath,
        };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
}
