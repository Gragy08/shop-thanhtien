import mongoose from "mongoose";
import dns from "dns";

dns.setServers(["1.1.1.1", "8.8.8.8"]);

export const connectDB = async (): Promise<void> => {
  const databaseUrl = process.env.DATABASE;

  if (!databaseUrl) {
    throw new Error("DATABASE is not configured");
  }

  await mongoose.connect(databaseUrl, {
    family: 4,
    serverSelectionTimeoutMS: 10000
  });
  console.log("Kết nối DB thành công!");
};
