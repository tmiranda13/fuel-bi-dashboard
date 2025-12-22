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
  
  // Fetch profile directly using session's user id
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
  
  useEffect(() => {
    let isMounted = true
    
    // Initialize auth state
    const initAuth = async () => {
      try {
        // Get initial session
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('getSession error:', error)
          if (isMounted) setLoading(false)
          return
        }
        
        if (session?.user) {
          if (isMounted) {
            setSession(session)
            const profile = await fetchProfile(session.user.id)
            setProfile(profile)
          }
        }
        
        if (isMounted) setLoading(false)
      } catch (e) {
        console.error('Init auth error:', e)
        if (isMounted) setLoading(false)
      }
    }
    
    initAuth()
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event)
        
        if (!isMounted) return
        
        if (event === 'SIGNED_OUT' || !session) {
          setSession(null)
          setProfile(null)
          return
        }
        
        if (session?.user) {
          setSession(session)
          
          // Only fetch profile on sign in events, not token refresh
          if (event === 'SIGNED_IN') {
            const profile = await fetchProfile(session.user.id)
            setProfile(profile)
          }
        }
      }
    )
    
    return () => {
      isMounted = false
      subscription?.unsubscribe()
    }
  }, [])
  
  const logout = async () => {
    await supabase.auth.signOut()
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
