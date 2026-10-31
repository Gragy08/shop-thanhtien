import { Router } from "express";
import * as orderController from "../../controllers/admin/order.controller";
import { requireAuth, requirePermission } from "../../middlewares/admin/authenticate.middleware";

const router = Router();

router.use(requireAuth);

router.get("/", requirePermission("order:read"), orderController.list);
router.get("/pos", requirePermission("order:write"), orderController.pos);
router.post("/create", requirePermission("order:write"), orderController.createPost);
router.patch("/installment/:id", requirePermission("order:write"), orderController.updateInstallmentInfo);
router.patch("/settle-installment/:id", requirePermission("order:settle"), orderController.settleInstallment);
router.patch("/cancel/:id", requirePermission("order:cancel"), orderController.cancel);

router.get("/api/search-products", requirePermission("order:read"), orderController.searchProducts);
router.get("/api/available-imeis/:variantId", requirePermission("order:read"), orderController.availableImeis);

router.get("/:id", requirePermission("order:read"), orderController.detail);

export default router;

