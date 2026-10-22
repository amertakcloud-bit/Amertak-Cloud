import crypto from "node:crypto";
import { openSqlite } from "./driver.js";

// mongoose-lite: the slice of the Mongoose/MongoDB API this project uses, stored in SQLite.
//  • one table per collection:  _id TEXT PRIMARY KEY, doc TEXT (JSON)      • Buffers live in "<coll>__blobs"
//  • unique / index fields become real SQLite (expression) indexes          • TTL (expires / expireAfterSeconds) is purged lazily
//  • every operation runs synchronously after its first await → single-process atomicity (like findOneAndUpdate)
// It is only used when MONGODB_URI / CLOUD_MONGODB_URI are not configured.

/* ───────── ObjectId ───────── */
let oidCounter = crypto.randomInt(0, 0xffffff);
export class ObjectId {
  constructor(v) {
    if (v instanceof ObjectId) this._s = v._s;
    else if (v != null) this._s = String(v);
    else {
      const t = Math.floor(Date.now() / 1000).toString(16).padStart(8, "0");
      oidCounter = (oidCounter + 1) & 0xffffff;
      this._s = t + crypto.randomBytes(5).toString("hex") + oidCounter.toString(16).padStart(6, "0");
    }
  }
  toString() { return this._s; }
  toJSON() { return this._s; }
  valueOf() { return this._s; }
  equals(o) { return String(o) === this._s; }
  get [Symbol.toStringTag]() { return "ObjectId"; }
  static isValid(v) { return /^[0-9a-f]{24}$/i.test(String(v ?? "")); }
}
const MIXED = { __mixed: true };

/* ───────── errors ───────── */
function validationError(errors) {
  const e = new Error(Object.values(errors).map((x) => x.message).join(", "));
  e.name = "ValidationError";
  e.errors = errors;
  return e;
}
function duplicateError(field, coll) {
  const e = new Error(`E11000 duplicate key error collection: ${coll} index: ${field}_1`);
  e.code = 11000;
  e.keyPattern = { [field]: 1 };
  return e;
}

/* ───────── Schema ───────── */
function parseType(def) {
  if (Array.isArray(def)) return { type: "Array", of: parseType(def[0] ?? MIXED), opts: {} };
  if (def === String) return { type: "String" };
  if (def === Number) return { type: "Number" };
  if (def === Boolean) return { type: "Boolean" };
  if (def === Date) return { type: "Date" };
  if (def === Buffer) return { type: "Buffer" };
  if (def === ObjectId) return { type: "ObjectId" };
  if (def === MIXED || def === Object) return { type: "Mixed" };
  if (def && typeof def === "object" && "type" in def) {
    const inner = parseType(def.type);
    return { ...inner, opts: def };
  }
  return { type: "Mixed" };
}
const normPath = (def) => {
  const p = parseType(def);
  if (p.type === "Array" && def && !Array.isArray(def) && def.type) p.opts = def; // { type: [..], default: [] }
  p.opts = p.opts || {};
  return p;
};
const msgOf = (v, dflt) => (Array.isArray(v) ? v[1] ?? dflt : dflt);
const valOf = (v) => (Array.isArray(v) ? v[0] : v);

export class Schema {
  constructor(def = {}, options = {}) {
    this.options = options;
    this.paths = {};
    this.methods = {};
    this.statics = {};
    this.hooks = { save: [] };
    this.indexes = [];
    for (const [k, v] of Object.entries(def)) this.paths[k] = normPath(v);
    if (options.timestamps) {
      this.paths.createdAt = this.paths.createdAt || { type: "Date", opts: {} };
      this.paths.updatedAt = this.paths.updatedAt || { type: "Date", opts: {} };
    }
  }
  pre(name, fn) { (this.hooks[name] ||= []).push(fn); return this; }
  index(spec, opts = {}) { this.indexes.push({ spec, opts }); return this; }
  virtual() { return { get() {}, set() {} }; }
}
Schema.Types = { ObjectId, Mixed: MIXED };

/* ───────── casting & validation ───────── */
function cast(p, v) {
  if (v === null || v === undefined) return v ?? null;
  switch (p.type) {
    case "String": {
      let s = typeof v === "string" ? v : String(v);
      if (p.opts.trim) s = s.trim();
      if (p.opts.lowercase) s = s.toLowerCase();
      if (p.opts.uppercase) s = s.toUpperCase();
      return s;
    }
    case "Number": { const n = Number(v); if (Number.isNaN(n)) throw Object.assign(new Error(`Cast to Number failed for value "${v}"`), { name: "CastError" }); return n; }
    case "Boolean": return v === true || v === "true" || v === 1 || v === "1";
    case "Date": { const d = v instanceof Date ? v : new Date(v); if (Number.isNaN(d.getTime())) throw Object.assign(new Error(`Cast to date failed for value "${v}"`), { name: "CastError" }); return d; }
    case "Buffer": return Buffer.isBuffer(v) ? v : Buffer.from(v);
    case "ObjectId": return v instanceof ObjectId ? v : new ObjectId(v);
    case "Array": return (Array.isArray(v) ? v : [v]).map((x) => cast(p.of, x));
    default: return v;
  }
}

function validatePath(path, p, v, doc) {
  const o = p.opts, errs = {};
  const fail = (m) => { errs[path] = { message: m, path, kind: "user defined" }; };
  const req = typeof o.required === "function" ? o.required.call(doc) : valOf(o.required);
  const empty = v === undefined || v === null || (p.type === "String" && v === "");
  if (req && empty) { fail(typeof o.required === "function" ? `Path \`${path}\` is required.` : msgOf(o.required, `Path \`${path}\` is required.`)); return errs; }
  if (empty) return errs;
  if (p.type === "String") {
    if (o.minlength != null && v.length < valOf(o.minlength)) fail(msgOf(o.minlength, `Path \`${path}\` is shorter than the minimum allowed length (${valOf(o.minlength)}).`));
    if (o.maxlength != null && v.length > valOf(o.maxlength)) fail(msgOf(o.maxlength, `Path \`${path}\` is longer than the maximum allowed length (${valOf(o.maxlength)}).`));
    if (o.match && !valOf(o.match).test(v)) fail(msgOf(o.match, `Path \`${path}\` is invalid (${v}).`));
  }
  if (p.type === "Number") {
    if (o.min != null && v < valOf(o.min)) fail(msgOf(o.min, `Path \`${path}\` (${v}) is less than minimum allowed value (${valOf(o.min)}).`));
    if (o.max != null && v > valOf(o.max)) fail(msgOf(o.max, `Path \`${path}\` (${v}) is more than maximum allowed value (${valOf(o.max)}).`));
  }
  if (o.enum) {
    const values = Array.isArray(o.enum) ? o.enum : o.enum.values;
    if (!values.includes(v)) fail(o.enum.message ? o.enum.message.replace("{VALUE}", v) : `\`${v}\` is not a valid enum value for path \`${path}\`.`);
  }
  return errs;
}

/* ───────── query matching ───────── */
const cmp = (v) => (v instanceof Date ? v.getTime() : v instanceof ObjectId ? v._s : v === undefined ? null : v);
const looseEq = (a, b) => { a = cmp(a); b = cmp(b); return a === b || (typeof a === "number" && typeof b === "string" && String(a) === b); };
const getPath = (o, p) => p.split(".").reduce((x, k) => (x == null ? undefined : x[k]), o);

function fieldMatch(val, cond) {
  const isOps = cond && typeof cond === "object" && !(cond instanceof Date) && !(cond instanceof ObjectId) && !(cond instanceof RegExp) && !Array.isArray(cond) && Object.keys(cond).some((k) => k.startsWith("$"));
  const arr = Array.isArray(val) ? val : null;
  const anyEq = (c) => (arr ? arr.some((x) => looseEq(x, c)) || (c === null && arr.length === 0) : looseEq(val, c));
  if (!isOps) {
    if (cond instanceof RegExp) return typeof val === "string" && cond.test(val);
    return anyEq(cond);
  }
  for (const [op, c] of Object.entries(cond)) {
    const one = (fn) => (arr ? arr.some(fn) : fn(val));
    switch (op) {
      case "$eq": if (!anyEq(c)) return false; break;
      case "$ne": if (anyEq(c)) return false; break;
      case "$gt": if (!one((x) => x != null && cmp(x) > cmp(c))) return false; break;
      case "$gte": if (!one((x) => x != null && cmp(x) >= cmp(c))) return false; break;
      case "$lt": if (!one((x) => x != null && cmp(x) < cmp(c))) return false; break;
      case "$lte": if (!one((x) => x != null && cmp(x) <= cmp(c))) return false; break;
      case "$in": if (!c.some((x) => anyEq(x))) return false; break;
      case "$nin": if (c.some((x) => anyEq(x))) return false; break;
      case "$exists": if ((val !== undefined && val !== null) !== Boolean(c)) return false; break;
      case "$regex": {
        const src = c instanceof RegExp ? c.source : String(c);
        if (src.length > 200) return false;
        let re; try { re = new RegExp(src, c instanceof RegExp ? c.flags : cond.$options || ""); } catch { return false; }
        if (!one((x) => typeof x === "string" && re.test(x))) return false;
        break;
      }
      case "$options": break;
      default: throw new Error(`Unsupported query operator ${op}`);
    }
  }
  return true;
}
export function matches(doc, filter) {
  for (const [k, c] of Object.entries(filter || {})) {
    if (k === "$or") { if (!c.some((f) => matches(doc, f))) return false; }
    else if (k === "$and") { if (!c.every((f) => matches(doc, f))) return false; }
    else if (k === "$nor") { if (c.some((f) => matches(doc, f))) return false; }
    else if (k.startsWith("$")) throw new Error(`Unsupported query operator ${k}`);
    else if (!fieldMatch(getPath(doc, k), c)) return false;
  }
  return true;
}

/* ───────── updates ───────── */
function applyUpdate(raw, update, schema) {
  const ops = Object.keys(update).some((k) => k.startsWith("$")) ? update : { $set: update };
  const touched = new Set();
  const setP = (k, v) => { const p = schema.paths[k]; raw[k] = p ? cast(p, v) : v; touched.add(k); };
  for (const [op, body] of Object.entries(ops)) {
    for (const [k, v] of Object.entries(body || {})) {
      const p = schema.paths[k];
      switch (op) {
        case "$set": setP(k, v); break;
        case "$unset": delete raw[k]; touched.add(k); break;
        case "$inc": raw[k] = (Number(raw[k]) || 0) + Number(v); touched.add(k); break;
        case "$push": raw[k] = [...(raw[k] || []), p?.of ? cast(p.of, v) : v]; touched.add(k); break;
        case "$addToSet": { const x = p?.of ? cast(p.of, v) : v; const cur = raw[k] || []; raw[k] = cur.some((y) => looseEq(y, x)) ? cur : [...cur, x]; touched.add(k); break; }
        case "$pull": raw[k] = (raw[k] || []).filter((y) => !looseEq(y, v)); touched.add(k); break;
        default: throw new Error(`Unsupported update operator ${op}`);
      }
    }
  }
  return touched;
}

/* ───────── aggregation (subset) ───────── */
function tzOffsetMin(tz) {
  const m = /^([+-])(\d{2}):?(\d{2})$/.exec(String(tz || "")); return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
}
function evalExpr(e, doc) {
  if (typeof e === "string" && e.startsWith("$")) return getPath(doc, e.slice(1));
  if (Array.isArray(e)) return e.map((x) => evalExpr(x, doc));
  if (e && typeof e === "object" && !(e instanceof Date)) {
    const [op] = Object.keys(e);
    const a = e[op];
    const bin = (f) => { const [x, y] = a.map((z) => evalExpr(z, doc)); return f(cmp(x), cmp(y)); };
    switch (op) {
      case "$dateToString": {
        const d = evalExpr(a.date, doc); if (!d) return null;
        const t = new Date(new Date(d).getTime() + tzOffsetMin(a.timezone) * 60000), p2 = (n) => String(n).padStart(2, "0");
        return String(a.format || "%Y-%m-%dT%H:%M:%S.%LZ").replace(/%Y/g, t.getUTCFullYear()).replace(/%m/g, p2(t.getUTCMonth() + 1)).replace(/%d/g, p2(t.getUTCDate()))
          .replace(/%H/g, p2(t.getUTCHours())).replace(/%M/g, p2(t.getUTCMinutes())).replace(/%S/g, p2(t.getUTCSeconds())).replace(/%L/g, String(t.getUTCMilliseconds()).padStart(3, "0"));
      }
      case "$cond": { const [c, t, f] = Array.isArray(a) ? a : [a.if, a.then, a.else]; return evalExpr(c, doc) ? evalExpr(t, doc) : evalExpr(f, doc); }
      case "$gt": return bin((x, y) => x > y); case "$gte": return bin((x, y) => x >= y);
      case "$lt": return bin((x, y) => x < y); case "$lte": return bin((x, y) => x <= y);
      case "$eq": return bin((x, y) => x === y); case "$ne": return bin((x, y) => x !== y);
      case "$add": return a.map((z) => Number(evalExpr(z, doc)) || 0).reduce((s, x) => s + x, 0);
      case "$multiply": return a.map((z) => Number(evalExpr(z, doc)) || 0).reduce((s, x) => s * x, 1);
      default: return e;
    }
  }
  return e;
}
function aggregate(rows, pipeline) {
  let cur = rows;
  for (const stage of pipeline) {
    const [op] = Object.keys(stage);
    const a = stage[op];
    if (op === "$match") cur = cur.filter((d) => matches(d, a));
    else if (op === "$sort") cur = sortRows(cur, a);
    else if (op === "$limit") cur = cur.slice(0, a);
    else if (op === "$skip") cur = cur.slice(a);
    else if (op === "$group") {
      const groups = new Map();
      for (const d of cur) {
        const id = evalExpr(a._id, d);
        const key = JSON.stringify(id instanceof Date ? id.toISOString() : id);
        let g = groups.get(key);
        if (!g) { g = { _id: id, _n: {} }; groups.set(key, g); }
        for (const [f, acc] of Object.entries(a)) {
          if (f === "_id") continue;
          const [aop] = Object.keys(acc), v = evalExpr(acc[aop], d), n = (g._n[f] ||= { c: 0 });
          if (aop === "$sum") g[f] = (g[f] || 0) + (Number(v) || 0);
          else if (aop === "$avg") { n.c += 1; n.s = (n.s || 0) + (Number(v) || 0); g[f] = n.s / n.c; }
          else if (aop === "$min") g[f] = g[f] === undefined || cmp(v) < cmp(g[f]) ? v : g[f];
          else if (aop === "$max") g[f] = g[f] === undefined || cmp(v) > cmp(g[f]) ? v : g[f];
          else if (aop === "$first") { if (g[f] === undefined) g[f] = v; }
          else throw new Error(`Unsupported accumulator ${aop}`);
        }
      }
      cur = [...groups.values()].map(({ _n, ...g }) => g);
    } else throw new Error(`Unsupported aggregation stage ${op}`);
  }
  return cur;
}
function sortRows(rows, spec) {
  const keys = Object.entries(spec || {});
  if (!keys.length) return rows;
  return [...rows].sort((x, y) => {
    for (const [k, dir] of keys) {
      const a = cmp(getPath(x, k)), b = cmp(getPath(y, k));
      if (a === b) continue;
      if (a == null) return -dir; if (b == null) return dir;
      return (a < b ? -1 : 1) * (dir < 0 ? -1 : 1);
    }
    return 0;
  });
}

/* ───────── connection + models ───────── */
const q = (s) => `"${String(s).replace(/"/g, '""')}"`;

function toStored(raw, schema) {
  const doc = {}, blobs = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k === "_id") continue;
    if (v === undefined) continue;
    if (schema.paths[k]?.type === "Buffer" && v != null) blobs[k] = v; else doc[k] = v;
  }
  return { json: JSON.stringify(doc), blobs };
}
function revive(rowDoc, schema, id) {
  const o = JSON.parse(rowDoc);
  for (const [k, p] of Object.entries(schema.paths)) {
    if (o[k] == null) continue;
    if (p.type === "Date") o[k] = new Date(o[k]);
    else if (p.type === "ObjectId") o[k] = new ObjectId(o[k]);
    else if (p.type === "Array" && p.of.type === "Date") o[k] = o[k].map((x) => new Date(x));
    else if (p.type === "Array" && p.of.type === "ObjectId") o[k] = o[k].map((x) => new ObjectId(x));
  }
  o._id = new ObjectId(id);
  return o;
}

class Connection {
  constructor(file) {
    this.file = file;
    this.models = {};
    this.readyState = 0;
    this.host = "sqlite";
    this.name = file;
    this._open = null;
    this.db = null;
  }
  open() {
    if (!this._open) {
      this._open = openSqlite(this.file).then((db) => { this.db = db; this.readyState = 1; return this; }).catch((e) => { this._open = null; throw e; });
    }
    return this._open;
  }
  asPromise() { return this.open(); }
  model(name, schema) { return (this.models[name] ||= buildModel(this, name, schema)); }
  async close() { if (this.db) { this.db.close(); this.db = null; } this.readyState = 0; this._open = null; }
}

function buildModel(conn, name, schema) {
  const coll = name.toLowerCase().replace(/[^a-z0-9]+/g, "_") + "s";
  const T = q(coll), B = q(coll + "__blobs");
  const bufferPaths = Object.entries(schema.paths).filter(([, p]) => p.type === "Buffer").map(([k]) => k);
  const ttl = [];
  for (const [k, p] of Object.entries(schema.paths)) if (p.opts.expires != null) ttl.push({ path: k, seconds: Number(p.opts.expires) });
  for (const { spec, opts } of schema.indexes) if (opts.expireAfterSeconds != null) ttl.push({ path: Object.keys(spec)[0], seconds: opts.expireAfterSeconds });
  const uniques = Object.entries(schema.paths).filter(([, p]) => p.opts.unique).map(([k]) => k);
  const indexed = Object.entries(schema.paths).filter(([k, p]) => (p.opts.index || p.opts.unique) && p.type !== "Buffer").map(([k]) => k);
  let ready = false;

  async function init() {
    await conn.open();
    if (ready) return conn.db;
    const db = conn.db;
    db.exec(`CREATE TABLE IF NOT EXISTS ${T} (_id TEXT PRIMARY KEY, doc TEXT NOT NULL)`);
    if (bufferPaths.length) db.exec(`CREATE TABLE IF NOT EXISTS ${B} (_id TEXT NOT NULL, field TEXT NOT NULL, data BLOB, PRIMARY KEY (_id, field))`);
    for (const k of indexed) {
      const kind = uniques.includes(k) ? "UNIQUE INDEX" : "INDEX";
      db.exec(`CREATE ${kind} IF NOT EXISTS ${q(`${coll}_${k}_idx`)} ON ${T} (json_extract(doc, '$.${k}'))`);
    }
    for (const { spec, opts } of schema.indexes) {
      const keys = Object.keys(spec);
      if (!keys.length || keys.some((k) => !/^[\w.]+$/.test(k))) continue;
      db.exec(`CREATE ${opts.unique ? "UNIQUE " : ""}INDEX IF NOT EXISTS ${q(`${coll}_${keys.join("_")}_cidx`)} ON ${T} (${keys.map((k) => `json_extract(doc, '$.${k}')`).join(", ")})`);
    }
    for (const { path } of ttl) if (/^\w+$/.test(path)) db.exec(`CREATE INDEX IF NOT EXISTS ${q(`${coll}_${path}_ttl`)} ON ${T} (json_extract(doc, '$.${path}'))`);
    ready = true;
    return db;
  }

  const wrapDup = (fn) => {
    try { return fn(); } catch (e) {
      if (/UNIQUE constraint failed/i.test(String(e?.message))) {
        const m = /index '([^']+)_idx'/.exec(e.message);
        const field = m && m[1].startsWith(coll + "_") ? m[1].slice(coll.length + 1) : /_id/.test(e.message) ? "_id" : uniques[0] || "_id";
        throw duplicateError(field, coll);
      }
      throw e;
    }
  };

  function purge(db) {
    if (!ttl.length) return;
    for (const { path, seconds } of ttl) {
      const cutoff = new Date(Date.now() - seconds * 1000).toISOString();
      const ids = db.all(`SELECT _id FROM ${T} WHERE json_extract(doc, '$.${path}') IS NOT NULL AND json_extract(doc, '$.${path}') <= ?`, cutoff);
      for (const { _id } of ids) { db.run(`DELETE FROM ${T} WHERE _id = ?`, _id); if (bufferPaths.length) db.run(`DELETE FROM ${B} WHERE _id = ?`, _id); }
    }
  }

  // Candidate rows (SQL narrows by top-level scalar equality; JS applies the exact filter).
  function candidates(db, filter) {
    purge(db);
    const where = [], args = [];
    for (const [k, c] of Object.entries(filter || {})) {
      if (k.startsWith("$") || k.includes(".")) continue;
      const v = c instanceof ObjectId ? c._s : c;
      if (!(typeof v === "string" || typeof v === "number" || typeof v === "boolean")) continue;
      if (schema.paths[k]?.type === "Array" || schema.paths[k]?.type === "Date") continue;
      if (k === "_id") { where.push("_id = ?"); args.push(String(v)); }
      else if (/^\w+$/.test(k)) { where.push(`json_extract(doc, '$.${k}') = ?`); args.push(v); }
    }
    const rows = db.all(`SELECT _id, doc FROM ${T}${where.length ? " WHERE " + where.join(" AND ") : ""}`, ...args);
    return rows.map((r) => revive(r.doc, schema, r._id)).filter((d) => matches(d, filter));
  }

  function loadBlobs(db, raw, fields) {
    for (const f of fields) { const r = db.get(`SELECT data FROM ${B} WHERE _id = ? AND field = ?`, String(raw._id), f); if (r) raw[f] = r.data; }
  }
  function persist(db, raw, { insert }) {
    const { json, blobs } = toStored(raw, schema);
    const id = String(raw._id);
    wrapDup(() => {
      if (insert) db.run(`INSERT INTO ${T} (_id, doc) VALUES (?, ?)`, id, json);
      else db.run(`UPDATE ${T} SET doc = ? WHERE _id = ?`, json, id);
    });
    for (const f of bufferPaths) {
      if (f in blobs) db.run(`INSERT OR REPLACE INTO ${B} (_id, field, data) VALUES (?, ?, ?)`, id, f, blobs[f]);
    }
  }

  function defaults(data) {
    const raw = {};
    for (const [k, p] of Object.entries(schema.paths)) {
      let v = data[k];
      if (v === undefined && p.opts.default !== undefined) v = typeof p.opts.default === "function" ? p.opts.default() : (Array.isArray(p.opts.default) ? [...p.opts.default] : p.opts.default && typeof p.opts.default === "object" && !(p.opts.default instanceof Date) ? structuredClone(p.opts.default) : p.opts.default);
      if (v === undefined && p.type === "Array") v = [];
      if (v !== undefined) raw[k] = cast(p, v);
    }
    raw._id = data._id ? new ObjectId(data._id) : new ObjectId();
    return raw;
  }
  function validate(raw, paths, doc) {
    const errs = {};
    for (const k of paths || Object.keys(schema.paths)) { const p = schema.paths[k]; if (p) Object.assign(errs, validatePath(k, p, raw[k], doc || raw)); }
    if (Object.keys(errs).length) throw validationError(errs);
  }

  /* selection */
  function selector(spec) {
    const toks = typeof spec === "string" ? spec.split(/\s+/).filter(Boolean) : Object.entries(spec || {}).map(([k, v]) => (v ? k : "-" + k));
    const plus = new Set(), minus = new Set(), only = new Set();
    for (const t of toks) { if (t[0] === "+") plus.add(t.slice(1)); else if (t[0] === "-") minus.add(t.slice(1)); else only.add(t); }
    const hiddenByDefault = (k) => schema.paths[k]?.opts.select === false && !plus.has(k);
    return (k) => {
      if (k === "_id") return !minus.has("_id");
      if (only.size) return only.has(k) || plus.has(k);
      if (minus.has(k)) return false;
      return !hiddenByDefault(k);
    };
  }

  function Doc(raw, { isNew = false, sel = null } = {}) {
    Object.defineProperty(this, "_doc", { value: raw, writable: true, enumerable: false });
    Object.defineProperty(this, "_mod", { value: new Set(isNew ? Object.keys(raw) : []), writable: true, enumerable: false });
    Object.defineProperty(this, "isNew", { value: isNew, writable: true, enumerable: false });
    Object.defineProperty(this, "_sel", { value: sel, writable: true, enumerable: false });
  }
  for (const [k, p] of Object.entries(schema.paths)) {
    Object.defineProperty(Doc.prototype, k, {
      enumerable: true, configurable: true,
      get() { return this._doc[k]; },
      set(v) { this._doc[k] = cast(p, v); this._mod.add(k); },
    });
  }
  Object.defineProperty(Doc.prototype, "_id", { get() { return this._doc._id; }, enumerable: true });
  Object.defineProperty(Doc.prototype, "id", { get() { return String(this._doc._id); } });
  Object.assign(Doc.prototype, schema.methods);
  Doc.prototype.isModified = function (k) { return k ? this._mod.has(k) : this._mod.size > 0; };
  Doc.prototype.toObject = function () {
    const o = {};
    for (const [k, v] of Object.entries(this._doc)) o[k] = Buffer.isBuffer(v) ? v : Array.isArray(v) ? [...v] : v;
    return o;
  };
  Doc.prototype.toJSON = function () { const o = this.toObject(); if (schema.options.toJSON?.virtuals) o.id = String(o._id); return JSON.parse(JSON.stringify(o)); };
  Doc.prototype.set = function (k, v) { this[k] = v; return this; };
  Doc.prototype.get = function (k) { return this._doc[k]; };
  Doc.prototype.save = async function () {
    const db = await init();
    const hooks = schema.hooks.save || [];
    const self = this;
    for (const fn of hooks) {
      await new Promise((res, rej) => {
        let r;
        try { r = fn.length > 0 ? fn.call(self, (e) => (e ? rej(e) : res())) : fn.call(self); } catch (e) { return rej(e); }
        if (fn.length === 0) Promise.resolve(r).then(res, rej);
      });
    }
    const now = new Date();
    if (schema.options.timestamps) { if (this.isNew && !this._doc.createdAt) this._doc.createdAt = now; this._doc.updatedAt = now; this._mod.add("updatedAt"); }
    if (this.isNew) {
      validate(this._doc, null, this);
      persist(db, this._doc, { insert: true });
      this.isNew = false;
    } else {
      validate(this._doc, [...this._mod], this);
      const cur = db.get(`SELECT doc FROM ${T} WHERE _id = ?`, String(this._doc._id));
      if (!cur) throw Object.assign(new Error("No document found for save"), { name: "DocumentNotFoundError" });
      const stored = revive(cur.doc, schema, this._doc._id);
      for (const k of this._mod) stored[k] = this._doc[k];
      for (const f of bufferPaths) if (!this._mod.has(f)) delete stored[f]; // untouched blobs stay as they are
      persist(db, stored, { insert: false });
    }
    this._mod.clear();
    return this;
  };

  function wrapDoc(raw, sel) {
    const doc = new Doc(raw, { sel });
    return doc;
  }
  function project(raw, selFn) {
    const out = {};
    for (const [k, v] of Object.entries(raw)) if (selFn(k)) out[k] = v;
    return out;
  }

  /* Query */
  class Query {
    constructor(op, filter, extra = {}) { this.op = op; this.filter = filter || {}; this.extra = extra; this._sel = null; this._sort = null; this._skip = 0; this._limit = 0; this._lean = false; }
    select(s) { this._sel = this._sel ? `${this._sel} ${s}` : s; return this; }
    sort(s) { this._sort = s; return this; }
    skip(n) { this._skip = n; return this; }
    limit(n) { this._limit = n; return this; }
    lean() { this._lean = true; return this; }
    populate() { return this; }
    exec() { return this._run(); }
    then(a, b) { return this._run().then(a, b); }
    catch(b) { return this._run().catch(b); }
    finally(f) { return this._run().finally(f); }
    async _run() {
      const db = await init();
      const selFn = selector(this._sel || "");
      const out = (raw) => {
        if (!raw) return null;
        const wantBlobs = bufferPaths.filter((f) => selFn(f));
        if (wantBlobs.length) loadBlobs(db, raw, wantBlobs);
        const p = project(raw, selFn);
        return this._lean ? p : wrapDoc(p, this._sel);
      };
      const { op, extra } = this;
      if (op === "find" || op === "findOne") {
        let rows = candidates(db, this.filter);
        if (this._sort) rows = sortRows(rows, this._sort);
        if (op === "findOne") return out(rows[0]);
        if (this._skip) rows = rows.slice(this._skip);
        if (this._limit) rows = rows.slice(0, this._limit);
        return rows.map(out);
      }
      if (op === "findOneAndUpdate" || op === "findOneAndDelete") {
        let rows = candidates(db, this.filter);
        if (this._sort) rows = sortRows(rows, this._sort);
        const hit = rows[0];
        if (!hit) return null;
        const before = hit;
        if (op === "findOneAndDelete") { db.run(`DELETE FROM ${T} WHERE _id = ?`, String(hit._id)); if (bufferPaths.length) db.run(`DELETE FROM ${B} WHERE _id = ?`, String(hit._id)); return out(before); }
        const after = structuredCloneRaw(before);
        const touched = applyUpdate(after, extra.update, schema);
        if (schema.options.timestamps) after.updatedAt = new Date();
        if (extra.options?.runValidators) validate(after, [...touched], after);
        persist(db, after, { insert: false });
        return out(extra.options?.new ? after : before);
      }
      throw new Error(`Unsupported query ${op}`);
    }
  }
  const structuredCloneRaw = (r) => {
    const o = {};
    for (const [k, v] of Object.entries(r)) o[k] = v instanceof Date ? new Date(v) : Buffer.isBuffer(v) ? v : Array.isArray(v) ? [...v] : v && typeof v === "object" && !(v instanceof ObjectId) ? structuredClone(v) : v;
    return o;
  };

  /* Model */
  function Model(data = {}) { return new Doc(defaults(data), { isNew: true }); }
  Model.modelName = name;
  Model.collection = { name: coll };
  Model.db = conn;
  Model.schema = schema;
  Model.find = (f, proj) => { const x = new Query("find", f); if (proj) x.select(proj); return x; };
  Model.findOne = (f, proj) => { const x = new Query("findOne", f); if (proj) x.select(proj); return x; };
  Model.findById = (id) => new Query("findOne", id == null ? { _id: "\u0000none" } : { _id: String(id) });
  Model.findOneAndUpdate = (f, update, options = {}) => new Query("findOneAndUpdate", f, { update, options });
  Model.findByIdAndUpdate = (id, update, options = {}) => new Query("findOneAndUpdate", { _id: String(id) }, { update, options });
  Model.findOneAndDelete = (f) => new Query("findOneAndDelete", f);
  Model.findByIdAndDelete = (id) => new Query("findOneAndDelete", { _id: String(id) });
  Model.create = async (data) => {
    if (Array.isArray(data)) { const out = []; for (const d of data) out.push(await Model.create(d)); return out; }
    const doc = new Model(data);
    await doc.save();
    return doc;
  };
  Model.updateOne = async (f, update, options = {}) => {
    const r = await new Query("findOneAndUpdate", f, { update, options }).exec();
    return { acknowledged: true, matchedCount: r ? 1 : 0, modifiedCount: r ? 1 : 0 };
  };
  Model.updateMany = async (f, update) => {
    const db = await init();
    let n = 0;
    for (const hit of candidates(db, f)) {
      const after = structuredCloneRaw(hit);
      applyUpdate(after, update, schema);
      if (schema.options.timestamps) after.updatedAt = new Date();
      persist(db, after, { insert: false }); n++;
    }
    return { acknowledged: true, matchedCount: n, modifiedCount: n };
  };
  Model.deleteOne = async (f) => {
    const db = await init();
    const hit = candidates(db, f)[0];
    if (hit) { db.run(`DELETE FROM ${T} WHERE _id = ?`, String(hit._id)); if (bufferPaths.length) db.run(`DELETE FROM ${B} WHERE _id = ?`, String(hit._id)); }
    return { acknowledged: true, deletedCount: hit ? 1 : 0 };
  };
  Model.deleteMany = async (f = {}) => {
    const db = await init();
    const hits = candidates(db, f);
    for (const h of hits) { db.run(`DELETE FROM ${T} WHERE _id = ?`, String(h._id)); if (bufferPaths.length) db.run(`DELETE FROM ${B} WHERE _id = ?`, String(h._id)); }
    return { acknowledged: true, deletedCount: hits.length };
  };
  Model.countDocuments = async (f = {}) => { const db = await init(); return candidates(db, f).length; };
  Model.exists = async (f) => { const db = await init(); const h = candidates(db, f)[0]; return h ? { _id: h._id } : null; };
  Model.aggregate = async (pipeline) => { const db = await init(); return aggregate(candidates(db, pipeline[0]?.$match || {}), pipeline); };
  Model.syncIndexes = Model.init = async () => { await init(); };
  Object.assign(Model, schema.statics);
  return Model;
}

/* ───────── public API (mongoose-shaped) ───────── */
let defaultConn = null;
const lite = {
  Schema,
  Types: { ObjectId, Mixed: MIXED },
  isValidObjectId: ObjectId.isValid,
  set() {},
  createConnection(file) { return new Connection(file); },
  _file: ":memory:",
  async connect(file) { if (file && !(defaultConn && defaultConn.readyState === 1)) { lite._file = file; if (defaultConn) defaultConn.file = file; } await lite._default().open(); return lite; },
  model(name, schema) { return lite._default().model(name, schema); },
  _default() {
    if (!defaultConn) defaultConn = new Connection(lite._file);
    return defaultConn;
  },
  get connection() { return lite._default(); },
  async disconnect() { if (defaultConn) await defaultConn.close(); },
};
export default lite;
export { Connection };
