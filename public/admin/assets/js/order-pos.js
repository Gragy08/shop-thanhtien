let cart = [];
let activeItemIndexForImei = null;
let tempSelectedImeis = [];

const selectImeiModalEl = document.querySelector("#selectImeiModal");
const selectImeiModal = selectImeiModalEl && window.bootstrap ? window.bootstrap.Modal.getOrCreateInstance(selectImeiModalEl) : null;

// ==========================================
// 1. TÌM KIẾM SẢN PHẨM & QUÉT MÃ IMEI REAL-TIME
// ==========================================
const searchInput = document.querySelector("#posSearchInput");
const searchResults = document.querySelector("#posSearchResults");
const clearSearchBtn = document.querySelector("#btnClearSearch");
let searchDebounceTimer = null;

searchInput?.addEventListener("input", (e) => {
  const keyword = e.target.value.trim();
  if (clearSearchBtn) clearSearchBtn.style.display = keyword ? "block" : "none";

  clearTimeout(searchDebounceTimer);
  if (!keyword) {
    if (searchResults) searchResults.style.display = "none";
    return;
  }

  searchDebounceTimer = setTimeout(() => {
    executeProductSearch(keyword);
  }, 220);
});

clearSearchBtn?.addEventListener("click", () => {
  if (searchInput) {
    searchInput.value = "";
    searchInput.focus();
  }
  clearSearchBtn.style.display = "none";
  if (searchResults) searchResults.style.display = "none";
});

// Đóng dropdown khi click ra ngoài
document.addEventListener("click", (e) => {
  if (searchResults && !searchResults.contains(e.target) && e.target !== searchInput) {
    searchResults.style.display = "none";
  }
});

// Thực hiện tìm kiếm qua API backend
const executeProductSearch = async (keyword) => {
  try {
    const response = await fetch(`/admin/order/api/search-products?q=${encodeURIComponent(keyword)}`, {
      credentials: "same-origin"
    });
    const data = await response.json();

    if (!response.ok) {
      console.error(data.message);
      return;
    }

    // 1. Nếu quét trúng đích danh mã IMEI có sẵn (Direct IMEI Match)
    if (data.isDirectImeiMatch) {
      if (searchResults) searchResults.style.display = "none";
      if (searchInput) searchInput.value = "";
      if (clearSearchBtn) clearSearchBtn.style.display = "none";

      addDirectImeiToCart(data);
      return;
    }

    // 2. Nếu quét trúng IMEI nhưng máy không ở trạng thái bán
    if (data.code === "warning") {
      if (typeof notyf !== "undefined") notyf.error(data.message);
      else window.alert(data.message);
      if (searchResults) searchResults.style.display = "none";
      return;
    }

    // 3. Hiển thị danh sách kết quả tìm kiếm theo tên / SKU
    renderSearchResults(data.results || []);
  } catch (err) {
    console.error("Lỗi tìm kiếm sản phẩm:", err);
  }
};

// Hiển thị danh sách kết quả tìm kiếm
const renderSearchResults = (items) => {
  if (!searchResults) return;

  if (!items || !items.length) {
    searchResults.innerHTML = '<div class="p-3 text-center text-muted small"><i class="las la-frown me-1"></i> Không tìm thấy sản phẩm nào trong kho!</div>';
    searchResults.style.display = "block";
    return;
  }

  // Đảm bảo sắp xếp: Hàng CÒN SẴN (availableStock > 0) lên trên đầu, HẾT HÀNG xếp xuống cuối
  items.sort((a, b) => {
    if (a.availableStock > 0 && b.availableStock <= 0) return -1;
    if (a.availableStock <= 0 && b.availableStock > 0) return 1;
    return (b.availableStock || 0) - (a.availableStock || 0);
  });

  searchResults.innerHTML = items.map((item) => {
    const isOutOfStock = item.availableStock <= 0;
    const attrText = (item.attributeValues || []).map((a) => a.label).join(" / ");
    const typeBadge = item.inventoryType === "imei"
      ? '<span class="badge bg-primary ms-1">IMEI</span>'
      : (item.inventoryType === "serial" ? '<span class="badge bg-info text-dark ms-1">Serial</span>' : '<span class="badge bg-secondary ms-1">SL</span>');

    return `
      <div class="dropdown-item p-2 border-bottom product-search-item ${isOutOfStock ? 'opacity-50 text-muted' : ''}" 
        style="cursor: ${isOutOfStock ? 'not-allowed' : 'pointer'};"
        data-item='${JSON.stringify(item).replaceAll("'", "&#39;")}'>
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <strong class="text-dark">${item.productName}</strong> ${typeBadge}
            <div class="small text-muted">
              ${attrText ? `<span>${attrText}</span> | ` : ''}
              Mã SKU: <code>${item.variantSku || '--'}</code>
            </div>
          </div>
          <div class="text-end">
            <strong class="text-primary d-block">${Number(item.unitPrice).toLocaleString("vi-VN")} đ</strong>
            <small class="${isOutOfStock ? 'text-danger fw-bold' : 'text-success'}">
              ${isOutOfStock ? 'Hết hàng' : `Còn ${item.availableStock} sẵn`}
            </small>
          </div>
        </div>
      </div>
    `;
  }).join("");

  searchResults.style.display = "block";

  // Bắt sự kiện chọn sản phẩm từ dropdown
  searchResults.querySelectorAll(".product-search-item").forEach((el) => {
    el.addEventListener("click", () => {
      const itemData = JSON.parse(el.dataset.item.replaceAll("&#39;", "'"));
      if (itemData.availableStock <= 0) {
        if (typeof notyf !== "undefined") notyf.error(`Sản phẩm "${itemData.productName}" hiện đã hết hàng có sẵn trong kho!`);
        else window.alert(`Sản phẩm "${itemData.productName}" hiện đã hết hàng có sẵn trong kho!`);
        return;
      }
      addVariantToCart(itemData);
      searchResults.style.display = "none";
      if (searchInput) {
        searchInput.value = "";
        searchInput.focus();
      }
      if (clearSearchBtn) clearSearchBtn.style.display = "none";
    });
  });
};

// ==========================================
// 2. QUẢN LÝ GIỎ HÀNG (CART LOGIC)
// ==========================================

// Thêm sản phẩm khi quét trúng đích danh mã IMEI
const addDirectImeiToCart = (data) => {
  const existing = cart.find((i) => String(i.variantId) === String(data.variant._id));

  if (existing) {
    if (existing.identifiers.includes(data.matchedImei)) {
      if (typeof notyf !== "undefined") notyf.error(`Mã IMEI "${data.matchedImei}" đã được chọn trong giỏ hàng!`);
      else window.alert(`Mã IMEI "${data.matchedImei}" đã được chọn trong giỏ hàng!`);
      return;
    }
    // Cập nhật lại availableStock và availableIdentifiers mới nhất
    if (data.availableStock != null) existing.availableStock = data.availableStock;
    if (Array.isArray(data.availableIdentifiers) && data.availableIdentifiers.length) {
      existing.availableIdentifiers = data.availableIdentifiers;
    }

    // Thêm IMEI mới vào dòng sản phẩm hiện có
    existing.identifiers.push(data.matchedImei);
    existing.quantity = existing.identifiers.length;
    existing.totalPrice = existing.quantity * existing.unitPrice;
  } else {
    // Tạo dòng sản phẩm mới với IMEI đã quét
    const attrText = (data.variant.attributeValues || []).map((a) => a.label).join(" / ");
    cart.push({
      productId: data.product._id,
      variantId: data.variant._id,
      productName: data.product.name,
      variantSku: data.variant.sku || "",
      variantName: attrText,
      trackingType: data.product.inventoryType,
      unitPrice: Number(data.unitPrice) || 0,
      quantity: 1,
      discount: 0,
      totalPrice: Number(data.unitPrice) || 0,
      identifiers: [data.matchedImei],
      availableStock: data.availableStock || 1,
      availableIdentifiers: data.availableIdentifiers || [data.matchedImei]
    });
  }

  renderCart();
};

// Thêm biến thể từ kết quả tìm kiếm thông thường
const addVariantToCart = (itemData) => {
  const existing = cart.find((i) => String(i.variantId) === String(itemData.variantId));

  if (existing) {
    if (existing.quantity >= existing.availableStock) {
      if (typeof notyf !== "undefined") notyf.error(`Sản phẩm "${existing.productName}" trong kho chỉ còn ${existing.availableStock} chiếc có sẵn!`);
      else window.alert(`Sản phẩm "${existing.productName}" trong kho chỉ còn ${existing.availableStock} chiếc có sẵn!`);
      return;
    }
    existing.quantity += 1;
    existing.totalPrice = existing.quantity * existing.unitPrice;
  } else {
    const attrText = (itemData.attributeValues || []).map((a) => a.label).join(" / ");
    cart.push({
      productId: itemData.productId,
      variantId: itemData.variantId,
      productName: itemData.productName,
      variantSku: itemData.variantSku || "",
      variantName: attrText,
      trackingType: itemData.inventoryType,
      unitPrice: Number(itemData.unitPrice) || 0,
      quantity: 1,
      discount: 0,
      totalPrice: Number(itemData.unitPrice) || 0,
      identifiers: [],
      availableStock: itemData.availableStock,
      availableIdentifiers: itemData.availableIdentifiers || []
    });
  }

  renderCart();
};

// Render lại giao diện giỏ hàng
const renderCart = () => {
  const tbody = document.querySelector("#cartTableBody");
  const emptyRow = document.querySelector("#cartEmptyRow");
  const totalItemsCount = document.querySelector("#cartTotalItemsCount");

  if (totalItemsCount) {
    const totalCount = cart.reduce((acc, i) => acc + i.quantity, 0);
    totalItemsCount.textContent = totalCount;
  }

  if (!cart.length) {
    if (tbody) tbody.innerHTML = "";
    if (emptyRow) {
      emptyRow.style.display = "";
      tbody?.appendChild(emptyRow);
    }
    updateSummary();
    return;
  }

  if (emptyRow) emptyRow.style.display = "none";

  tbody.innerHTML = cart.map((item, index) => {
    const isImeiTracking = item.trackingType === "imei" || item.trackingType === "serial";

    // Cột IMEI
    let imeiCellContent = "";
    if (!isImeiTracking) {
      imeiCellContent = '<span class="badge bg-light text-muted border">Hàng số lượng</span>';
    } else {
      const selectedCount = item.identifiers.length;
      const isFulfilled = selectedCount === item.quantity;

      const chipsHtml = item.identifiers.map((id) =>
        `<span class="badge bg-primary-subtle text-primary border border-primary font-monospace me-1 mb-1">${id}</span>`
      ).join("");

      const statusBadge = isFulfilled
        ? '<span class="badge bg-success-subtle text-success small ms-1"><i class="las la-check"></i> Đủ IMEI</span>'
        : `<span class="badge bg-danger-subtle text-danger small ms-1"><i class="las la-exclamation-circle"></i> Thiếu ${item.quantity - selectedCount}</span>`;

      imeiCellContent = `
        <div class="mb-1">${chipsHtml || '<span class="text-muted small">Chưa chọn IMEI</span>'} ${statusBadge}</div>
        <button class="btn btn-sm btn-outline-primary py-0 px-2 btn-open-imei-select" type="button" data-index="${index}">
          <i class="las la-barcode me-1"></i> ${selectedCount > 0 ? 'Đổi IMEI' : 'Chọn IMEI'} (${selectedCount}/${item.quantity})
        </button>
      `;
    }

    return `
      <tr>
        <td class="text-center text-muted">${index + 1}</td>
        <td>
          <strong class="text-dark">${item.productName}</strong>
          ${item.variantName ? `<br><small class="text-muted">${item.variantName}</small>` : ''}
          ${item.variantSku ? `<code class="ms-1 small">${item.variantSku}</code>` : ''}
        </td>
        <td class="text-end fw-semibold text-dark">
          ${Number(item.unitPrice).toLocaleString("vi-VN")} đ
        </td>
        <td class="text-center">
          <div class="input-group input-group-sm justify-content-center" style="width: 100px; margin: 0 auto;">
            <button class="btn btn-outline-secondary btn-qty-minus" type="button" data-index="${index}">-</button>
            <input class="form-control text-center fw-bold btn-qty-input" type="number" min="1" max="${item.availableStock}" value="${item.quantity}" data-index="${index}">
            <button class="btn btn-outline-secondary btn-qty-plus" type="button" data-index="${index}">+</button>
          </div>
        </td>
        <td>${imeiCellContent}</td>
        <td class="text-end fw-bold text-primary">
          ${Number(item.totalPrice).toLocaleString("vi-VN")} đ
        </td>
        <td class="text-center">
          <button class="btn btn-sm btn-outline-danger py-1 px-2 btn-remove-item" type="button" data-index="${index}" title="Xóa món này">
            <i class="las la-trash-alt"></i>
          </button>
        </td>
      </tr>
    `;
  }).join("");

  bindCartEvents();
  updateSummary();
};

// Gán sự kiện cho các nút trong giỏ hàng
const bindCartEvents = () => {
  // Tăng/giảm số lượng
  document.querySelectorAll(".btn-qty-minus").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index, 10);
      if (cart[idx].quantity > 1) {
        cart[idx].quantity -= 1;
        // Nếu là IMEI, cắt bớt IMEI thừa
        if (cart[idx].identifiers.length > cart[idx].quantity) {
          cart[idx].identifiers.length = cart[idx].quantity;
        }
        cart[idx].totalPrice = cart[idx].quantity * cart[idx].unitPrice;
        renderCart();
      }
    });
  });

  document.querySelectorAll(".btn-qty-plus").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index, 10);
      if (cart[idx].quantity < cart[idx].availableStock) {
        cart[idx].quantity += 1;
        cart[idx].totalPrice = cart[idx].quantity * cart[idx].unitPrice;
        renderCart();
      } else {
        if (typeof notyf !== "undefined") notyf.error(`Sản phẩm này trong kho chỉ còn tối đa ${cart[idx].availableStock} chiếc!`);
        else window.alert(`Sản phẩm này trong kho chỉ còn tối đa ${cart[idx].availableStock} chiếc!`);
      }
    });
  });

  // Nhập số lượng trực tiếp
  document.querySelectorAll(".btn-qty-input").forEach((input) => {
    input.addEventListener("change", (e) => {
      const idx = parseInt(input.dataset.index, 10);
      let val = parseInt(e.target.value, 10) || 1;
      val = Math.max(1, Math.min(val, cart[idx].availableStock));
      cart[idx].quantity = val;
      if (cart[idx].identifiers.length > val) {
        cart[idx].identifiers.length = val;
      }
      cart[idx].totalPrice = cart[idx].quantity * cart[idx].unitPrice;
      renderCart();
    });
  });

  // Xóa món khỏi giỏ
  document.querySelectorAll(".btn-remove-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index, 10);
      cart.splice(idx, 1);
      renderCart();
    });
  });

  // Mở modal chọn IMEI
  document.querySelectorAll(".btn-open-imei-select").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeItemIndexForImei = parseInt(btn.dataset.index, 10);
      openSelectImeiModal(cart[activeItemIndexForImei]);
    });
  });
};

// ==========================================
// 3. MODAL CHỌN MÃ IMEI / SERIAL XUẤT BÁN
// ==========================================
const openSelectImeiModal = async (item) => {
  if (searchResults) searchResults.style.display = "none";
  searchInput?.blur();

  const nameEl = document.querySelector("#modalImeiProductName");
  if (nameEl) nameEl.textContent = `${item.productName} (${item.variantName})`;

  const reqEl = document.querySelector("#modalRequiredCount");
  if (reqEl) reqEl.textContent = item.quantity;
  const maxEl = document.querySelector("#modalMaxCount");
  if (maxEl) maxEl.textContent = item.quantity;

  tempSelectedImeis = [...item.identifiers];
  updateImeiModalCount();

  const searchBox = document.querySelector("#modalImeiSearch");
  if (searchBox) searchBox.value = "";

  // Luôn làm mới danh sách IMEI có sẵn từ server để đảm bảo cập nhật đầy đủ các máy trong kho
  try {
    const response = await fetch(`/admin/order/api/available-imeis/${item.variantId}`, { credentials: "same-origin" });
    const data = await response.json();
    if (data.code === "success" && Array.isArray(data.identifiers)) {
      item.availableIdentifiers = data.identifiers;
      item.availableStock = data.identifiers.length;
    }
  } catch (_e) {
    console.error("Lỗi cập nhật IMEI:", _e);
  }

  renderImeiChips(item.availableIdentifiers || []);
  if (selectImeiModal) selectImeiModal.show();
};

const renderImeiChips = (identifiers) => {
  const container = document.querySelector("#modalImeiList");
  if (!container) return;

  const keyword = document.querySelector("#modalImeiSearch")?.value.trim().toUpperCase() || "";
  let filtered = identifiers;
  if (keyword) {
    filtered = filtered.filter((id) => id.includes(keyword));
  }

  if (!filtered.length) {
    container.innerHTML = '<div class="text-center text-muted w-100 py-3">Không có mã IMEI nào phù hợp.</div>';
    return;
  }

  container.innerHTML = filtered.map((id) => {
    const isSelected = tempSelectedImeis.includes(id);
    return `
      <button class="btn btn-sm ${isSelected ? 'btn-primary' : 'btn-outline-secondary'} imei-chip font-monospace fw-bold" 
        type="button" 
        data-imei="${id}">
        ${id}
        ${isSelected ? '<i class="las la-check ms-1"></i>' : ''}
      </button>
    `;
  }).join("");

  container.querySelectorAll(".imei-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const imei = chip.dataset.imei;
      const currentItem = cart[activeItemIndexForImei];
      const maxAllowed = currentItem ? currentItem.quantity : 1;

      if (tempSelectedImeis.includes(imei)) {
        tempSelectedImeis = tempSelectedImeis.filter((i) => i !== imei);
      } else {
        if (tempSelectedImeis.length >= maxAllowed) {
          if (typeof notyf !== "undefined") notyf.error(`Bạn chỉ cần chọn đúng ${maxAllowed} mã IMEI cho sản phẩm này!`);
          else window.alert(`Bạn chỉ cần chọn đúng ${maxAllowed} mã IMEI cho sản phẩm này!`);
          return;
        }
        tempSelectedImeis.push(imei);
      }

      updateImeiModalCount();
      renderImeiChips(identifiers);
    });
  });
};

document.querySelector("#modalImeiSearch")?.addEventListener("input", () => {
  if (activeItemIndexForImei != null && cart[activeItemIndexForImei]) {
    renderImeiChips(cart[activeItemIndexForImei].availableIdentifiers || []);
  }
});

const updateImeiModalCount = () => {
  const selEl = document.querySelector("#modalSelectedCount");
  if (selEl) selEl.textContent = tempSelectedImeis.length;
};

// Xác nhận chọn IMEI
document.querySelector("#btnConfirmImeis")?.addEventListener("click", () => {
  if (activeItemIndexForImei != null && cart[activeItemIndexForImei]) {
    cart[activeItemIndexForImei].identifiers = [...tempSelectedImeis];
    renderCart();
  }
  if (selectImeiModal) selectImeiModal.hide();
});

// ==========================================
// 4. TÍNH TOÁN & CẬP NHẬT THANH TOÁN
// ==========================================
const discountInput = document.querySelector("#orderDiscountInput");
const paidAmountInput = document.querySelector("#paidAmountInput");
const btnRoundDiscount = document.querySelector("#btnRoundDiscount");
const keepSmallChangeContainer = document.querySelector("#keepSmallChangeContainer");
const keepSmallChangeCheck = document.querySelector("#keepSmallChangeCheck");
const smallChangeAmountText = document.querySelector("#smallChangeAmountText");
const changeDisplay = document.querySelector("#changeAmountDisplay");

const updateSummary = () => {
  const subTotal = cart.reduce((acc, i) => acc + i.totalPrice, 0);
  const discount = Math.max(0, (window.parseVND ? window.parseVND(discountInput?.value) : parseFloat(discountInput?.value)) || 0);
  const totalAmount = Math.max(0, subTotal - discount);

  document.querySelector("#subTotalDisplay").textContent = window.formatVND ? window.formatVND(subTotal, "đ") : `${subTotal.toLocaleString("vi-VN")} đ`;
  document.querySelector("#totalAmountDisplay").textContent = window.formatVND ? window.formatVND(totalAmount, "đ") : `${totalAmount.toLocaleString("vi-VN")} đ`;

  // Tính tiền thừa ban đầu
  const parsedPaid = window.parseVND ? window.parseVND(paidAmountInput?.value) : parseFloat(paidAmountInput?.value);
  const paid = (paidAmountInput?.value !== "" && !isNaN(parsedPaid)) ? parsedPaid : totalAmount;
  const rawChange = Math.max(0, paid - totalAmount);

  // Xử lý tiền lẻ thừa (< 1.000 VNĐ)
  const smallRemainder = rawChange % 1000;
  if (rawChange > 0 && smallRemainder > 0) {
    if (keepSmallChangeContainer) keepSmallChangeContainer.style.display = "block";
    if (smallChangeAmountText) smallChangeAmountText.textContent = window.formatVND ? window.formatVND(smallRemainder, "đ") : `${smallRemainder.toLocaleString("vi-VN")} đ`;
  } else {
    if (keepSmallChangeContainer) keepSmallChangeContainer.style.display = "none";
    if (keepSmallChangeCheck) keepSmallChangeCheck.checked = false;
  }

  // Tiền thối lại thực tế (nếu khách không nhận tiền lẻ: làm tròn xuống phần nghìn)
  let actualChange = rawChange;
  if (keepSmallChangeCheck && keepSmallChangeCheck.checked && smallRemainder > 0) {
    actualChange = Math.floor(rawChange / 1000) * 1000;
  }

  if (changeDisplay) {
    const formattedActual = window.formatVND ? window.formatVND(actualChange, "đ") : `${actualChange.toLocaleString("vi-VN")} đ`;
    const formattedRemainder = window.formatVND ? window.formatVND(smallRemainder, "đ") : `${smallRemainder.toLocaleString("vi-VN")} đ`;
    if (keepSmallChangeCheck && keepSmallChangeCheck.checked && smallRemainder > 0) {
      changeDisplay.innerHTML = `${formattedActual} <span class="badge bg-warning-subtle text-warning-emphasis ms-1 fw-normal">Khách tặng ${formattedRemainder}</span>`;
    } else {
      changeDisplay.textContent = formattedActual;
    }
  }
};

discountInput?.addEventListener("input", updateSummary);
paidAmountInput?.addEventListener("input", updateSummary);
keepSmallChangeCheck?.addEventListener("change", updateSummary);

// Nút tự động làm tròn bill (Bớt số tiền lẻ < 1.000 VNĐ vào ô Giảm giá)
btnRoundDiscount?.addEventListener("click", () => {
  const subTotal = cart.reduce((acc, i) => acc + i.totalPrice, 0);
  const currentDiscount = (window.parseVND ? window.parseVND(discountInput?.value) : parseFloat(discountInput?.value)) || 0;
  const totalBeforeRounding = subTotal - currentDiscount;
  const remainder = totalBeforeRounding % 1000;

  if (remainder > 0 && discountInput) {
    const newDiscount = currentDiscount + remainder;
    discountInput.value = window.formatVND ? window.formatVND(newDiscount) : newDiscount;
    updateSummary();
  } else {
    if (typeof notyf !== "undefined") notyf.success("Hóa đơn đã tròn nghìn đồng, không có số tiền lẻ cần làm tròn!");
    else window.alert("Hóa đơn đã tròn nghìn đồng, không có số tiền lẻ cần làm tròn!");
  }
});

// Nút đúng số tiền
document.querySelector("#btnExactAmount")?.addEventListener("click", () => {
  const subTotal = cart.reduce((acc, i) => acc + i.totalPrice, 0);
  const discount = Math.max(0, (window.parseVND ? window.parseVND(discountInput?.value) : parseFloat(discountInput?.value)) || 0);
  const total = Math.max(0, subTotal - discount);
  if (paidAmountInput) {
    paidAmountInput.value = window.formatVND ? window.formatVND(total) : total;
    updateSummary();
  }
});

// Các nút tiền nhanh (500k, 1tr, 2tr...)
document.querySelectorAll(".btn-quick-cash").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (paidAmountInput) {
      const val = parseInt(btn.dataset.amount, 10);
      paidAmountInput.value = window.formatVND ? window.formatVND(val) : val;
      updateSummary();
    }
  });
});

// Làm mới toàn bộ giỏ hàng
document.querySelector("#btnResetCart")?.addEventListener("click", () => {
  if (!cart.length) return;
  if (window.confirm("Bạn có chắc chắn muốn làm mới (xóa hết) giỏ hàng hiện tại?")) {
    cart = [];
    renderCart();
  }
});

// ==========================================
// 5. HOÀN TẤT ĐƠN HÀNG & GỬI API CHECKOUT
// ==========================================
document.querySelector("#btnCheckout")?.addEventListener("click", async () => {
  const msg = document.querySelector("#posMessage");
  if (msg) msg.textContent = "";

  if (!cart.length) {
    if (typeof notyf !== "undefined") notyf.error("Giỏ hàng đang trống! Vui lòng chọn ít nhất một sản phẩm.");
    else window.alert("Giỏ hàng đang trống! Vui lòng chọn ít nhất một sản phẩm.");
    return;
  }

  // Kiểm tra IMEI với tất cả các dòng hàng định danh
  for (const item of cart) {
    if (item.trackingType === "imei" || item.trackingType === "serial") {
      if (item.identifiers.length !== item.quantity) {
        if (typeof notyf !== "undefined") notyf.error(`Sản phẩm "${item.productName}" yêu cầu chọn đủ ${item.quantity} mã ${item.trackingType === 'imei' ? 'IMEI' : 'Serial'} (Hiện có: ${item.identifiers.length})!`);
        else window.alert(`Sản phẩm "${item.productName}" yêu cầu chọn đủ ${item.quantity} mã ${item.trackingType === 'imei' ? 'IMEI' : 'Serial'} (Hiện có: ${item.identifiers.length})!`);
        return;
      }
    }
  }

  const customerName = document.querySelector("#customerName")?.value.trim() || "Khách lẻ vãng lai";
  const customerPhone = document.querySelector("#customerPhone")?.value.trim() || "";
  const customerAddress = document.querySelector("#customerAddress")?.value.trim() || "";
  const paymentMethod = document.querySelector("input[name=paymentMethod]:checked")?.value || "cash";
  const discount = Math.max(0, (window.parseVND ? window.parseVND(discountInput?.value) : parseFloat(discountInput?.value)) || 0);
  const subTotal = cart.reduce((acc, i) => acc + i.totalPrice, 0);
  const totalAmount = Math.max(0, subTotal - discount);
  const parsedPaid = window.parseVND ? window.parseVND(paidAmountInput?.value) : parseFloat(paidAmountInput?.value);
  const paidAmount = (paidAmountInput?.value !== "" && !isNaN(parsedPaid)) ? parsedPaid : totalAmount;
  const rawChange = Math.max(0, paidAmount - totalAmount);

  const keepSmallChange = keepSmallChangeCheck?.checked;
  const smallRemainder = rawChange % 1000;
  const changeAmount = (keepSmallChange && smallRemainder > 0) ? Math.floor(rawChange / 1000) * 1000 : rawChange;

  let note = document.querySelector("#orderNote")?.value.trim() || "";
  if (keepSmallChange && smallRemainder > 0) {
    const tipText = `[Khách không nhận tiền lẻ thừa: ${window.formatVND ? window.formatVND(smallRemainder, "đ") : smallRemainder + " đ"}]`;
    note = note ? `${note} | ${tipText}` : tipText;
  }

  const payload = {
    customerInfo: {
      fullName: customerName,
      phone: customerPhone,
      address: customerAddress
    },
    items: cart.map((i) => ({
      productId: i.productId,
      variantId: i.variantId,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      discount: i.discount || 0,
      identifiers: i.identifiers
    })),
    subTotal,
    discount,
    totalAmount,
    paymentMethod,
    paidAmount,
    changeAmount,
    note
  };

  const checkoutBtn = document.querySelector("#btnCheckout");
  if (checkoutBtn) {
    checkoutBtn.disabled = true;
    checkoutBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Đang tạo hóa đơn & xuất kho...';
  }

  try {
    const response = await fetch("/admin/order/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload)
    });
    const result = await response.json();

    if (!response.ok || result.code !== "success") {
      if (msg) {
        msg.textContent = result.message || "Không thể hoàn tất đơn hàng!";
        msg.className = "form-message mt-2 mb-0 text-danger fw-bold";
      }
      if (typeof notyf !== "undefined") notyf.error(result.message || "Không thể tạo đơn hàng!");
      else window.alert(result.message || "Không thể tạo đơn hàng!");
      if (checkoutBtn) {
        checkoutBtn.disabled = false;
        checkoutBtn.innerHTML = '<i class="las la-check-circle fs-4 me-1"></i> THANH TOÁN &amp; XUẤT HÓA ĐƠN';
      }
      return;
    }

    if (msg) {
      msg.textContent = result.message;
      msg.className = "form-message mt-2 mb-0 text-success fw-bold";
    }

    // Tự động chuyển hướng sang xem & in hóa đơn bán hàng
    window.drawNotify("success", result.message || "Tạo đơn hàng thành công!");
    window.location.href = `/admin/order/${result.orderId}`;
  } catch (err) {
    console.error(err);
    if (msg) {
      msg.textContent = "Lỗi kết nối khi gửi yêu cầu thanh toán!";
      msg.className = "form-message mt-2 mb-0 text-danger";
    }
    if (typeof notyf !== "undefined") notyf.error("Lỗi kết nối khi gửi yêu cầu thanh toán!");
    if (checkoutBtn) {
      checkoutBtn.disabled = false;
      checkoutBtn.innerHTML = '<i class="las la-check-circle fs-4 me-1"></i> THANH TOÁN &amp; XUẤT HÓA ĐƠN';
    }
  }
});

// ==========================================
// 6. TRA CỨU TỰ ĐỘNG KHÁCH HÀNG THEO SỐ ĐIỆN THOẠI
// ==========================================
const phoneInput = document.querySelector("#customerPhone");
const nameInput = document.querySelector("#customerName");
const addressInput = document.querySelector("#customerAddress");
const lookupBadge = document.querySelector("#customerLookupBadge");
let phoneLookupTimer = null;

phoneInput?.addEventListener("input", (e) => {
  const phone = e.target.value.trim().replace(/\D/g, "");
  clearTimeout(phoneLookupTimer);

  if (phone.length < 9) {
    if (lookupBadge) {
      lookupBadge.style.display = "none";
      lookupBadge.innerHTML = "";
    }
    return;
  }

  phoneLookupTimer = setTimeout(async () => {
    try {
      const res = await fetch(`/admin/customer/api/lookup?phone=${encodeURIComponent(phone)}`, {
        credentials: "same-origin"
      });
      const data = await res.json();

      if (data.code === "success" && data.found && data.customer) {
        if (nameInput && (!nameInput.value || nameInput.value === "Khách lẻ vãng lai" || nameInput.value === "Khách lẻ")) {
          nameInput.value = data.customer.fullName;
        }
        if (addressInput && !addressInput.value && data.customer.address) {
          addressInput.value = data.customer.address;
        }
        if (lookupBadge) {
          const groupBadge = data.customer.customerGroup === "vip" ? '<span class="badge bg-warning text-dark ms-1">VIP</span>' : '';
          lookupBadge.innerHTML = `
            <div class="alert alert-success py-1 px-2 mb-0 small d-flex justify-content-between align-items-center">
              <span><i class="las la-user-check me-1"></i> Khách quen: <strong>${data.customer.fullName}</strong> ${groupBadge}</span>
              <span class="text-muted small">${data.customer.orderCount || 0} đơn (${Number(data.customer.totalSpent || 0).toLocaleString("vi-VN")} đ)</span>
            </div>
          `;
          lookupBadge.style.display = "block";
        }
      } else {
        if (lookupBadge) lookupBadge.style.display = "none";
      }
    } catch (_err) {
      // Ignore lookup network errors
    }
  }, 250);
});


