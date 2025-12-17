/**
 * API Client
 * Handles all HTTP requests to the backend API
 */

import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token to requests
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors globally
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// API Functions
const api = {
  // Health check
  health: () => apiClient.get('/health'),

  // Authentication
  auth: {
    login: (email, password) =>
      apiClient.post('/api/auth/login', { email, password }),
    logout: () =>
      apiClient.post('/api/auth/logout'),
    verify: () =>
      apiClient.get('/api/auth/verify'),
    getMe: () =>
      apiClient.get('/api/auth/me'),
  },

  // Purchases
  purchases: {
    getAll: (params) =>
      apiClient.get('/api/purchases', { params }),
    getById: (id) =>
      apiClient.get(`/api/purchases/${id}`),
  },

  // Sales
  sales: {
    getAll: (params) =>
      apiClient.get('/api/sales', { params }),
  },

  // Inventory
  inventory: {
    getAll: () =>
      apiClient.get('/api/inventory'),
    getAdjustments: (params) =>
      apiClient.get('/api/inventory/adjustments', { params }),
  },

  // Products
  products: {
    getAll: () =>
      apiClient.get('/api/products'),
  },

  // Admin (super_admin only)
  admin: {
    getCompanies: () =>
      apiClient.get('/api/admin/companies'),
    getUsers: () =>
      apiClient.get('/api/admin/users'),
  },

  // FIFO
  fifo: {
    getReport: (startDate = null) =>
      apiClient.get('/api/fifo/report', { params: { start_date: startDate } }),
    getSettings: () =>
      apiClient.get('/api/fifo/settings'),
    updateSettings: (fifoStartDate) =>
      apiClient.post('/api/fifo/settings', { fifo_start_date: fifoStartDate }),
    getProductAnalysis: (startDate = null) =>
      apiClient.get('/api/fifo/product-analysis', { params: { start_date: startDate } }),
  },

  // Data Import
  import: {
    dailySales: (formData) =>
      apiClient.post('/api/import/daily-sales', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      }),
  },
};

export default api;
