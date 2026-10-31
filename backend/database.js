require("dotenv").config();

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const dbPath = path.resolve(process.cwd(), process.env.DATABASE_PATH);

fs.mkdirSync(path.dirname(dbPath), {recursive: true});

const db = new Database(dbPath);
db.exec(`
    CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NIT NULL;
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    create_at DATETIME DEFAULT CURREN_TIMESTAMP
    )
    `);

console.log("SQLite database Connected!");

module.exports = db