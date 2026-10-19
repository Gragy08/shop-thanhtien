import mongoose from "mongoose";

const optionSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true
    },
    value: {
      type: String,
      required: true,
      trim: true
    }
  },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    code: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true
    },
    type: {
      type: String,
      enum: ["text", "select", "color"],
      default: "text"
    },
    options: {
      type: [optionSchema],
      default: []
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active"
    },
    deleted: {
      type: Boolean,
      default: false
    },
    deletedAt: Date
  },
  { timestamps: true }
);

const Attribute = mongoose.model("Attribute", schema, "attributes");

export default Attribute;
