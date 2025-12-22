import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Spinner, Container } from 'react-bootstrap'
import { supabase } from './services/supabase'
import { authService } from './services/auth'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

import 'bootstrap/dist/css/bootstrap.min.css'
import './assets/index.css'

const AuthContext = createContext(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Helper to check if stored token is expired
const isTokenExpired = () => {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.includes('sb-') && key.includes('auth-token')) {
        const stored = localStorage.getItem(key)
        if (stored) {
          const parsed = JSON.parse(stored)
          const expiresAt = parsed?.expires_at
          if (expiresAt) {
            const now = Math.floor(Date.now() / 1000)
            const isExpired = now >= expiresAt
            console.log('Token expires_at:', expiresAt, 'now:', now, 'expired:', isExpired)
            return isExpired
          }
        }
      }
    }
  } catch (e) {
    console.error('Error checking token expiry:', e)
  }
  return false
}

// Helper to clear all auth data from localStorage
const clearAuthStorage = () => {
  console.log('Clearing auth storage...')
  const keysToRemove = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && (key.includes('supabase') || key.includes('sb-') || key.includes('auth'))) {
      keysToRemove.push(key)
    }
  }
  console.log('Removing keys:', keysToRemove)
  keysToRemove.forEach(key => localStorage.removeItem(key))
}

const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  
  // Force clear auth state
  const forceLogout = useCallback(async () => {
    console.log('Force logout - clearing auth state')
    clearAuthStorage()
    try {
      await supabase.auth.signOut()
    } catch (e) {
      console.error('Sign out error:', e)
    }
    setSession(null)
    setProfile(null)
  }, [])

  // Proactive token refresh function
  const refreshSession = useCallback(async () => {
    try {
      console.log('Proactively refreshing session...')
      const { data, error } = await supabase.auth.refreshSession()
      
      if (error) {
        console.error('Session refresh failed:', error)
        // If refresh fails, force logout
        await forceLogout()
        return false
      }
      
      if (data.session) {
        console.log('Session refreshed successfully')
        setSession(data.session)
        return true
      }
      
      return false
    } catch (e) {
      console.error('Session refresh error:', e)
      return false
    }
  }, [forceLogout])
  
  useEffect(() => {
    let isMounted = true
    let refreshInterval = null
    
    const initAuth = async () => {
      try {
        console.log('Starting auth initialization...')
        
        // Check if token is expired BEFORE calling getSession
        if (isTokenExpired()) {
          console.log('Token is expired - clearing and redirecting to login')
          clearAuthStorage()
          setLoading(false)
          return
        }
        
        // Set a timeout for getSession specifically
        const sessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('getSession timeout')), 5000)
        )
        
        let sessionResult
        try {
          sessionResult = await Promise.race([sessionPromise, timeoutPromise])
        } catch (timeoutError) {
          console.error('getSession timed out - clearing auth')
          clearAuthStorage()
          if (isMounted) setLoading(false)
          return
        }
        
        const { data: { session }, error } = sessionResult
        
        console.log('getSession result:', session ? 'has session' : 'no session', error ? `error: ${error.message}` : 'no error')
        
        if (!isMounted) return
        
        if (error) {
          console.error('Get session error:', error)
          clearAuthStorage()
          setLoading(false)
          return
        }
        
        if (!session) {
          console.log('No session found - user needs to login')
          setLoading(false)
          return
        }
        
        // Verify the session is still valid with a timeout
        const userPromise = supabase.auth.getUser()
        const userTimeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('getUser timeout')), 5000)
        )
        
        let userResult
        try {
          userResult = await Promise.race([userPromise, userTimeoutPromise])
        } catch (timeoutError) {
          console.error('getUser timed out - clearing auth')
          clearAuthStorage()
          if (isMounted) setLoading(false)
          return
        }
        
        const { data: { user }, error: userError } = userResult
        
        console.log('getUser result:', user ? 'has user' : 'no user', userError ? `error: ${userError.message}` : 'no error')
        
        if (!isMounted) return
        
        if (userError || !user) {
          console.error('Session invalid:', userError)
          clearAuthStorage()
          setLoading(false)
          return
        }
        
        setSession(session)
        
        // Try to get profile
        try {
          const profile = await authService.getProfile()
          if (isMounted) {
            setProfile(profile)
          }
        } catch (profileError) {
          console.error('Profile fetch error:', profileError)
        }
        
        if (isMounted) {
          setLoading(false)
        }
        
      } catch (error) {
        console.error('Auth init error:', error)
        if (isMounted) {
          clearAuthStorage()
          setLoading(false)
        }
      }
    }
    
    initAuth()
    
    // Set up proactive token refresh every 4 minutes (240000ms)
    // This ensures the token stays fresh even if auto-refresh fails
    refreshInterval = setInterval(() => {
      if (session) {
        console.log('Running scheduled token refresh...')
        refreshSession()
      }
    }, 240000) // 4 minutes
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log('Auth event:', event, newSession ? 'has session' : 'no session')
        
        if (!isMounted) return
        
        // Handle sign out
        if (event === 'SIGNED_OUT') {
          setSession(null)
          setProfile(null)
          setLoading(false)
          return
        }
        
        // Handle token refresh failure
        if (event === 'TOKEN_REFRESHED' && !newSession) {
          console.log('Token refresh failed - forcing logout')
          clearAuthStorage()
          setSession(null)
          setProfile(null)
          setLoading(false)
          return
        }
        
        // Handle successful auth events
        if (newSession) {
          setSession(newSession)
          
          // Only fetch profile on sign in, not on every token refresh
          if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || !profile) {
            try {
              const newProfile = await authService.getProfile()
              if (isMounted) {
                setProfile(newProfile)
              }
            } catch (error) {
              console.error('Profile fetch error on auth change:', error)
            }
          }
          
          if (isMounted) {
            setLoading(false)
          }
        }
      }
    )
    
    // Also refresh on window focus (user comes back to tab)
    const handleFocus = () => {
      if (session) {
        console.log('Window focused - refreshing session')
        refreshSession()
      }
    }
    window.addEventListener('focus', handleFocus)
    
    // Also refresh on visibility change (tab becomes visible)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && session) {
        console.log('Tab visible - refreshing session')
        refreshSession()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      isMounted = false
      if (refreshInterval) {
        clearInterval(refreshInterval)
      }
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      subscription?.unsubscribe()
    }
  }, [session, refreshSession])
  
  const logout = async () => {
    await authService.logout()
    setSession(null)
    setProfile(null)
  }
  
  const value = {
    session,
    profile,
    user: session?.user,
    isAuthenticated: !!session,
    isLoading: loading,
    logout,
    forceLogout,
    refreshSession,
    companyId: profile?.company_id,
    companyName: profile?.companies?.display_name || profile?.companies?.company_name,
    userRole: profile?.role,
    userName: profile?.full_name,
    isManager: profile?.role === 'manager' || profile?.role === 'super_admin',
    isSuperAdmin: profile?.role === 'super_admin'
  }
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth()
  
  if (isLoading) {
    return (
      <Container className="d-flex align-items-center justify-content-center min-vh-100">
        <div className="text-center">
          <Spinner animation="border" variant="primary" />
          <p className="mt-3 text-muted">Carregando...</p>
        </div>
      </Container>
    )
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  
  return children
}

const PublicRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth()
  
  if (isLoading) {
    return (
      <Container className="d-flex align-items-center justify-content-center min-vh-100">
        <div className="text-center">
          <Spinner animation="border" variant="primary" />
          <p className="mt-3 text-muted">Carregando...</p>
        </div>
      </Container>
    )
  }
  
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }
  
  return children
}

function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Routes>
          <Route 
            path="/login" 
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            } 
          />
          <Route
            path="/dashboard/*"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </HashRouter>
  )
}

export default App
