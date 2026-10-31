import { Router } from "express";
import * as warrantyController from "../../controllers/admin/warranty.controller";
import { requireAuth, requirePermission } from "../../middlewares/admin/authenticate.middleware";

const router = Router();

router.use(requireAuth);

// API kiểm tra thiết bị & lịch sử mua theo IMEI hoặc SĐT
router.get("/api/check-device", warrantyController.checkDevice);
router.get("/api/search-available-imei", requirePermission("warranty:write"), warrantyController.searchAvailableImei);
router.get("/api/search-parts", requirePermission("warranty:write"), warrantyController.searchParts);

router.get("/", requirePermission("warranty:read"), warrantyController.list);
router.get("/create", requirePermission("warranty:write"), warrantyController.create);
router.post("/create", requirePermission("warranty:write"), warrantyController.createPost);
router.patch("/bulk-update-status", requirePermission("warranty:write"), warrantyController.bulkUpdateStatus);
router.patch("/edit/:id", requirePermission("warranty:write"), warrantyController.editTicket);
router.post("/deliver/:id", requirePermission("warranty:write"), warrantyController.deliver);
router.post("/exchange-1to1/:id", requirePermission("warranty:write"), warrantyController.exchange1to1);
router.patch("/update-status/:id", requirePermission("warranty:write"), warrantyController.updateStatus);
router.get("/:id", requirePermission("warranty:read"), warrantyController.detail);

export default router;

