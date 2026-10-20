import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDB } from "../configs/database.config";
import { adminRoles, AdminRole } from "../configs/variable.config";
import AccountAdmin from "../models/account-admin.model";

const run = async (): Promise<void> => {
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  const role = (process.env.INITIAL_ADMIN_ROLE || "admin") as AdminRole;

  if (!email || !password || password.length < 12) {
    throw new Error("INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD (at least 12 characters) are required");
  }
  if (!adminRoles.includes(role)) {
    throw new Error(`INITIAL_ADMIN_ROLE must be one of: ${adminRoles.join(", ")}`);
  }

  await connectDB();
  const passwordHash = await bcrypt.hash(password, 12);
  await AccountAdmin.updateOne(
    { email },
    {
      $set: { fullName: role === "admin" ? "Administrator" : "Manager", password: passwordHash, role, status: "active", deleted: false },
      $setOnInsert: { email }
    },
    { upsert: true }
  );

  console.log(`Đã tạo/cập nhật tài khoản ${role}: ${email}`);
  await mongoose.disconnect();
  process.exit(0);
};

run().catch((error: unknown) => {
  console.error("Không thể seed tài khoản admin", error);
  mongoose.disconnect().finally(() => process.exit(1));
});