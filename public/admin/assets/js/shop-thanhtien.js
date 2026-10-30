/**
 * Shop Thanh Tien - Script tiện ích dùng chung toàn hệ thống Admin
 * 1. Thông báo Notyf & drawNotify (đồng bộ project-ecommerce)
 * 2. Helper định dạng tiền tệ VND tự động cho các ô input & giao diện
 * 3. Helper định dạng ngày tháng dd/mm/yyyy & khởi tạo Datepicker
 */

// =============================================================================
// 1. NOTYF NOTIFICATION & FLASH MESSAGES
// =============================================================================
var notyf;
if (typeof Notyf !== "undefined") {
  notyf = new Notyf({
    duration: 3500,
    position: {
      x: "right",
      y: "top"
    },
    dismissible: true
  });
}

// Kiểm tra thông báo chuyển trang được lưu trong sessionStorage
try {
  const notifyData = sessionStorage.getItem("notify");
  if (notifyData && notyf) {
    const parsed = JSON.parse(notifyData);
    if (parsed.type === "error") {
      notyf.error(parsed.message);
    } else {
      notyf.success(parsed.message);
    }
    sessionStorage.removeItem("notify");
  }
} catch (e) {
  console.error("Lỗi đọc notify từ sessionStorage:", e);
}

/**
 * Lưu thông báo vào sessionStorage để hiển thị sau khi reload hoặc redirect trang
 * @param {'success'|'error'} type 
 * @param {string} message 
 */
window.drawNotify = (type, message) => {
  try {
    sessionStorage.setItem("notify", JSON.stringify({ type, message }));
  } catch (e) {}
};

// =============================================================================
// 2. CURRENCY FORMATTER (VND) - DẤU CHẤM PHÂN CÁCH HÀNG NGHÌN
// =============================================================================

/**
 * Định dạng số thành chuỗi tiền tệ VND có dấu chấm (vd: 100000 -> "100.000")
 * @param {number|string} value 
 * @param {string} suffix Hậu tố (mặc định không có, nếu truyền "đ" -> "100.000 đ")
 * @returns {string}
 */
window.formatVND = (value, suffix = "") => {
  if (value === undefined || value === null || value === "") return suffix ? "0 " + suffix : "";
  const cleanStr = String(value).replace(/\./g, "").replace(/,/g, "").replace(/\D/g, "");
  if (!cleanStr) return suffix ? "0 " + suffix : "";
  const num = parseInt(cleanStr, 10);
  if (isNaN(num)) return suffix ? "0 " + suffix : "";
  const formatted = num.toLocaleString("vi-VN");
  return suffix ? `${formatted} ${suffix}` : formatted;
};

/**
 * Tách chuỗi tiền tệ đã định dạng về số nguyên thuần túy (vd: "100.000" -> 100000)
 * @param {string|number} value 
 * @returns {number}
 */
window.parseVND = (value) => {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "number") return isNaN(value) ? 0 : value;
  const cleanStr = String(value).replace(/\D/g, "");
  const num = parseInt(cleanStr, 10);
  return isNaN(num) ? 0 : num;
};

/**
 * Gắn sự kiện tự động format tiền cho tất cả các input có attribute [format-money] hoặc class .format-money
 */
window.initFormatMoney = () => {
  const inputs = document.querySelectorAll("[format-money], input.format-money");
  inputs.forEach((input) => {
    if (input.dataset.moneyInitialized) return;
    input.dataset.moneyInitialized = "true";

    // Format giá trị ban đầu nếu là số hợp lệ
    if (input.value && !isNaN(Number(String(input.value).replace(/\./g, "")))) {
      const parsed = window.parseVND(input.value);
      input.value = parsed > 0 ? window.formatVND(parsed) : input.value;
    }

    // Lắng nghe sự kiện input khi người dùng gõ phím
    input.addEventListener("input", () => {
      const raw = window.parseVND(input.value);
      if (raw > 0) {
        input.value = window.formatVND(raw);
      } else if (input.value.trim() === "0") {
        input.value = "0";
      } else {
        input.value = "";
      }
    });
  });
};

// =============================================================================
// 3. DATEPICKER & DATE FORMATTER (dd/mm/yyyy - VIỆT NAM)
// =============================================================================

/**
 * Format Date object hoặc chuỗi ngày thành dd/mm/yyyy
 * @param {Date|string} date 
 * @returns {string}
 */
window.formatDateVN = (date) => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Chuyển chuỗi dd/mm/yyyy thành yyyy-mm-dd
 * @param {string} str 
 * @returns {string}
 */
window.parseDateVN = (str) => {
  if (!str || typeof str !== "string") return "";
  const parts = str.trim().split("/");
  if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
    return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  }
  return str;
};

/**
 * Khởi tạo VanillaJS Datepicker & DateRangePicker cho các ô lọc ngày
 */
window.initDatePickers = () => {
  // 1. Nhóm DateRangePicker (khoảng từ ngày - đến ngày trong 1 container)
  if (typeof DateRangePicker !== "undefined") {
    document.querySelectorAll("[date-range]").forEach((el) => {
      if (el.dataset.datepickerInitialized) return;
      el.dataset.datepickerInitialized = "true";
      new DateRangePicker(el, {
        format: "dd/mm/yyyy",
        autohide: true
      });
    });
  }

  // 2. Các ô datepicker đơn lẻ
  if (typeof Datepicker !== "undefined") {
    document.querySelectorAll("[data-datepicker], input.datepicker-vn").forEach((el) => {
      if (el.dataset.datepickerInitialized) return;
      el.dataset.datepickerInitialized = "true";
      new Datepicker(el, {
        format: "dd/mm/yyyy",
        autohide: true
      });
    });
  }
};

// Tự động kích hoạt khi DOM tải xong
document.addEventListener("DOMContentLoaded", () => {
  window.initFormatMoney();
  window.initDatePickers();
});

