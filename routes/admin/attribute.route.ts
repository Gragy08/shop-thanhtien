import { Router } from "express";
import * as attributeController from "../../controllers/admin/attribute.controller";
import { requireAuth, requirePermission } from "../../middlewares/admin/authenticate.middleware";

const router = Router();

router.use(requireAuth);
router.get("/attribute", requirePermission("attribute:read"), attributeController.list);
router.get("/attribute/create", requirePermission("attribute:write"), attributeController.create);
router.post("/attribute/create", requirePermission("attribute:write"), attributeController.createPost);
router.get("/attribute/edit/:id", requirePermission("attribute:write"), attributeController.edit);
router.patch("/attribute/edit/:id", requirePermission("attribute:write"), attributeController.editPatch);
router.patch("/attribute/delete/:id", requirePermission("attribute:write"), attributeController.deletePatch);

export default router;