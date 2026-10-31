import { Router } from "express";
import * as inventoryController from "../../controllers/admin/inventory.controller";
import { requireAuth, requirePermission } from "../../middlewares/admin/authenticate.middleware";

const router = Router();

router.use(requireAuth);

router.get("/", requirePermission("inventory:read"), inventoryController.list);
router.get("/tracker", requirePermission("inventory:read"), inventoryController.trackerPage);
router.get("/tracker/search", requirePermission("inventory:read"), inventoryController.trackerSearch);
router.get("/items/:variantId", requirePermission("inventory:read"), inventoryController.variantItemsJson);
router.patch("/item/change-status/:id", requirePermission("inventory:write"), inventoryController.changeItemStatus);
router.post("/items/bulk-change-status", requirePermission("inventory:write"), inventoryController.bulkChangeItemStatus);

router.get("/receipt", requirePermission("inventory:read"), inventoryController.receiptList);
router.get("/receipt/trash", requirePermission("inventory:read"), inventoryController.receiptTrash);
router.get("/receipt/create", requirePermission("inventory:write"), inventoryController.create);
router.post("/receipt/create", requirePermission("inventory:write"), inventoryController.createPost);
router.get("/receipt/edit/:id", requirePermission("inventory:receipt:manage"), inventoryController.edit);
router.patch("/receipt/edit/:id", requirePermission("inventory:receipt:manage"), inventoryController.editPatch);
router.patch("/receipt/restore/:id", requirePermission("inventory:receipt:manage"), inventoryController.restorePatch);
router.patch("/receipt/delete/:id", requirePermission("inventory:receipt:manage"), inventoryController.deletePatch);
router.delete("/receipt/delete/:id", requirePermission("inventory:delete"), inventoryController.deleteHard);
router.get("/receipt/:id", requirePermission("inventory:read"), inventoryController.receiptDetail);

export default router;
