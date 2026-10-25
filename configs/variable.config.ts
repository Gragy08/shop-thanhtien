export const pathAdmin = process.env.PATH_ADMIN || "admin";

export const adminRoles = ["admin", "manager"] as const;
export type AdminRole = (typeof adminRoles)[number];

export const purchasePriceRoles: AdminRole[] = ["admin", "manager"];

export const rolePermissions: Record<AdminRole, string[]> = {
	admin: ["admin:all"],
	manager: [
		"product:read",
		"product:write",
		"category:read",
		"category:write",
		"attribute:read",
		"attribute:write",
		"inventory:read",
		"inventory:write",
		"order:read",
		"order:write",
		"media:read",
		"media:write",
		"price:purchase:read",
		"price:purchase:write"
	]
};
