import mongoose from "mongoose";

const receiptItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: true
    },
    trackingType: {
      type: String,
      enum: ["imei", "serial", "quantity"],
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    purchasePrice: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    identifiers: {
      type: [String],
      default: []
    }
  },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    receiptCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
      index: true
    },
    supplierContactName: {
      type: String,
      required: true,
      trim: true
    },
    hasInvoice: {
      type: Boolean,
      default: false
    },
    invoiceNumber: {
      type: String,
      trim: true,
      default: ""
    },
    totalCost: {
      type: Number,
      default: 0,
      min: 0
    },
    note: {
      type: String,
      trim: true,
      default: ""
    },
    lineCount: {
      type: Number,
      required: true,
      min: 1
    },
    items: {
      type: [receiptItemSchema],
      default: []
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccountAdmin",
      required: true
    },
    deleted: {
      type: Boolean,
      default: false
    },
    deletedAt: Date
  },
  { timestamps: true }
);

const StockReceipt = mongoose.model("StockReceipt", schema, "stock-receipts");

export default StockReceipt;
