import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { api, setUnauthorizedHandler } from './api'

const AuthContext = createContext(null)

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null')
  } catch {
    return null
  }
}

function isValidToken(token) {
  return !!token && token.length >= 50 && token.split('.').length === 3
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    const stored = localStorage.getItem('authToken')
    return isValidToken(stored) ? stored : null
  })
  const [user, setUser] = useState(() => (isValidToken(localStorage.getItem('authToken')) ? readStoredUser() : null))

  const persistSession = useCallback((nextToken, nextUser) => {
    localStorage.setItem('authToken', nextToken)
    localStorage.setItem('user', JSON.stringify(nextUser))
    setToken(nextToken)
    setUser(nextUser)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('authToken')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(logout)
  }, [logout])

  const login = useCallback(
    async (username, password) => {
      const data = await api.post('/auth/login', { username, password })
      persistSession(data.token, data.user)
      return data.user
    },
    [persistSession],
  )

  const signup = useCallback(
    async (payload) => {
      const data = await api.post('/auth/signup', payload)
      persistSession(data.token, data.user)
      return data.user
    },
    [persistSession],
  )

  // Silent token renewal so a long-open tab doesn't hit a hard session expiry.
  useEffect(() => {
    if (!token) return undefined
    const interval = setInterval(
      async () => {
        try {
          const data = await api.post('/auth/refresh', {})
          localStorage.setItem('authToken', data.token)
          setToken(data.token)
        } catch {
          // unauthorizedHandler already logs the user out on 401/403
        }
      },
      20 * 60 * 1000,
    )
    return () => clearInterval(interval)
  }, [token])

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: !!token && !!user,
      isAdmin: user?.role === 'admin',
      login,
      signup,
      logout,
    }),
    [token, user, login, signup, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
