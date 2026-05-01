/**
 * Chrome extension background config
 *
 * Shared constants used by the service worker helpers. The prefix
 * list covers both stage and prod AEM Author hosts — tab detection
 * (`startsWith`) accepts either, so the env selected in the side
 * panel only needs to match the tab the user actually operates on.
 */
export const AEM_HOST_PREFIXES = [
    'https://author-p125318-e1369672.adobeaemcloud.com',
    'https://author-p125318-e1369623.adobeaemcloud.com',
];
export function isAemUrl(url) {
    return !!url && AEM_HOST_PREFIXES.some((prefix) => url.startsWith(prefix));
}
