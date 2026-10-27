import mongoose from "mongoose";

export type WarrantyStatus = "received" | "in_progress" | "completed" | "delivered" | "cancelled";

export interface WarrantyTicketDocument extends mongoose.Document {
  ticketCode: string;
  customerId?: mongoose.Types.ObjectId;
  customerInfo: {
    fullName: string;
    phone: string;
    address?: string;
  };
  inventoryItemId?: mongoose.Types.ObjectId;
  identifier: string; // Mã IMEI / Serial thiết bị
  productId?: mongoose.Types.ObjectId;
  variantId?: mongoose.Types.ObjectId;
  productName: string;
  variantName?: string;
  orderId?: mongoose.Types.ObjectId;
  orderCode?: string;
  purchaseDate?: Date;
  warrantyPeriodMonths?: number;
  isUnderWarranty: boolean;
  issueDescription: string;
  physicalCondition?: string;
  accessoriesAttached?: string;
  passcode?: string;
  technicianNotes?: string;
  repairCost: number;
  ticketStatus: WarrantyStatus;
  receivedDate: Date;
  expectedReturnDate?: Date;
  completedDate?: Date;
  deliveredDate?: Date;
  cancelledDate?: Date;
  cancelReason?: string;
  resolution?: string; // "repair" | "replace_parts" | "exchange_1to1" | "unfixable" | "refused"
  replacedParts?: string;
  partsWarrantyMonths?: number;
  paymentMethod?: string;
  handoverNotes?: string;
  isExchange1to1?: boolean;
  replacementInventoryItemId?: mongoose.Types.ObjectId;
  replacementIdentifier?: string;
  replacementProductName?: string;
  replacementVariantName?: string;
  priceDifference?: number;
  createdBy?: mongoose.Types.ObjectId;
  technicianId?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  deleted: boolean;
  deletedAt?: Date;
  deletedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const warrantyTicketSchema = new mongoose.Schema(
  {
    ticketCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer"
    },
    customerInfo: {
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
      address: {
        type: String,
        default: "",
        trim: true
      }
    },
    inventoryItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryItem"
    },
    identifier: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product"
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant"
    },
    productName: {
      type: String,
      required: true,
      trim: true
    },
    variantName: {
      type: String,
      default: "",
      trim: true
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order"
    },
    orderCode: {
      type: String,
      default: "",
      trim: true
    },
    purchaseDate: {
      type: Date
    },
    warrantyPeriodMonths: {
      type: Number,
      default: 12
    },
    isUnderWarranty: {
      type: Boolean,
      default: true
    },
    issueDescription: {
      type: String,
      required: true,
      trim: true
    },
    physicalCondition: {
      type: String,
      default: "Máy bình thường, không cấn móp",
      trim: true
    },
    accessoriesAttached: {
      type: String,
      default: "Thân máy",
      trim: true
    },
    passcode: {
      type: String,
      default: "",
      trim: true
    },
    technicianNotes: {
      type: String,
      default: "",
      trim: true
    },
    repairCost: {
      type: Number,
      default: 0,
      min: 0
    },
    ticketStatus: {
      type: String,
      enum: ["received", "in_progress", "completed", "delivered", "cancelled"],
      default: "received",
      required: true
    },
    receivedDate: {
      type: Date,
      default: Date.now
    },
    expectedReturnDate: {
      type: Date
    },
    completedDate: {
      type: Date
    },
    deliveredDate: {
      type: Date
    },
    cancelledDate: {
      type: Date
    },
    cancelReason: {
      type: String,
      default: ""
    },
    resolution: {
      type: String,
      default: "repair"
    },
    replacedParts: {
      type: String,
      default: ""
    },
    partsWarrantyMonths: {
      type: Number,
      default: 0
    },
    paymentMethod: {
      type: String,
      default: "free"
    },
    handoverNotes: {
      type: String,
      default: ""
    },
    isExchange1to1: {
      type: Boolean,
      default: false
    },
    replacementInventoryItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryItem"
    },
    replacementIdentifier: {
      type: String,
      default: "",
      trim: true,
      uppercase: true
    },
    replacementProductName: {
      type: String,
      default: ""
    },
    replacementVariantName: {
      type: String,
      default: ""
    },
    priceDifference: {
      type: Number,
      default: 0
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccountAdmin"
    },
    technicianId: {
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

warrantyTicketSchema.index({ identifier: 1 });
warrantyTicketSchema.index({ "customerInfo.phone": 1 });
warrantyTicketSchema.index({ ticketStatus: 1 });

const WarrantyTicket = mongoose.model<WarrantyTicketDocument>(
  "WarrantyTicket",
  warrantyTicketSchema,
  "warranty_tickets"
);

export default WarrantyTicket;

