const receiptForm = document.querySelector("#receiptForm");
const receiptLines = document.querySelector("#receiptLines tbody");
const hasInvoiceCheckbox = document.querySelector("#hasInvoice");
const invoiceNumberGroup = document.querySelector("#invoiceNumberGroup");
const invoiceNumberInput = document.querySelector("#invoiceNumber");
const totalCostInput = document.querySelector("#totalCost");
const btnCalcTotal = document.querySelector("#btnCalcTotal");

const variantList = window.variantList || [];
const createProductUrl = window.createProductUrl || "/admin/product/create";

// Tạo container floating gợi ý gắn trực tiếp vào document.body để không bị overflow cha giới hạn
let activeMenu = document.querySelector("#globalVariantSuggestMenu");
if (!activeMenu) {
  activeMenu = document.createElement("div");
  activeMenu.id = "globalVariantSuggestMenu";
  activeMenu.className = "dropdown-menu shadow p-0";
  activeMenu.style.display = "none";
  document.body.appendChild(activeMenu);
}

let currentActiveLine = null;
let currentActiveInput = null;

// Toggle invoice number input
hasInvoiceCheckbox?.addEventListener("change", (event) => {
  const isChecked = event.target.checked;
  if (invoiceNumberGroup) {
    invoiceNumberGroup.style.display = isChecked ? "block" : "none";
  }
  if (invoiceNumberInput) {
    invoiceNumberInput.required = isChecked;
    if (!isChecked) {
      invoiceNumberInput.value = "";
    }
  }
});

const escapeHtml = (str) => {
  if (!str) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
};

const normalizeText = (text) => {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

const filterVariants = (keyword) => {
  const normKey = normalizeText(keyword);
  if (!normKey) {
    return variantList.slice(0, 10);
  }
  return variantList.filter((item) => {
    return (
      normalizeText(item.productName).includes(normKey) ||
      normalizeText(item.sku).includes(normKey) ||
      normalizeText(item.labels).includes(normKey) ||
      normalizeText(item.fullTitle).includes(normKey)
    );
  }).slice(0, 15);
};

const positionMenu = (input) => {
  if (!input || !activeMenu) return;
  const rect = input.getBoundingClientRect();
  const menuWidth = Math.max(rect.width, 380);

  let left = rect.left;
  if (left + menuWidth > window.innerWidth - 12) {
    left = window.innerWidth - menuWidth - 12;
  }
  if (left < 12) left = 12;

  const estimatedHeight = Math.min(activeMenu.scrollHeight || 260, 320);
  let top = rect.bottom + 4;
  if (top + estimatedHeight > window.innerHeight && rect.top > estimatedHeight + 8) {
    top = rect.top - estimatedHeight - 4;
  }

  activeMenu.style.top = `${top}px`;
  activeMenu.style.left = `${left}px`;
  activeMenu.style.width = `${menuWidth}px`;
};

const renderSuggestions = (menu, items, keyword) => {
  if (!items.length) {
    menu.innerHTML = `
      <div class="p-3 text-center text-muted">
        <p class="mb-1 text-danger small">Không tìm thấy sản phẩm nào khớp với "<strong>${escapeHtml(keyword)}</strong>".</p>
        <p class="small text-muted mb-2">Sản phẩm phải được tạo trước trong hệ thống.</p>
        <a class="btn btn-sm btn-primary" href="${createProductUrl}" target="_blank">
          <i class="las la-plus me-1"></i> Tạo sản phẩm mới ngay
        </a>
      </div>
    `;
    return;
  }

  const itemsHtml = items.map((item) => {
    const trackingBadge =
      item.trackingType === "imei"
        ? '<span class="badge bg-primary">IMEI</span>'
        : item.trackingType === "serial"
        ? '<span class="badge bg-info text-dark">SERIAL</span>'
        : '<span class="badge bg-secondary">SL</span>';

    return `
      <button type="button" class="list-group-item list-group-item-action py-2 px-3 variant-suggest-item" data-id="${item.id}">
        <div class="d-flex justify-content-between align-items-center">
          <strong class="text-primary">${escapeHtml(item.productName)}</strong>
          ${trackingBadge}
        </div>
        <div class="d-flex justify-content-between align-items-center small text-muted mt-1">
          <span>${escapeHtml(item.labels || "Mặc định")}</span>
          <code class="text-dark">${escapeHtml(item.sku || "Chưa có SKU")}</code>
        </div>
      </button>
    `;
  }).join("");

  menu.innerHTML = `
    <div class="list-group list-group-flush">${itemsHtml}</div>
    <div class="p-2 border-top bg-light text-center">
      <small class="text-muted">Chưa có sản phẩm? <a href="${createProductUrl}" target="_blank" class="fw-semibold">Tạo sản phẩm mới</a></small>
    </div>
  `;
};

const showSuggestions = (line, keyword) => {
  currentActiveLine = line;
  currentActiveInput = line.querySelector(".variant-search-input");
  const items = filterVariants(keyword);
  renderSuggestions(activeMenu, items, keyword);
  activeMenu.style.display = "block";
  positionMenu(currentActiveInput);
};

const hideSuggestions = () => {
  if (activeMenu) {
    activeMenu.style.display = "none";
  }
};

activeMenu.addEventListener("click", (event) => {
  const itemBtn = event.target.closest(".variant-suggest-item");
  if (!itemBtn || !currentActiveLine) return;
  const variantId = itemBtn.dataset.id;
  const variant = variantList.find((v) => v.id === variantId);
  if (variant) {
    selectVariant(currentActiveLine, variant);
  }
  hideSuggestions();
});

const calcLineTotal = (line) => {
  const isQuantity = line.dataset.trackingType === "quantity";
  const quantityInput = line.querySelector(".variant-quantity");
  const priceInput = line.querySelector(".variant-price");
  const totalInput = line.querySelector(".variant-total");

  let qty = 0;
  if (isQuantity) {
    qty = Number(quantityInput.value) || 0;
  } else {
    const rawIdentifiers = line.querySelector(".variant-identifiers").value;
    const list = rawIdentifiers.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
    qty = list.length;
    quantityInput.value = qty > 0 ? qty : 0;
  }

  const price = window.parseVND ? window.parseVND(priceInput.value) : (Number(priceInput.value) || 0);
  const lineTotal = qty * price;
  if (totalInput) {
    totalInput.value = window.formatVND ? window.formatVND(lineTotal, "đ") : `${lineTotal.toLocaleString("vi-VN")} đ`;
  }
  return lineTotal;
};

const recalcTotalCost = (force = false) => {
  if (!totalCostInput) return;
  const lines = receiptLines ? [...receiptLines.querySelectorAll(".receipt-line")] : [];
  let total = 0;
  for (const line of lines) {
    total += calcLineTotal(line);
  }
  if (force || totalCostInput.dataset.manual !== "true") {
    totalCostInput.value = window.formatVND ? window.formatVND(total) : total;
  }
};

totalCostInput?.addEventListener("input", () => {
  totalCostInput.dataset.manual = "true";
});

btnCalcTotal?.addEventListener("click", () => {
  totalCostInput.dataset.manual = "false";
  recalcTotalCost(true);
});

const syncLineMode = (line, isInitial = false) => {
  const trackingType = line.dataset.trackingType;
  const identifiers = line.querySelector(".variant-identifiers");
  const quantity = line.querySelector(".variant-quantity");
  const price = line.querySelector(".variant-price");

  if (!trackingType) {
    identifiers.disabled = true;
    identifiers.value = "";
    identifiers.placeholder = "Chọn biến thể sản phẩm trước";
    quantity.disabled = true;
    quantity.value = 1;
    price.value = 0;
    calcLineTotal(line);
    recalcTotalCost();
    return;
  }

  const isQuantity = trackingType === "quantity";
  identifiers.disabled = isQuantity;
  quantity.disabled = !isQuantity;
  identifiers.placeholder = isQuantity
    ? "Mặt hàng này quản lý theo số lượng"
    : "Mỗi IMEI/serial một dòng hoặc phân cách bằng dấu phẩy";

  if (!isInitial && line.dataset.defaultPrice) {
    const defaultPrice = Number(line.dataset.defaultPrice) || 0;
    if (defaultPrice > 0 && (!price.value || Number(price.value) === 0)) {
      price.value = defaultPrice;
    }
  }

  calcLineTotal(line);
  recalcTotalCost();
};

const selectVariant = (line, variant) => {
  const searchInput = line.querySelector(".variant-search-input");
  const idInput = line.querySelector(".variant-id-input");

  searchInput.value = variant.fullTitle;
  idInput.value = variant.id;
  line.dataset.trackingType = variant.trackingType;
  line.dataset.defaultPrice = variant.defaultPrice;
  searchInput.classList.remove("is-invalid");
  searchInput.classList.add("is-valid");

  syncLineMode(line, false);
};

const clearVariant = (line) => {
  const searchInput = line.querySelector(".variant-search-input");
  const idInput = line.querySelector(".variant-id-input");

  searchInput.value = "";
  idInput.value = "";
  delete line.dataset.trackingType;
  delete line.dataset.defaultPrice;
  searchInput.classList.remove("is-valid", "is-invalid");

  syncLineMode(line, false);
};

const setupAutocomplete = (line) => {
  const searchInput = line.querySelector(".variant-search-input");
  const clearBtn = line.querySelector(".variant-clear-btn");
  const idInput = line.querySelector(".variant-id-input");

  searchInput?.addEventListener("focus", () => {
    showSuggestions(line, searchInput.value);
  });

  searchInput?.addEventListener("input", () => {
    idInput.value = "";
    delete line.dataset.trackingType;
    delete line.dataset.defaultPrice;
    searchInput.classList.remove("is-valid");

    showSuggestions(line, searchInput.value);
    syncLineMode(line, false);
  });

  clearBtn?.addEventListener("click", () => {
    clearVariant(line);
    hideSuggestions();
  });
};

// Đóng dropdown khi click bên ngoài
document.addEventListener("click", (event) => {
  if (
    !event.target.closest("#globalVariantSuggestMenu") &&
    !event.target.closest(".variant-autocomplete-wrapper")
  ) {
    hideSuggestions();
  }
});

// Điều chỉnh vị trí dropdown khi scroll hoặc resize
window.addEventListener("scroll", () => {
  if (activeMenu.style.display === "block" && currentActiveInput) {
    positionMenu(currentActiveInput);
  }
}, true);

window.addEventListener("resize", () => {
  if (activeMenu.style.display === "block" && currentActiveInput) {
    positionMenu(currentActiveInput);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    hideSuggestions();
  }
});

const createLine = () => {
  const row = document.createElement("tr");
  row.className = "receipt-line";
  row.innerHTML = `
    <td>
      <div class="variant-autocomplete-wrapper">
        <div class="input-group">
          <span class="input-group-text"><i class="las la-search"></i></span>
          <input class="form-control variant-search-input" type="text" placeholder="Gõ tên hoặc SKU để tìm kiếm..." autocomplete="off">
          <button class="btn btn-outline-secondary variant-clear-btn" type="button" title="Xóa chọn">×</button>
        </div>
        <input class="variant-id-input" type="hidden" name="variantId">
      </div>
    </td>
    <td><textarea class="form-control variant-identifiers" rows="2" placeholder="Chọn biến thể sản phẩm trước" disabled></textarea></td>
    <td><input class="form-control variant-quantity" type="number" min="1" value="1" disabled></td>
    <td><input class="form-control variant-price" type="text" format-money value="0" placeholder="0"></td>
    <td><input class="form-control variant-total" type="text" readonly value="0 đ"></td>
    <td class="text-center"><button class="btn btn-sm btn-outline-danger remove-line" type="button" aria-label="Xóa dòng">×</button></td>
  `;
  setupAutocomplete(row);
  if (window.initFormatMoney) window.initFormatMoney();
  return row;
};

receiptLines?.addEventListener("input", (event) => {
  const line = event.target.closest(".receipt-line");
  if (!line) return;
  if (
    event.target.classList.contains("variant-identifiers") ||
    event.target.classList.contains("variant-quantity") ||
    event.target.classList.contains("variant-price")
  ) {
    calcLineTotal(line);
    recalcTotalCost();
  }
});

receiptLines?.addEventListener("click", (event) => {
  if (!event.target.classList.contains("remove-line")) return;
  const rows = receiptLines.querySelectorAll(".receipt-line");
  if (rows.length > 1) {
    event.target.closest(".receipt-line").remove();
    hideSuggestions();
    recalcTotalCost();
  }
});

document.querySelector("#addReceiptLine")?.addEventListener("click", () => {
  const row = createLine();
  receiptLines.appendChild(row);
  syncLineMode(row, true);
});

// Setup cho các dòng ban đầu
document.querySelectorAll(".receipt-line").forEach((line) => {
  setupAutocomplete(line);
  syncLineMode(line, true);
});

receiptForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const rows = [...receiptLines.querySelectorAll(".receipt-line")];
  const message = document.querySelector("#receiptMessage");

  // Validate từng dòng phải có variantId đã chọn
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const idInput = row.querySelector(".variant-id-input");
    const searchInput = row.querySelector(".variant-search-input");
    if (!idInput || !idInput.value) {
      searchInput.classList.add("is-invalid");
      searchInput.focus();
      message.innerHTML = `Dòng số ${i + 1} chưa chọn biến thể sản phẩm hợp lệ trong hệ thống! Nếu sản phẩm chưa có, hãy <a href="${createProductUrl}" target="_blank" class="fw-bold text-decoration-underline">bấm vào đây để tạo sản phẩm mới</a>.`;
      message.className = "form-message mt-3 mb-0 text-danger";
      return;
    }
  }

  const lines = rows.map((line) => {
    const variantId = line.querySelector(".variant-id-input").value;
    const isQuantity = line.dataset.trackingType === "quantity";
    const identifiers = line.querySelector(".variant-identifiers").value;
    const quantity = isQuantity
      ? Number(line.querySelector(".variant-quantity").value) || 1
      : (identifiers.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean).length || 1);
    const purchasePrice = window.parseVND ? window.parseVND(line.querySelector(".variant-price").value) : (Number(line.querySelector(".variant-price").value) || 0);

    return {
      variantId,
      quantity,
      purchasePrice,
      identifiers: isQuantity ? undefined : identifiers
    };
  });

  const formData = new FormData(receiptForm);
  const body = {
    supplierId: formData.get("supplierId"),
    supplierContactName: formData.get("supplierContactName"),
    hasInvoice: hasInvoiceCheckbox?.checked ?? false,
    invoiceNumber: formData.get("invoiceNumber"),
    totalCost: window.parseVND ? window.parseVND(formData.get("totalCost")) : formData.get("totalCost"),
    note: formData.get("note"),
    lines: JSON.stringify(lines)
  };

  const response = await fetch("/admin/inventory/receipt/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body)
  });

  const result = await response.json();
  if (message) {
    message.textContent = result.message || "";
    message.className = `form-message mt-3 mb-0 ${response.ok ? "text-success" : "text-danger"}`;
  }
  if (response.ok) {
    if (typeof notyf !== "undefined") notyf.success(result.message || "Tạo phiếu nhập thành công!");
    receiptForm.reset();
    if (invoiceNumberGroup) invoiceNumberGroup.style.display = "none";
    if (totalCostInput) totalCostInput.dataset.manual = "false";
    document.querySelectorAll(".receipt-line").forEach((line) => {
      clearVariant(line);
      syncLineMode(line, true);
    });
  } else {
    if (typeof notyf !== "undefined") notyf.error(result.message || "Lỗi tạo phiếu nhập kho!");
  }
});
