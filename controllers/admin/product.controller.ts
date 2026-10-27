import { Request, Response } from "express";
import mongoose from "mongoose";
import slugify from "slugify";
import Attribute from "../../models/attribute.model";
import Category from "../../models/category.model";
import Product from "../../models/product.model";
import ProductVariant from "../../models/product-variant.model";
import InventoryItem from "../../models/inventory-item.model";
import { buildCategoryTree, collectDescendantIds } from "../../helpers/category.helper";
import { RequestAccount } from "../../interfaces/request.interface";

interface VariantInput {
  id?: string;
  sku?: string;
  attributeValues?: Array<{
    attributeId: string;
    attributeName: string;
    value: string;
    label: string;
  }>;
  purchasePriceOverride?: number | string | null;
  salePriceOverride?: number | string | null;
  status?: string;
}

const parseIds = (value: unknown): string[] | null => {
  let ids: unknown = value;
  if (typeof value === "string") {
    try {
      ids = JSON.parse(value);
    } catch (_error) {
      return null;
    }
  }
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string" || !mongoose.isValidObjectId(id))) return null;
  return [...new Set(ids)];
};

const parsePrice = (value: unknown): number | null => {
  if (value === "" || value === null || value === undefined) return null;
  const price = Number(value);
  return Number.isFinite(price) && price >= 0 ? price : null;
};

const parseImages = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string" && item.trim().length > 0);
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => typeof item === "string" && item.trim().length > 0);
      }
    } catch {
      if (value.trim()) return [value.trim()];
    }
  }
  return [];
};

export const list = async (req: Request, res: Response) => {
  const keyword = typeof req.query.keyword === "string" ? req.query.keyword.trim() : "";
  const categoryId = typeof req.query.categoryId === "string" ? req.query.categoryId : "";
  const status = typeof req.query.status === "string" ? req.query.status : "";

  const find: Record<string, unknown> = { deleted: { $ne: true } };

  if (["active", "inactive", "draft"].includes(status)) {
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
    find.categoryIds = { $in: targetCategoryIds };
  }

  if (keyword) {
    const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const matchedVariants = await ProductVariant.find({ sku: regex }).distinct("productId");
    find.$or = [
      { name: regex },
      { sku: regex },
      { _id: { $in: matchedVariants } }
    ];
  }

  const [products, rawCategories, trashCount, totalProducts, activeCount, draftCount, inactiveCount] = await Promise.all([
    Product.find(find)
      .populate("categoryIds", "name slug")
      .sort({ createdAt: "desc" })
      .limit(200)
      .lean(),
    Category.find({ deleted: false, status: "active" }).select("_id parentId name slug status").lean(),
    Product.countDocuments({ deleted: true }),
    Product.countDocuments({ deleted: { $ne: true } }),
    Product.countDocuments({ deleted: { $ne: true }, status: "active" }),
    Product.countDocuments({ deleted: { $ne: true }, status: "draft" }),
    Product.countDocuments({ deleted: { $ne: true }, status: "inactive" })
  ]);

  rawCategories.sort((a, b) => a.name.localeCompare(b.name, "vi"));
  const categoryTree = buildCategoryTree(rawCategories);

  const productIds = products.map((p) => p._id);

  // Lấy danh sách biến thể theo sản phẩm
  const variants = await ProductVariant.find({ productId: { $in: productIds } })
    .select("productId sku attributeValues status purchasePriceOverride salePriceOverride")
    .lean();

  const variantMap = new Map<string, typeof variants>();
  for (const v of variants) {
    const pId = String(v.productId);
    if (!variantMap.has(pId)) variantMap.set(pId, []);
    variantMap.get(pId)!.push(v);
  }

  // Thống kê tồn kho thực tế có sẵn cho từng sản phẩm
  const stockAgg = await InventoryItem.aggregate([
    {
      $match: {
        productId: { $in: productIds },
        deleted: { $ne: true },
        status: "available"
      }
    },
    {
      $group: {
        _id: "$productId",
        totalAvailable: { $sum: "$quantity" }
      }
    }
  ]);

  const stockMap = new Map<string, number>();
  for (const item of stockAgg) {
    stockMap.set(String(item._id), item.totalAvailable);
  }

  const productList = products.map((product) => {
    const pId = String(product._id);
    const pVariants = variantMap.get(pId) || [];
    const stockQuantity = stockMap.get(pId) || 0;
    return {
      ...product,
      variants: pVariants,
      variantCount: pVariants.length,
      activeVariantCount: pVariants.filter((v) => v.status === "active").length,
      stockQuantity
    };
  });

  res.render("admin/product/list", {
    pageTitle: "Danh sách sản phẩm",
    productList,
    categoryTree,
    trashCount,
    stats: { totalProducts, activeCount, draftCount, inactiveCount },
    filters: { keyword, categoryId, status },
    canWrite: res.locals.permissions.includes("admin:all") || res.locals.permissions.includes("product:write")
  });
};

export const trash = async (req: Request, res: Response) => {
  const keyword = typeof req.query.keyword === "string" ? req.query.keyword.trim() : "";
  const find: Record<string, unknown> = { deleted: true };

  if (keyword) {
    const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    find.$or = [{ name: regex }, { sku: regex }];
  }

  const trashProducts = await Product.find(find)
    .populate("categoryIds", "name slug")
    .sort({ deletedAt: "desc" })
    .limit(200)
    .lean();

  const productIds = trashProducts.map((p) => p._id);
  const variantCounts = await ProductVariant.aggregate([
    { $match: { productId: { $in: productIds } } },
    { $group: { _id: "$productId", count: { $sum: 1 } } }
  ]);

  const countMap = new Map(variantCounts.map((v) => [String(v._id), v.count]));

  const trashList = trashProducts.map((product) => ({
    ...product,
    variantCount: countMap.get(String(product._id)) || 0
  }));

  res.render("admin/product/trash", {
    pageTitle: "Thùng rác sản phẩm",
    trashList,
    keyword,
    canWrite: res.locals.permissions.includes("admin:all") || res.locals.permissions.includes("product:write")
  });
};

export const create = async (_req: Request, res: Response) => {
  const [categories, attributes] = await Promise.all([
    Category.find({ deleted: false, status: "active" }).select("name slug parentId status").lean(),
    Attribute.find({ deleted: false, status: "active" }).select("name code type options status").lean()
  ]);

  res.render("admin/product/form", {
    pageTitle: "Tạo sản phẩm",
    categoryTree: buildCategoryTree(categories),
    attributeList: attributes
  });
};

export const createPost = async (req: RequestAccount, res: Response) => {
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const categoryIds = parseIds(req.body.categoryIds);
    const attributeIds = parseIds(req.body.attributeIds);
    const variants: VariantInput[] = typeof req.body.variants === "string" ? JSON.parse(req.body.variants) : req.body.variants;
    const purchasePrice = parsePrice(req.body.purchasePrice);
    const salePrice = parsePrice(req.body.salePrice);
    const inventoryType = req.body.inventoryType;

    if (!name || !categoryIds?.length || !attributeIds || attributeIds.length > 2 || !Array.isArray(variants) || variants.length === 0 || purchasePrice === null || salePrice === null || !["imei", "serial", "quantity"].includes(inventoryType)) {
      res.status(400).json({ code: "error", message: "Thông tin sản phẩm hoặc variant không hợp lệ!" });
      return;
    }

    const [categoryCount, attributes] = await Promise.all([
      Category.countDocuments({ _id: { $in: categoryIds }, deleted: false, status: "active" }),
      Attribute.find({ _id: { $in: attributeIds }, deleted: false, status: "active" }).lean()
    ]);
    if (categoryCount !== categoryIds.length || attributes.length !== attributeIds.length) {
      res.status(400).json({ code: "error", message: "Danh mục hoặc thuộc tính không hợp lệ!" });
      return;
    }

    const slug = slugify(typeof req.body.slug === "string" && req.body.slug.trim() ? req.body.slug : name, { lower: true, strict: true, trim: true });
    if (await Product.exists({ slug })) {
      res.status(409).json({ code: "error", message: "Đường dẫn sản phẩm đã tồn tại!" });
      return;
    }

    for (const variant of variants) {
      if (!Array.isArray(variant.attributeValues) || variant.attributeValues.length !== attributeIds.length) {
        res.status(400).json({ code: "error", message: "Mỗi variant phải có đủ giá trị thuộc tính đã chọn!" });
        return;
      }
      const variantAttributeIds = variant.attributeValues.map((item) => item.attributeId);
      if (new Set(variantAttributeIds).size !== variantAttributeIds.length || variantAttributeIds.some((id) => !attributeIds.includes(id))) {
        res.status(400).json({ code: "error", message: "Giá trị thuộc tính của variant không hợp lệ!" });
        return;
      }
    }

    const product = await Product.create({
      name,
      slug,
      categoryIds: categoryIds.map((id) => new mongoose.Types.ObjectId(id)),
      attributeIds: attributeIds.map((id) => new mongoose.Types.ObjectId(id)),
      inventoryType,
      purchasePrice,
      salePrice,
      images: parseImages(req.body.images),
      description: typeof req.body.description === "string" ? req.body.description.trim() : "",
      status: req.body.status === "active" ? "active" : req.body.status === "inactive" ? "inactive" : "draft",
      createdBy: req.adminId && mongoose.isValidObjectId(req.adminId) ? new mongoose.Types.ObjectId(req.adminId) : undefined
    });

    await ProductVariant.insertMany(variants.map((variant) => ({
      productId: product._id,
      sku: typeof variant.sku === "string" && variant.sku.trim() ? variant.sku.trim().toUpperCase() : undefined,
      attributeValues: variant.attributeValues,
      purchasePriceOverride: parsePrice(variant.purchasePriceOverride),
      salePriceOverride: parsePrice(variant.salePriceOverride),
      status: variant.status === "inactive" ? "inactive" : "active"
    })));

    res.json({ code: "success", message: "Tạo sản phẩm thành công!", productId: product.id });
  } catch (error) {
    console.error(error);
    res.status(400).json({ code: "error", message: "Không thể tạo sản phẩm với dữ liệu hiện tại!" });
  }
};

export const detail = async (req: Request, res: Response) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, deleted: { $ne: true } })
      .populate("categoryIds", "name slug")
      .lean();

    if (!product) {
      res.status(404).json({ code: "error", message: "Sản phẩm không tồn tại hoặc đã bị xóa!" });
      return;
    }

    const [variants, stockItems] = await Promise.all([
      ProductVariant.find({ productId: product._id }).sort({ createdAt: "asc" }).lean(),
      InventoryItem.aggregate([
        {
          $match: {
            productId: product._id,
            deleted: { $ne: true }
          }
        },
        {
          $group: {
            _id: {
              variantId: "$variantId",
              status: "$status"
            },
            count: { $sum: "$quantity" }
          }
        }
      ])
    ]);

    const variantStockMap = new Map<string, { total: number; available: number; sold: number; other: number }>();
    for (const v of variants) {
      variantStockMap.set(String(v._id), { total: 0, available: 0, sold: 0, other: 0 });
    }

    let totalProductStock = 0;
    let totalProductAvailable = 0;

    for (const item of stockItems) {
      const vId = String(item._id.variantId);
      const st = item._id.status;
      const count = Number(item.count) || 0;

      totalProductStock += count;
      if (st === "available") {
        totalProductAvailable += count;
      }

      if (!variantStockMap.has(vId)) {
        variantStockMap.set(vId, { total: 0, available: 0, sold: 0, other: 0 });
      }
      const entry = variantStockMap.get(vId)!;
      entry.total += count;
      if (st === "available") {
        entry.available += count;
      } else if (st === "sold") {
        entry.sold += count;
      } else {
        entry.other += count;
      }
    }

    const permissions: string[] = res.locals.permissions || [];
    const canViewPurchasePrice = permissions.includes("admin:all") || permissions.includes("price:purchase:read");

    const variantsWithStock = variants.map((v) => {
      const vId = String(v._id);
      const stock = variantStockMap.get(vId) || { total: 0, available: 0, sold: 0, other: 0 };
      return {
        _id: v._id,
        sku: v.sku,
        attributeValues: v.attributeValues,
        purchasePriceOverride: canViewPurchasePrice ? v.purchasePriceOverride : undefined,
        salePriceOverride: v.salePriceOverride,
        status: v.status,
        stock
      };
    });

    const productData = {
      ...product,
      purchasePrice: canViewPurchasePrice ? product.purchasePrice : undefined,
      totalStock: totalProductStock,
      totalAvailable: totalProductAvailable
    };

    res.json({
      code: "success",
      product: productData,
      variants: variantsWithStock,
      canViewPurchasePrice
    });
  } catch (error) {
    console.error("Error fetching product detail:", error);
    res.status(500).json({ code: "error", message: "Lỗi hệ thống khi tải chi tiết sản phẩm!" });
  }
};

export const edit = async (req: Request, res: Response) => {
  const product = await Product.findOne({ _id: req.params.id, deleted: { $ne: true } })
    .populate("categoryIds", "name slug")
    .lean();

  if (!product) {
    res.redirect("/admin/product");
    return;
  }

  const [variants, categories, attributes, hasInventory] = await Promise.all([
    ProductVariant.find({ productId: product._id }).sort({ createdAt: "asc" }).lean(),
    Category.find({ deleted: false, status: "active" }).select("name slug parentId status").lean(),
    Attribute.find({ deleted: false, status: "active" }).select("name code type options status").lean(),
    InventoryItem.exists({ productId: product._id, deleted: { $ne: true } })
  ]);

  const selectedCategoryIds = (product.categoryIds as any[]).map((c) => String(c._id || c));

  res.render("admin/product/edit", {
    pageTitle: `Chỉnh sửa: ${product.name}`,
    product,
    variants,
    categoryTree: buildCategoryTree(categories),
    selectedCategoryIds,
    attributeList: attributes,
    hasInventory: Boolean(hasInventory)
  });
};

export const editPatch = async (req: RequestAccount, res: Response) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, deleted: { $ne: true } });
    if (!product) {
      res.status(404).json({ code: "error", message: "Sản phẩm không tồn tại!" });
      return;
    }

    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const categoryIds = parseIds(req.body.categoryIds);
    const purchasePrice = parsePrice(req.body.purchasePrice);
    const salePrice = parsePrice(req.body.salePrice);
    const status = req.body.status;

    if (!name || !categoryIds?.length || purchasePrice === null || salePrice === null || !["draft", "active", "inactive"].includes(status)) {
      res.status(400).json({ code: "error", message: "Thông tin cơ bản của sản phẩm không hợp lệ!" });
      return;
    }

    const slug = slugify(typeof req.body.slug === "string" && req.body.slug.trim() ? req.body.slug : name, { lower: true, strict: true, trim: true });
    if (await Product.exists({ slug, _id: { $ne: product._id } })) {
      res.status(409).json({ code: "error", message: "Đường dẫn sản phẩm này đã được sử dụng bởi sản phẩm khác!" });
      return;
    }

    product.name = name;
    product.slug = slug;
    product.categoryIds = categoryIds.map((id) => new mongoose.Types.ObjectId(id));
    product.purchasePrice = purchasePrice;
    product.salePrice = salePrice;
    product.status = status;
    if (req.body.images !== undefined) {
      product.images = parseImages(req.body.images);
    }
    product.description = typeof req.body.description === "string" ? req.body.description.trim() : "";
    if (req.adminId && mongoose.isValidObjectId(req.adminId)) {
      product.updatedBy = new mongoose.Types.ObjectId(req.adminId);
    }

    await product.save();

    // Cập nhật các variant nếu có
    if (req.body.variants) {
      const variants: VariantInput[] = typeof req.body.variants === "string" ? JSON.parse(req.body.variants) : req.body.variants;
      if (Array.isArray(variants)) {
        for (const v of variants) {
          if (v.id && mongoose.isValidObjectId(v.id)) {
            const updateObj: Record<string, unknown> = {};
            if (typeof v.sku === "string") updateObj.sku = v.sku.trim().toUpperCase() || undefined;
            if (v.status === "active" || v.status === "inactive") updateObj.status = v.status;
            updateObj.purchasePriceOverride = parsePrice(v.purchasePriceOverride);
            updateObj.salePriceOverride = parsePrice(v.salePriceOverride);

            await ProductVariant.updateOne({ _id: v.id, productId: product._id }, { $set: updateObj });
          }
        }
      }
    }

    res.json({ code: "success", message: "Cập nhật sản phẩm thành công!" });
  } catch (error) {
    console.error(error);
    res.status(400).json({ code: "error", message: "Không thể cập nhật sản phẩm!" });
  }
};

export const changeStatus = async (req: RequestAccount, res: Response) => {
  const product = await Product.findOne({ _id: req.params.id, deleted: { $ne: true } });
  if (!product) {
    res.status(404).json({ code: "error", message: "Sản phẩm không tồn tại!" });
    return;
  }

  const requestedStatus = typeof req.body.status === "string" ? req.body.status : "";
  const newStatus = ["active", "inactive", "draft"].includes(requestedStatus)
    ? requestedStatus
    : product.status === "active"
    ? "inactive"
    : "active";

  product.status = newStatus as "active" | "inactive" | "draft";
  if (req.adminId && mongoose.isValidObjectId(req.adminId)) {
    product.updatedBy = new mongoose.Types.ObjectId(req.adminId);
  }

  await product.save();
  res.json({ code: "success", message: `Đã đổi trạng thái sang "${newStatus}"!`, status: newStatus });
};

export const deletePatch = async (req: RequestAccount, res: Response) => {
  const product = await Product.findOneAndUpdate(
    { _id: req.params.id, deleted: { $ne: true } },
    {
      $set: {
        deleted: true,
        deletedAt: new Date(),
        updatedBy: req.adminId && mongoose.isValidObjectId(req.adminId) ? new mongoose.Types.ObjectId(req.adminId) : undefined
      }
    },
    { new: true }
  );

  if (!product) {
    res.status(404).json({ code: "error", message: "Sản phẩm không tồn tại!" });
    return;
  }

  res.json({ code: "success", message: "Đã chuyển sản phẩm vào Thùng rác (Lưu trữ)!" });
};

export const restorePatch = async (req: RequestAccount, res: Response) => {
  const product = await Product.findOneAndUpdate(
    { _id: req.params.id, deleted: true },
    {
      $set: {
        deleted: false,
        updatedBy: req.adminId && mongoose.isValidObjectId(req.adminId) ? new mongoose.Types.ObjectId(req.adminId) : undefined
      },
      $unset: { deletedAt: "" }
    },
    { new: true }
  );

  if (!product) {
    res.status(404).json({ code: "error", message: "Sản phẩm không tồn tại hoặc chưa bị xóa!" });
    return;
  }

  res.json({ code: "success", message: "Đã khôi phục sản phẩm thành công!" });
};

export const deleteHard = async (req: Request, res: Response) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404).json({ code: "error", message: "Sản phẩm không tồn tại!" });
    return;
  }

  const hasInventory = await InventoryItem.exists({ productId: product._id });
  if (hasInventory) {
    res.status(400).json({
      code: "error",
      message: "Không thể xóa vĩnh viễn sản phẩm đang có dữ liệu trong kho! Hãy xóa các phiếu nhập kho liên quan trước."
    });
    return;
  }

  await ProductVariant.deleteMany({ productId: product._id });
  await Product.deleteOne({ _id: product._id });

  res.json({ code: "success", message: "Đã xóa vĩnh viễn sản phẩm và toàn bộ biến thể liên quan!" });
};
