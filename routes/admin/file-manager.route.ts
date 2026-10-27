import { Router } from "express";
import multer from "multer";
import * as fileManagerController from "../../controllers/admin/file-manager.controller";
import { requireAuth, requirePermission } from "../../middlewares/admin/authenticate.middleware";

const router = Router();

// Dùng memoryStorage để giữ buffer trung chuyển sang file-manager microservice
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    // Ép originalname về UTF-8 tránh lỗi font tiếng Việt
    try {
      file.originalname = Buffer.from(file.originalname, "latin1").toString("utf8");
    } catch {
      // fallback
    }
    cb(null, true);
  }
});

router.use(requireAuth);

router.get("/", requirePermission("media:read"), fileManagerController.index);

router.post(
  "/upload",
  requirePermission("media:write"),
  upload.array("files"),
  fileManagerController.uploadPost
);

router.patch(
  "/change-file-name/:id",
  requirePermission("media:write"),
  upload.none(),
  fileManagerController.changeFileNamePatch
);

router.delete(
  "/delete-file/:id",
  requirePermission("media:write"),
  fileManagerController.deleteFileDel
);

router.post(
  "/folder/create",
  requirePermission("media:write"),
  upload.none(),
  fileManagerController.createFolderPost
);

router.get("/iframe", requirePermission("media:read"), fileManagerController.iframe);

export default router;

