/**
 * Token economy constants for the UI (display only).
 *
 * Pricing model: 1 token = $0.01, so one print = 75 tokens = $0.75.
 * Keep these values in sync with server/economy.js (the authoritative copy used
 * by the backend that actually charges via Stripe).
 */
export const TOKENS_PER_PRINT = 75

/** Purchasable token packs (price shown is what a real checkout would charge). */
export const PACKS = [
  { id: 'p1', tokens: 75, prints: 1, cents: 75 },
  { id: 'p5', tokens: 375, prints: 5, cents: 375 },
  { id: 'p10', tokens: 750, prints: 10, cents: 750 },
  { id: 'p25', tokens: 1875, prints: 25, cents: 1875 },
]

export const formatUSD = (cents) => `$${(cents / 100).toFixed(2)}`
