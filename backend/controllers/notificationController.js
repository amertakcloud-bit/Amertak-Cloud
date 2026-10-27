import Notification from "../models/Notification.js";
import Ledger from "../models/Ledger.js";
import { asyncHandler } from "../middleware/errorMiddleware.js";

// GET /api/users/notifications  → latest 30 + unread count (the bell polls this)
export const listNotifications = asyncHandler(async (req, res) => {
  const [items, unread] = await Promise.all([
    Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(30),
    Notification.countDocuments({ user: req.user._id, read: false }),
  ]);
  res.json({ success: true, data: { items, unread } });
});

export const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { $set: { read: true } });
  res.json({ success: true });
});

export const markRead = asyncHandler(async (req, res) => {
  await Notification.updateOne({ _id: req.params.id, user: req.user._id }, { $set: { read: true } });
  res.json({ success: true });
});

// GET /api/users/ledger  → the user's own token history
export const listLedger = asyncHandler(async (req, res) => {
  const items = await Ledger.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100);
  res.json({ success: true, data: { items } });
});
