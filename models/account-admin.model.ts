import mongoose from "mongoose";
import { adminRoles, AdminRole } from "../configs/variable.config";

const schema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true
    },
    password: {
      type: String,
      required: true,
      select: false
    },
    role: {
      type: String,
      enum: adminRoles,
      required: true,
      default: "manager"
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active"
    },
    avatar: {
      type: String,
      default: ""
    },
    lastLoginAt: Date,
    deleted: {
      type: Boolean,
      default: false
    },
    deletedAt: Date
  },
  { timestamps: true }
);

schema.path("role").validate((value: AdminRole) => adminRoles.includes(value));

const AccountAdmin = mongoose.model("AccountAdmin", schema, "accounts-admin");

export default AccountAdmin;