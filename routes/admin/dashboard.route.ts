import { Router } from "express";
import * as dashboardController from "../../controllers/admin/dashboard.controller";
import { requireAuth } from "../../middlewares/admin/authenticate.middleware";

const router = Router();

router.use(requireAuth);

router.get("/", dashboardController.index);

export default router;

