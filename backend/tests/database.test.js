import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const originalMongoUri = process.env.MONGODB_URI;
const originalDatabasePath = process.env.DATABASE_PATH;

test("uses SQLite fallback when MONGODB_URI is missing", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "amertak-sqlite-"));
  const sqlitePath = path.join(tempDir, "app.db");

  try {
    delete process.env.MONGODB_URI;
    process.env.DATABASE_PATH = sqlitePath;

    const { ensureDb, getSqliteDb } = await import("../config/database.js");
    await ensureDb();

    const db = getSqliteDb();
    assert.ok(db, "SQLite database should be initialized");
    assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get()?.name, "users");

    const row = db.prepare("SELECT COUNT(*) AS count FROM users").get();
    assert.equal(row.count, 0);
  } finally {
    const { getSqliteDb } = await import("../config/database.js");
    getSqliteDb().close();
    fs.rmSync(tempDir, { recursive: true, force: true });
    process.env.MONGODB_URI = originalMongoUri;
    process.env.DATABASE_PATH = originalDatabasePath;
  }
});
