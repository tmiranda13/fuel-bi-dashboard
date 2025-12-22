import { useState, useEffect, createContext, useContext } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Spinner, Container } from 'react-bootstrap'
import { supabase } from './services/supabase'

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
  
  // Fetch profile directly using user id
  const fetchProfile = async (userId) => {
    if (!userId) return null
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          id,
          email,
          full_name,
          role,
          company_id,
          is_active,
          companies (
            id,
            company_code,
            company_name,
            display_name,
            status
          )
        `)
        .eq('auth_id', userId)
        .single()
      
      if (error) {
        console.error('Profile fetch error:', error)
        return null
      }
      return data
    } catch (e) {
      console.error('Profile fetch exception:', e)
      return null
    }
  }
  
  // Simple logout - clears everything
  const logout = async () => {
    try {
      await supabase.auth.signOut()
    } catch (e) {
      console.error('Logout error:', e)
    }
    setSession(null)
    setProfile(null)
  }
  
  useEffect(() => {
    let isMounted = true
    
    const initAuth = async () => {
      try {
        // Simple session check - no complex validation
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!isMounted) return
        
        if (session?.user) {
          // Check if token is expired (with 5 min buffer)
          const expiresAt = session.expires_at
          const now = Math.floor(Date.now() / 1000)
          const buffer = 300 // 5 minutes
          
          if (expiresAt && now >= (expiresAt - buffer)) {
            console.log('Session expired, redirecting to login')
            await logout()
            setLoading(false)
            return
          }
          
          setSession(session)
          const profile = await fetchProfile(session.user.id)
          if (isMounted) setProfile(profile)
        }
        
        if (isMounted) setLoading(false)
      } catch (e) {
        console.error('Auth init error:', e)
        if (isMounted) {
          await logout()
          setLoading(false)
        }
      }
    }
    
    initAuth()
    
    // Listen for sign in/out only (not token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!isMounted) return
        
        console.log('Auth event:', event)
        
        if (event === 'SIGNED_IN' && newSession?.user) {
          setSession(newSession)
          const profile = await fetchProfile(newSession.user.id)
          if (isMounted) setProfile(profile)
        }
        
        if (event === 'SIGNED_OUT') {
          setSession(null)
          setProfile(null)
        }
      }
    )
    
    return () => {
      isMounted = false
      subscription?.unsubscribe()
    }
  }, [])
  
  const value = {
    session,
    profile,
    user: session?.user,
    isAuthenticated: !!session,
    isLoading: loading,
    logout,
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
