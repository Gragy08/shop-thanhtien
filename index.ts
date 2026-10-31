import "dotenv/config";
import axios from "axios";
import cookieParser from "cookie-parser";
import express from "express";
import fs from "fs";
import path from "path";
import { connectDB } from "./configs/database.config";
import { pathAdmin, domainCDN } from "./configs/variable.config";
import { formatVND } from "./helpers/currency.helper";
import { formatVNDate } from "./helpers/date.helper";
import adminRoutes from "./routes/admin/index.route";
import { publicLookupPage } from "./controllers/admin/warranty.controller";

const app = express();
const port = Number(process.env.PORT) || 3001;
app.set("trust proxy", 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const rootDir = fs.existsSync(path.join(__dirname, "views"))
  ? __dirname
  : path.resolve(__dirname, "..");

app.set("views", path.join(rootDir, "views"));
app.set("view engine", "pug");
app.use(express.static(path.join(rootDir, "public")));
app.locals.pathAdmin = pathAdmin;
app.locals.domainCDN = domainCDN;
app.locals.formatVND = formatVND;
app.locals.formatVNDate = formatVNDate;

app.get("/", (_req, res) => {
  res.redirect(`/${pathAdmin}/account/login`);
});

app.get("/tra-cuu-bao-hanh", publicLookupPage);

// Proxy phục vụ hình ảnh và tệp tin từ CDN (vượt rào cản kiểm tra Referer khi chạy local)
app.use("/media", async (req, res) => {
  try {
    const targetUrl = `${domainCDN}${req.originalUrl}`;
    const response = await axios.get(targetUrl, {
      headers: {
        Referer: process.env.DOMAIN || "https://thanhtien-shop.duckdns.org"
      },
      responseType: "stream",
      timeout: 15000
    });

    const contentType = response.headers["content-type"];
    if (contentType) {
      res.setHeader("Content-Type", String(contentType));
    }
    const contentDisposition = response.headers["content-disposition"];
    if (contentDisposition) {
      res.setHeader("Content-Disposition", String(contentDisposition));
    }
    const contentLength = response.headers["content-length"];
    if (contentLength) {
      res.setHeader("Content-Length", String(contentLength));
    }
    res.setHeader("Cache-Control", "public, max-age=86400");
    response.data.pipe(res);
  } catch (error: any) {
    res.status(404).send("Tệp tin không tìm thấy hoặc lỗi kết nối CDN!");
  }
});

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
