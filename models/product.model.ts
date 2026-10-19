import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true
    },
    sku: {
      type: String,
      trim: true,
      uppercase: true,
      unique: true,
      sparse: true
    },
    categoryIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Category",
      required: true,
      validate: {
        validator: (categories: mongoose.Types.ObjectId[]) => categories.length > 0,
        message: "Sản phẩm phải thuộc ít nhất một danh mục"
      }
    },
    attributeIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Attribute",
      default: []
    },
    inventoryType: {
      type: String,
      enum: ["imei", "serial", "quantity"],
      required: true
    },
    purchasePrice: {
      type: Number,
      required: true,
      min: 0
    },
    salePrice: {
      type: Number,
      required: true,
      min: 0
    },
    images: {
      type: [String],
      default: []
    },
    description: {
      type: String,
      default: ""
    },
    content: {
      type: String,
      default: ""
    },
    status: {
      type: String,
      enum: ["draft", "active", "inactive"],
      default: "draft"
    },
    deleted: {
      type: Boolean,
      default: false
    },
    deletedAt: Date,
    createdBy: mongoose.Schema.Types.ObjectId,
    updatedBy: mongoose.Schema.Types.ObjectId
  },
  { timestamps: true }
);

const Product = mongoose.model("Product", schema, "products");

export default Product;
