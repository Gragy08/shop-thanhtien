import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import AccountAdmin from "../../models/account-admin.model";
import { RequestAccount } from "../../interfaces/request.interface";
import { pathAdmin } from "../../configs/variable.config";

const getJwtSecret = (): string => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }
  return process.env.JWT_SECRET;
};

export const login = (req: Request, res: Response) => {
  const token = req.cookies?.tokenAdmin;
  if (token) {
    try {
      const secret = process.env.JWT_SECRET;
      if (secret) {
        jwt.verify(token, secret);
        res.redirect(`/${pathAdmin}/dashboard`);
        return;
      }
    } catch (_e) {
      res.clearCookie("tokenAdmin");
    }
  }

  res.render("admin/account-login", {
    pageTitle: "Đăng nhập quản trị"
  });
};

export const loginPost = async (req: Request, res: Response) => {
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";

  if (!email || !password) {
    res.status(400).json({ code: "error", message: "Email và mật khẩu là bắt buộc!" });
    return;
  }

  const account = await AccountAdmin.findOne({ email, deleted: false }).select("+password");
  if (!account || account.status !== "active" || !(await bcrypt.compare(password, account.password))) {
    res.status(401).json({ code: "error", message: "Email hoặc mật khẩu không chính xác!" });
    return;
  }

  const rememberPassword = req.body.rememberPassword === true || req.body.rememberPassword === "true";
  const token = jwt.sign(
    { sub: account.id, email: account.email, role: account.role },
    getJwtSecret(),
    { expiresIn: rememberPassword ? "7d" : "1d" }
  );

  await AccountAdmin.updateOne({ _id: account._id }, { lastLoginAt: new Date() });
  res.cookie("tokenAdmin", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: rememberPassword ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
  });

  res.json({
    code: "success",
    message: "Đăng nhập thành công!",
    account: {
      fullName: account.fullName,
      email: account.email,
      role: account.role
    }
  });
};

export const me = (req: RequestAccount, res: Response) => {
  res.json({
    code: "success",
    account: res.locals.accountAdmin,
    role: req.adminRole
  });
};

export const logout = (req: Request, res: Response) => {
  res.clearCookie("tokenAdmin");
  if (!req.headers.accept?.includes("text/html") && (req.headers.accept?.includes("application/json") || req.xhr)) {
    res.json({ code: "success", message: "Đã đăng xuất!" });
    return;
  }
  res.redirect(`/${pathAdmin}/account/login`);
};