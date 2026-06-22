/**
 * Google AdSense configuration.
 *
 * To EARN MONEY from real ads you must:
 *   1. Create a Google AdSense account: https://adsense.google.com
 *   2. Get your site approved (Google reviews it; can take days/weeks).
 *   3. Create a Display ad unit and copy its values below.
 *
 * Your publisher ID looks like:  ca-pub-1234567890123456
 * Your ad slot ID looks like:    1234567890
 *
 * IMPORTANT (AdSense policy): You may NOT force, incentivize, or ask users to
 * click ads, and "rewarded" ads for content unlocking are not permitted with
 * standard AdSense. What IS allowed: showing a normal display ad while the user
 * waits, with the timed gate simply pacing the download. Keep it policy-safe.
 *
 * Until you fill these in (leave as the empty strings), the app shows a clearly
 * labelled demo placeholder instead of a live ad so nothing breaks.
 */
export const ADSENSE = {
  client: '', // e.g. 'ca-pub-1234567890123456'
  slot: '', // e.g. '1234567890'
}

export const ADSENSE_ENABLED =
  ADSENSE.client.startsWith('ca-pub-') && ADSENSE.slot.length > 0

/**
 * Meshy text-to-3D AI configuration (https://www.meshy.ai).
 *
 * This powers "AI mode", which generates a real 3D model of ANY prompt
 * (e.g. "a dog", "a dragon holding a sword") and lets you download it as STL.
 *
 * Setup:
 *   1. Create an account at https://www.meshy.ai and open Settings -> API Keys.
 *   2. Copy your API key (starts with "msy_") and paste it below.
 *   3. Each generation costs Meshy credits (they offer a free monthly tier).
 *
 * SECURITY NOTE: This is a browser-only app, so the key below ships to the
 * client. That's fine for personal/local use. For a public production site,
 * move generation behind your own server so the key stays secret.
 *
 * CORS: During local dev, requests go through the Vite proxy ("/api/meshy")
 * configured in vite.config.js, so the browser can reach Meshy without CORS
 * errors. In a deployed build, point MESHY.baseUrl at your own proxy.
 */
export const MESHY = {
  apiKey: '', // e.g. 'msy_xxxxxxxxxxxxxxxxxxxxxxxxxxxx'
  // Use the dev proxy by default; override for production with your proxy URL.
  baseUrl: '/api/meshy',
}

export const MESHY_ENABLED = MESHY.apiKey.trim().length > 0

/**
 * Tripo3D text-to-3D AI configuration (https://www.tripo3d.ai).
 *
 * This is the active "AI mode" provider. It generates a real 3D model of ANY
 * prompt (e.g. "a dog", "a dragon holding a sword") and lets you download STL.
 *
 * Setup (the key is kept SERVER-SIDE now, never shipped to the browser):
 *   1. Create an account at https://platform.tripo3d.ai and make a key (tsk_…).
 *   2. Set it as the TRIPO_API_KEY environment variable:
 *        - Local dev: add TRIPO_API_KEY=tsk_... to your .env file.
 *        - Production: Netlify dashboard -> Site settings -> Environment.
 *   3. Requests go through /api/tripo, which is proxied to Tripo with the key
 *      injected server-side (dev: vite.config.js; prod: netlify/functions/tripo).
 *
 * AI mode is shown by default. To hide it (e.g. no key configured), set the
 * non-secret build var VITE_TRIPO_ENABLED=false.
 */
export const TRIPO = {
  baseUrl: '/api/tripo',
}

export const TRIPO_ENABLED =
  (import.meta.env.VITE_TRIPO_ENABLED ?? 'true') !== 'false'
