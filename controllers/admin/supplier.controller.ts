import { Request, Response } from "express";
import Supplier from "../../models/supplier.model";
import { buildPagination } from "../../helpers/pagination.helper";

const parseSupplierInput = (body: Record<string, unknown>) => {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const address = typeof body.address === "string" ? body.address.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const status = body.status === "inactive" ? "inactive" : "active";
  if (!name || !address || !phone) return null;
  return { name, address, phone, status };
};

export const list = async (req: Request, res: Response) => {
  const find = { deleted: false };
  const totalCount = await Supplier.countDocuments(find);
  const pagination = buildPagination(req, totalCount, 10);

  const supplierList = await Supplier.find(find)
    .sort({ createdAt: "desc" })
    .skip(pagination.skip)
    .limit(pagination.limit)
    .lean();

  res.render("admin/supplier/list", {
    pageTitle: "Nhà cung cấp",
    supplierList,
    pagination
  });
};

export const create = (_req: Request, res: Response) => {
  res.render("admin/supplier/form", {
    pageTitle: "Tạo nhà cung cấp",
    formTitle: "Tạo nhà cung cấp",
    supplier: null,
    isEdit: false
  });
};

export const createPost = async (req: Request, res: Response) => {
  const input = parseSupplierInput(req.body);
  if (!input) {
    res.status(400).json({ code: "error", message: "Tên, địa chỉ và số điện thoại là bắt buộc!" });
    return;
  }
  await Supplier.create(input);
  res.json({ code: "success", message: "Tạo nhà cung cấp thành công!" });
};

export const edit = async (req: Request, res: Response) => {
  const supplier = await Supplier.findOne({ _id: req.params.id, deleted: false }).lean();
  if (!supplier) {
    res.redirect("/admin/inventory/supplier");
    return;
  }
  res.render("admin/supplier/form", {
    pageTitle: "Chỉnh sửa nhà cung cấp",
    formTitle: "Chỉnh sửa nhà cung cấp",
    supplier,
    isEdit: true
  });
};

export const editPatch = async (req: Request, res: Response) => {
  const input = parseSupplierInput(req.body);
  if (!input) {
    res.status(400).json({ code: "error", message: "Tên, địa chỉ và số điện thoại là bắt buộc!" });
    return;
  }
  const result = await Supplier.updateOne({ _id: req.params.id, deleted: false }, { $set: input });
  if (!result.matchedCount) {
    res.status(404).json({ code: "error", message: "Nhà cung cấp không tồn tại!" });
    return;
  }
  res.json({ code: "success", message: "Cập nhật nhà cung cấp thành công!" });
};

export const deletePatch = async (req: Request, res: Response) => {
  const result = await Supplier.updateOne(
    { _id: req.params.id, deleted: false },
    { $set: { deleted: true, deletedAt: new Date(), status: "inactive" } }
  );
  if (!result.matchedCount) {
    res.status(404).json({ code: "error", message: "Nhà cung cấp không tồn tại!" });
    return;
  }
  res.json({ code: "success", message: "Đã vô hiệu hóa nhà cung cấp!" });
};
