/**
 * Authentication Service
 * 
 * Handles all authentication using Supabase Auth.
 * Replaces the old custom JWT implementation.
 */

import { supabase } from './supabase'

export const authService = {
  /**
   * Login with email and password
   * @param {string} email 
   * @param {string} password 
   * @returns {Promise<{user, profile, session}>}
   */
  async login(email, password) {
    // Authenticate with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    
    if (error) {
      console.error('Login error:', error)
      throw new Error(error.message || 'Login failed')
    }
    
    // Get user profile with company info
    const profile = await this.getProfile()
    
    return {
      user: data.user,
      profile,
      session: data.session
    }
  },
  
  /**
   * Logout current user
   */
  async logout() {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Logout error:', error)
      throw new Error(error.message || 'Logout failed')
    }
  },
  
  /**
   * Get current session
   * @returns {Promise<Session|null>}
   */
  async getSession() {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) {
      console.error('Get session error:', error)
      return null
    }
    return session
  },
  
  /**
   * Get current authenticated user
   * @returns {Promise<User|null>}
   */
  async getUser() {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) {
      console.error('Get user error:', error)
      return null
    }
    return user
  },
  
  /**
   * Get current user's profile from users table
   * Includes company information
   * @returns {Promise<Object|null>}
   */
  async getProfile() {
    const user = await this.getUser()
    if (!user) return null
    
    const { data, error } = await supabase
      .from('users')
      .select(`
        id,
        email,
        full_name,
        role,
        company_id,
        is_active,
        last_login,
        login_count,
        companies (
          id,
          company_code,
          company_name,
          display_name,
          status
        )
      `)
      .eq('auth_id', user.id)
      .single()
    
    if (error) {
      console.error('Get profile error:', error)
      return null
    }
    
    return data
  },
  
  /**
   * Check if user is currently authenticated
   * @returns {Promise<boolean>}
   */
  async isAuthenticated() {
    const session = await this.getSession()
    return !!session
  },
  
  /**
   * Check if current user has a specific role
   * @param {string|string[]} roles - Role or array of roles to check
   * @returns {Promise<boolean>}
   */
  async hasRole(roles) {
    const profile = await this.getProfile()
    if (!profile) return false
    
    const allowedRoles = Array.isArray(roles) ? roles : [roles]
    return allowedRoles.includes(profile.role)
  },
  
  /**
   * Check if current user is super admin
   * @returns {Promise<boolean>}
   */
  async isSuperAdmin() {
    return this.hasRole('super_admin')
  },
  
  /**
   * Check if current user is manager or super admin
   * @returns {Promise<boolean>}
   */
  async isManager() {
    return this.hasRole(['manager', 'super_admin'])
  },
  
  /**
   * Listen for authentication state changes
   * @param {Function} callback - Called with (event, session)
   * @returns {Object} Subscription object with unsubscribe method
   */
  onAuthStateChange(callback) {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(callback)
    return subscription
  },
  
  /**
   * Update user's last login timestamp
   * Called automatically after successful login
   */
  async updateLastLogin() {
    const user = await this.getUser()
    if (!user) return
    
    const { error } = await supabase
      .from('users')
      .update({
        last_login: new Date().toISOString(),
        login_count: supabase.rpc('increment_login_count')
      })
      .eq('auth_id', user.id)
    
    if (error) {
      console.error('Update last login error:', error)
    }
  },

  /**
   * Get token for backward compatibility
   * Some components might still call this
   * @returns {Promise<string|null>}
   */
  async getToken() {
    const session = await this.getSession()
    return session?.access_token || null
  }
}

// For backward compatibility with components that import authService differently
export default authService