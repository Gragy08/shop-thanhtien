import { Router } from "express";
import * as productController from "../../controllers/admin/product.controller";
import { requireAuth, requirePermission } from "../../middlewares/admin/authenticate.middleware";

const router = Router();

router.use(requireAuth);
router.get("/create", requirePermission("product:write"), productController.create);
router.post("/create", requirePermission("product:write"), productController.createPost);

export default router;