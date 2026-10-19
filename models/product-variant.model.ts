import mongoose from "mongoose";

const attributeValueSchema = new mongoose.Schema(
  {
    attributeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attribute",
      required: true
    },
    attributeName: {
      type: String,
      required: true,
      trim: true
    },
    value: {
      type: String,
      required: true,
      trim: true
    },
    label: {
      type: String,
      required: true,
      trim: true
    }
  },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true
    },
    sku: {
      type: String,
      trim: true,
      uppercase: true,
      unique: true,
      sparse: true
    },
    attributeValues: {
      type: [attributeValueSchema],
      default: []
    },
    purchasePriceOverride: {
      type: Number,
      min: 0,
      default: null
    },
    salePriceOverride: {
      type: Number,
      min: 0,
      default: null
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active"
    },
    images: {
      type: [String],
      default: []
    }
  },
  { timestamps: true }
);

schema.index({ productId: 1, attributeValues: 1 });

const ProductVariant = mongoose.model("ProductVariant", schema, "product-variants");

export default ProductVariant;
