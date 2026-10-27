import { can, isStaff } from "../lib/permissions.js";

// requirePerm("tokens.adjust") — 401 when not logged in, 403 when the role lacks the permission.
export const requirePerm = (perm) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: "Not authenticated. Please log in." });
  if (!isStaff(req.user.role) || !can(req.user.role, perm)) {
    return res.status(403).json({ success: false, code: "FORBIDDEN", message: "You do not have permission to do this." });
  }
  return next();
};
