import { Router } from "express";
import * as categoryController from "../../controllers/admin/category.controller";
import { requireAuth, requirePermission } from "../../middlewares/admin/authenticate.middleware";

const router = Router();

router.use(requireAuth);
router.get("/category", requirePermission("category:read"), categoryController.list);
router.get("/category/create", requirePermission("category:write"), categoryController.create);
router.post("/category/create", requirePermission("category:write"), categoryController.createPost);
router.get("/category/edit/:id", requirePermission("category:write"), categoryController.edit);
router.patch("/category/edit/:id", requirePermission("category:write"), categoryController.editPatch);
router.patch("/category/delete/:id", requirePermission("category:write"), categoryController.deletePatch);

export default router;