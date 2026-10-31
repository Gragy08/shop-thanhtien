import { Request, Response } from "express";
import mongoose from "mongoose";
import InventoryItem from "../../models/inventory-item.model";
import Product from "../../models/product.model";
import ProductVariant from "../../models/product-variant.model";
import StockReceipt from "../../models/stock-receipt.model";
import Supplier from "../../models/supplier.model";
import Category from "../../models/category.model";
import AccountAdmin from "../../models/account-admin.model";
import { RequestAccount } from "../../interfaces/request.interface";
import { buildCategoryTree, collectDescendantIds } from "../../helpers/category.helper";
import { parseVNDate } from "../../helpers/date.helper";
import { buildPagination } from "../../helpers/pagination.helper";

interface ReceiptLine {
  variantId: string;
  quantity?: number | string;
  identifiers?: string[] | string;
  purchasePrice?: number | string;
}

const normalizeIdentifiers = (value: unknown): string[] => {
  const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[\n,;]+/) : [];
  return values.map((item) => String(item).trim().toUpperCase()).filter(Boolean);
};

const createReceiptCode = (): string => {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `PN-${date}-${Date.now().toString().slice(-6)}`;
};

export const create = async (_req: Request, res: Response) => {
  const [variants, suppliers] = await Promise.all([
    ProductVariant.find({ status: "active" })
      .populate("productId", "name inventoryType purchasePrice salePrice")
      .sort({ createdAt: "desc" })
      .lean(),
    Supplier.find({ deleted: false, status: "active" }).sort({ name: "asc" }).lean()
  ]);

  const variantClientData = variants.map((variant) => {
    const product = variant.productId as unknown as { _id: mongoose.Types.ObjectId; name: string; inventoryType: string; purchasePrice?: number };
    const labels = variant.attributeValues ? variant.attributeValues.map((item) => item.label).join(" / ") : "";
    const effectivePrice = (typeof variant.purchasePriceOverride === "number" && variant.purchasePriceOverride >= 0)
      ? variant.purchasePriceOverride
      : (product?.purchasePrice || 0);

    return {
      id: String(variant._id),
      productId: String(product?._id || ""),
      productName: product?.name || "Không xác định",
      sku: variant.sku || "",
      labels,
      fullTitle: `${product?.name || "Không xác định"}${labels ? " - " + labels : ""}${variant.sku ? " (" + variant.sku + ")" : ""}`,
      trackingType: product?.inventoryType || "quantity",
      defaultPrice: effectivePrice
    };
  });

  res.render("admin/inventory/receipt-form", {
    pageTitle: "Nhập kho",
    variants,
    variantClientData,
    suppliers,
    canCreate: variants.length > 0 && suppliers.length > 0
  });
};

export const createPost = async (req: RequestAccount, res: Response) => {
  let lines: ReceiptLine[];
  try {
    lines = typeof req.body.lines === "string" ? JSON.parse(req.body.lines) : req.body.lines;
  } catch (_error) {
    res.status(400).json({ code: "error", message: "Danh sách nhập kho không hợp lệ!" });
    return;
  }

  if (!req.adminId || !mongoose.isValidObjectId(req.adminId) || !Array.isArray(lines) || lines.length === 0) {
    res.status(400).json({ code: "error", message: "Phiếu nhập phải có ít nhất một dòng hàng!" });
    return;
  }

  const supplierId = typeof req.body.supplierId === "string" ? req.body.supplierId : "";
  const supplierContactName = typeof req.body.supplierContactName === "string" ? req.body.supplierContactName.trim() : "";
  if (!mongoose.isValidObjectId(supplierId) || !supplierContactName || !(await Supplier.exists({ _id: supplierId, deleted: false, status: "active" }))) {
    res.status(400).json({ code: "error", message: "Nhà cung cấp và nhân viên bên nhà cung cấp là bắt buộc!" });
    return;
  }

  const hasInvoice = req.body.hasInvoice === true || req.body.hasInvoice === "true" || req.body.hasInvoice === "on" || req.body.hasInvoice === 1;
  const invoiceNumber = typeof req.body.invoiceNumber === "string" ? req.body.invoiceNumber.trim() : "";
  if (hasInvoice && !invoiceNumber) {
    res.status(400).json({ code: "error", message: "Vui lòng nhập số hóa đơn từ nhà cung cấp!" });
    return;
  }

  const variantIds = lines.map((line) => line.variantId);
  if (variantIds.some((id) => typeof id !== "string" || !mongoose.isValidObjectId(id)) || new Set(variantIds).size !== variantIds.length) {
    res.status(400).json({ code: "error", message: "Biển thể của sản phẩm trong phiếu nhập không hợp lệ hoặc bị trùng!" });
    return;
  }

  const variants = await ProductVariant.find({ _id: { $in: variantIds }, status: "active" })
    .populate("productId", "name inventoryType purchasePrice")
    .lean();
  if (variants.length !== variantIds.length) {
    res.status(400).json({ code: "error", message: "Một hoặc nhiều biển thể của sản phẩm trong phiếu nhập không còn hoạt động!" });
    return;
  }

  const variantMap = new Map(variants.map((variant) => [String(variant._id), variant]));
  const inventoryRows: Array<Record<string, unknown>> = [];
  const receiptItems: Array<{
    productId: mongoose.Types.ObjectId;
    variantId: mongoose.Types.ObjectId;
    trackingType: "imei" | "serial" | "quantity";
    quantity: number;
    purchasePrice: number;
    totalPrice: number;
    identifiers: string[];
  }> = [];
  const identifiersInReceipt = new Set<string>();

  for (const line of lines) {
    const variant = variantMap.get(line.variantId);
    if (!variant || !variant.productId || typeof variant.productId === "string") {
      res.status(400).json({ code: "error", message: "Không đọc được thông tin biến thể của sản phẩm!" });
      return;
    }
    const product = variant.productId as unknown as { _id: mongoose.Types.ObjectId; inventoryType: "imei" | "serial" | "quantity"; purchasePrice?: number };
    const trackingType = product.inventoryType;

    const defaultPrice = (typeof variant.purchasePriceOverride === "number" && variant.purchasePriceOverride >= 0)
      ? variant.purchasePriceOverride
      : (product.purchasePrice || 0);

    const rawLinePrice = Number(line.purchasePrice);
    const linePurchasePrice = !Number.isNaN(rawLinePrice) && rawLinePrice >= 0 ? rawLinePrice : defaultPrice;

    if (trackingType === "quantity") {
      const quantity = Number(line.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) {
        res.status(400).json({ code: "error", message: "Số lượng nhập phải là số nguyên lớn hơn 0!" });
        return;
      }
      const lineTotalPrice = quantity * linePurchasePrice;
      receiptItems.push({
        productId: product._id,
        variantId: variant._id,
        trackingType,
        quantity,
        purchasePrice: linePurchasePrice,
        totalPrice: lineTotalPrice,
        identifiers: []
      });
      inventoryRows.push({
        productId: product._id,
        variantId: variant._id,
        trackingType,
        quantity,
        purchasePrice: linePurchasePrice
      });
      continue;
    }

    const identifiers = normalizeIdentifiers(line.identifiers);
    if (identifiers.length === 0 || new Set(identifiers).size !== identifiers.length) {
      res.status(400).json({ code: "error", message: "IMEI/serial không được rỗng hoặc trùng trong cùng dòng!" });
      return;
    }

    for (const identifier of identifiers) {
      if (identifiersInReceipt.has(identifier)) {
        res.status(400).json({ code: "error", message: `IMEI/serial ${identifier} bị trùng trong phiếu!` });
        return;
      }
      identifiersInReceipt.add(identifier);
      inventoryRows.push({
        productId: product._id,
        variantId: variant._id,
        trackingType,
        identifier,
        quantity: 1,
        purchasePrice: linePurchasePrice
      });
    }

    const quantity = identifiers.length;
    const lineTotalPrice = quantity * linePurchasePrice;
    receiptItems.push({
      productId: product._id,
      variantId: variant._id,
      trackingType,
      quantity,
      purchasePrice: linePurchasePrice,
      totalPrice: lineTotalPrice,
      identifiers
    });
  }

  if (identifiersInReceipt.size > 0 && await InventoryItem.exists({ identifier: { $in: [...identifiersInReceipt] } })) {
    res.status(409).json({ code: "error", message: "Một hoặc nhiều IMEI/serial đã tồn tại trong kho!" });
    return;
  }

  const calculatedTotalCost = receiptItems.reduce((acc, curr) => acc + curr.totalPrice, 0);
  const rawTotalCost = Number(req.body.totalCost);
  const totalCost = !Number.isNaN(rawTotalCost) && rawTotalCost >= 0 ? rawTotalCost : calculatedTotalCost;

  const receipt = await StockReceipt.create({
    receiptCode: createReceiptCode(),
    supplierId: new mongoose.Types.ObjectId(supplierId),
    supplierContactName,
    hasInvoice,
    invoiceNumber: hasInvoice ? invoiceNumber : "",
    totalCost,
    note: typeof req.body.note === "string" ? req.body.note.trim() : "",
    lineCount: lines.length,
    items: receiptItems,
    createdBy: new mongoose.Types.ObjectId(req.adminId)
  });

  try {
    await InventoryItem.insertMany(inventoryRows.map((row) => ({ ...row, receiptId: receipt._id })));
  } catch (error) {
    await StockReceipt.deleteOne({ _id: receipt._id });
    console.error(error);
    res.status(409).json({ code: "error", message: "Không thể ghi tồn kho, hãy kiểm tra IMEI/serial trùng!" });
    return;
  }

  res.json({ code: "success", message: `Nhập kho thành công: ${inventoryRows.length} đơn vị hàng hóa.`, receiptId: receipt.id });
};

export const list = async (req: Request, res: Response) => {
  const keyword = typeof req.query.keyword === "string" ? req.query.keyword.trim() : "";
  const categoryId = typeof req.query.categoryId === "string" ? req.query.categoryId : "";
  const status = typeof req.query.status === "string" ? req.query.status : "";

  const find: Record<string, unknown> = { deleted: { $ne: true } };

  if (["available", "sold", "warranty", "returned", "damaged", "liquidated"].includes(status)) {
    find.status = status;
  }

  if (mongoose.isValidObjectId(categoryId)) {
    const allCategories = await Category.find({ deleted: false }).select("_id parentId name slug status").lean();
    const tree = buildCategoryTree(allCategories);
    const descendantIds = collectDescendantIds(tree, categoryId);
    const targetCategoryIds = [
      new mongoose.Types.ObjectId(categoryId),
      ...descendantIds.map((id) => new mongoose.Types.ObjectId(id))
    ];
    const productIds = await Product.find({
      categoryIds: { $in: targetCategoryIds }
    }).distinct("_id");
    find.productId = { $in: productIds };
  }

  if (keyword) {
    const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const [products, variants] = await Promise.all([
      Product.find({ name: regex }).select("_id").lean(),
      ProductVariant.find({ sku: regex }).select("_id").lean()
    ]);
    find.$or = [
      { identifier: regex },
      { productId: { $in: products.map((product) => product._id) } },
      { variantId: { $in: variants.map((variant) => variant._id) } }
    ];
  }

  const inventoryItems = await InventoryItem.find(find)
    .populate("productId", "name categoryIds inventoryType")
    .populate("variantId", "sku attributeValues")
    .populate({
      path: "receiptId",
      match: { deleted: { $ne: true } },
      select: "receiptCode supplierId createdAt",
      populate: { path: "supplierId", select: "name" }
    })
    .sort({ createdAt: -1 })
    .lean();

  interface SkuInventoryGroup {
    variantId: string;
    product: {
      _id: string;
      name: string;
      inventoryType: string;
    };
    variant: {
      _id: string;
      sku?: string;
      attributeValues?: Array<{ attributeId: string; attributeName: string; value: string; label: string }>;
    };
    trackingType: string;
    totalQuantity: number;
    availableCount: number;
    soldCount: number;
    otherCount: number;
    suppliers: Array<{ id: string; name: string }>;
    latestReceipt?: { id: string; code: string; date: Date };
    identifiers: Array<{
      identifier: string;
      status: string;
      receiptId?: string;
      receiptCode?: string;
      supplierName?: string;
    }>;
  }

  const skuMap = new Map<string, SkuInventoryGroup>();

  for (const item of inventoryItems) {
    if (!item.variantId || !item.productId) continue;
    const v = item.variantId as unknown as { _id: mongoose.Types.ObjectId; sku?: string; attributeValues?: Array<{ attributeId: string; attributeName: string; value: string; label: string }> };
    const p = item.productId as unknown as { _id: mongoose.Types.ObjectId; name: string; inventoryType: string };
    const variantIdStr = String(v._id);

    if (!skuMap.has(variantIdStr)) {
      skuMap.set(variantIdStr, {
        variantId: variantIdStr,
        product: { _id: String(p._id), name: p.name, inventoryType: p.inventoryType },
        variant: { _id: variantIdStr, sku: v.sku, attributeValues: v.attributeValues },
        trackingType: item.trackingType,
        totalQuantity: 0,
        availableCount: 0,
        soldCount: 0,
        otherCount: 0,
        suppliers: [],
        identifiers: []
      });
    }

    const group = skuMap.get(variantIdStr)!;
    const qty = item.trackingType === "quantity" ? (Number(item.quantity) || 1) : 1;

    group.totalQuantity += qty;
    if (item.status === "available") {
      group.availableCount += qty;
    } else if (item.status === "sold") {
      group.soldCount += qty;
    } else {
      group.otherCount += qty;
    }

    const receipt = item.receiptId as unknown as { _id: mongoose.Types.ObjectId; receiptCode: string; createdAt: Date; supplierId?: { _id: mongoose.Types.ObjectId; name: string } } | null;

    if (receipt) {
      if (!group.latestReceipt || new Date(receipt.createdAt) > new Date(group.latestReceipt.date)) {
        group.latestReceipt = { id: String(receipt._id), code: receipt.receiptCode, date: receipt.createdAt };
      }
      if (receipt.supplierId && !group.suppliers.some((s) => s.id === String(receipt.supplierId?._id))) {
        group.suppliers.push({ id: String(receipt.supplierId._id), name: receipt.supplierId.name });
      }
    }

    if (item.identifier) {
      group.identifiers.push({
        identifier: item.identifier,
        status: item.status,
        receiptId: receipt ? String(receipt._id) : undefined,
        receiptCode: receipt ? receipt.receiptCode : undefined,
        supplierName: receipt?.supplierId ? receipt.supplierId.name : undefined
      });
    }
  }

  const allInventoryGroups = Array.from(skuMap.values());

  const rawCategories = await Category.find({ deleted: false, status: "active" }).select("_id parentId name slug status").lean();
  rawCategories.sort((a, b) => a.name.localeCompare(b.name, "vi"));
  const categoryTree = buildCategoryTree(rawCategories);

  const totalSKUs = allInventoryGroups.length;
  const totalStock = allInventoryGroups.reduce((acc, g) => acc + g.totalQuantity, 0);
  const totalAvailable = allInventoryGroups.reduce((acc, g) => acc + g.availableCount, 0);

  const pagination = buildPagination(req, totalSKUs, 10);
  const inventoryList = allInventoryGroups.slice(pagination.skip, pagination.skip + pagination.limit);

  res.render("admin/inventory/list", {
    pageTitle: "Tồn kho",
    inventoryList,
    stats: { totalSKUs, totalStock, totalAvailable },
    filters: { keyword, categoryId, status },
    pagination,
    categoryTree,
    canWrite: res.locals.permissions.includes("admin:all") || res.locals.permissions.includes("inventory:write")
  });
};

export const receiptList = async (_req: Request, res: Response) => {
  const req = _req;
  const from = typeof req.query.from === "string" ? req.query.from : "";
  const to = typeof req.query.to === "string" ? req.query.to : "";
  const find: Record<string, unknown> = { deleted: { $ne: true } };
  if (from || to) {
    const createdAt: Record<string, Date> = {};
    const fromDate = parseVNDate(from, false);
    const toDate = parseVNDate(to, true);
    if (fromDate) createdAt.$gte = fromDate;
    if (toDate) createdAt.$lte = toDate;
    if (fromDate || toDate) {
      find.createdAt = createdAt;
    }
  }
  const [filteredReceiptCount, trashCount] = await Promise.all([
    StockReceipt.countDocuments(find),
    StockReceipt.countDocuments({ deleted: true })
  ]);
  const pagination = buildPagination(req, filteredReceiptCount, 10);

  const receiptList = await StockReceipt.find(find)
    .populate("supplierId", "name phone")
    .populate("createdBy", "fullName")
    .sort({ createdAt: "desc" })
    .skip(pagination.skip)
    .limit(pagination.limit)
    .lean();

  res.render("admin/inventory/receipt-list", {
    pageTitle: "Phiếu nhập kho",
    receiptList,
    trashCount,
    filters: { from, to },
    pagination,
    canWrite: res.locals.permissions.includes("admin:all") || res.locals.permissions.includes("inventory:write"),
    canManageReceipt: res.locals.permissions.includes("admin:all") || res.locals.permissions.includes("inventory:receipt:manage"),
    canViewPurchasePrice: res.locals.permissions.includes("admin:all") || res.locals.permissions.includes("price:purchase:read")
  });
};

export const receiptTrash = async (_req: Request, res: Response) => {
  const req = _req;
  const from = typeof req.query.from === "string" ? req.query.from : "";
  const to = typeof req.query.to === "string" ? req.query.to : "";
  const find: Record<string, unknown> = { deleted: true };

  if (from || to) {
    const createdAt: Record<string, Date> = {};
    const fromDate = parseVNDate(from, false);
    const toDate = parseVNDate(to, true);
    if (fromDate) createdAt.$gte = fromDate;
    if (toDate) createdAt.$lte = toDate;
    if (fromDate || toDate) {
      find.createdAt = createdAt;
    }
  }

  const totalTrashCount = await StockReceipt.countDocuments(find);
  const pagination = buildPagination(req, totalTrashCount, 10);

  const trashList = await StockReceipt.find(find)
    .populate("supplierId", "name phone")
    .populate("createdBy", "fullName")
    .sort({ deletedAt: "desc" })
    .skip(pagination.skip)
    .limit(pagination.limit)
    .lean();

  res.render("admin/inventory/receipt-trash", {
    pageTitle: "Thùng rác phiếu nhập kho",
    trashList,
    filters: { from, to },
    pagination,
    canWrite: res.locals.permissions.includes("admin:all") || res.locals.permissions.includes("inventory:write"),
    canManageReceipt: res.locals.permissions.includes("admin:all") || res.locals.permissions.includes("inventory:receipt:manage"),
    canViewPurchasePrice: res.locals.permissions.includes("admin:all") || res.locals.permissions.includes("price:purchase:read")
  });
};

export const receiptDetail = async (req: Request, res: Response) => {
  const receipt = await StockReceipt.findOne({ _id: req.params.id, deleted: { $ne: true } })
    .populate("supplierId", "name address phone")
    .populate("createdBy", "fullName email")
    .populate({
      path: "items.variantId",
      select: "sku attributeValues"
    })
    .populate({
      path: "items.productId",
      select: "name inventoryType"
    })
    .lean();

  if (!receipt) {
    res.redirect("/admin/inventory/receipt");
    return;
  }

  const inventoryList = await InventoryItem.find({ receiptId: receipt._id, deleted: { $ne: true } })
    .populate("productId", "name inventoryType")
    .populate("variantId", "sku attributeValues")
    .sort({ createdAt: "asc" })
    .lean();

  res.render("admin/inventory/receipt-detail", {
    pageTitle: `Chi tiết ${receipt.receiptCode}`,
    receipt,
    inventoryList,
    canManageReceipt: res.locals.permissions.includes("admin:all") || res.locals.permissions.includes("inventory:receipt:manage"),
    canViewPurchasePrice: res.locals.permissions.includes("admin:all") || res.locals.permissions.includes("price:purchase:read")
  });
};

export const edit = async (req: Request, res: Response) => {
  const [receipt, suppliers] = await Promise.all([
    StockReceipt.findOne({ _id: req.params.id, deleted: { $ne: true } }).lean(),
    Supplier.find({ deleted: false, status: "active" }).sort({ name: "asc" }).lean()
  ]);
  if (!receipt) {
    res.redirect("/admin/inventory/receipt");
    return;
  }
  res.render("admin/inventory/receipt-edit", { pageTitle: `Sửa ${receipt.receiptCode}`, receipt, suppliers });
};

export const editPatch = async (req: Request, res: Response) => {
  const supplierId = typeof req.body.supplierId === "string" ? req.body.supplierId : "";
  const supplierContactName = typeof req.body.supplierContactName === "string" ? req.body.supplierContactName.trim() : "";
  if (!mongoose.isValidObjectId(supplierId) || !supplierContactName || !(await Supplier.exists({ _id: supplierId, deleted: false, status: "active" }))) {
    res.status(400).json({ code: "error", message: "Nhà cung cấp và nhân viên liên hệ là bắt buộc!" });
    return;
  }

  const hasInvoice = req.body.hasInvoice === true || req.body.hasInvoice === "true" || req.body.hasInvoice === "on" || req.body.hasInvoice === 1;
  const invoiceNumber = typeof req.body.invoiceNumber === "string" ? req.body.invoiceNumber.trim() : "";
  if (hasInvoice && !invoiceNumber) {
    res.status(400).json({ code: "error", message: "Vui lòng nhập số hóa đơn từ nhà cung cấp!" });
    return;
  }

  const rawTotalCost = Number(req.body.totalCost);
  const totalCost = !Number.isNaN(rawTotalCost) && rawTotalCost >= 0 ? rawTotalCost : 0;

  const result = await StockReceipt.updateOne(
    { _id: req.params.id, deleted: { $ne: true } },
    {
      $set: {
        supplierId: new mongoose.Types.ObjectId(supplierId),
        supplierContactName,
        hasInvoice,
        invoiceNumber: hasInvoice ? invoiceNumber : "",
        totalCost,
        note: typeof req.body.note === "string" ? req.body.note.trim() : ""
      }
    }
  );
  if (!result.matchedCount) {
    res.status(404).json({ code: "error", message: "Phiếu nhập không tồn tại!" });
    return;
  }
  res.json({ code: "success", message: "Cập nhật phiếu nhập thành công!" });
};

export const deletePatch = async (req: Request, res: Response) => {
  const receipt = await StockReceipt.findOneAndUpdate(
    { _id: req.params.id, deleted: { $ne: true } },
    { $set: { deleted: true, deletedAt: new Date() } },
    { new: true }
  );
  if (!receipt) {
    res.status(404).json({ code: "error", message: "Phiếu nhập không tồn tại!" });
    return;
  }
  await InventoryItem.updateMany({ receiptId: receipt._id, deleted: { $ne: true } }, { $set: { deleted: true, deletedAt: new Date() } });
  res.json({ code: "success", message: "Đã xóa mềm phiếu nhập và các dòng tồn kho liên quan!" });
};

export const restorePatch = async (req: Request, res: Response) => {
  const receipt = await StockReceipt.findOneAndUpdate(
    { _id: req.params.id, deleted: true },
    { $set: { deleted: false }, $unset: { deletedAt: "" } },
    { new: true }
  );
  if (!receipt) {
    res.status(404).json({ code: "error", message: "Phiếu nhập không tồn tại hoặc chưa bị xóa!" });
    return;
  }
  await InventoryItem.updateMany({ receiptId: receipt._id, deleted: true }, { $set: { deleted: false }, $unset: { deletedAt: "" } });
  res.json({ code: "success", message: "Đã khôi phục phiếu nhập và hàng hóa trong kho thành công!" });
};

export const deleteHard = async (req: Request, res: Response) => {
  const receipt = await StockReceipt.findById(req.params.id);
  if (!receipt) {
    res.status(404).json({ code: "error", message: "Phiếu nhập không tồn tại!" });
    return;
  }
  await InventoryItem.deleteMany({ receiptId: receipt._id });
  await StockReceipt.deleteOne({ _id: receipt._id });
  res.json({ code: "success", message: "Đã xóa vĩnh viễn phiếu nhập và toàn bộ tồn kho liên quan!" });
};

export const variantItemsJson = async (req: Request, res: Response) => {
  try {
    const variantId = typeof req.params.variantId === "string" ? req.params.variantId : "";
    if (!mongoose.isValidObjectId(variantId)) {
      res.status(400).json({ code: "error", message: "Mã biến thể không hợp lệ!" });
      return;
    }

    const status = typeof req.query.status === "string" ? req.query.status : "";
    const find: Record<string, unknown> = {
      variantId: new mongoose.Types.ObjectId(variantId),
      deleted: { $ne: true }
    };

    if (["available", "sold", "warranty", "returned", "damaged", "liquidated"].includes(status)) {
      find.status = status;
    }

    const [items, variant] = await Promise.all([
      InventoryItem.find(find)
        .populate("productId", "name slug inventoryType")
        .populate("variantId", "sku attributeValues")
        .populate({
          path: "receiptId",
          select: "receiptCode supplierId createdAt invoiceNumber",
          populate: { path: "supplierId", select: "name phone" }
        })
        .populate("statusLogs.updatedBy", "fullName email")
        .sort({ createdAt: -1 })
        .lean(),
      ProductVariant.findById(variantId).populate("productId", "name inventoryType").lean()
    ]);

    const permissions: string[] = res.locals.permissions || [];
    const canViewPurchasePrice = permissions.includes("admin:all") || permissions.includes("price:purchase:read");

    const sanitizedItems = items.map((item) => ({
      ...item,
      purchasePrice: canViewPurchasePrice ? item.purchasePrice : undefined
    }));

    res.json({
      code: "success",
      variant,
      items: sanitizedItems,
      canViewPurchasePrice
    });
  } catch (error) {
    console.error("Error variantItemsJson:", error);
    res.status(500).json({ code: "error", message: "Lỗi khi tải danh sách thiết bị!" });
  }
};

export const changeItemStatus = async (req: RequestAccount, res: Response) => {
  try {
    const id = typeof req.params.id === "string" ? req.params.id : "";
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ code: "error", message: "ID thiết bị không hợp lệ!" });
      return;
    }

    const { status, reason, note } = req.body;
    const validStatuses = ["available", "sold", "warranty", "returned", "damaged", "liquidated"];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ code: "error", message: "Trạng thái thiết bị không hợp lệ!" });
      return;
    }

    const item = await InventoryItem.findOne({ _id: id, deleted: { $ne: true } });
    if (!item) {
      res.status(404).json({ code: "error", message: "Thiết bị không tồn tại hoặc đã bị xóa!" });
      return;
    }

    const fromStatus = item.status;
    const toStatus = status;

    if (fromStatus !== toStatus) {
      item.status = toStatus;
      if (typeof note === "string") {
        item.note = note.trim();
      }

      item.statusLogs.push({
        fromStatus,
        toStatus,
        reason: typeof reason === "string" ? reason.trim() : "",
        note: typeof note === "string" ? note.trim() : "",
        updatedBy: req.adminId && mongoose.isValidObjectId(req.adminId) ? new mongoose.Types.ObjectId(req.adminId) : undefined,
        updatedAt: new Date()
      });

      await item.save();
    }

    res.json({
      code: "success",
      message: `Đã đổi trạng thái thiết bị ${item.identifier || ""} sang "${toStatus}"!`,
      status: toStatus
    });
  } catch (error) {
    console.error("Error changeItemStatus:", error);
    res.status(500).json({ code: "error", message: "Không thể đổi trạng thái thiết bị!" });
  }
};

export const bulkChangeItemStatus = async (req: RequestAccount, res: Response) => {
  try {
    const { itemIds, status, reason, note } = req.body;
    const validStatuses = ["available", "sold", "warranty", "returned", "damaged", "liquidated"];

    if (!Array.isArray(itemIds) || !itemIds.length || !validStatuses.includes(status)) {
      res.status(400).json({ code: "error", message: "Danh sách thiết bị hoặc trạng thái không hợp lệ!" });
      return;
    }

    const validIds = itemIds.filter((id) => mongoose.isValidObjectId(id)).map((id) => new mongoose.Types.ObjectId(id));
    if (!validIds.length) {
      res.status(400).json({ code: "error", message: "Không có thiết bị hợp lệ nào được chọn!" });
      return;
    }

    const items = await InventoryItem.find({ _id: { $in: validIds }, deleted: { $ne: true } });
    let updatedCount = 0;

    for (const item of items) {
      const fromStatus = item.status;
      if (fromStatus !== status) {
        item.status = status;
        if (typeof note === "string" && note.trim()) {
          item.note = note.trim();
        }
        item.statusLogs.push({
          fromStatus,
          toStatus: status,
          reason: typeof reason === "string" ? reason.trim() : "",
          note: typeof note === "string" ? note.trim() : "",
          updatedBy: req.adminId && mongoose.isValidObjectId(req.adminId) ? new mongoose.Types.ObjectId(req.adminId) : undefined,
          updatedAt: new Date()
        });
        await item.save();
        updatedCount++;
      }
    }

    res.json({
      code: "success",
      message: `Đã cập nhật trạng thái sang "${status}" cho ${updatedCount} thiết bị!`
    });
  } catch (error) {
    console.error("Error bulkChangeItemStatus:", error);
    res.status(500).json({ code: "error", message: "Không thể cập nhật trạng thái hàng loạt!" });
  }
};

export const trackerPage = async (req: Request, res: Response) => {
  const keyword = typeof req.query.keyword === "string" ? req.query.keyword.trim().toUpperCase() : "";
  let matchedItem: any = null;

  if (keyword) {
    matchedItem = await InventoryItem.findOne({
      identifier: keyword,
      deleted: { $ne: true }
    })
      .populate("productId", "name slug inventoryType salePrice description")
      .populate("variantId", "sku attributeValues salePriceOverride")
      .populate({
        path: "receiptId",
        select: "receiptCode supplierId createdAt invoiceNumber createdBy hasInvoice totalCost",
        populate: [
          { path: "supplierId", select: "name phone contactPerson" },
          { path: "createdBy", select: "fullName email" }
        ]
      })
      .populate("statusLogs.updatedBy", "fullName email")
      .lean();
  }

  const permissions: string[] = res.locals.permissions || [];
  const canViewPurchasePrice = permissions.includes("admin:all") || permissions.includes("price:purchase:read");

  if (matchedItem && !canViewPurchasePrice) {
    matchedItem.purchasePrice = undefined;
  }

  res.render("admin/inventory/tracker", {
    pageTitle: "Tra cứu thiết bị (IMEI / Serial Tracker)",
    keyword,
    item: matchedItem,
    canViewPurchasePrice,
    canWrite: permissions.includes("admin:all") || permissions.includes("inventory:write")
  });
};

export const trackerSearch = async (req: Request, res: Response) => {
  try {
    const keyword = typeof req.query.keyword === "string" ? req.query.keyword.trim().toUpperCase() : "";
    if (!keyword) {
      res.status(400).json({ code: "error", message: "Vui lòng nhập mã IMEI hoặc Serial để tra cứu!" });
      return;
    }

    const item = await InventoryItem.findOne({
      identifier: keyword,
      deleted: { $ne: true }
    })
      .populate("productId", "name slug inventoryType salePrice")
      .populate("variantId", "sku attributeValues salePriceOverride")
      .populate({
        path: "receiptId",
        select: "receiptCode supplierId createdAt invoiceNumber createdBy hasInvoice",
        populate: [
          { path: "supplierId", select: "name phone contactPerson" },
          { path: "createdBy", select: "fullName email" }
        ]
      })
      .populate("statusLogs.updatedBy", "fullName email")
      .lean();

    if (!item) {
      res.status(404).json({ code: "error", message: `Không tìm thấy thiết bị nào có IMEI/Serial "${keyword}"!` });
      return;
    }

    const permissions: string[] = res.locals.permissions || [];
    const canViewPurchasePrice = permissions.includes("admin:all") || permissions.includes("price:purchase:read");

    if (!canViewPurchasePrice) {
      item.purchasePrice = undefined;
    }

    res.json({
      code: "success",
      item,
      canViewPurchasePrice
    });
  } catch (error) {
    console.error("Error trackerSearch:", error);
    res.status(500).json({ code: "error", message: "Lỗi tra cứu thiết bị!" });
  }
};
