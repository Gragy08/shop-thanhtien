import { Router } from "express";
import accountRoutes from "./account.route";
import accountAdminRoutes from "./account-admin.route";
import categoryRoutes from "./category.route";
import attributeRoutes from "./attribute.route";
import productRoutes from "./product.route";
import inventoryRoutes from "./inventory.route";
import supplierRoutes from "./supplier.route";
import { requireAuth } from "../../middlewares/admin/authenticate.middleware";
import { RequestAccount } from "../../interfaces/request.interface";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({
    code: "success",
    service: "shop-thanhtien-admin",
    status: "ready"
  });
});

router.use("/account", accountRoutes);
router.use("/account-admin", accountAdminRoutes);
router.use("/product", categoryRoutes);
router.use("/product", attributeRoutes);
router.use("/product", productRoutes);
router.use("/inventory", inventoryRoutes);
router.use("/inventory/supplier", supplierRoutes);

router.get("/protected-health", requireAuth, (req: RequestAccount, res) => {
  res.json({
    code: "success",
    service: "shop-thanhtien-admin",
    status: "authenticated",
    role: req.adminRole
  });
});

export default router;
