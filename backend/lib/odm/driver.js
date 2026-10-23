import fs from "node:fs";
import path from "node:path";

// Opens a SQLite file with better-sqlite3 (preferred). If that native module is not installed
// (e.g. no build tools), Node's built-in node:sqlite (Node ≥ 22.5) is used instead — same API shape.
export async function openSqlite(file) {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  let raw, kind;
  try {
    const mod = await import("better-sqlite3");
    raw = new mod.default(file);
    kind = "better-sqlite3";
  } catch (err) {
    if (err?.code !== "ERR_MODULE_NOT_FOUND" && !/Cannot find (module|package)/i.test(String(err?.message))) throw err;
    try {
      const { DatabaseSync } = await import("node:sqlite");
      raw = new DatabaseSync(file);
      kind = "node:sqlite";
    } catch {
      throw new Error("SQLite is unavailable. Run `npm install` in backend/ (better-sqlite3) or use Node 22.5+.");
    }
  }
  raw.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = OFF;");

  const bind = (a) => a.map((v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v));
  const fixRow = (r) => {
    if (!r) return r;
    for (const k of Object.keys(r)) if (r[k] instanceof Uint8Array && !Buffer.isBuffer(r[k])) r[k] = Buffer.from(r[k]);
    return r;
  };
  const cache = new Map();
  const stmt = (sql) => { let s = cache.get(sql); if (!s) { s = raw.prepare(sql); if (cache.size > 300) cache.clear(); cache.set(sql, s); } return s; };
  return {
    kind,
    exec: (sql) => raw.exec(sql),
    run: (sql, ...a) => stmt(sql).run(...bind(a)),
    get: (sql, ...a) => fixRow(stmt(sql).get(...bind(a))),
    all: (sql, ...a) => stmt(sql).all(...bind(a)).map(fixRow),
    close: () => raw.close(),
  };
}
