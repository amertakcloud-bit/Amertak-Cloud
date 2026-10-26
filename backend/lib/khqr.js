import { AppError } from "./AppError.js";

// KHQR.dev (KHQR for Developers) API client — https://api.khqr.dev/docs
// Auth: store permanent token → Authorization: Bearer <RBK_TOKEN>. Amount/currency/merchant are
// resolved by KHQR.dev from the store link, so only the amount is sent.
export const deps = { fetch: (...a) => globalThis.fetch(...a) };

const baseUrl = () => (process.env.KHQR_API_URL || "https://api.khqr.dev/v1").replace(/\/+$/, "");
export const khqrConfigured = () => Boolean(process.env.RBK_TOKEN);

async function call(path, body, { timeoutMs = 15000 } = {}) {
  const token = process.env.RBK_TOKEN;
  if (!token) throw new AppError(503, "PAYMENT_NOT_CONFIGURED", "Payments are not configured on this server (RBK_TOKEN is missing).");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await deps.fetch(baseUrl() + path, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, json, retryAfter: Number(res.headers?.get?.("retry-after")) || 0 };
  } catch (err) {
    if (err?.name === "AbortError") throw new AppError(504, "PAYMENT_TIMEOUT", "The payment service took too long to answer. Please try again.");
    throw new AppError(502, "PAYMENT_UNREACHABLE", "The payment service is unreachable. Please try again later.");
  } finally {
    clearTimeout(timer);
  }
}

// POST /generate_qr → { qr, md5, tran_id, checkout_url? }
export async function generateQr({ amount, returnUrl, successUrl, cancelUrl }) {
  const body = { amount: Number(Number(amount).toFixed(2)) };
  if (returnUrl) body.return_url = returnUrl;
  if (successUrl) body.success_url = successUrl;
  if (cancelUrl) body.cancel_url = cancelUrl;
  const r = await call("/generate_qr", body);
  if (r.status === 429) throw new AppError(429, "PAYMENT_RATE_LIMITED", `Too many payment requests. Please wait ${r.retryAfter || 3} seconds and try again.`);
  if (!r.ok || r.json?.responseCode !== 0 || !r.json?.data?.md5) {
    throw new AppError(502, "PAYMENT_REJECTED", r.json?.responseMessage || "The payment service rejected the request.");
  }
  return r.json.data;
}

// POST /check_transaction_by_md5 → "paid" | "scanned" | "unpaid" | "expired"
// (paid/scanned = 200, unpaid = 404, expired = 400 — all are normal answers, not errors)
export async function checkByMd5(md5) {
  if (!/^[a-f0-9]{32}$/i.test(String(md5 || ""))) throw new AppError(400, "INVALID_MD5", "Invalid payment reference.");
  const r = await call("/check_transaction_by_md5", { md5 });
  if (r.status === 429) throw new AppError(429, "PAYMENT_RATE_LIMITED", "Too many status checks. Please wait a moment.");
  const st = String(r.json?.data?.status || "").toLowerCase();
  if (["paid", "scanned", "unpaid", "expired"].includes(st)) return { status: st, tranId: r.json?.data?.tran_id || null, hash: r.json?.data?.hash || null };
  if (r.status === 404) return { status: "unpaid" };
  if (r.status === 400) return { status: "expired" };
  throw new AppError(502, "PAYMENT_UNREACHABLE", "The payment service returned an unexpected answer.");
}
