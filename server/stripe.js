/**
 * Stripe integration (hosted Checkout). The browser never sees card data or the
 * secret key — it just gets redirected to Stripe's hosted page.
 *
 * Requires STRIPE_SECRET_KEY (use a test key, sk_test_..., to start).
 */
import Stripe from 'stripe'

let _stripe
function client() {
  if (_stripe === undefined) {
    const key = process.env.STRIPE_SECRET_KEY
    _stripe = key ? new Stripe(key) : null
  }
  return _stripe
}

export function stripeConfigured() {
  return !!client()
}

/** Create a Checkout Session for a token pack; returns the redirect URL. */
export async function createCheckout({ pack, accountId, origin }) {
  const session = await client().checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: pack.cents,
          product_data: {
            name: `${pack.tokens} tokens (${pack.prints} print${pack.prints > 1 ? 's' : ''})`,
          },
        },
      },
    ],
    success_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/?checkout=cancel`,
    // Ties the payment to the account so confirm can credit the right wallet.
    metadata: { accountId, tokens: String(pack.tokens), packId: pack.id },
  })
  return session.url
}

export async function retrieveSession(sessionId) {
  return await client().checkout.sessions.retrieve(sessionId)
}
