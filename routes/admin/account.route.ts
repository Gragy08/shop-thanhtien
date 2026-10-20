import { Router } from "express";
import * as accountController from "../../controllers/admin/account.controller";
import { requireAuth } from "../../middlewares/admin/authenticate.middleware";

const router = Router();

router.get("/login", accountController.login);
router.post("/login", accountController.loginPost);
router.get("/me", requireAuth, accountController.me);
router.post("/logout", requireAuth, accountController.logout);

export default router;