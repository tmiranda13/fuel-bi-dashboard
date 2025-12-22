import { useState, useEffect, createContext, useContext } from 'react'
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

const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  
  // Force clear auth state
  const forceLogout = async () => {
    console.log('Force logout - clearing auth state')
    // Clear localStorage directly as backup
    const keysToRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.includes('supabase') || key.includes('sb-') || key.includes('auth'))) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key))
    
    try {
      await supabase.auth.signOut()
    } catch (e) {
      console.error('Sign out error:', e)
    }
    setSession(null)
    setProfile(null)
  }
  
  useEffect(() => {
    let isMounted = true
    let timeoutId = null
    
    const initAuth = async () => {
      // Set a timeout to prevent infinite loading
      timeoutId = setTimeout(() => {
        if (isMounted && loading) {
          console.error('Auth initialization timeout - forcing logout')
          forceLogout()
          setLoading(false)
        }
      }, 10000) // 10 second timeout
      
      try {
        console.log('Starting auth initialization...')
        
        // First try to get the session
        const { data: { session }, error } = await supabase.auth.getSession()
        
        console.log('getSession result:', session ? 'has session' : 'no session', error ? `error: ${error.message}` : 'no error')
        
        if (!isMounted) return
        
        if (error) {
          console.error('Get session error:', error)
          await forceLogout()
          setLoading(false)
          return
        }
        
        if (!session) {
          console.log('No session found - user needs to login')
          setLoading(false)
          return
        }
        
        // Verify the session is still valid
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        console.log('getUser result:', user ? 'has user' : 'no user', userError ? `error: ${userError.message}` : 'no error')
        
        if (!isMounted) return
        
        if (userError || !user) {
          console.error('Session invalid:', userError)
          await forceLogout()
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
          await forceLogout()
          setLoading(false)
        }
      }
    }
    
    initAuth()
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event, session ? 'has session' : 'no session')
        
        if (!isMounted) return
        
        // Handle sign out
        if (event === 'SIGNED_OUT') {
          setSession(null)
          setProfile(null)
          setLoading(false)
          return
        }
        
        // Handle token refresh failure
        if (event === 'TOKEN_REFRESHED' && !session) {
          console.log('Token refresh failed - forcing logout')
          await forceLogout()
          setLoading(false)
          return
        }
        
        // Handle successful auth events
        if (session) {
          setSession(session)
          
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
    
    return () => {
      isMounted = false
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      subscription?.unsubscribe()
    }
  }, [])
  
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
