// Mirrors backend/lib/permissions.js. Only hides buttons — the server enforces every rule.
const P = {
  admin: ["*"],
  support: ["users.read", "users.ban", "audit.read"],
  finance: ["users.read", "tokens.adjust", "ledger.read", "payments.read", "stats.read"],
};
export const isStaff = (u) => Boolean(u && P[u.role]);
export const can = (u, perm) => { const p = (u && P[u.role]) || []; return p.includes("*") || p.includes(perm); };
