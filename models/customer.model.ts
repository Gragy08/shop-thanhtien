import mongoose from "mongoose";

export interface CustomerDocument extends mongoose.Document {
  fullName: string;
  phone: string;
  cccd?: string;
  email?: string;
  address?: string;
  birthday?: Date;
  gender?: "male" | "female" | "other";
  totalSpent: number;
  orderCount: number;
  lastOrderAt?: Date;
  customerGroup: "retail" | "vip" | "wholesale";
  source: "pos" | "manual" | "warranty" | "other";
  notes?: string;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  deleted: boolean;
  deletedAt?: Date;
  deletedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    cccd: {
      type: String,
      trim: true,
      default: ""
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: ""
    },
    address: {
      type: String,
      trim: true,
      default: ""
    },
    birthday: {
      type: Date
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      default: "other"
    },
    totalSpent: {
      type: Number,
      default: 0,
      min: 0
    },
    orderCount: {
      type: Number,
      default: 0,
      min: 0
    },
    lastOrderAt: {
      type: Date
    },
    customerGroup: {
      type: String,
      enum: ["retail", "vip", "wholesale"],
      default: "retail"
    },
    source: {
      type: String,
      enum: ["pos", "manual", "warranty", "other"],
      default: "manual"
    },
    notes: {
      type: String,
      default: "",
      trim: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccountAdmin"
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccountAdmin"
    },
    deleted: {
      type: Boolean,
      default: false
    },
    deletedAt: {
      type: Date
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccountAdmin"
    }
  },
  {
    timestamps: true
  }
);

// Unique Index chống conflict số điện thoại đối với các bản ghi đang hoạt động
customerSchema.index(
  { phone: 1 },
  {
    unique: true,
    partialFilterExpression: {
      deleted: { $ne: true }
    }
  }
);

const Customer = mongoose.model<CustomerDocument>("Customer", customerSchema, "customers");

export default Customer;

