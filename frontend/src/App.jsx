import { useState, useEffect, createContext, useContext } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Spinner, Container } from 'react-bootstrap'
import { supabase } from './services/supabase'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import { PinnedWidgetsProvider } from './contexts/PinnedWidgetsContext'

import 'bootstrap/dist/css/bootstrap.min.css'
import './assets/index.css'

const AuthContext = createContext(null)

// Session storage key
const SESSION_KEY = 'fuel_bi_session'
const SESSION_DURATION = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Helper to get stored session
const getStoredSession = () => {
  try {
    const stored = localStorage.getItem(SESSION_KEY)
    if (!stored) return null
    
    const session = JSON.parse(stored)
    
    // Check if session is expired
    if (Date.now() > session.expiresAt) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    
    return session
  } catch (e) {
    localStorage.removeItem(SESSION_KEY)
    return null
  }
}

// Helper to store session
const storeSession = (user, profile) => {
  const session = {
    user,
    profile,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_DURATION
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

// Helper to clear session
const clearStoredSession = () => {
  localStorage.removeItem(SESSION_KEY)
}

const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  
  // Initialize from stored session
  useEffect(() => {
    const stored = getStoredSession()
    if (stored) {
      setSession(stored)
    }
    setLoading(false)
  }, [])
  
  // Login function - called from Login page
  const login = async (email, password) => {
    // Authenticate with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    
    if (error) {
      throw new Error(error.message || 'Login failed')
    }
    
    // Fetch profile
    const { data: profileData, error: profileError } = await supabase
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
      .eq('auth_id', data.user.id)
      .single()
    
    if (profileError) {
      console.error('Profile fetch error:', profileError)
    }
    
    // Store session locally for our own session management
    // BUT keep Supabase signed in so RLS policies work for database queries
    const newSession = storeSession(data.user, profileData)
    setSession(newSession)
    
    return newSession
  }
  
  // Logout function
  const logout = () => {
    clearStoredSession()
    setSession(null)
  }
  
  // Refresh session (extend expiry) - call this on user activity if needed
  const refreshSession = () => {
    if (session) {
      const refreshed = storeSession(session.user, session.profile)
      setSession(refreshed)
    }
  }
  
  const profile = session?.profile
  
  const value = {
    session,
    profile,
    user: session?.user,
    isAuthenticated: !!session,
    isLoading: loading,
    login,
    logout,
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
        <PinnedWidgetsProvider>
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
        </PinnedWidgetsProvider>
      </AuthProvider>
    </HashRouter>
  )
}

export default App
