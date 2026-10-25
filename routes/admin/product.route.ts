import { Router } from "express";
import * as productController from "../../controllers/admin/product.controller";
import { requireAuth, requirePermission } from "../../middlewares/admin/authenticate.middleware";

const router = Router();

router.use(requireAuth);

router.get("/", requirePermission("product:read"), productController.list);
router.get("/trash", requirePermission("product:read"), productController.trash);
router.get("/detail/:id", requirePermission("product:read"), productController.detail);
router.get("/create", requirePermission("product:write"), productController.create);
router.post("/create", requirePermission("product:write"), productController.createPost);
router.get("/edit/:id", requirePermission("product:write"), productController.edit);
router.patch("/edit/:id", requirePermission("product:write"), productController.editPatch);
router.patch("/change-status/:id", requirePermission("product:write"), productController.changeStatus);
router.patch("/restore/:id", requirePermission("product:write"), productController.restorePatch);
router.patch("/delete/:id", requirePermission("product:write"), productController.deletePatch);
router.delete("/delete/:id", requirePermission("product:delete"), productController.deleteHard);

export default router;
