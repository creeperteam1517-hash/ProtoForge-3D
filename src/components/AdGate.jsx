import { useEffect, useRef, useState } from 'react'
import { X, Volume2, Loader2, CheckCircle2, Sparkles } from 'lucide-react'
import { ADSENSE, ADSENSE_ENABLED } from '../config.js'

/**
 * Ad gate. The user waits out a short timed gate (random 10-20s) while an ad
 * is shown, then the STL download unlocks.
 *
 * If a real Google AdSense publisher ID + slot are configured in src/config.js,
 * a live AdSense display unit is rendered (this is how you EARN money). If not
 * configured, a clearly-labelled demo placeholder is shown so the app still
 * works during development.
 */

// Loads the AdSense library script once.
function loadAdSenseScript(client) {
  if (typeof document === 'undefined') return
  if (document.querySelector('script[data-adsbygoogle]')) return
  const s = document.createElement('script')
  s.async = true
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`
  s.crossOrigin = 'anonymous'
  s.setAttribute('data-adsbygoogle', 'true')
  document.head.appendChild(s)
}
const FAKE_ADS = [
  {
    brand: 'FilamentWorld',
    tagline: 'Premium PLA & PETG — 20% off your first spool.',
    bg: 'from-orange-500 to-pink-600',
  },
  {
    brand: 'PrintForge Pro',
    tagline: 'The slicer that thinks for you. Try it free.',
    bg: 'from-emerald-500 to-cyan-600',
  },
  {
    brand: 'NozzleHub',
    tagline: 'Hardened steel nozzles built to last 10x longer.',
    bg: 'from-violet-500 to-indigo-600',
  },
  {
    brand: 'MakerCloud',
    tagline: 'Store, slice & share your models in the cloud.',
    bg: 'from-sky-500 to-blue-700',
  },
]

export default function AdGate({ open, onComplete, onCancel }) {
  const [remaining, setRemaining] = useState(0)
  const [total, setTotal] = useState(0)
  const [ad, setAd] = useState(FAKE_ADS[0])
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const duration = 10 + Math.floor(Math.random() * 11) // 10-20s
    setTotal(duration)
    setRemaining(duration)
    setAd(FAKE_ADS[Math.floor(Math.random() * FAKE_ADS.length)])

    const start = Date.now()
    intervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000
      const left = Math.max(0, duration - elapsed)
      setRemaining(left)
      if (left <= 0) {
        clearInterval(intervalRef.current)
      }
    }, 100)

    return () => clearInterval(intervalRef.current)
  }, [open])

  // Load + request a real AdSense ad when configured and the gate opens.
  useEffect(() => {
    if (!open || !ADSENSE_ENABLED) return
    loadAdSenseScript(ADSENSE.client)
    const t = setTimeout(() => {
      try {
        ;(window.adsbygoogle = window.adsbygoogle || []).push({})
      } catch (e) {
        console.warn('AdSense push failed:', e)
      }
    }, 200)
    return () => clearTimeout(t)
  }, [open])

  if (!open) return null

  const done = remaining <= 0
  const pct = total > 0 ? ((total - remaining) / total) * 100 : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-slate-900 shadow-2xl ring-1 ring-white/10 animate-fade-in">
        {/* top bar */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <Volume2 className="h-4 w-4" /> Sponsored
          </span>
          {done ? (
            <button
              onClick={onCancel}
              className="rounded-full p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          ) : (
            <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-300">
              Reward in {Math.ceil(remaining)}s
            </span>
          )}
        </div>

        {/* ad creative */}
        {ADSENSE_ENABLED ? (
          // Real Google AdSense display unit — this is what earns revenue.
          <div className="flex min-h-[250px] items-center justify-center bg-slate-950 px-2 py-3">
            <ins
              key={open ? 'ad-open' : 'ad-closed'}
              className="adsbygoogle"
              style={{ display: 'block', width: '100%', minHeight: 250 }}
              data-ad-client={ADSENSE.client}
              data-ad-slot={ADSENSE.slot}
              data-ad-format="auto"
              data-full-width-responsive="true"
            />
          </div>
        ) : (
          <div className={`relative bg-gradient-to-br ${ad.bg} px-6 py-12 text-center`}>
            <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,white_0,transparent_40%),radial-gradient(circle_at_80%_60%,white_0,transparent_35%)]" />
            <div className="relative">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">
                Demo Ad · configure AdSense in src/config.js
              </p>
              <h3 className="mt-3 text-3xl font-extrabold text-white drop-shadow">
                {ad.brand}
              </h3>
              <p className="mx-auto mt-2 max-w-xs text-sm font-medium text-white/90">
                {ad.tagline}
              </p>
              <span className="mt-6 inline-block rounded-full bg-white/20 px-5 py-2 text-sm font-semibold text-white ring-1 ring-white/30">
                Learn more
              </span>
            </div>
          </div>
        )}

        {/* progress */}
        <div className="h-1.5 w-full bg-slate-800">
          <div
            className="h-full bg-brand-500 transition-[width] duration-100 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* footer / reward */}
        <div className="px-6 py-5">
          {done ? (
            <button
              onClick={onComplete}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-white shadow-lg transition hover:bg-emerald-400"
            >
              <CheckCircle2 className="h-5 w-5" />
              Claim your STL download
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin text-brand-400" />
              <span>
                Your model is being prepared while the ad plays&hellip;
              </span>
            </div>
          )}
          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-slate-500">
            <Sparkles className="h-3.5 w-3.5" />
            Watching ads keeps AI 3D Forge free for everyone.
          </p>
        </div>
      </div>
    </div>
  )
}
