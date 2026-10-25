

import "dotenv/config";
import cookieParser from "cookie-parser";
import express from "express";
import path from "path";
import { connectDB } from "./configs/database.config";
import { pathAdmin } from "./configs/variable.config";
import adminRoutes from "./routes/admin/index.route";
import { publicLookupPage } from "./controllers/admin/warranty.controller";

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");
app.use(express.static(path.join(__dirname, "public")));
app.locals.pathAdmin = pathAdmin;

app.get("/", (_req, res) => {
  res.redirect(`/${pathAdmin}/account/login`);
});

app.get("/tra-cuu-bao-hanh", publicLookupPage);

app.use(`/${pathAdmin}`, adminRoutes);

const start = async (): Promise<void> => {
  await connectDB();
  app.listen(port, "127.0.0.1", () => {
    console.log(`Shop Thanh Tien admin đang chạy trên cổng ${port}`);
  });
};

start().catch((error: unknown) => {
  console.error("Không thể khởi động ứng dụng", error);
  process.exitCode = 1;
});
