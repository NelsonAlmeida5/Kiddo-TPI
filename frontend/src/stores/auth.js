import { defineStore } from 'pinia'
import api from '@/services/api'

const extractTokenValue = (token) => {
  if (!token) {
    return null
  }

  if (typeof token === 'string') {
    return token
  }

  return token.value || token.token || null
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: JSON.parse(localStorage.getItem('kiddo_user')) || null,
    token: localStorage.getItem('kiddo_token') || null,
    loading: false,
    error: null,
  }),

  getters: {
    isAuthenticated: (state) => Boolean(state.token && state.user),
    isParent: (state) => state.user?.role === 'parent',
    isChild: (state) => state.user?.role === 'child',
  },

  actions: {
    saveSession(user, token) {
      const tokenValue = extractTokenValue(token)

      this.user = user
      this.token = tokenValue

      localStorage.setItem('kiddo_user', JSON.stringify(user))

      if (tokenValue) {
        localStorage.setItem('kiddo_token', tokenValue)
      }
    },

    clearSession() {
      this.user = null
      this.token = null
      this.error = null

      localStorage.removeItem('kiddo_user')
      localStorage.removeItem('kiddo_token')
    },

    async login(credentials) {
      this.loading = true
      this.error = null

      try {
        const response = await api.post('/login', credentials)

        this.saveSession(response.data.user, response.data.token)

        return response.data.user
      } catch (error) {
        this.error = error.response?.data?.message || 'Connexion impossible.'
        throw error
      } finally {
        this.loading = false
      }
    },

    async register(payload) {
      this.loading = true
      this.error = null

      try {
        const response = await api.post('/register', payload)

        this.saveSession(response.data.user, response.data.token)

        return response.data.user
      } catch (error) {
        this.error = error.response?.data?.message || 'Inscription impossible.'
        throw error
      } finally {
        this.loading = false
      }
    },

    async fetchMe() {
      if (!this.token) {
        return null
      }

      try {
        const response = await api.get('/me')

        this.user = response.data.user
        localStorage.setItem('kiddo_user', JSON.stringify(response.data.user))

        return response.data.user
      } catch {
        this.clearSession()
        return null
      }
    },

    async logout() {
      try {
        await api.post('/logout')
      } finally {
        this.clearSession()
      }
    },
  },
})
