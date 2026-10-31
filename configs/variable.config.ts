export const pathAdmin = process.env.PATH_ADMIN || "admin";

export const domainCDN = process.env.DOMAIN_CDN || "http://localhost:4000";
export const fileManagerSecret = process.env.FILE_MANAGER_SECRET || "ECOPROJECTFILEMANAGERSECRET";
export const mediaNamespace = process.env.MEDIA_NAMESPACE || "shop-thanhtien";

export const adminRoles = ["admin", "manager", "staff"] as const;
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
		"inventory:receipt:manage",
		"supplier:read",
		"supplier:write",
		"order:read",
		"order:write",
		"order:cancel",
		"customer:read",
		"customer:write",
		"customer:delete",
		"warranty:read",
		"warranty:write",
		"media:read",
		"media:write",
		"price:purchase:read",
		"price:purchase:write"
	],
	staff: [
		"product:read",
		"category:read",
		"attribute:read",
		"inventory:read",
		"inventory:write",
		"order:read",
		"order:write",
		"customer:read",
		"customer:write",
		"warranty:read",
		"warranty:write"
	]
};
