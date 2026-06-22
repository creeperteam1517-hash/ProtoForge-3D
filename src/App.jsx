import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Box,
  Sparkles,
  Wand2,
  Download,
  RefreshCw,
  Grid3x3,
  Ruler,
  Github,
  Loader2,
  RotateCcw,
  Gauge,
  Sliders,
  Move3d,
  Rotate3d,
  Scaling,
  MousePointer2,
  Brain,
  Blocks,
  AlertTriangle,
  Coins,
  Circle,
  Cylinder,
  Cone,
  Pyramid,
  Torus,
  Triangle,
  Diamond,
  Pentagon,
  Gem,
  LogIn,
  LogOut,
} from 'lucide-react'
import ModelViewer from './components/ModelViewer.jsx'
import BuyTokens from './components/BuyTokens.jsx'
import AuthModal from './components/AuthModal.jsx'
import { generateModel, QUALITY } from './lib/modelGenerator.js'
import { generateWithTripo } from './lib/tripoClient.js'
import { geometryToBinarySTL, downloadBlob, slugify } from './lib/stlExporter.js'
import {
  fetchMe,
  startCheckout,
  confirmCheckout,
  spendPrint,
  signup,
  login,
  logout,
} from './lib/wallet.js'
import { TOKENS_PER_PRINT } from './lib/economy.js'
import { TRIPO_ENABLED } from './config.js'

const AI_SUGGESTIONS = [
  'a cute dog',
  'a dragon',
  'a sports car',
  'a knight helmet',
  'a potted succulent',
  'a robot action figure',
]

// Free Shapes mode: pick a primitive — no text prompt. Each `keyword` maps to a
// primitive recipe in modelGenerator.js.
const SHAPE_PRESETS = [
  { label: 'Cube', keyword: 'cube', icon: Box },
  { label: 'Sphere', keyword: 'sphere', icon: Circle },
  { label: 'Cylinder', keyword: 'cylinder', icon: Cylinder },
  { label: 'Cone', keyword: 'cone', icon: Cone },
  { label: 'Pyramid', keyword: 'pyramid', icon: Pyramid },
  { label: 'Torus', keyword: 'torus', icon: Torus },
  { label: 'Tetrahedron', keyword: 'tetrahedron', icon: Triangle },
  { label: 'Octahedron', keyword: 'octahedron', icon: Diamond },
  { label: 'Dodecahedron', keyword: 'dodecahedron', icon: Pentagon },
  { label: 'Icosahedron', keyword: 'icosahedron', icon: Gem },
]

const PRESET_COLORS = ['#ff7a00', '#1f47c4', '#22c55e', '#e11d48', '#a855f7', '#f4f4f5']
const DEFAULT_EDITS = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
  color: '#ff7a00',
}
const EDIT_TOOLS = [
  { mode: null, label: 'View', icon: MousePointer2 },
  { mode: 'translate', label: 'Move', icon: Move3d },
  { mode: 'rotate', label: 'Rotate', icon: Rotate3d },
  { mode: 'scale', label: 'Scale', icon: Scaling },
]

export default function App() {
  const [prompt, setPrompt] = useState('')
  const [result, setResult] = useState(null) // { geometry, recipe, seed, prompt }
  const [generating, setGenerating] = useState(false)
  const [wireframe, setWireframe] = useState(false)
  const [quality, setQuality] = useState('high')
  const [edits, setEdits] = useState(DEFAULT_EDITS)
  const [editMode, setEditMode] = useState(null)
  // 'shapes' = free built-in engine, 'ai' = Tripo3D text-to-3D.
  // Default to free Shapes unless an AI key is configured.
  const [genMode, setGenMode] = useState('shapes')
  const [aiProgress, setAiProgress] = useState(null) // { progress, status }
  const [aiError, setAiError] = useState(null)
  const [tokens, setTokens] = useState(0)
  const [buyOpen, setBuyOpen] = useState(false)
  const [me, setMe] = useState({ loggedIn: false, email: null })
  const [authOpen, setAuthOpen] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [showAiTip, setShowAiTip] = useState(true)
  const [aiTipFading, setAiTipFading] = useState(false)

  // Initialize the wallet: handle a Stripe checkout result from the URL, then
  // load the account (identity + balance).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const params = new URLSearchParams(window.location.search)

        // Returning from Stripe checkout: verify + credit.
        if (params.get('checkout') === 'success' && params.get('session_id')) {
          await confirmCheckout(params.get('session_id'))
          window.history.replaceState({}, '', window.location.pathname)
        }

        const m = await fetchMe()
        if (!cancelled) {
          setTokens(m.balance)
          setMe({ loggedIn: m.loggedIn, email: m.email })
        }
      } catch (err) {
        console.error('Wallet init failed:', err)
      } finally {
        if (!cancelled) setAuthChecked(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Fade the AI nudge out, then unmount it after the transition finishes.
  const dismissAiTip = useCallback(() => {
    setAiTipFading(true)
    setTimeout(() => setShowAiTip(false), 500)
  }, [])

  // Nudge new visitors toward AI mode, then auto-dismiss after 10 seconds.
  useEffect(() => {
    const t = setTimeout(dismissAiTip, 10000)
    return () => clearTimeout(t)
  }, [dismissAiTip])

  const stats = useMemo(() => {
    if (!result?.geometry) return null
    const pos = result.geometry.getAttribute('position')
    const triangles = pos.count / 3
    result.geometry.computeBoundingBox()
    const bb = result.geometry.boundingBox
    const size = {
      x: (bb.max.x - bb.min.x).toFixed(1),
      y: (bb.max.y - bb.min.y).toFixed(1),
      z: (bb.max.z - bb.min.z).toFixed(1),
    }
    return { triangles, size }
  }, [result])

  const resetEditsKeepColor = useCallback(
    () => setEdits((e) => ({ ...DEFAULT_EDITS, color: e.color })),
    []
  )

  // Built-in shape engine (free, instant).
  const generateShapes = useCallback(
    (value, seed) => {
      setGenerating(true)
      setTimeout(() => {
        const { geometry, recipe, seed: usedSeed } = generateModel(value, {
          seed,
          quality,
        })
        setResult({ geometry, recipe, seed: usedSeed, prompt: value })
        resetEditsKeepColor()
        setGenerating(false)
      }, 450)
    },
    [quality, resetEditsKeepColor]
  )

  const runGenerate = useCallback(
    async (text, seed) => {
      const value = (text ?? prompt).trim()
      if (!value || generating) return
      setAiError(null)

      // ---- AI mode (Tripo3D text-to-3D) ----
      if (genMode === 'ai') {
        // No key? Don't block the user — fall back to the free shape engine so
        // a model still appears. The amber "needs key" notice explains how to
        // enable real AI generation.
        if (!TRIPO_ENABLED) {
          generateShapes(value, seed)
          return
        }
        if (tokens < TOKENS_PER_PRINT) {
          setBuyOpen(true)
          return
        }
        setGenerating(true)
        setAiProgress({ progress: 0, status: 'Starting…' })
        try {
          const geometry = await generateWithTripo(value, (info) =>
            setAiProgress(info)
          )
          const { ok, balance } = await spendPrint()
          if (typeof balance === 'number') setTokens(balance)
          if (!ok) {
            setBuyOpen(true)
            return
          }
          setResult({ geometry, recipe: 'ai', seed: 0, prompt: value })
          resetEditsKeepColor()
        } catch (err) {
          setAiError(err.message || 'AI generation failed.')
        } finally {
          setGenerating(false)
          setAiProgress(null)
        }
        return
      }

      // ---- Built-in shape engine (free, instant) ----
      generateShapes(value, seed)
    },
    [prompt, generating, genMode, tokens, resetEditsKeepColor, generateShapes]
  )

  const handleSubmit = (e) => {
    e.preventDefault()
    runGenerate()
  }

  // Free Shapes mode generates directly from a primitive preset (no prompt).
  const generateShape = (keyword) => runGenerate(keyword)

  const reroll = () => {
    if (!result) return
    runGenerate(result.prompt, (result.seed + 0x9e3779b9) >>> 0)
  }

  const handleDownloadClick = () => {
    if (!result?.geometry) return
    // Downloads are free — AI was already paid for at generation time, and
    // Shapes is free. Just write the STL.
    const blob = geometryToBinarySTL(result.geometry, {
      position: edits.position,
      rotation: edits.rotation,
      scale: edits.scale,
    })
    downloadBlob(blob, `${slugify(result.prompt)}.stl`)
  }

  // Start a Stripe Checkout for the chosen pack (redirects to Stripe). Any error
  // propagates to the BuyTokens modal, which displays it.
  const handleBuy = (pack) => startCheckout(pack.id)

  const handleLogout = async () => {
    await logout()
    const m = await fetchMe()
    setMe({ loggedIn: m.loggedIn, email: m.email })
    setTokens(m.balance)
  }

  // Sign up or log in (called by AuthModal). Throws on failure so the modal can
  // show the error; on success updates state and closes.
  const handleAuth = async (mode, email, password) => {
    const data = mode === 'signup' ? await signup(email, password) : await login(email, password)
    setMe({ loggedIn: true, email: data.email })
    setTokens(data.balance)
    setAuthOpen(false)
  }

  const setRotation = (axis, value) =>
    setEdits((e) => ({ ...e, rotation: { ...e.rotation, [axis]: value } }))

  const setUniformScale = (value) =>
    setEdits((e) => ({ ...e, scale: { x: value, y: value, z: value } }))

  // Called live while the user drags a gizmo in the 3D viewport.
  const handleGizmoChange = useCallback((t) => {
    setEdits((e) => ({ ...e, position: t.position, rotation: t.rotation, scale: t.scale }))
  }, [])

  const resetEdits = () => {
    setEdits((e) => ({ ...DEFAULT_EDITS, color: e.color }))
    setEditMode(null)
  }

  // While checking the session, show a brief splash to avoid flashing the wall.
  if (!authChecked) {
    return (
      <div className="flex h-full items-center justify-center bg-[#060e2a] text-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
      </div>
    )
  }

  // Login wall — nothing else is reachable until the user signs in.
  if (!me.loggedIn) {
    return (
      <div className="h-full bg-[#060e2a]">
        <AuthModal open required onAuth={handleAuth} />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-[#060e2a] text-slate-100">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-lg">
            <Box className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold leading-none tracking-tight">
              AI 3D Forge
            </h1>
            <p className="text-xs text-slate-400">Text → printable STL</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900/70 px-3 py-1.5 text-sm">
            <Coins className="h-4 w-4 text-accent-400" />
            <span className="font-semibold text-slate-100">{tokens}</span>
            <span className="hidden text-slate-400 sm:inline">tokens</span>
          </div>
          <button
            onClick={() => setBuyOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-accent-500 to-accent-600 px-3 py-1.5 text-sm font-semibold text-white shadow transition hover:from-accent-400 hover:to-accent-500"
          >
            Get tokens
          </button>
          {me.loggedIn ? (
            <div className="flex items-center gap-2">
              <span
                className="hidden max-w-[160px] truncate text-sm text-slate-300 md:inline"
                title={me.email}
              >
                {me.email}
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-white/10"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Log out</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAuthOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-slate-200 transition hover:bg-white/10"
            >
              <LogIn className="h-4 w-4" /> Sign in
            </button>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Sidebar */}
        <aside className="flex w-full flex-col gap-5 border-b border-white/10 p-5 lg:w-[380px] lg:border-b-0 lg:border-r lg:overflow-y-auto">
          <div>
            {/* Generation mode: AI text-to-3D vs free built-in shapes */}
            <div className="relative mb-3">
              {showAiTip && (
                <button
                  type="button"
                  onClick={dismissAiTip}
                  className={`absolute left-0 top-full z-20 mt-2 flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-accent-500 to-accent-600 px-3 py-2 text-xs font-semibold text-white shadow-lg animate-fade-in transition-opacity duration-500 ${
                    aiTipFading ? 'opacity-0' : 'opacity-100'
                  }`}
                >
                  <span className="absolute -top-1 left-8 h-2.5 w-2.5 rotate-45 bg-accent-500" />
                  <Sparkles className="h-3.5 w-3.5" />
                  If you want advanced models, go here!
                </button>
              )}
              <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-slate-900/70 p-1">
                <button
                  onClick={() => {
                    setGenMode('ai')
                    dismissAiTip()
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium transition ${
                    genMode === 'ai'
                      ? 'bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow'
                      : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <Brain className="h-4 w-4" /> AI (any object)
                </button>
                <button
                  onClick={() => setGenMode('shapes')}
                  className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium transition ${
                    genMode === 'shapes'
                      ? 'bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow'
                      : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <Blocks className="h-4 w-4" /> Shapes (free)
                </button>
              </div>
            </div>

            {genMode === 'ai' ? (
              <>
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
                  <Wand2 className="h-4 w-4 text-brand-400" />
                  Describe your model
                </label>
                <form onSubmit={handleSubmit}>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g. a cute dog, a dragon, a knight helmet..."
                    rows={3}
                    className="w-full resize-none rounded-xl border border-white/10 bg-slate-900/70 px-3.5 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
                  />
                  <button
                    type="submit"
                    disabled={generating || !prompt.trim()}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-500 to-accent-600 px-4 py-3 font-semibold text-white shadow-lg transition hover:from-accent-400 hover:to-accent-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        AI is sculpting…
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-5 w-5" />
                        Generate with AI
                      </>
                    )}
                  </button>
                </form>
                <p className="mt-2 text-center text-xs text-slate-500">
                  Each generation costs {TOKENS_PER_PRINT} tokens. You have{' '}
                  <span className="font-semibold text-slate-300">{tokens}</span>.
                </p>
              </>
            ) : (
              <>
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
                  <Blocks className="h-4 w-4 text-brand-400" />
                  Pick a shape
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {SHAPE_PRESETS.map((shape) => {
                    const Icon = shape.icon
                    return (
                      <button
                        key={shape.keyword}
                        onClick={() => generateShape(shape.keyword)}
                        disabled={generating}
                        className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-medium text-slate-200 transition hover:border-brand-500/60 hover:bg-brand-500/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Icon className="h-4 w-4 text-brand-300" />
                        {shape.label}
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            {/* AI progress */}
            {genMode === 'ai' && aiProgress && (
              <div className="mt-3 rounded-lg border border-brand-500/30 bg-brand-500/10 p-3">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-medium text-brand-200">
                    {aiProgress.status}
                  </span>
                  <span className="text-brand-300">{aiProgress.progress}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full bg-brand-400 transition-[width] duration-500"
                    style={{ width: `${aiProgress.progress}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  AI generation usually takes 30–90 seconds.
                </p>
              </div>
            )}

            {/* AI errors / setup notice */}
            {genMode === 'ai' && aiError && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{aiError}</span>
              </div>
            )}
            {genMode === 'ai' && !TRIPO_ENABLED && !aiError && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>
                  AI mode needs a Tripo API key. Set{' '}
                  <code className="rounded bg-black/30 px-1">TRIPO_API_KEY</code>{' '}
                  in your environment (free credits at tripo3d.ai), then restart
                  the server. No key? You still get a free shape model.
                </span>
              </div>
            )}
          </div>

          {/* Quality / detail level (built-in shapes only) */}
          {genMode === 'shapes' && (
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
              <Gauge className="h-4 w-4 text-accent-400" />
              Quality / detail
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {Object.entries(QUALITY).map(([key, q]) => (
                <button
                  key={key}
                  onClick={() => setQuality(key)}
                  className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${
                    quality === key
                      ? 'border-accent-500 bg-accent-500/15 text-accent-300'
                      : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {q.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              Higher detail = smoother curves &amp; larger STL files. Re-generate
              to apply.
            </p>
          </div>
          )}

          {/* Suggestions (AI mode only — Shapes mode uses the preset grid) */}
          {genMode === 'ai' && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Try one of these
              </p>
              <div className="flex flex-wrap gap-2">
                {AI_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setPrompt(s)
                      runGenerate(s)
                    }}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:border-brand-500/60 hover:bg-brand-500/10 hover:text-white"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Model info + actions */}
          {result && (
            <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4 animate-fade-in">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-200">
                  Current model
                </span>
                <span className="rounded-md bg-brand-500/15 px-2 py-0.5 text-xs font-medium capitalize text-brand-300">
                  {result.recipe}
                </span>
              </div>

              {stats && (
                <dl className="mb-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-white/5 p-2.5">
                    <dt className="flex items-center gap-1 text-slate-500">
                      <Grid3x3 className="h-3.5 w-3.5" /> Triangles
                    </dt>
                    <dd className="mt-0.5 font-semibold text-slate-100">
                      {stats.triangles.toLocaleString()}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-white/5 p-2.5">
                    <dt className="flex items-center gap-1 text-slate-500">
                      <Ruler className="h-3.5 w-3.5" /> Size (mm)
                    </dt>
                    <dd className="mt-0.5 font-semibold text-slate-100">
                      {stats.size.x}×{stats.size.y}×{stats.size.z}
                    </dd>
                  </div>
                </dl>
              )}

              <div className="flex gap-2">
                <button
                  onClick={reroll}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/10"
                >
                  <RefreshCw className="h-4 w-4" /> Re-roll
                </button>
                <button
                  onClick={() => setWireframe((w) => !w)}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                    wireframe
                      ? 'border-brand-500/60 bg-brand-500/15 text-brand-200'
                      : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                  }`}
                >
                  <Grid3x3 className="h-4 w-4" />
                </button>
              </div>

              {/* Model editor */}
              <div className="mt-4 border-t border-white/10 pt-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-200">
                    <Sliders className="h-4 w-4 text-accent-400" /> Edit model
                  </span>
                  <button
                    onClick={resetEdits}
                    className="flex items-center gap-1 text-xs text-slate-400 transition hover:text-white"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reset
                  </button>
                </div>

                {/* Hands-on tools: drag the gizmo on the model in the viewport */}
                <div className="mb-3 grid grid-cols-4 gap-1.5">
                  {EDIT_TOOLS.map((tool) => {
                    const Icon = tool.icon
                    const active = editMode === tool.mode
                    return (
                      <button
                        key={tool.label}
                        onClick={() => setEditMode(tool.mode)}
                        className={`flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[11px] font-medium transition ${
                          active
                            ? 'border-accent-500 bg-accent-500/15 text-accent-300'
                            : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {tool.label}
                      </button>
                    )
                  })}
                </div>
                <p className="mb-3 text-xs text-slate-500">
                  {editMode
                    ? 'Drag the colored handles on the model to edit it by hand.'
                    : 'Pick Move, Rotate, or Scale to grab the model directly — or use the sliders below.'}
                </p>

                <SliderRow
                  label="Size"
                  value={`${Math.round(edits.scale.x * 100)}%`}
                  min={25}
                  max={300}
                  step={5}
                  raw={edits.scale.x * 100}
                  onChange={(v) => setUniformScale(v / 100)}
                />
                <SliderRow
                  label="Rotate X"
                  value={`${edits.rotation.x}°`}
                  min={0}
                  max={360}
                  step={5}
                  raw={edits.rotation.x}
                  onChange={(v) => setRotation('x', v)}
                />
                <SliderRow
                  label="Rotate Y"
                  value={`${edits.rotation.y}°`}
                  min={0}
                  max={360}
                  step={5}
                  raw={edits.rotation.y}
                  onChange={(v) => setRotation('y', v)}
                />
                <SliderRow
                  label="Rotate Z"
                  value={`${edits.rotation.z}°`}
                  min={0}
                  max={360}
                  step={5}
                  raw={edits.rotation.z}
                  onChange={(v) => setRotation('z', v)}
                />

                <div className="mt-3">
                  <span className="mb-1.5 block text-xs text-slate-400">
                    Preview color
                  </span>
                  <div className="flex items-center gap-2">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setEdits((e) => ({ ...e, color: c }))}
                        style={{ backgroundColor: c }}
                        className={`h-6 w-6 rounded-full ring-2 ring-offset-2 ring-offset-slate-900 transition ${
                          edits.color === c ? 'ring-white' : 'ring-transparent'
                        }`}
                        aria-label={`Color ${c}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={handleDownloadClick}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 font-semibold text-white shadow-lg transition hover:bg-emerald-400"
              >
                <Download className="h-5 w-5" /> Download STL
              </button>
              <p className="mt-2 text-center text-xs text-emerald-400">
                Free download
              </p>
            </div>
          )}

          <p className="mt-auto text-xs leading-relaxed text-slate-500">
            Models are generated entirely in your browser as solid, printable
            geometry. Open the STL in any slicer (Cura, PrusaSlicer, Bambu
            Studio) to scale and print.
          </p>
        </aside>

        {/* Viewport */}
        <main className="relative min-h-[320px] flex-1 min-w-0 overflow-hidden">
          {result ? (
            <ModelViewer
              geometry={result.geometry}
              wireframe={wireframe}
              color={edits.color}
              editMode={editMode}
              transform={{
                position: edits.position,
                rotation: edits.rotation,
                scale: edits.scale,
              }}
              onTransformChange={handleGizmoChange}
            />
          ) : (
            <EmptyState generating={generating} />
          )}

          {result && (
            <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-4 py-1.5 text-xs text-slate-300 backdrop-blur">
              Drag to orbit · Scroll to zoom · Right-click to pan
            </div>
          )}
        </main>
      </div>

      <BuyTokens
        open={buyOpen}
        balance={tokens}
        onClose={() => setBuyOpen(false)}
        onBuy={handleBuy}
      />

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuth={handleAuth}
      />
    </div>
  )
}

function EmptyState({ generating }) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 animate-pulse-slow rounded-3xl bg-brand-500/20 blur-2xl" />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-2xl">
          {generating ? (
            <Loader2 className="h-12 w-12 animate-spin text-white" />
          ) : (
            <Box className="h-12 w-12 text-white" />
          )}
        </div>
      </div>
      <h2 className="text-2xl font-bold text-slate-100">
        {generating ? 'Forging your model…' : 'Describe it. Forge it. Print it.'}
      </h2>
      <p className="mt-2 max-w-md text-sm text-slate-400">
        {generating
          ? 'Assembling printable geometry from your prompt.'
          : 'Type a prompt or pick a suggestion to generate a 3D model you can download as an STL and 3D print.'}
      </p>
    </div>
  )
}

function SliderRow({ label, value, min, max, step, raw, onChange }) {
  return (
    <div className="mb-2.5">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="font-semibold text-slate-200">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={raw}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-accent-500"
      />
    </div>
  )
}
