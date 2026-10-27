import { Request, Response } from "express";
import FormData from "form-data";
import axios from "axios";
import Media from "../../models/media.model";
import { domainCDN, fileManagerSecret, mediaNamespace } from "../../configs/variable.config";

/**
 * Format kÃ­ch thÆ°á»›c tá»‡p (Byte -> KB, MB, GB)
 */
export const formatFileSize = (bytes?: number): string => {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

/**
 * Táº¡o Ä‘Æ°á»ng dáº«n namespace thÆ° má»¥c cho Shop Thanh Tiá»n
 */
const getFolderContext = (rawSubPath?: string) => {
  const cleanSub = typeof rawSubPath === "string" ? rawSubPath.trim().replace(/^\/+|\/+$/g, "") : "";
  const root = mediaNamespace || "shop-thanhtien";

  // ThÆ° má»¥c lÆ°u trong database Media: /media/shop-thanhtien[/sub]
  const dbFolder = `/media/${root}` + (cleanSub ? `/${cleanSub}` : "");

  // ThÆ° má»¥c truyá»n sang file-manager microservice qua API: shop-thanhtien[/sub]
  const apiFolderPath = cleanSub ? `${root}/${cleanSub}` : root;

  return { root, cleanSub, dbFolder, apiFolderPath };
};

/**
 * Trang quáº£n lÃ½ file chÃ­nh
 * GET /admin/file-manager
 */
export const index = async (req: Request, res: Response) => {
  try {
    const rawSubPath = typeof req.query.folderPath === "string" ? req.query.folderPath : "";
    const { cleanSub, dbFolder, apiFolderPath } = getFolderContext(rawSubPath);

    // 1. PhÃ¢n trang tá»‡p
    const limitItems = 24;
    let page = 1;
    if (req.query.page && parseInt(String(req.query.page)) > 0) {
      page = parseInt(String(req.query.page));
    }

    const totalRecord = await Media.countDocuments({ folder: dbFolder });
    const totalPage = Math.max(1, Math.ceil(totalRecord / limitItems));
    const skip = (page - 1) * limitItems;

    // 2. Láº¥y danh sÃ¡ch files tá»« MongoDB
    const files = await Media.find({ folder: dbFolder })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitItems)
      .lean();

    const formattedFiles = files.map((f: any) => ({
      ...f,
      sizeFormat: formatFileSize(f.size),
      url: `${f.folder}/${f.filename}`, cdnUrl: `${domainCDN}${f.folder}/${f.filename}`,
      isImage: f.mimetype ? f.mimetype.startsWith("image/") : false,
      createdAtFormat: new Date(f.createdAt).toLocaleString("vi-VN")
    }));

    // 3. Láº¥y danh sÃ¡ch folders tá»« file-manager microservice
    let folderList: any[] = [];
    try {
      const response = await axios.get(`${domainCDN}/file-manager/folder/list?folderPath=${encodeURIComponent(apiFolderPath)}`, {
        headers: {
          Authorization: `Bearer ${fileManagerSecret}`
        },
        timeout: 8000
      });

      if (response.data && response.data.code === "success" && Array.isArray(response.data.folderList)) {
        folderList = response.data.folderList.map((item: any) => ({
          ...item,
          path: cleanSub ? `${cleanSub}/${item.name}` : item.name,
          createdAtFormat: item.createdAt ? new Date(item.createdAt).toLocaleString("vi-VN") : "--"
        }));
      }
    } catch (apiErr: any) {
      console.warn("LÆ°u Ã½: KhÃ´ng thá»ƒ láº¥y danh sÃ¡ch thÆ° má»¥c tá»« file-manager CDN (cÃ³ thá»ƒ service chÆ°a cháº¡y hoáº·c timeout):", apiErr.message);
    }

    // 4. XÃ¢y dá»±ng Breadcrumbs
    const breadcrumbs: { name: string; path: string }[] = [
      { name: "ThÆ° má»¥c gá»‘c", path: "" }
    ];
    if (cleanSub) {
      const segments = cleanSub.split("/");
      let accum = "";
      segments.forEach((seg) => {
        accum = accum ? `${accum}/${seg}` : seg;
        breadcrumbs.push({ name: seg, path: accum });
      });
    }

    res.render("admin/file-manager/index", {
      pageTitle: "Quáº£n lÃ½ file & Äa phÆ°Æ¡ng tiá»‡n",
      listFile: formattedFiles,
      folderList,
      breadcrumbs,
      currentFolder: cleanSub,
      domainCDN,
      pagination: {
        page,
        totalPage,
        totalRecord,
        limit: limitItems
      }
    });
  } catch (error) {
    console.error("Error fileManager index:", error);
    res.status(500).render("error/500", { message: "Lá»—i táº£i trang quáº£n lÃ½ file!" });
  }
};

/**
 * Upload tá»‡p tin lÃªn file-manager microservice
 * POST /admin/file-manager/upload
 */
export const uploadPost = async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || !files.length) {
      res.status(400).json({ code: "error", message: "Vui lÃ²ng chá»n Ã­t nháº¥t má»™t tá»‡p Ä‘á»ƒ táº£i lÃªn!" });
      return;
    }

    const rawSubPath = typeof req.query.folderPath === "string" ? req.query.folderPath : (typeof req.body.folderPath === "string" ? req.body.folderPath : "");
    const { apiFolderPath } = getFolderContext(rawSubPath);

    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype
      });
    });

    if (apiFolderPath) {
      formData.append("folderPath", apiFolderPath);
    }

    const response = await axios.post(`${domainCDN}/file-manager/upload`, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${fileManagerSecret}`
      },
      maxContentLength: 100 * 1024 * 1024,
      maxBodyLength: 100 * 1024 * 1024,
      timeout: 30000
    });

    if (response.data && response.data.code === "success" && Array.isArray(response.data.saveLinks)) {
      // LÆ°u danh sÃ¡ch tá»‡p vÃ o MongoDB cá»§a Shop Thanh Tiá»n
      await Media.insertMany(response.data.saveLinks);
      res.json({
        code: "success",
        message: `Táº£i lÃªn thÃ nh cÃ´ng ${files.length} tá»‡p tin!`,
        saveLinks: response.data.saveLinks
      });
    } else {
      res.status(400).json({
        code: "error",
        message: response.data?.message || "Lá»—i khi lÆ°u tá»‡p trÃªn server CDN!"
      });
    }
  } catch (error: any) {
    console.error("Error uploadPost fileManager:", error.message || error);
    res.status(500).json({
      code: "error",
      message: `Lá»—i káº¿t ná»‘i tá»›i dá»‹ch vá»¥ file-manager CDN (${domainCDN}): ${error.message}`
    });
  }
};

/**
 * Äá»•i tÃªn tá»‡p tin
 * PATCH /admin/file-manager/change-file-name/:id
 */
export const changeFileNamePatch = async (req: Request, res: Response) => {
  try {
    const id = typeof req.params.id === "string" ? req.params.id : "";
    const newFileName = typeof req.body.fileName === "string" ? req.body.fileName.trim() : "";

    if (!id || !newFileName) {
      res.status(400).json({ code: "error", message: "TÃªn file má»›i khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng!" });
      return;
    }

    const record = await Media.findById(id);
    if (!record) {
      res.status(404).json({ code: "error", message: "KhÃ´ng tÃ¬m tháº¥y tá»‡p tin trong há»‡ thá»‘ng!" });
      return;
    }

    const formData = new FormData();
    formData.append("folder", record.folder);
    formData.append("oldFileName", record.filename);
    formData.append("newFileName", newFileName);

    const response = await axios.patch(`${domainCDN}/file-manager/change-file-name`, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${fileManagerSecret}`
      },
      timeout: 10000
    });

    if (response.data && response.data.code === "error") {
      res.status(400).json({ code: "error", message: response.data.message || "Lá»—i khi Ä‘á»•i tÃªn file!" });
      return;
    }

    record.filename = newFileName;
    await record.save();

    res.json({
      code: "success",
      message: "Äá»•i tÃªn tá»‡p tin thÃ nh cÃ´ng!"
    });
  } catch (error: any) {
    console.error("Error changeFileNamePatch:", error.message || error);
    res.status(500).json({ code: "error", message: "Lá»—i há»‡ thá»‘ng khi Ä‘á»•i tÃªn tá»‡p tin!" });
  }
};

/**
 * XÃ³a tá»‡p tin
 * DELETE /admin/file-manager/delete-file/:id
 */
export const deleteFileDel = async (req: Request, res: Response) => {
  try {
    const id = typeof req.params.id === "string" ? req.params.id : "";
    const record = await Media.findById(id);

    if (!record) {
      res.status(404).json({ code: "error", message: "Tá»‡p tin khÃ´ng tá»“n táº¡i!" });
      return;
    }

    const formData = new FormData();
    formData.append("folder", record.folder);
    formData.append("fileName", record.filename);

    try {
      await axios.patch(`${domainCDN}/file-manager/delete-file`, formData, {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${fileManagerSecret}`
        },
        timeout: 10000
      });
    } catch (e: any) {
      console.warn("LÆ°u Ã½: KhÃ´ng thá»ƒ xÃ³a file váº­t lÃ½ trÃªn CDN:", e.message);
    }

    await Media.deleteOne({ _id: id });

    res.json({
      code: "success",
      message: "ÄÃ£ xÃ³a tá»‡p tin thÃ nh cÃ´ng!"
    });
  } catch (error: any) {
    console.error("Error deleteFileDel:", error);
    res.status(500).json({ code: "error", message: "Lá»—i khi xÃ³a tá»‡p tin!" });
  }
};

/**
 * Táº¡o thÆ° má»¥c má»›i
 * POST /admin/file-manager/folder/create
 */
export const createFolderPost = async (req: Request, res: Response) => {
  try {
    const folderName = typeof req.body.folderName === "string" ? req.body.folderName.trim() : "";
    const rawSubPath = typeof req.body.folderPath === "string" ? req.body.folderPath : "";

    if (!folderName) {
      res.status(400).json({ code: "error", message: "TÃªn thÆ° má»¥c khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng!" });
      return;
    }

    const { apiFolderPath } = getFolderContext(rawSubPath);

    const formData = new FormData();
    formData.append("folderName", folderName);
    formData.append("folderPath", apiFolderPath);

    const response = await axios.post(`${domainCDN}/file-manager/folder/create`, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${fileManagerSecret}`
      },
      timeout: 10000
    });

    if (response.data && response.data.code === "success") {
      res.json({ code: "success", message: `Táº¡o thÆ° má»¥c "${folderName}" thÃ nh cÃ´ng!` });
    } else {
      res.status(400).json({ code: "error", message: response.data?.message || "Lá»—i táº¡o thÆ° má»¥c!" });
    }
  } catch (error: any) {
    console.error("Error createFolderPost:", error.message || error);
    res.status(500).json({ code: "error", message: "Lá»—i káº¿t ná»‘i khi táº¡o thÆ° má»¥c!" });
  }
};

/**
 * Giao diá»‡n Iframe phá»¥c vá»¥ Modal chá»n áº£nh (File Picker)
 * GET /admin/file-manager/iframe
 */
export const iframe = async (req: Request, res: Response) => {
  try {
    const rawSubPath = typeof req.query.folderPath === "string" ? req.query.folderPath : "";
    const { cleanSub, dbFolder, apiFolderPath } = getFolderContext(rawSubPath);

    const files = await Media.find({ folder: dbFolder })
      .sort({ createdAt: -1 })
      .limit(60)
      .lean();

    const formattedFiles = files.map((f: any) => ({
      ...f,
      sizeFormat: formatFileSize(f.size),
      url: `${f.folder}/${f.filename}`, cdnUrl: `${domainCDN}${f.folder}/${f.filename}`,
      isImage: f.mimetype ? f.mimetype.startsWith("image/") : false
    }));

    let folderList: any[] = [];
    try {
      const response = await axios.get(`${domainCDN}/file-manager/folder/list?folderPath=${encodeURIComponent(apiFolderPath)}`, {
        headers: {
          Authorization: `Bearer ${fileManagerSecret}`
        },
        timeout: 5000
      });
      if (response.data && response.data.code === "success" && Array.isArray(response.data.folderList)) {
        folderList = response.data.folderList.map((item: any) => ({
          ...item,
          path: cleanSub ? `${cleanSub}/${item.name}` : item.name
        }));
      }
    } catch (e: any) {
      console.warn("Iframe folder list warning:", e.message);
    }

    const breadcrumbs: { name: string; path: string }[] = [
      { name: "Gá»‘c", path: "" }
    ];
    if (cleanSub) {
      const segments = cleanSub.split("/");
      let accum = "";
      segments.forEach((seg) => {
        accum = accum ? `${accum}/${seg}` : seg;
        breadcrumbs.push({ name: seg, path: accum });
      });
    }

    res.render("admin/file-manager/iframe", {
      layout: false,
      listFile: formattedFiles,
      folderList,
      breadcrumbs,
      currentFolder: cleanSub,
      domainCDN
    });
  } catch (error) {
    console.error("Error fileManager iframe:", error);
    res.status(500).send("Lá»—i táº£i thÆ° viá»‡n chá»n tá»‡p!");
  }
};


