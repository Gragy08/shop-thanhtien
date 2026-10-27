import mongoose from "mongoose";

export interface MediaDocument extends mongoose.Document {
  folder: string;
  filename: string;
  mimetype: string;
  size: number;
  createdAt: Date;
  updatedAt: Date;
}

const mediaSchema = new mongoose.Schema(
  {
    folder: {
      type: String,
      required: true,
      trim: true
    },
    filename: {
      type: String,
      required: true,
      trim: true
    },
    mimetype: {
      type: String,
      default: ""
    },
    size: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

mediaSchema.index({ folder: 1, createdAt: -1 });

const Media = mongoose.model<MediaDocument>("Media", mediaSchema, "media");

export default Media;

