import { MongoMemoryServer } from "mongodb-memory-server";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// dev-memory-db
// Starts an in-memory MongoDB (on the default port 27017) and then boots
// server.js with MONGODB_URI pointing at it.
// Usage: npm run dev:memory
// Data is NOT persisted between restarts — use a real MongoDB for production.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 27017;

console.log(`[DevDB] Starting in-memory MongoDB on port ${PORT}…`);
const mongod = await MongoMemoryServer.create({
  instance: { port: PORT },
});

const uri = mongod.getUri();
console.log(`[DevDB] Ready: ${uri}`);

const server = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
  stdio: "inherit",
  env: { ...process.env, MONGODB_URI: uri },
});

async function shutdown(code = 0) {
  server.kill();
  if (mongod) await mongod.stop();
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
server.on("exit", (code) => shutdown(code ?? 0));
