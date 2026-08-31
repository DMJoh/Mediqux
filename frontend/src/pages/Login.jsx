import { useState } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { HeartPulse, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { ApiError } from '../lib/api'

export default function Login() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // ProtectedRoute stamps location.state.from any time it bounces an unauthenticated
  // visit to /login, including right after an intentional logout — which isn't a
  // "come back where you were" case, it should land on the dashboard. AppShell's
  // logout flags that case explicitly since racing ProtectedRoute's own redirect
  // with a state-less navigate() doesn't reliably win. Resolved once per mount (not
  // as a function called from multiple spots) — this reads sessionStorage exactly
  // once, so the early-return below and handleSubmit always agree on the same
  // target instead of the first reader consuming the flag out from under the second.
  const [destination] = useState(() => {
    if (sessionStorage.getItem('mediqux-intentional-logout')) {
      sessionStorage.removeItem('mediqux-intentional-logout')
      return '/'
    }
    return location.state?.from ?? '/'
  })

  if (isAuthenticated) {
    return <Navigate to={destination} replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!username || !password) {
      setError('Enter both username and password.')
      return
    }
    setLoading(true)
    try {
      await login(username, password)
      navigate(destination, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-bg text-text flex items-center justify-center p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-1/5 z-0 opacity-85 blur-[60px] saturate-150"
        style={{
          background: `
            radial-gradient(38% 32% at 12% 8%, color-mix(in srgb, var(--color-glow-a) 55%, transparent), transparent 70%),
            radial-gradient(34% 30% at 88% 12%, color-mix(in srgb, var(--color-glow-b) 48%, transparent), transparent 70%)`,
        }}
      />

      <div className="glass relative z-1 w-full max-w-sm rounded-[22px] p-8">
        <div className="flex flex-col items-center gap-3 pb-6 text-center">
          <span className="glow-gradient flex h-11 w-11 items-center justify-center rounded-[12px] text-white shadow-[0_0_20px_color-mix(in_srgb,var(--color-glow-a)_60%,transparent)]">
            <HeartPulse size={22} strokeWidth={2.3} />
          </span>
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight">Mediqux</h1>
            <p className="mt-1 text-sm text-muted">Sign in to your records</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="username" className="text-xs font-semibold uppercase tracking-wide text-muted">
              Username or email
            </label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="rounded-[10px] border border-glass-border bg-white/6 px-3 py-2.5 text-sm text-text outline-none focus:border-glow-b"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wide text-muted">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-[10px] border border-glass-border bg-white/6 px-3 py-2.5 pr-10 text-sm text-text outline-none focus:border-glow-b"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-white"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-[10px] border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="glow-gradient mt-1 rounded-[10px] py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
