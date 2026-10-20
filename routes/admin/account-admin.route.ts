import { Router } from "express";
import * as accountAdminController from "../../controllers/admin/account-admin.controller";
import { requireAuth, requirePermission } from "../../middlewares/admin/authenticate.middleware";

const router = Router();
const canManageAccounts = [requireAuth, requirePermission("account:manage")];

router.use(...canManageAccounts);
router.get("/list", accountAdminController.list);
router.get("/create", accountAdminController.create);
router.post("/create", accountAdminController.createPost);
router.get("/edit/:id", accountAdminController.edit);
router.patch("/edit/:id", accountAdminController.editPatch);
router.patch("/change-password/:id", accountAdminController.changePasswordPatch);
router.patch("/delete/:id", accountAdminController.deletePatch);

export default router;