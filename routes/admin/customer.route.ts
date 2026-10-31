import { Router } from "express";
import * as customerController from "../../controllers/admin/customer.controller";
import { requireAuth, requirePermission } from "../../middlewares/admin/authenticate.middleware";

const router = Router();

router.use(requireAuth);

// API tra cứu nhanh theo số điện thoại (cho màn hình POS & Tiếp nhận bảo hành)
router.get("/api/lookup", customerController.lookup);

router.get("/", requirePermission("customer:read"), customerController.list);
router.get("/create", requirePermission("customer:write"), customerController.create);
router.post("/create", requirePermission("customer:write"), customerController.createPost);
router.get("/edit/:id", requirePermission("customer:write"), customerController.edit);
router.patch("/edit/:id", requirePermission("customer:write"), customerController.editPatch);
router.get("/:id", requirePermission("customer:read"), customerController.detail);
router.delete("/:id", requirePermission("customer:delete"), customerController.deleteCustomer);

export default router;

