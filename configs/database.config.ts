import mongoose from "mongoose";

export const connectDB = async (): Promise<void> => {
  const databaseUrl = process.env.DATABASE;

  if (!databaseUrl) {
    throw new Error("DATABASE is not configured");
  }

  await mongoose.connect(databaseUrl, { family: 4 });
  console.log("Kết nối DB thành công!");
};
