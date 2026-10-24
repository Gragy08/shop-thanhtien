import { Router } from "express";
import * as supplierController from "../../controllers/admin/supplier.controller";
import { requireAuth, requirePermission } from "../../middlewares/admin/authenticate.middleware";

const router = Router();

router.use(requireAuth, requirePermission("inventory:write"));
router.get("/", supplierController.list);
router.get("/create", supplierController.create);
router.post("/create", supplierController.createPost);
router.get("/edit/:id", supplierController.edit);
router.patch("/edit/:id", supplierController.editPatch);
router.patch("/delete/:id", supplierController.deletePatch);

export default router;