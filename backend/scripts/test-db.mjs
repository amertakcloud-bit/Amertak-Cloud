import mongoose from "mongoose";
import dns from "node:dns";
import dotenv from "dotenv";

dotenv.config();

const uri = process.env.MONGODB_URI;
console.log("URI scheme:", uri?.slice(0, 20) + "...");
console.log("Has db name:", /mongodb(\+srv)?:\/\/[^/]+\//.test(uri));

const options = { serverSelectionTimeoutMS: 15000 };

try {
  await mongoose.connect(uri, options);
} catch (error) {
  if (uri.startsWith("mongodb+srv") && /querySrv|ECONNREFUSED|ESERVFAIL|ENOTFOUND/i.test(error.message)) {
    console.log("SRV failed → retry with 8.8.8.8 / 1.1.1.1");
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
    await mongoose.connect(uri, options);
  } else {
    throw error;
  }
}

try {
  console.log("CONNECTED OK:", mongoose.connection.host, "/", mongoose.connection.name);
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log("Collections:", collections.map((c) => c.name));
  await mongoose.disconnect();
  process.exit(0);
} catch (error) {
  console.log("ERROR name:", error.name);
  console.log("ERROR code:", error.code);
  console.log("ERROR message:", error.message);
  if (error.reason) console.log("ERROR reason:", JSON.stringify(error.reason, null, 2));
  if (error.cause) console.log("ERROR cause:", error.cause);
  process.exit(1);
}

