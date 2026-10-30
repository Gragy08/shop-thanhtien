import { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import AccountAdmin from "../../models/account-admin.model";
import { AdminRole, rolePermissions, pathAdmin } from "../../configs/variable.config";
import { RequestAccount } from "../../interfaces/request.interface";

interface AdminTokenPayload extends jwt.JwtPayload {
  sub: string;
  role: AdminRole;
}

const isBrowserNavigation = (req: RequestAccount): boolean => {
  if (req.method !== "GET") return false;
  if (req.xhr || req.headers["x-requested-with"] === "XMLHttpRequest") return false;
  if (req.headers.accept?.includes("application/json")) return false;

  const secFetchDest = req.headers["sec-fetch-dest"];
  if (secFetchDest === "document") return true;
  if (secFetchDest && secFetchDest !== "document") return false;

  return Boolean(req.headers.accept?.includes("text/html"));
};

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
  const isNav = isBrowserNavigation(req);

  try {
    const token = req.cookies?.tokenAdmin;
    if (!token) {
      if (isNav) {
        const cleanPath = req.originalUrl.split("?")[0].replace(/\/+$/, "");
        if (cleanPath === `/${pathAdmin}` || cleanPath === "") {
          res.redirect(`/${pathAdmin}/account/login`);
          return;
        }

        res.status(401).render("admin/session-expired", {
          pageTitle: "Phiên đăng nhập đã hết hạn",
          message: "Bạn chưa đăng nhập hoặc phiên làm việc đã kết thúc. Vui lòng bấm nút bên dưới để đăng nhập lại hệ thống."
        });
        return;
      }

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
      if (isNav) {
        res.status(401).render("admin/session-expired", {
          pageTitle: "Phiên đăng nhập không hợp lệ",
          message: "Tài khoản của bạn không tồn tại, đã bị vô hiệu hóa hoặc quyền truy cập đã thay đổi. Vui lòng đăng nhập lại."
        });
        return;
      }
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
    if (isNav) {
      res.status(401).render("admin/session-expired", {
        pageTitle: "Phiên đăng nhập đã hết hạn",
        message: "Phiên đăng nhập của bạn đã hết hạn. Vui lòng bấm nút bên dưới để đăng nhập lại hệ thống."
      });
      return;
    }
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

    if (isBrowserNavigation(req)) {
      res.status(403).render("admin/error-403", {
        pageTitle: "Truy cập bị từ chối",
        message: "Tài khoản của bạn không có quyền truy cập vào trang này."
      });
      return;
    }

    res.status(403).json({ code: "error", message: "Bạn không có quyền thực hiện thao tác này!" });
  };
};
