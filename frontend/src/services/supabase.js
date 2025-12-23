import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables!')
}

// Supabase client - keep session for database RLS queries
// We manage our own session expiry separately
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,   // Let Supabase handle token refresh for DB queries
    persistSession: true,     // Keep session for RLS to work
    detectSessionInUrl: false
  }
})

if (import.meta.env.DEV) {
  window.supabase = supabase
}
