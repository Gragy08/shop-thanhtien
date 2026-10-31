import { Router } from "express";
import * as supplierController from "../../controllers/admin/supplier.controller";
import { requireAuth, requirePermission } from "../../middlewares/admin/authenticate.middleware";

const router = Router();

router.use(requireAuth);
router.get("/", requirePermission("supplier:read"), supplierController.list);
router.get("/create", requirePermission("supplier:write"), supplierController.create);
router.post("/create", requirePermission("supplier:write"), supplierController.createPost);
router.get("/edit/:id", requirePermission("supplier:write"), supplierController.edit);
router.patch("/edit/:id", requirePermission("supplier:write"), supplierController.editPatch);
router.patch("/delete/:id", requirePermission("supplier:write"), supplierController.deletePatch);

export default router;