import { Router } from "express";
import * as inventoryController from "../../controllers/admin/inventory.controller";
import { requireAuth, requirePermission } from "../../middlewares/admin/authenticate.middleware";

const router = Router();

router.use(requireAuth);
router.get("/", requirePermission("inventory:read"), inventoryController.list);
router.get("/receipt", requirePermission("inventory:read"), inventoryController.receiptList);
router.get("/receipt/trash", requirePermission("inventory:read"), inventoryController.receiptTrash);
router.get("/receipt/create", requirePermission("inventory:write"), inventoryController.create);
router.post("/receipt/create", requirePermission("inventory:write"), inventoryController.createPost);
router.get("/receipt/edit/:id", requirePermission("inventory:write"), inventoryController.edit);
router.patch("/receipt/edit/:id", requirePermission("inventory:write"), inventoryController.editPatch);
router.patch("/receipt/restore/:id", requirePermission("inventory:write"), inventoryController.restorePatch);
router.patch("/receipt/delete/:id", requirePermission("inventory:write"), inventoryController.deletePatch);
router.delete("/receipt/delete/:id", requirePermission("inventory:delete"), inventoryController.deleteHard);
router.get("/receipt/:id", requirePermission("inventory:read"), inventoryController.receiptDetail);

export default router;
