import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "../src/models/User.js";

const email = process.env.SEED_ADMIN_EMAIL || "admin@pool.local";
const password = process.env.SEED_ADMIN_PASSWORD || "adminadmin";
const name = process.env.SEED_ADMIN_NAME || "Admin";

await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/pool_scheduler");

const existing = await User.findOne({ email: email.toLowerCase() });
if (existing) {
  console.log("Admin already exists:", email);
  process.exit(0);
}

const passwordHash = await bcrypt.hash(password, 10);
await User.create({
  email: email.toLowerCase(),
  passwordHash,
  name,
  role: "admin",
});

console.log("Created admin user");
console.log("  email:", email);
console.log("  password:", password);
process.exit(0);
