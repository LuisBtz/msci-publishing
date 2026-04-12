/**
 * Supabase browser client
 *
 * Singleton Supabase client for React components running in the browser.
 * Uses the public anon key and is protected by Row Level Security on the
 * database side. Used by useAuth, dashboard, and article editor pages.
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
