/**
 * messageHandlers
 *
 * Maps every runtime message type from the side panel to the
 * corresponding injected-function runner. PING_AEM is special (it
 * only answers whether the active tab is AEM), and
 * INSERT_KEY_FINDINGS has an extra post-step that refreshes the
 * open editor tab so the user sees the new content instantly.
 *
 * Each handler returns true when it intends to call sendResponse
 * asynchronously — matching the chrome.runtime.onMessage contract.
 */
import { getActiveAEMTab, findEditorTabForPage } from './aemTabs.js';
import { runInPage } from './runInPage.js';
import { publishAssetsInAEM } from './injected/publishAssetsInAEM.js';
import { createPageInAEM } from './injected/createPageInAEM.js';
import { checkDamAssetsInAEM } from './injected/checkDamAssetsInAEM.js';
import { checkPageExistsInAEM } from './injected/checkPageExistsInAEM.js';
import { insertKeyFindingsInAEM, refreshEditorFrame } from './injected/insertKeyFindingsInAEM.js';
import { discoverPageStructure } from './injected/discoverPageStructure.js';
import { probeSiblingSchemas } from './injected/probeSiblingSchemas.js';
import { insertBodyContentInAEM } from './injected/insertBodyContentInAEM.js';
import { probeAuthorStructure } from './injected/probeAuthorStructure.js';
import { insertAuthorsInAEM } from './injected/insertAuthorsInAEM.js';
import { probeRelatedContentStructure } from './injected/probeRelatedContentStructure.js';
import { insertRelatedContentInAEM } from './injected/insertRelatedContentInAEM.js';
import { probeFootnotesStructure } from './injected/probeFootnotesStructure.js';
import { insertFootnotesInAEM } from './injected/insertFootnotesInAEM.js';
import { cleanupEmptyContainers } from './injected/cleanupEmptyContainers.js';
import { deletePageInAEM } from './injected/deletePageInAEM.js';
export function handleMessage(message, _sender, sendResponse) {
    if (message.type === 'PING_AEM') {
        ;
        (async () => {
            const tab = await getActiveAEMTab();
            sendResponse({ success: true, connected: !!tab });
        })();
        return true;
    }
    if (message.type === 'PUBLISH_ASSETS') {
        ;
        (async () => {
            const result = await runInPage(publishAssetsInAEM, [
                message.slug,
                message.title,
                message.exhibitAssets,
                message.bannerAssets,
            ]);
            sendResponse(result);
        })();
        return true;
    }
    if (message.type === 'CREATE_PAGE') {
        ;
        (async () => {
            const result = await runInPage(createPageInAEM, [message.params]);
            sendResponse(result);
        })();
        return true;
    }
    if (message.type === 'CHECK_DAM_ASSETS') {
        ;
        (async () => {
            const result = await runInPage(checkDamAssetsInAEM, [message.slug]);
            sendResponse(result);
        })();
        return true;
    }
    if (message.type === 'CHECK_PAGE_EXISTS') {
        ;
        (async () => {
            const result = await runInPage(checkPageExistsInAEM, [message.slug]);
            sendResponse(result);
        })();
        return true;
    }
    if (message.type === 'DISCOVER_PAGE') {
        ;
        (async () => {
            const result = await runInPage(discoverPageStructure, [message.slug]);
            sendResponse(result);
        })();
        return true;
    }
    if (message.type === 'INSERT_BODY_CONTENT') {
        ;
        (async () => {
            const result = await runInPage(insertBodyContentInAEM, [
                message.slug,
                message.bodyBlocks,
            ]);
            // Refresh editor tab if successful
            if (result.success && result.createdPaths?.length) {
                const { tab: editorTab } = await findEditorTabForPage(message.slug);
                if (editorTab) {
                    try {
                        await chrome.scripting.executeScript({
                            target: { tabId: editorTab.id },
                            func: () => location.reload(),
                        });
                        result.logs.push({ type: 'log', message: 'Editor reloaded.' });
                    }
                    catch (e) {
                        result.logs.push({
                            type: 'warn',
                            message: 'Could not reload editor — please refresh manually.',
                        });
                    }
                }
                else {
                    result.logs.push({
                        type: 'warn',
                        message: 'Editor tab not found — open it from the report step.',
                    });
                }
            }
            sendResponse(result);
        })();
        return true;
    }
    if (message.type === 'PROBE_SIBLINGS') {
        ;
        (async () => {
            const result = await runInPage(probeSiblingSchemas, [message.slug]);
            sendResponse(result);
        })();
        return true;
    }
    if (message.type === 'PROBE_AUTHORS') {
        ;
        (async () => {
            const result = await runInPage(probeAuthorStructure, [message.slug]);
            sendResponse(result);
        })();
        return true;
    }
    if (message.type === 'INSERT_AUTHORS') {
        ;
        (async () => {
            const result = await runInPage(insertAuthorsInAEM, [
                message.slug,
                message.authorPaths,
            ]);
            // Refresh editor tab if successful
            if (result.success && result.createdPaths?.length) {
                const { tab: editorTab } = await findEditorTabForPage(message.slug);
                if (editorTab) {
                    try {
                        await chrome.scripting.executeScript({
                            target: { tabId: editorTab.id },
                            func: () => location.reload(),
                        });
                        result.logs.push({ type: 'log', message: 'Editor reloaded.' });
                    }
                    catch (e) {
                        result.logs.push({
                            type: 'warn',
                            message: 'Could not reload editor — please refresh manually.',
                        });
                    }
                }
                else {
                    result.logs.push({
                        type: 'warn',
                        message: 'Editor tab not found — open it from the report step.',
                    });
                }
            }
            sendResponse(result);
        })();
        return true;
    }
    if (message.type === 'PROBE_RELATED_CONTENT') {
        ;
        (async () => {
            const result = await runInPage(probeRelatedContentStructure, [message.slug]);
            sendResponse(result);
        })();
        return true;
    }
    if (message.type === 'INSERT_RELATED_CONTENT') {
        ;
        (async () => {
            const result = await runInPage(insertRelatedContentInAEM, [
                message.slug,
                message.relatedItems,
            ]);
            // Refresh editor tab if successful
            if (result.success && result.updatedPaths?.length) {
                const { tab: editorTab } = await findEditorTabForPage(message.slug);
                if (editorTab) {
                    try {
                        await chrome.scripting.executeScript({
                            target: { tabId: editorTab.id },
                            func: () => location.reload(),
                        });
                        result.logs.push({ type: 'log', message: 'Editor reloaded.' });
                    }
                    catch (e) {
                        result.logs.push({
                            type: 'warn',
                            message: 'Could not reload editor — please refresh manually.',
                        });
                    }
                }
                else {
                    result.logs.push({
                        type: 'warn',
                        message: 'Editor tab not found — open it from the report step.',
                    });
                }
            }
            sendResponse(result);
        })();
        return true;
    }
    if (message.type === 'PROBE_FOOTNOTES') {
        ;
        (async () => {
            const result = await runInPage(probeFootnotesStructure, [message.slug]);
            sendResponse(result);
        })();
        return true;
    }
    if (message.type === 'INSERT_FOOTNOTES') {
        ;
        (async () => {
            const result = await runInPage(insertFootnotesInAEM, [
                message.slug,
                message.footnotes,
            ]);
            // Refresh editor tab if successful
            if (result.success && result.targetPath) {
                const { tab: editorTab } = await findEditorTabForPage(message.slug);
                if (editorTab) {
                    try {
                        await chrome.scripting.executeScript({
                            target: { tabId: editorTab.id },
                            func: () => location.reload(),
                        });
                        result.logs.push({ type: 'log', message: 'Editor reloaded.' });
                    }
                    catch (e) {
                        result.logs.push({
                            type: 'warn',
                            message: 'Could not reload editor — please refresh manually.',
                        });
                    }
                }
                else {
                    result.logs.push({
                        type: 'warn',
                        message: 'Editor tab not found — open it from the report step.',
                    });
                }
            }
            sendResponse(result);
        })();
        return true;
    }
    if (message.type === 'DELETE_PAGE') {
        ;
        (async () => {
            const result = await runInPage(deletePageInAEM, [message.pagePath]);
            sendResponse(result);
        })();
        return true;
    }
    if (message.type === 'CLEANUP_EMPTY_CONTAINERS') {
        ;
        (async () => {
            const result = await runInPage(cleanupEmptyContainers, [message.slug]);
            // Refresh editor tab if successful
            if (result.success && result.deletedCount > 0) {
                const { tab: editorTab } = await findEditorTabForPage(message.slug);
                if (editorTab) {
                    try {
                        await chrome.scripting.executeScript({
                            target: { tabId: editorTab.id },
                            func: () => location.reload(),
                        });
                        result.logs.push({ type: 'log', message: 'Editor reloaded.' });
                    }
                    catch (e) {
                        result.logs.push({
                            type: 'warn',
                            message: 'Could not reload editor — please refresh manually.',
                        });
                    }
                }
            }
            sendResponse(result);
        })();
        return true;
    }
    if (message.type === 'INSERT_KEY_FINDINGS') {
        ;
        (async () => {
            const result = await runInPage(insertKeyFindingsInAEM, [
                message.slug,
                message.html,
                message.textAsJson,
            ]);
            // After writing, refresh the editor tab so the user sees the new
            // content without F5. The editor tab is often separate from the
            // active tab (opened from step 3 with target=_blank), so we scan
            // every window for it and inject into all frames, picking the one
            // that actually has Granite.author.
            if (result.success && result.targetPath) {
                const { tab: editorTab, diag } = await findEditorTabForPage(message.slug);
                console.log('[KeyFindings] tab search', diag);
                if (!editorTab) {
                    result.logs.push({
                        type: 'warn',
                        message: 'Editor tab not found — open the page in AEM editor and try again.',
                    });
                }
                else {
                    try {
                        const injectionResults = await chrome.scripting.executeScript({
                            target: { tabId: editorTab.id, allFrames: true },
                            world: 'MAIN',
                            func: refreshEditorFrame,
                            args: [result.targetPath, message.html],
                        });
                        const chosen = (injectionResults || []).map((i) => i?.result).find((r) => r && r.persistMethod) ||
                            (injectionResults || []).map((i) => i?.result).find((r) => r && r.hasGraniteAuthor) ||
                            (injectionResults || []).map((i) => i?.result).find(Boolean) ||
                            {};
                        console.log('[KeyFindings] refresh result', chosen, 'frames=', injectionResults?.length);
                        if (chosen.persistMethod) {
                            result.logs.push({ type: 'log', message: 'Preview updated.' });
                        }
                        else if (chosen.refreshMethod) {
                            result.logs.push({
                                type: 'log',
                                message: 'Editor refreshed, but the preview may take a moment to update.',
                            });
                        }
                        else {
                            result.logs.push({
                                type: 'warn',
                                message: 'Could not refresh editor automatically — please refresh the tab manually.',
                            });
                        }
                    }
                    catch (e) {
                        console.error('[KeyFindings] refresh injection failed', e);
                        result.logs.push({
                            type: 'warn',
                            message: 'Could not refresh editor automatically.',
                        });
                    }
                }
            }
            sendResponse(result);
        })();
        return true;
    }
}
