/**
 * Side panel config
 *
 * Environment constants used across the side panel modules. The
 * Supabase anon key lives here intentionally — it is protected by
 * RLS (the rows the side panel reads are publicly readable anyway)
 * so it is safe to ship in the extension bundle. Never add the
 * service-role key here.
 *
 * AEM_HOST is a `let` export so it participates in ES-module live
 * bindings: every caller that does `${AEM_HOST}/...` re-reads the
 * current value at the time the template literal runs. Call
 * `loadAemEnv()` on bootstrap to restore the saved env, and
 * `setAemEnv()` to switch at runtime.
 */
export const SUPABASE_URL = 'https://zrorbndnrrrtcatvezro.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpyb3JibmRucnJydGNhdHZlenJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjY3MDIsImV4cCI6MjA4ODY0MjcwMn0.xnFfZe7J_QoTHPxlGopzo_zPlUDQh_esW5ymPDxpgXA';
export const APP_HOST = 'https://msci-publishing.vercel.app';
// SharePoint download URLs expire after ~1 hour
export const URL_LIFETIME_MS = 60 * 60 * 1000;
export const AEM_HOSTS = {
    stage: 'https://author-p125318-e1369672.adobeaemcloud.com',
    prod: 'https://author-p125318-e1369623.adobeaemcloud.com',
};
export const AEM_ENV_STORAGE_KEY = 'aem_env';
export const DEFAULT_AEM_ENV = 'stage';
export let AEM_HOST = AEM_HOSTS[DEFAULT_AEM_ENV];
export let AEM_ENV = DEFAULT_AEM_ENV;
export async function loadAemEnv() {
    const stored = await chrome.storage.local.get(AEM_ENV_STORAGE_KEY);
    const env = stored[AEM_ENV_STORAGE_KEY] === 'prod' ? 'prod' : 'stage';
    AEM_ENV = env;
    AEM_HOST = AEM_HOSTS[env];
    return env;
}
export async function setAemEnv(env) {
    const normalized = env === 'prod' ? 'prod' : 'stage';
    AEM_ENV = normalized;
    AEM_HOST = AEM_HOSTS[normalized];
    await chrome.storage.local.set({ [AEM_ENV_STORAGE_KEY]: normalized });
    return normalized;
}
