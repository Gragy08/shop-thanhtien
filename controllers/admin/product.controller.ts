import { Request, Response } from "express";
import mongoose from "mongoose";
import slugify from "slugify";
import Attribute from "../../models/attribute.model";
import Category from "../../models/category.model";
import Product from "../../models/product.model";
import ProductVariant from "../../models/product-variant.model";
import { buildCategoryTree } from "../../helpers/category.helper";
import { RequestAccount } from "../../interfaces/request.interface";

interface VariantInput {
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
      description: typeof req.body.description === "string" ? req.body.description.trim() : "",
      status: req.body.status === "active" ? "active" : "draft",
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