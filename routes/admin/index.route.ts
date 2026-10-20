import { Router } from "express";
import accountRoutes from "./account.route";
import accountAdminRoutes from "./account-admin.route";
import categoryRoutes from "./category.route";
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

router.get("/protected-health", requireAuth, (req: RequestAccount, res) => {
  res.json({
    code: "success",
    service: "shop-thanhtien-admin",
    status: "authenticated",
    role: req.adminRole
  });
});

export default router;
