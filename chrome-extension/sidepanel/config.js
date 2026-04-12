/**
 * Side panel config
 *
 * Environment constants used across the side panel modules. The
 * Supabase anon key lives here intentionally — it is protected by
 * RLS (the rows the side panel reads are publicly readable anyway)
 * so it is safe to ship in the extension bundle. Never add the
 * service-role key here.
 */
export const SUPABASE_URL = 'https://zrorbndnrrrtcatvezro.supabase.co'
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpyb3JibmRucnJydGNhdHZlenJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjY3MDIsImV4cCI6MjA4ODY0MjcwMn0.xnFfZe7J_QoTHPxlGopzo_zPlUDQh_esW5ymPDxpgXA'

export const AEM_HOST = 'https://author-p125318-e1369672.adobeaemcloud.com'
export const APP_HOST = 'https://msci-publishing.vercel.app'

// SharePoint download URLs expire after ~1 hour
export const URL_LIFETIME_MS = 60 * 60 * 1000
