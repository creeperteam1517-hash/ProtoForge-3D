import { useState } from 'react'
import { X, LogIn, UserPlus, Loader2, AlertTriangle, Box } from 'lucide-react'

/**
 * Email + password sign-up / log-in modal.
 *
 * onAuth(mode, email, password) should return a promise that resolves on
 * success (the parent updates state + closes) or rejects with an Error whose
 * message is shown to the user.
 */
export default function AuthModal({ open, onClose, onAuth, required = false }) {
  const [mode, setMode] = useState('signup') // 'signup' | 'login'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  if (!open) return null

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await onAuth(mode, email.trim(), password)
    } catch (err) {
      setError(err.message || 'Something went wrong.')
      setBusy(false)
    }
  }

  const isLogin = mode === 'login'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={required ? undefined : onClose}
      />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#0a1330] p-6 shadow-2xl animate-fade-in">
        {!required && (
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        {required && (
          <div className="mb-5 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-lg">
              <Box className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold leading-none tracking-tight">
                AI 3D Forge
              </h1>
              <p className="text-xs text-slate-400">Sign in to continue</p>
            </div>
          </div>
        )}

        <h2 className="mb-1 text-xl font-bold text-slate-100">
          {isLogin ? 'Log in' : 'Create account'}
        </h2>
        <p className="mb-4 text-sm text-slate-400">
          {isLogin
            ? 'Access your tokens on any device.'
            : 'Keep your tokens across devices and browsers.'}
        </p>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="email"
            className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 6 characters)"
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
          />
          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-500 to-accent-600 px-4 py-2.5 font-semibold text-white shadow-lg transition hover:from-accent-400 hover:to-accent-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isLogin ? (
              <>
                <LogIn className="h-5 w-5" /> Log in
              </>
            ) : (
              <>
                <UserPlus className="h-5 w-5" /> Create account
              </>
            )}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(isLogin ? 'signup' : 'login')
            setError(null)
          }}
          className="mt-4 w-full text-center text-xs text-slate-400 transition hover:text-white"
        >
          {isLogin
            ? "Don't have an account? Sign up"
            : 'Already have an account? Log in'}
        </button>
      </div>
    </div>
  )
}
