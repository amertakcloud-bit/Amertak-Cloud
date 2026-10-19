import User from "../models/User.js";

// protectAdmin
// Ensures the authenticated user is an admin.
// Returns 403 if the user is not an admin.
export async function protectAdmin(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated. Please log in.",
      });
    }

    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required.",
      });
    }

    return next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "An error occurred. Please try again later.",
    });
  }
}
