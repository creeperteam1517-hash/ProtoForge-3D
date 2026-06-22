/**
 * Token economy — SERVER source of truth.
 *
 * Keep these values in sync with src/lib/economy.js (the client copy used for
 * display). Pricing: 1 token = $0.01, so one print = 75 tokens = $0.75.
 */
export const TOKENS_PER_PRINT = 75

// Free tokens granted to a brand-new (anonymous) account so users can try one
// print. Set to 0 to disable the trial grant. NOTE: accounts are per-browser,
// so this grant can be farmed by clearing storage — keep it small.
export const STARTER_TOKENS = 75

/** Purchasable token packs. `cents` is the Stripe charge amount (USD). */
export const PACKS = [
  { id: 'p1', tokens: 75, prints: 1, cents: 75 },
  { id: 'p5', tokens: 375, prints: 5, cents: 375 },
  { id: 'p10', tokens: 750, prints: 10, cents: 750 },
  { id: 'p25', tokens: 1875, prints: 25, cents: 1875 },
]

export const getPack = (id) => PACKS.find((p) => p.id === id) || null
