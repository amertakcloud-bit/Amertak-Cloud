import app from "./app.js";
import { connectDB, hasDatabase } from "./config/database.js";

const PORT = process.env.PORT || 5000;

async function start() {
  if (hasDatabase()) await connectDB();
  else console.warn("[Server] MONGODB_URI not set — login/payments/admin are disabled; tool APIs still work.");

  app.listen(PORT, () => {
    console.log(`[Server] API running at http://localhost:${PORT}/api`);
    console.log(`[Server] CORS origin: ${process.env.CLIENT_URL || "http://localhost:5173"}`);
  });
}

start();
