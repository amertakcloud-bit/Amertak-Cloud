// Role → permissions. Enforced on the server (the frontend only hides buttons).
export const ROLES = ["user", "support", "finance", "admin"];
const P = {
  admin: ["*"],
  support: ["users.read", "users.ban", "audit.read"],
  finance: ["users.read", "tokens.adjust", "ledger.read", "payments.read", "stats.read"],
  user: [],
};
export const isStaff = (role) => role === "admin" || role === "support" || role === "finance";
export const permsFor = (role) => P[role] || [];
export const can = (role, perm) => { const p = permsFor(role); return p.includes("*") || p.includes(perm); };
