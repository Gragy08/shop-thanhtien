import { Request, Response } from "express";
import mongoose from "mongoose";
import slugify from "slugify";
import Category from "../../models/category.model";
import { buildCategoryTree, collectDescendantIds, flattenCategoryTree } from "../../helpers/category.helper";
import { buildPagination } from "../../helpers/pagination.helper";

const getCategoryRecords = async () => {
  return Category.find({ deleted: false })
    .select("name slug parentId status")
    .sort({ name: "asc" })
    .lean();
};

const normalizeSlug = (value: unknown, name: string): string => {
  const rawSlug = typeof value === "string" && value.trim() ? value : name;
  return slugify(rawSlug, { lower: true, strict: true, trim: true });
};

const parseParentId = (value: unknown): mongoose.Types.ObjectId | null | undefined => {
  if (value === undefined) return undefined;
  if (value === "" || value === null) return null;
  if (typeof value !== "string" || !mongoose.isValidObjectId(value)) return undefined;
  return new mongoose.Types.ObjectId(value);
};

export const list = async (req: Request, res: Response) => {
  const records = await getCategoryRecords();
  const tree = buildCategoryTree(records);
  const fullRecordList = flattenCategoryTree(tree);
  const pagination = buildPagination(req, fullRecordList.length, 10);
  const recordList = fullRecordList.slice(pagination.skip, pagination.skip + pagination.limit);

  res.render("admin/category/list", {
    pageTitle: "Danh mục sản phẩm",
    recordList,
    pagination
  });
};

export const create = async (_req: Request, res: Response) => {
  const records = await getCategoryRecords();
  res.render("admin/category/form", {
    pageTitle: "Tạo danh mục sản phẩm",
    formTitle: "Tạo danh mục",
    category: null,
    categoryTree: buildCategoryTree(records),
    isEdit: false
  });
};

export const createPost = async (req: Request, res: Response) => {
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const parentId = parseParentId(req.body.parentId);
  if (!name || parentId === undefined) {
    res.status(400).json({ code: "error", message: "Tên hoặc danh mục cha không hợp lệ!" });
    return;
  }

  if (parentId && !(await Category.exists({ _id: parentId, deleted: false }))) {
    res.status(400).json({ code: "error", message: "Danh mục cha không tồn tại!" });
    return;
  }

  const slug = normalizeSlug(req.body.slug, name);
  if (!slug || await Category.exists({ slug })) {
    res.status(409).json({ code: "error", message: "Đường dẫn đã tồn tại!" });
    return;
  }

  await Category.create({
    name,
    slug,
    parentId,
    description: typeof req.body.description === "string" ? req.body.description.trim() : "",
    status: req.body.status === "inactive" ? "inactive" : "active"
  });

  res.json({ code: "success", message: "Tạo danh mục thành công!" });
};

export const edit = async (req: Request, res: Response) => {
  const category = await Category.findOne({ _id: req.params.id, deleted: false }).lean();
  if (!category) {
    res.redirect("/admin/product/category");
    return;
  }

  const records = await getCategoryRecords();
  const tree = buildCategoryTree(records);
  const excludedIds = new Set([category._id.toString(), ...collectDescendantIds(tree, category._id.toString())]);

  res.render("admin/category/form", {
    pageTitle: "Chỉnh sửa danh mục sản phẩm",
    formTitle: "Chỉnh sửa danh mục",
    category,
    categoryTree: tree.filter((item) => !excludedIds.has(item.id)),
    isEdit: true
  });
};

export const editPatch = async (req: Request, res: Response) => {
  const category = await Category.findOne({ _id: req.params.id, deleted: false });
  if (!category) {
    res.status(404).json({ code: "error", message: "Danh mục không tồn tại!" });
    return;
  }

  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const parentId = parseParentId(req.body.parentId);
  if (!name || parentId === undefined || String(parentId) === category.id) {
    res.status(400).json({ code: "error", message: "Dữ liệu danh mục không hợp lệ!" });
    return;
  }

  const records = await getCategoryRecords();
  const tree = buildCategoryTree(records);
  const descendantIds = collectDescendantIds(tree, category.id);
  if (parentId && descendantIds.includes(parentId.toString())) {
    res.status(400).json({ code: "error", message: "Không thể chọn danh mục con làm danh mục cha!" });
    return;
  }

  if (parentId && !(await Category.exists({ _id: parentId, deleted: false }))) {
    res.status(400).json({ code: "error", message: "Danh mục cha không tồn tại!" });
    return;
  }

  const slug = normalizeSlug(req.body.slug, name);
  if (await Category.exists({ slug, _id: { $ne: category._id } })) {
    res.status(409).json({ code: "error", message: "Đường dẫn đã tồn tại!" });
    return;
  }

  category.name = name;
  category.slug = slug;
  category.parentId = parentId;
  category.description = typeof req.body.description === "string" ? req.body.description.trim() : "";
  category.status = req.body.status === "inactive" ? "inactive" : "active";
  await category.save();

  res.json({ code: "success", message: "Cập nhật danh mục thành công!" });
};

export const deletePatch = async (req: Request, res: Response) => {
  const hasChildren = await Category.exists({ parentId: req.params.id, deleted: false });
  if (hasChildren) {
    res.status(409).json({ code: "error", message: "Hãy xử lý danh mục con trước khi xóa!" });
    return;
  }

  const result = await Category.updateOne(
    { _id: req.params.id, deleted: false },
    { $set: { deleted: true, deletedAt: new Date() } }
  );
  if (!result.matchedCount) {
    res.status(404).json({ code: "error", message: "Danh mục không tồn tại!" });
    return;
  }

  res.json({ code: "success", message: "Đã xóa danh mục!" });
};
