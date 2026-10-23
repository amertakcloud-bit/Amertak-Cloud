import dns from "node:dns/promises";
import net from "node:net";
import { AppError } from "../../lib/AppError.js";

export const deps = { lookup: (host) => dns.lookup(host, { all: true, verbatim: true }) };

export function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === "::" || v === "::1") return true;
    if (v.startsWith("::ffff:")) return isPrivateIp(v.slice(7));
    return /^(fc|fd|fe[89ab])/.test(v) || v.startsWith("ff");
  }
  return true;
}

// Throws unless the URL is http(s) on the default ports and resolves only to public IPs.
export async function assertPublicUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    throw new AppError(400, "INVALID_URL", "That link is not a valid URL.");
  }
  if (!/^https?:$/.test(u.protocol)) throw new AppError(400, "INVALID_URL", "Only http(s) links are supported.");
  if (u.username || u.password) throw new AppError(400, "INVALID_URL", "Links with credentials are not allowed.");
  if (u.port && !["80", "443"].includes(u.port)) throw new AppError(400, "INVALID_URL", "Unusual ports are not allowed.");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (/^localhost$|\.local$|\.internal$/i.test(host)) throw new AppError(400, "BLOCKED_URL", "That address is not allowed.");
  let addrs;
  if (net.isIP(host)) addrs = [{ address: host }];
  else {
    try {
      addrs = await deps.lookup(host);
    } catch {
      throw new AppError(400, "UNREACHABLE_URL", "Could not find that website.");
    }
  }
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) {
    throw new AppError(400, "BLOCKED_URL", "That address is not allowed.");
  }
  return u;
}

// fetch that validates the target and every redirect hop (max 5), with a timeout.
export async function safeFetch(raw, init = {}, { timeoutMs = 15000, maxRedirects = 5 } = {}) {
  let url = raw;
  for (let i = 0; i <= maxRedirects; i += 1) {
    const u = await assertPublicUrl(url);
    const res = await fetch(u, { ...init, redirect: "manual", signal: AbortSignal.timeout(timeoutMs) });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      res.body?.cancel?.().catch?.(() => {});
      url = new URL(res.headers.get("location"), u).toString();
      continue;
    }
    return { res, url: u.toString() };
  }
  throw new AppError(400, "TOO_MANY_REDIRECTS", "The link redirects too many times.");
}
