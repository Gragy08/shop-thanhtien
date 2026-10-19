export const pathAdmin = process.env.PATH_ADMIN || "admin";

export const adminRoles = ["admin", "manager"] as const;
export type AdminRole = (typeof adminRoles)[number];

export const purchasePriceRoles: AdminRole[] = ["admin", "manager"];
