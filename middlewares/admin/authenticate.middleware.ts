import { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import AccountAdmin from "../../models/account-admin.model";
import { AdminRole, rolePermissions } from "../../configs/variable.config";
import { RequestAccount } from "../../interfaces/request.interface";

interface AdminTokenPayload extends jwt.JwtPayload {
  sub: string;
  role: AdminRole;
}

const getTokenPayload = (token: string): AdminTokenPayload => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  const payload = jwt.verify(token, secret);
  if (typeof payload === "string" || !payload.sub || !payload.role) {
    throw new Error("Invalid admin token payload");
  }

  if (!Object.prototype.hasOwnProperty.call(rolePermissions, payload.role)) {
    throw new Error("Invalid admin role");
  }

  return payload as AdminTokenPayload;
};

export const requireAuth = async (req: RequestAccount, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.tokenAdmin;
    if (!token) {
      res.status(401).json({ code: "error", message: "Bạn chưa đăng nhập!" });
      return;
    }

    const payload = getTokenPayload(token);
    const account = await AccountAdmin.findOne({
      _id: payload.sub,
      status: "active",
      deleted: false
    }).select("fullName email role avatar");

    if (!account || account.role !== payload.role) {
      res.clearCookie("tokenAdmin");
      res.status(401).json({ code: "error", message: "Phiên đăng nhập không hợp lệ!" });
      return;
    }

    req.adminId = account.id;
    req.adminRole = account.role;
    res.locals.accountAdmin = account;
    res.locals.permissions = rolePermissions[account.role];
    next();
  } catch (_error) {
    res.clearCookie("tokenAdmin");
    res.status(401).json({ code: "error", message: "Phiên đăng nhập không hợp lệ!" });
  }
};

export const requirePermission = (permission: string) => {
  return (req: RequestAccount, res: Response, next: NextFunction) => {
    const role = req.adminRole;
    const permissions = role ? rolePermissions[role] : [];
    if (permissions.includes("admin:all") || permissions.includes(permission)) {
      next();
      return;
    }

    res.status(403).json({ code: "error", message: "Bạn không có quyền thực hiện thao tác này!" });
  };
};