import test from "node:test";
import assert from "node:assert/strict";
import lite, { ObjectId } from "../lib/odm/lite.js";

// The SQLite look-alike must behave like MongoDB for everything the app does.
// (Uses :memory: and node:sqlite or better-sqlite3, whichever is available.)
const conn = lite.createConnection(":memory:");
const S = lite.Schema;

const userSchema = new S({
  name: { type: String, required: [true, "Name is required"], trim: true, minlength: [2, "Name too short"] },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, match: [/^\S+@\S+\.\S+$/, "Bad email"] },
  password: { type: String, select: false, required: function () { return this.provider !== "google"; } },
  provider: { type: String, enum: ["local", "google"], default: "local" },
  tokens: { type: Number, default: 0, min: [0, "Tokens cannot be negative"] },
  usedBy: { type: [{ type: lite.Types.ObjectId }], default: [] },
}, { timestamps: true });
let hashed = 0;
userSchema.pre("save", async function (next) { if (this.isModified("password") && this.password) { this.password = "h:" + this.password; hashed++; } next(); });
userSchema.methods.hi = function () { return "hi " + this.name; };
const User = conn.model("User", userSchema);

const Usage = conn.model("Usage", new S({ user: { type: lite.Types.ObjectId, required: true }, tool: String, tokens: Number, createdAt: { type: Date, default: Date.now } }, { versionKey: false }));
const Job = conn.model("Job", new S({ jti: { type: String, unique: true }, refunded: { type: Boolean, default: false }, createdAt: { type: Date, default: Date.now, expires: 3600 } }));
const fileSchema = new S({ shareId: { type: String, unique: true }, data: { type: Buffer, select: false }, downloads: { type: Number, default: 0 }, expiresAt: { type: Date, default: null } }, { timestamps: true });
fileSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const File = conn.model("File", fileSchema);

test("create / validate / unique / defaults / hooks / methods", async () => {
  const u = await User.create({ name: "  Dara ", email: " DARA@Mail.com ", password: "secret123" });
  assert.equal(u.name, "Dara"); assert.equal(u.email, "dara@mail.com"); assert.equal(u.tokens, 0); assert.equal(u.provider, "local");
  assert.ok(u._id instanceof ObjectId && /^[0-9a-f]{24}$/.test(String(u._id)));
  assert.equal(hashed, 1); assert.equal(u.hi(), "hi Dara"); assert.ok(u.createdAt instanceof Date);
  await assert.rejects(User.create({ name: "x", email: "bad" }), (e) => e.name === "ValidationError" && /Name too short/.test(e.message) && /Bad email/.test(e.message));
  await assert.rejects(User.create({ name: "Dup", email: "dara@mail.com", password: "p" }), (e) => e.code === 11000);
  await assert.rejects(User.create({ name: "Nopass", email: "n@x.co" }), (e) => e.name === "ValidationError");
  await User.create({ name: "Goo", email: "g@x.co", provider: "google" }); // password not required for google
  await assert.rejects(User.create({ name: "Bad", email: "b@x.co", provider: "nope", password: "p" }), (e) => e.name === "ValidationError");
});

test("find / select(+password) / sort / skip / limit / lean / count / regex / $or", async () => {
  for (let i = 0; i < 5; i++) await User.create({ name: `User ${i}`, email: `u${i}@x.co`, password: "p", tokens: i });
  const plain = await User.findOne({ email: "dara@mail.com" });
  assert.equal(plain.password, undefined);
  const withPw = await User.findOne({ email: "dara@mail.com" }).select("+password");
  assert.equal(withPw.password, "h:secret123");
  const page = await User.find({ provider: "local" }).select("name tokens").sort({ tokens: -1 }).skip(1).limit(2).lean();
  assert.deepEqual(page.map((x) => x.tokens), [3, 2]);
  assert.equal(page[0].email, undefined);
  assert.equal(await User.countDocuments({ tokens: { $gte: 3 } }), 2);
  assert.equal((await User.find({ $or: [{ name: { $regex: "user 1", $options: "i" } }, { email: { $regex: "^g@" } }] })).length, 2);
  assert.equal((await User.findById(String(plain._id))).name, "Dara");
  assert.equal(await User.findById("nonexistent"), null);
  assert.equal((await Promise.all([User.countDocuments(), User.find({ tokens: 4 })]))[1].length, 1);
});

test("save() only writes modified paths; hooks re-run; updateOne $set/$inc", async () => {
  const u = await User.findOne({ email: "u1@x.co" }); // password not loaded
  u.name = "Renamed"; await u.save();
  const again = await User.findOne({ email: "u1@x.co" }).select("+password");
  assert.equal(again.name, "Renamed"); assert.equal(again.password, "h:p"); // untouched hidden field survives
  await User.updateOne({ _id: u._id }, { $inc: { tokens: 10 }, $set: { name: "Z" } });
  const z = await User.findById(u._id); assert.equal(z.tokens, 11); assert.equal(z.name, "Z");
  u.usedBy = [new ObjectId(), new ObjectId()]; await u.save();
  const w = await User.findById(u._id); assert.ok(w.usedBy[0].equals(u.usedBy[0]));
});

test("atomic charge pattern: findOneAndUpdate with $gte guard + {new:true} + runValidators", async () => {
  const u = await User.create({ name: "Rich", email: "rich@x.co", password: "p", tokens: 10 });
  const a = await User.findOneAndUpdate({ _id: u._id, tokens: { $gte: 4 } }, { $inc: { tokens: -4 } }, { new: true });
  assert.equal(a.tokens, 6);
  const b = await User.findOneAndUpdate({ _id: u._id, tokens: { $gte: 99 } }, { $inc: { tokens: -99 } }, { new: true });
  assert.equal(b, null);
  const old = await User.findOneAndUpdate({ _id: u._id }, { $set: { tokens: 1 } });
  assert.equal(old.tokens, 6); // default returns the document BEFORE the update
  await assert.rejects(User.findByIdAndUpdate(u._id, { $inc: { tokens: -50 } }, { new: true, runValidators: true }), (e) => e.name === "ValidationError");
  const sel = await User.findByIdAndUpdate(u._id, { $inc: { tokens: 1 } }, { new: true }).select("name tokens");
  assert.deepEqual([sel.name, sel.tokens, sel.email], ["Rich", 2, undefined]);
  // concurrent charges can never overdraw
  const res = await Promise.all(Array.from({ length: 6 }, () => User.findOneAndUpdate({ _id: u._id, tokens: { $gte: 1 } }, { $inc: { tokens: -1 } }, { new: true })));
  assert.equal(res.filter(Boolean).length, 2);
});

test("null / $ne / dates / aggregate (group by day, sum, $cond)", async () => {
  const u = new ObjectId();
  const d = (s) => new Date(s);
  await Usage.create({ user: u, tool: "caption", tokens: 5, createdAt: d("2026-10-20T23:30:00Z") });
  await Usage.create({ user: u, tool: "caption", tokens: -5, createdAt: d("2026-10-21T01:00:00Z") });
  await Usage.create({ user: u, tool: "cloudshare", tokens: 2, createdAt: d("2026-10-21T02:00:00Z") });
  await Usage.create({ user: new ObjectId(), tool: "x", tokens: 99 });
  const byDay = await Usage.aggregate([{ $match: { user: u, createdAt: { $gte: d("2026-10-01") } } }, { $group: { _id: { $dateToString: { date: "$createdAt", format: "%Y-%m-%d", timezone: "+07:00" } }, tokens: { $sum: "$tokens" } } }]);
  assert.deepEqual(byDay, [{ _id: "2026-10-21", tokens: 2 }]); // 23:30Z on the 20th is already the 21st in UTC+7
  const utc = await Usage.aggregate([{ $match: { user: u } }, { $group: { _id: { $dateToString: { date: "$createdAt", format: "%Y-%m-%d", timezone: "+00:00" } }, tokens: { $sum: "$tokens" } } }, { $sort: { _id: 1 } }]);
  assert.deepEqual(utc, [{ _id: "2026-10-20", tokens: 5 }, { _id: "2026-10-21", tokens: -3 }]);
  const byTool = await Usage.aggregate([{ $match: { user: u } }, { $group: { _id: "$tool", tokens: { $sum: "$tokens" }, count: { $sum: { $cond: [{ $gt: ["$tokens", 0] }, 1, 0] } } } }, { $sort: { tokens: -1 } }]);
  assert.deepEqual(byTool.map((x) => [x._id, x.tokens, x.count]), [["cloudshare", 2, 1], ["caption", 0, 1]]);
  const total = await Usage.aggregate([{ $match: { user: u } }, { $group: { _id: null, tokens: { $sum: "$tokens" } } }]);
  assert.equal(total[0].tokens, 2);
  assert.equal((await Usage.find({ user: u, tokens: { $ne: null } })).length, 3);
});

test("Buffers, select:false data, $inc without touching the blob, TTL purge", async () => {
  const big = Buffer.alloc(1024 * 300, 7);
  const f = await File.create({ shareId: "abc", data: big, expiresAt: null });
  assert.equal(f.data.length, big.length);
  const noData = await File.findOne({ shareId: "abc" });
  assert.equal(noData.data, undefined);
  await File.updateOne({ shareId: "abc" }, { $inc: { downloads: 1 } });
  const withData = await File.findOne({ shareId: "abc" }).select("+data");
  assert.ok(Buffer.isBuffer(withData.data) && withData.data.equals(big) && withData.downloads === 1);
  await File.create({ shareId: "old", data: Buffer.from("x"), expiresAt: new Date(Date.now() - 1000) });
  await File.create({ shareId: "future", data: Buffer.from("y"), expiresAt: new Date(Date.now() + 3600e3) });
  assert.equal(await File.findOne({ shareId: "old" }), null); // expired → auto-removed
  assert.ok(await File.findOne({ shareId: "future" }));
  assert.equal((await File.deleteOne({ shareId: "future" })).deletedCount, 1);
  assert.equal(await File.countDocuments({ shareId: "future" }), 0);
  const o = (await File.findOne({ shareId: "abc" })).toObject();
  assert.equal(typeof o.shareId, "string");
});

test("TTL on createdAt via { expires }, boolean filters, findByIdAndDelete", async () => {
  await Job.create({ jti: "old", createdAt: new Date(Date.now() - 2 * 3600e3) });
  const fresh = await Job.create({ jti: "new" });
  assert.equal(await Job.findOne({ jti: "old" }), null);
  const claimed = await Job.findOneAndUpdate({ jti: "new", refunded: false }, { refunded: true }); // plain update object = $set
  assert.ok(claimed);
  assert.equal(await Job.findOneAndUpdate({ jti: "new", refunded: false }, { refunded: true }), null); // refund only once
  assert.ok(await Job.findByIdAndDelete(fresh._id));
  assert.equal(await Job.findById(fresh._id), null);
});
