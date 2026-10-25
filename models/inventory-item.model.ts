import mongoose from "mongoose";

const statusLogSchema = new mongoose.Schema(
  {
    fromStatus: {
      type: String,
      enum: ["available", "sold", "warranty", "returned", "damaged", "liquidated"]
    },
    toStatus: {
      type: String,
      enum: ["available", "sold", "warranty", "returned", "damaged", "liquidated"],
      required: true
    },
    reason: {
      type: String,
      default: ""
    },
    note: {
      type: String,
      default: ""
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccountAdmin"
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: true }
);

const schema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: true,
      index: true
    },
    trackingType: {
      type: String,
      enum: ["imei", "serial", "quantity"],
      required: true
    },
    identifier: {
      type: String,
      trim: true,
      uppercase: true,
      unique: true,
      sparse: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1
    },
    purchasePrice: {
      type: Number,
      min: 0,
      default: null
    },
    status: {
      type: String,
      enum: ["available", "sold", "warranty", "returned", "damaged", "liquidated"],
      default: "available"
    },
    note: {
      type: String,
      default: ""
    },
    statusLogs: {
      type: [statusLogSchema],
      default: []
    },
    receivedAt: {
      type: Date,
      default: Date.now
    },
    receiptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StockReceipt",
      default: null
    },
    deleted: {
      type: Boolean,
      default: false
    },
    deletedAt: Date
  },
  { timestamps: true }
);

schema.path("identifier").validate(function (value: string | undefined) {
  return this.trackingType === "quantity" || Boolean(value);
}, "IMEI hoặc serial là bắt buộc với hàng định danh");

const InventoryItem = mongoose.model("InventoryItem", schema, "inventory-items");

export default InventoryItem;
