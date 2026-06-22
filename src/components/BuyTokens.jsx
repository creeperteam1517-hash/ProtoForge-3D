import { useState } from 'react'
import { Coins, X, Loader2, Lock, AlertTriangle } from 'lucide-react'
import { PACKS, TOKENS_PER_PRINT, formatUSD } from '../lib/economy.js'

/**
 * Token purchase modal. Clicking a pack starts a Stripe Checkout via onBuy,
 * which redirects the browser to Stripe's hosted payment page.
 *
 * onBuy(pack) should return a promise; it normally redirects away, so a thrown
 * error means checkout couldn't start (e.g. payments not configured).
 */
export default function BuyTokens({ open, balance = 0, onClose, onBuy }) {
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)

  if (!open) return null

  const buy = async (pack) => {
    setError(null)
    setBusyId(pack.id)
    try {
      await onBuy(pack) // normally redirects to Stripe and never returns
    } catch (err) {
      setError(err.message || 'Could not start checkout.')
      setBusyId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0a1330] p-6 shadow-2xl animate-fade-in">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-white"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-1 flex items-center gap-2">
          <Coins className="h-6 w-6 text-accent-400" />
          <h2 className="text-xl font-bold text-slate-100">Get tokens</h2>
        </div>
        <p className="mb-1 text-sm text-slate-400">
          Each print costs{' '}
          <span className="font-semibold text-slate-200">
            {TOKENS_PER_PRINT} tokens
          </span>
          . You currently have{' '}
          <span className="font-semibold text-accent-300">{balance}</span>.
        </p>
        <p className="mb-4 flex items-center gap-1.5 text-xs text-slate-500">
          <Lock className="h-3.5 w-3.5" />
          Secure checkout via Stripe.
        </p>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {PACKS.map((pack) => {
            const busy = busyId === pack.id
            return (
              <button
                key={pack.id}
                onClick={() => buy(pack)}
                disabled={busyId !== null}
                className="group flex flex-col items-start gap-1 rounded-xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-accent-500/60 hover:bg-accent-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="flex items-center gap-1.5 text-lg font-bold text-slate-100">
                  <Coins className="h-4 w-4 text-accent-400" />
                  {pack.tokens}
                </span>
                <span className="text-xs text-slate-400">
                  {pack.prints} print{pack.prints > 1 ? 's' : ''}
                </span>
                <span className="mt-2 flex w-full items-center justify-between">
                  <span className="text-sm font-semibold text-accent-300">
                    {formatUSD(pack.cents)}
                  </span>
                  {busy && (
                    <Loader2 className="h-4 w-4 animate-spin text-accent-300" />
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
