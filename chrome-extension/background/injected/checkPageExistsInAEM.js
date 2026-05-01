/**
 * checkPageExistsInAEM (INJECTED)
 *
 * Probes /content/msci/.../blog-post/<slug>/jcr:content.json to tell
 * the side panel whether the page already exists on AEM Author.
 * When it does, also returns the current title + template so the
 * side panel can show a reassuring "already created" indicator
 * instead of asking the user to re-run step 3.
 *
 * SELF-CONTAINED.
 */
export async function checkPageExistsInAEM(slug) {
    try {
        const parentPath = '/content/msci/us/en/research-and-insights/blog-post';
        const pagePath = `${parentPath}/${slug}`;
        const res = await fetch(`${pagePath}/jcr:content.json`, {
            headers: { Accept: 'application/json' },
        });
        if (res.status === 404) {
            return { success: true, exists: false, pagePath };
        }
        if (!res.ok) {
            return { success: false, error: 'HTTP ' + res.status, pagePath };
        }
        const data = await res.json();
        return {
            success: true,
            exists: true,
            title: data['jcr:title'] || '',
            template: data['cq:template'] || '',
            pagePath,
        };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
}
