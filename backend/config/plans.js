// Plans
// Server-side source of truth for plans → price (USD) and token reward.
// The client only sends a planId; amounts/tokens are NEVER trusted from
// the browser, so a paid $1 plan cannot be claimed as a $3 plan.
export const PLANS = {
  1: { id: "1", name: "Free", price: 0, tokens: 150 },
  2: { id: "2", name: "Pro", price: 1, tokens: 300 },
  3: { id: "3", name: "Premium", price: 3, tokens: 1000 },
};

// Only paid plans go through the KHQR payment flow.
export function getPaidPlan(planId) {
  const plan = PLANS[String(planId)];
  if (!plan || !(plan.price > 0)) return null;
  return plan;
}

// ---- Custom plan ----
// The user types a token amount; the PRICE is always computed server-side
// at 300 tokens = $1.00, with a minimum price of $0.10 (30 tokens).
export const CUSTOM_RATE_TOKENS_PER_USD = 300;
export const CUSTOM_MIN_PRICE = 0.1;
export const CUSTOM_MIN_TOKENS = 30; // 0.10 × 300
export const CUSTOM_MAX_TOKENS = 1000000;

// Returns { plan } on success or { error } when the input is invalid.
export function getCustomPlan(tokensRaw) {
  const tokens = Number(tokensRaw);

  if (!Number.isFinite(tokens) || !Number.isInteger(tokens)) {
    return { error: "Tokens must be a whole number." };
  }
  if (tokens < CUSTOM_MIN_TOKENS) {
    return {
      error: `Custom plan requires at least ${CUSTOM_MIN_TOKENS} tokens (price ≥ $${CUSTOM_MIN_PRICE.toFixed(2)}).`,
    };
  }
  if (tokens > CUSTOM_MAX_TOKENS) {
    return {
      error: `Maximum ${CUSTOM_MAX_TOKENS.toLocaleString("en-US")} tokens per purchase.`,
    };
  }

  const price = Math.round((tokens / CUSTOM_RATE_TOKENS_PER_USD) * 100) / 100;
  if (price < CUSTOM_MIN_PRICE) {
    return { error: `Price must be at least $${CUSTOM_MIN_PRICE.toFixed(2)}.` };
  }

  return {
    plan: { id: "custom", name: `Custom (${tokens})`, price, tokens },
  };
}

