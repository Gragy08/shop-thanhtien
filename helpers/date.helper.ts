/**
 * Helper định dạng và xử lý ngày tháng theo chuẩn Việt Nam (dd/mm/yyyy)
 */

/**
 * Format Date hoặc chuỗi ngày thành dd/mm/yyyy
 * Ví dụ: new Date("2026-10-30") -> "30/10/2026"
 */
export const formatVNDate = (
  date: Date | string | undefined | null
): string => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Parse chuỗi ngày từ người dùng (dd/mm/yyyy hoặc yyyy-mm-dd) thành Date object
 * Bắt đầu từ 00:00:00 (nếu isEndOfDay = false) hoặc 23:59:59.999 (nếu isEndOfDay = true)
 */
export const parseVNDate = (
  dateStr: string | undefined | null,
  isEndOfDay: boolean = false
): Date | null => {
  if (!dateStr || typeof dateStr !== "string") return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  let day: number, month: number, year: number;

  if (trimmed.includes("/")) {
    // Định dạng dd/mm/yyyy
    const parts = trimmed.split("/").map(Number);
    if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      day = parts[0];
      month = parts[1];
      year = parts[2];
    } else {
      return null;
    }
  } else if (trimmed.includes("-")) {
    // Định dạng yyyy-mm-dd
    const parts = trimmed.split("-").map(Number);
    if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      year = parts[0];
      month = parts[1];
      day = parts[2];
    } else {
      return null;
    }
  } else {
    return null;
  }

  const d = new Date(
    year,
    month - 1,
    day,
    isEndOfDay ? 23 : 0,
    isEndOfDay ? 59 : 0,
    isEndOfDay ? 59 : 0,
    isEndOfDay ? 999 : 0
  );
  return isNaN(d.getTime()) ? null : d;
};

