import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables!')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // Storage key - helps with debugging
    storageKey: 'fuel-bi-auth'
  },
  global: {
    headers: {
      'x-application-name': 'fuel-bi-dashboard'
    }
  }
})

// Helper function to handle auth errors in API calls
export const handleSupabaseError = async (error) => {
  if (error) {
    const authErrorCodes = [
      'PGRST301', // JWT expired
      'PGRST302', // JWT invalid
      '401',
      'invalid_token',
      'token_expired',
      'session_not_found'
    ]
    
    const isAuthError = authErrorCodes.some(code => 
      error.message?.includes(code) || 
      error.code?.includes(code) ||
      error.status === 401
    )
    
    if (isAuthError) {
      console.error('Auth error detected, clearing session:', error)
      // Clear the session - this will trigger onAuthStateChange with SIGNED_OUT
      await supabase.auth.signOut()
      // Force page reload to reset app state
      window.location.href = '/#/login'
      return true
    }
  }
  return false
}

// Wrapper for Supabase queries that handles auth errors
export const safeQuery = async (queryFn) => {
  try {
    const result = await queryFn()
    
    if (result.error) {
      const wasAuthError = await handleSupabaseError(result.error)
      if (wasAuthError) {
        throw new Error('Session expired. Please login again.')
      }
    }
    
    return result
  } catch (error) {
    const wasAuthError = await handleSupabaseError(error)
    if (wasAuthError) {
      throw new Error('Session expired. Please login again.')
    }
    throw error
  }
}

if (import.meta.env.DEV) {
  window.supabase = supabase
}
