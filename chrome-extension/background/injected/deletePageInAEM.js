/**
 * deletePageInAEM (INJECTED)
 *
 * Deletes an AEM page via the wcmcommand servlet. Used when the user
 * chooses to overwrite an existing page during the automated process.
 *
 * SELF-CONTAINED: serialized into the page via chrome.scripting.
 */
export async function deletePageInAEM(pagePath) {
    const logs = [];
    const log = (m) => logs.push({ type: 'log', message: m });
    const logErr = (m) => logs.push({ type: 'error', message: m });
    try {
        log('Fetching CSRF token...');
        const token = (await fetch('/libs/granite/csrf/token.json').then((r) => r.json())).token;
        if (!token)
            throw new Error('Could not get CSRF token');
        log(`Deleting page: ${pagePath}`);
        const res = await fetch('/bin/wcmcommand', {
            method: 'POST',
            headers: {
                'CSRF-Token': token,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                cmd: 'deletePage',
                path: pagePath,
                force: 'true',
            }).toString(),
        });
        if (res.ok) {
            log('Page deleted successfully');
            return { success: true, logs };
        }
        else {
            logErr(`Failed to delete page: HTTP ${res.status}`);
            return { success: false, logs, error: `HTTP ${res.status}` };
        }
    }
    catch (err) {
        logErr('Fatal error: ' + err.message);
        return { success: false, logs, error: err.message };
    }
}
