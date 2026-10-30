/**
 * Helper định dạng tiền tệ Việt Nam (VND)
 * Ví dụ: 100000 -> "100.000 đ"
 */
export const formatVND = (
  amount: number | string | undefined | null,
  suffix: string = "đ"
): string => {
  if (amount === undefined || amount === null || amount === "") {
    return `0${suffix ? " " + suffix : ""}`;
  }
  const rawNum = typeof amount === "string" ? amount.replace(/\./g, "").replace(/,/g, "") : amount;
  const num = Number(rawNum);
  if (isNaN(num)) {
    return `0${suffix ? " " + suffix : ""}`;
  }
  const formatted = num.toLocaleString("vi-VN");
  return suffix ? `${formatted} ${suffix}` : formatted;
};

/**
 * Chuyển đổi chuỗi tiền tệ người dùng nhập về số nguyên thuần túy
 * Ví dụ: "100.000" -> 100000
 */
export const parseVND = (value: string | number | undefined | null): number => {
  if (value === undefined || value === null) return 0;
  if (typeof value === "number") return isNaN(value) ? 0 : value;
  const cleanStr = String(value).replace(/\D/g, "");
  const num = parseInt(cleanStr, 10);
  return isNaN(num) ? 0 : num;
};

