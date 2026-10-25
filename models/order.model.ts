import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
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
    productName: {
      type: String,
      required: true,
      trim: true
    },
    variantSku: {
      type: String,
      trim: true,
      default: ""
    },
    variantName: {
      type: String,
      default: ""
    },
    trackingType: {
      type: String,
      enum: ["imei", "serial", "quantity"],
      required: true
    },
    identifiers: {
      type: [String],
      default: []
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0
    },
    discount: {
      type: Number,
      default: 0,
      min: 0
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0
    }
  },
  { _id: true }
);

const schema = new mongoose.Schema(
  {
    orderCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    customerInfo: {
      fullName: {
        type: String,
        default: "Khách lẻ vãng lai",
        trim: true
      },
      phone: {
        type: String,
        default: "",
        trim: true
      },
      address: {
        type: String,
        default: "",
        trim: true
      }
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (items: unknown[]) => Array.isArray(items) && items.length > 0,
        message: "Đơn hàng phải có ít nhất một sản phẩm!"
      }
    },
    subTotal: {
      type: Number,
      required: true,
      min: 0
    },
    discount: {
      type: Number,
      default: 0,
      min: 0
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "bank_transfer", "credit_card", "installment"],
      default: "cash"
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    changeAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    orderStatus: {
      type: String,
      enum: ["completed", "cancelled"],
      default: "completed"
    },
    note: {
      type: String,
      default: "",
      trim: true
    },
    cancelReason: {
      type: String,
      default: "",
      trim: true
    },
    cancelledAt: Date,
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccountAdmin"
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

const Order = mongoose.model("Order", schema, "orders");

export default Order;

