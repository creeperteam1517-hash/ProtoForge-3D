
# AI 3D Forge

Turn a text prompt into a **printable 3D model** right in your browser, then
download it as an **STL** to open in any slicer (Cura, PrusaSlicer, Bambu
Studio) and 3D print. Downloads are unlocked after watching a short (10–20s)
rewarded ad.

## Two generation modes

- **AI (any object)** — Real text-to-3D via [Tripo3D](https://www.tripo3d.ai).
  Type *anything* ("a dog", "a dragon", "a knight helmet") and get a real AI
  mesh you can download as STL. Requires a Tripo API key (free starter credits)
  and costs credits per generation. See "AI setup" below.
- **Shapes (free)** — The built-in procedural engine. No API key, instant, and
  offline. Includes many composites (dog, cat, rabbit, bird, fish, horse,
  person, flower, etc.) plus primitives.

## AI setup (Tripo3D)

1. Create an account at https://platform.tripo3d.ai and open the **API Keys**
   page.
2. Copy your key (starts with `tsk_`) into `src/config.js`:
   ```js
   export const TRIPO = { apiKey: 'tsk_...', baseUrl: '/api/tripo' }
   ```
3. Restart the dev server. In dev, requests are proxied through Vite
   (`/api/tripo` → `https://api.tripo3d.ai`) to avoid CORS. The flow lives in
   `src/lib/tripoClient.js`: it creates a text-to-3D task, polls progress, then
   loads the resulting GLB and converts it into a print-ready STL geometry.

> A Meshy integration also ships in `src/lib/meshyClient.js` if you prefer that
> provider — set `MESHY.apiKey` and swap the import in `src/App.jsx`.

> Security: this is a browser-only app, so the key ships to the client (fine
> for personal/local use). For a public site, put generation behind your own
> server and point `MESHY.baseUrl` at it.

## How the free engine works

- **No API keys, no cost.** Models are generated client-side by a procedural
  engine (`src/lib/modelGenerator.js`) that interprets your prompt's keywords
  and assembles parametric primitives into a single mesh using Three.js.
- **Recognized prompts** include: snowman, rocket, mug, tree, house, car,
  robot, ring, vase, gear, heart. Any other prompt produces a deterministic
  abstract sculpture seeded from the text — so every prompt makes something
  printable.
- **STL export** (`src/lib/stlExporter.js`) writes a standard binary STL with
  units treated as millimetres.
- **Ad gate** (`src/components/AdGate.jsx`) requires watching a simulated
  rewarded ad before the STL download unlocks.

## Run locally

```bash
npm install
npm run dev
```

Then open the URL Vite prints (default http://localhost:5173).

## Build for production

```bash
npm run build
npm run preview
```

## Tech stack

- React 18 + Vite
- Three.js (geometry, rendering, OrbitControls)
- Tailwind CSS
- lucide-react icons

## Notes & next steps

- The procedural meshes are solid and printable; for best results, check
  "watertight"/repair options in your slicer and scale to your desired size.
- To plug in a real text-to-3D AI (e.g. Meshy/Tripo) later, swap the call in
  `App.jsx` `runGenerate` for an API request and feed the returned mesh into
  `ModelViewer` and the STL exporter.
