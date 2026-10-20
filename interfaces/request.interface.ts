import { Request } from "express";
import { AdminRole } from "../configs/variable.config";

export interface RequestAccount extends Request {
  adminId?: string;
  adminRole?: AdminRole;
}