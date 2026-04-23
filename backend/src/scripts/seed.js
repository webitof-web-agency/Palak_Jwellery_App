// Run once to create the first admin account
// Usage: npm run seed

import { connectDB } from "../config/db.js";
import { User } from "../models/User.js";

await connectDB();

const existing = await User.findOne({ email: "admin@jewellery.com" });
if (existing) {
  console.log("Admin already exists. Skipping.");
  process.exit(0);
}

await User.create({
  name: "Admin",
  email: "admin@jewellery.com",
  passwordHash: "admin123", // will be hashed automatically by the model
  role: "admin",
  isActive: true,
});

console.log("Admin created: admin@jwellery.com / admin123");
console.log("Change this password immediately after first login.");
process.exit(0);
