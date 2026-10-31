import { Request } from "express";

export interface PaginationResult {
  currentPage: number;
  limit: number;
  skip: number;
  totalItems: number;
  totalPages: number;
  startItem: number;
  endItem: number;
  pages: Array<number | "...">;
  buildPageUrl: (page: number) => string;
}

export const DEFAULT_PAGE_LIMIT = 10;

export const buildPagination = (
  req: Request,
  totalItems: number,
  defaultLimit = DEFAULT_PAGE_LIMIT
): PaginationResult => {
  const limit = Math.max(1, defaultLimit);
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));

  const rawPage = typeof req.query.page === "string" ? parseInt(req.query.page, 10) : 1;
  const currentPage = Number.isFinite(rawPage) && rawPage >= 1
    ? Math.min(rawPage, totalPages)
    : 1;

  const skip = (currentPage - 1) * limit;
  const startItem = totalItems === 0 ? 0 : skip + 1;
  const endItem = Math.min(skip + limit, totalItems);

  const pages: Array<number | "..."> = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push("...");
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  const basePath = (req.originalUrl || "").split("?")[0] || "";
  const buildPageUrl = (targetPage: number): string => {
    const params = new URLSearchParams();
    for (const [key, val] of Object.entries(req.query)) {
      if (key === "page") continue;
      if (typeof val === "string" && val !== "") {
        params.set(key, val);
      } else if (Array.isArray(val)) {
        for (const item of val) {
          if (typeof item === "string" && item !== "") {
            params.append(key, item);
          }
        }
      }
    }
    params.set("page", String(targetPage));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return {
    currentPage,
    limit,
    skip,
    totalItems,
    totalPages,
    startItem,
    endItem,
    pages,
    buildPageUrl
  };
};

