const defaultDigits = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];

function readThreeDigits(threeDigits: number, showZeroHundred: boolean): string {
  const hundred = Math.floor(threeDigits / 100);
  const ten = Math.floor((threeDigits % 100) / 10);
  const unit = threeDigits % 10;
  let result = "";

  if (hundred > 0 || showZeroHundred) {
    result += `${defaultDigits[hundred]} trăm `;
    if (ten === 0 && unit > 0) result += "lẻ ";
  }

  if (ten === 1) {
    result += "mười ";
  } else if (ten > 1) {
    result += `${defaultDigits[ten]} mươi `;
  }

  if (ten > 0 && unit === 1) {
    if (ten === 1) {
      result += "một ";
    } else {
      result += "mốt ";
    }
  } else if (unit === 5 && ten > 0) {
    result += "lăm ";
  } else if (unit > 0) {
    result += `${defaultDigits[unit]} `;
  }

  return result.trim();
}

/**
 * Đọc số tiền VNĐ thành chữ tiếng Việt chuẩn xác
 * Ví dụ: 3499988 -> "Ba triệu bốn trăm chín mươi chín nghìn chín trăm tám mươi tám đồng"
 */
export function readVietnameseNumber(num: number): string {
  if (num === 0) return "Không đồng";
  if (!num || isNaN(num)) return "";

  const units = ["", "nghìn", "triệu", "tỉ", "nghìn tỉ", "triệu tỉ"];
  let n = Math.abs(Math.round(num));
  const groups: number[] = [];

  while (n > 0) {
    groups.push(n % 1000);
    n = Math.floor(n / 1000);
  }

  let words = "";
  for (let i = groups.length - 1; i >= 0; i--) {
    const groupVal = groups[i];
    if (groupVal > 0) {
      const showZero = i < groups.length - 1;
      const groupStr = readThreeDigits(groupVal, showZero);
      words += `${groupStr} ${units[i]} `;
    }
  }

  words = words.trim();
  if (words.length > 0) {
    words = words.charAt(0).toUpperCase() + words.slice(1) + " đồng";
  }

  return words;
}

