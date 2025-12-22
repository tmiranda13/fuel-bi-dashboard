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
  
  // Force clear auth state and redirect to login
  const forceLogout = async () => {
    console.log('Force logout - clearing auth state')
    try {
      await supabase.auth.signOut()
    } catch (e) {
      console.error('Sign out error:', e)
    }
    setSession(null)
    setProfile(null)
  }
  
  useEffect(() => {
    const initAuth = async () => {
      try {
        // First try to get the session
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Get session error:', error)
          await forceLogout()
          setLoading(false)
          return
        }
        
        if (session) {
          // Verify the session is still valid by making a test request
          const { error: userError } = await supabase.auth.getUser()
          
          if (userError) {
            console.error('Session invalid:', userError)
            await forceLogout()
            setLoading(false)
            return
          }
          
          setSession(session)
          try {
            const profile = await authService.getProfile()
            setProfile(profile)
          } catch (profileError) {
            console.error('Profile fetch error:', profileError)
            // Session is valid but profile fetch failed - might be RLS issue
            // Don't force logout, just set profile to null
            setProfile(null)
          }
        }
      } catch (error) {
        console.error('Auth init error:', error)
        await forceLogout()
      } finally {
        setLoading(false)
      }
    }
    
    initAuth()
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event, session ? 'has session' : 'no session')
        
        // Handle sign out
        if (event === 'SIGNED_OUT') {
          setSession(null)
          setProfile(null)
          return
        }
        
        // Handle token refresh failure
        if (event === 'TOKEN_REFRESHED' && !session) {
          console.log('Token refresh failed - forcing logout')
          await forceLogout()
          return
        }
        
        // Handle successful auth events
        if (session) {
          setSession(session)
          
          // Only fetch profile on sign in, not on every token refresh
          if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || !profile) {
            try {
              const newProfile = await authService.getProfile()
              setProfile(newProfile)
            } catch (error) {
              console.error('Profile fetch error on auth change:', error)
            }
          }
        }
      }
    )
    
    return () => {
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
    forceLogout, // Expose this for components that need to handle auth errors
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
