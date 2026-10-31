import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import AccountAdmin from "../../models/account-admin.model";
import { RequestAccount } from "../../interfaces/request.interface";

import { adminRoles } from "../../configs/variable.config";
const allowedRoles = adminRoles;
const allowedStatuses = ["active", "inactive"] as const;

const parseAccountInput = (body: Record<string, unknown>) => {
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = body.role;
  const status = body.status;

  if (!fullName || !email || typeof role !== "string" || !allowedRoles.includes(role as typeof allowedRoles[number])) {
    return null;
  }

  if (status !== undefined && (typeof status !== "string" || !allowedStatuses.includes(status as typeof allowedStatuses[number]))) {
    return null;
  }

  return { fullName, email, role, status: status || "active" };
};

export const list = async (_req: Request, res: Response) => {
  const accountList = await AccountAdmin.find({ deleted: false })
    .select("fullName email role status avatar lastLoginAt createdAt")
    .sort({ createdAt: "desc" })
    .lean();

  res.render("admin/account-admin/list", {
    pageTitle: "Tài khoản quản trị",
    accountList
  });
};

export const create = (_req: Request, res: Response) => {
  res.render("admin/account-admin/form", {
    pageTitle: "Tạo tài khoản quản trị",
    formTitle: "Tạo tài khoản",
    account: null,
    isEdit: false
  });
};

export const createPost = async (req: Request, res: Response) => {
  const input = parseAccountInput(req.body);
  const password = typeof req.body.password === "string" ? req.body.password : "";

  if (!input || password.length < 12) {
    res.status(400).json({ code: "error", message: "Dữ liệu không hợp lệ hoặc mật khẩu dưới 12 ký tự!" });
    return;
  }

  const exists = await AccountAdmin.exists({ email: input.email, deleted: false });
  if (exists) {
    res.status(409).json({ code: "error", message: "Email đã tồn tại!" });
    return;
  }

  await AccountAdmin.create({
    ...input,
    password: await bcrypt.hash(password, 12)
  });

  res.json({ code: "success", message: "Tạo tài khoản thành công!" });
};

export const edit = async (req: Request, res: Response) => {
  const account = await AccountAdmin.findOne({ _id: req.params.id, deleted: false })
    .select("fullName email role status avatar")
    .lean();

  if (!account) {
    res.redirect("/admin/account-admin/list");
    return;
  }

  res.render("admin/account-admin/form", {
    pageTitle: "Chỉnh sửa tài khoản quản trị",
    formTitle: "Chỉnh sửa tài khoản",
    account,
    isEdit: true
  });
};

export const editPatch = async (req: Request, res: Response) => {
  const input = parseAccountInput(req.body);
  if (!input) {
    res.status(400).json({ code: "error", message: "Dữ liệu không hợp lệ!" });
    return;
  }

  const exists = await AccountAdmin.exists({
    email: input.email,
    _id: { $ne: req.params.id },
    deleted: false
  });
  if (exists) {
    res.status(409).json({ code: "error", message: "Email đã được sử dụng!" });
    return;
  }

  const result = await AccountAdmin.updateOne(
    { _id: req.params.id, deleted: false },
    { $set: input }
  );

  if (!result.matchedCount) {
    res.status(404).json({ code: "error", message: "Tài khoản không tồn tại!" });
    return;
  }

  res.json({ code: "success", message: "Cập nhật tài khoản thành công!" });
};

export const changePasswordPatch = async (req: Request, res: Response) => {
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (password.length < 12) {
    res.status(400).json({ code: "error", message: "Mật khẩu phải có ít nhất 12 ký tự!" });
    return;
  }

  const result = await AccountAdmin.updateOne(
    { _id: req.params.id, deleted: false },
    { $set: { password: await bcrypt.hash(password, 12) } }
  );

  if (!result.matchedCount) {
    res.status(404).json({ code: "error", message: "Tài khoản không tồn tại!" });
    return;
  }

  res.json({ code: "success", message: "Đổi mật khẩu thành công!" });
};

export const deletePatch = async (req: RequestAccount, res: Response) => {
  if (req.adminId === req.params.id) {
    res.status(400).json({ code: "error", message: "Không thể xóa tài khoản đang đăng nhập!" });
    return;
  }

  const result = await AccountAdmin.updateOne(
    { _id: req.params.id, deleted: false },
    { $set: { deleted: true, deletedAt: new Date(), status: "inactive" } }
  );

  if (!result.matchedCount) {
    res.status(404).json({ code: "error", message: "Tài khoản không tồn tại!" });
    return;
  }

  res.json({ code: "success", message: "Đã vô hiệu hóa tài khoản!" });
};