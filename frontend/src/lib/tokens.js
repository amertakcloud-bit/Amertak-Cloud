// Token prices — must match backend/lib/billing.js. Always whole tokens, rounded UP.
export const RATES = { captionPerMB: 5, cloudSharePerMB: 2 };

// ceil(bytes × perMB / 1 MiB), at least 1 (e.g. 2.12 MB × 5 = 10.6 → 11).
export function tokensForBytes(bytes, perMB) {
  const b = Math.max(0, Math.floor(Number(bytes) || 0));
  return Math.max(1, Math.ceil((b * perMB) / 1048576));
}
