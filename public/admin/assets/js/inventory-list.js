let currentVariantId = null;
let currentItems = [];
let canViewCost = false;

const imeiModalEl = document.querySelector("#imeiManagementModal");
const imeiModal = imeiModalEl && window.bootstrap ? window.bootstrap.Modal.getOrCreateInstance(imeiModalEl) : null;

const changeStatusModalEl = document.querySelector("#changeStatusModal");
const changeStatusModal = changeStatusModalEl && window.bootstrap ? window.bootstrap.Modal.getOrCreateInstance(changeStatusModalEl) : null;

// Khởi tạo mở modal quản lý IMEI / Serial của từng biến thể
document.querySelectorAll(".btn-open-imei-modal").forEach((btn) => {
  btn.addEventListener("click", () => {
    currentVariantId = btn.dataset.variantId;
    const variantName = btn.dataset.variantName || "";
    const trackingType = btn.dataset.trackingType || "imei";

    const titleEl = document.querySelector("#modalVariantTitle");
    if (titleEl) titleEl.textContent = variantName;

    const badgeEl = document.querySelector("#modalTrackingTypeBadge");
    if (badgeEl) {
      badgeEl.innerHTML = trackingType === "imei"
        ? '<span class="badge bg-primary">IMEI</span>'
        : '<span class="badge bg-info text-dark">Serial</span>';
    }

    if (imeiModal) imeiModal.show();
    loadVariantItems(currentVariantId);
  });
});

// Tải danh sách thiết bị của biến thể từ API
const loadVariantItems = async (variantId) => {
  const spinner = document.querySelector("#imeiModalLoadingSpinner");
  const content = document.querySelector("#imeiModalContent");
  if (spinner) spinner.style.display = "block";
  if (content) content.style.display = "none";

  // Reset các ô tìm kiếm
  const searchInput = document.querySelector("#imeiSearchInput");
  if (searchInput) searchInput.value = "";
  const statusFilter = document.querySelector("#imeiStatusFilter");
  if (statusFilter) statusFilter.value = "";

  try {
    const response = await fetch(`/admin/inventory/items/${variantId}`, {
      credentials: "same-origin"
    });
    const data = await response.json();

    if (!response.ok || data.code !== "success") {
      if (typeof notyf !== "undefined") notyf.error(data.message || "Không thể tải danh sách thiết bị.");
      else window.alert(data.message || "Không thể tải danh sách thiết bị.");
      if (imeiModal) imeiModal.hide();
      return;
    }

    currentItems = data.items || [];
    canViewCost = Boolean(data.canViewPurchasePrice);

    // Ẩn/hiển thị cột giá vốn theo phân quyền
    document.querySelectorAll(".imei-cost-col").forEach((col) => {
      col.style.display = canViewCost ? "" : "none";
    });

    renderImeiTable();

    if (spinner) spinner.style.display = "none";
    if (content) content.style.display = "block";
  } catch (err) {
    console.error(err);
    if (typeof notyf !== "undefined") notyf.error("Lỗi khi tải danh sách IMEI!");
    else window.alert("Lỗi khi tải danh sách IMEI!");
    if (imeiModal) imeiModal.hide();
  }
};

// Lọc và render bảng IMEI
const renderImeiTable = () => {
  const searchKeyword = document.querySelector("#imeiSearchInput")?.value.trim().toUpperCase() || "";
  const filterStatus = document.querySelector("#imeiStatusFilter")?.value || "";

  let filtered = currentItems;
  if (searchKeyword) {
    filtered = filtered.filter((item) => (item.identifier || "").includes(searchKeyword));
  }
  if (filterStatus) {
    filtered = filtered.filter((item) => item.status === filterStatus);
  }

  const countBadge = document.querySelector("#imeiCountBadge");
  if (countBadge) countBadge.textContent = `${filtered.length} thiết bị`;

  const tbody = document.querySelector("#imeiTableBody");
  if (!tbody) return;

  // Bỏ chọn tất cả khi render lại
  const checkAll = document.querySelector("#checkAllImei");
  if (checkAll) checkAll.checked = false;
  updateBulkActionBar();

  if (!filtered.length) {
    const colCount = canViewCost ? 9 : 8;
    tbody.innerHTML = `<tr><td colspan="${colCount}" class="text-center text-muted py-4">Không tìm thấy thiết bị nào phù hợp.</td></tr>`;
    return;
  }

  const statusMap = {
    available: '<span class="badge bg-success-subtle text-success">Có sẵn</span>',
    sold: '<span class="badge bg-dark-subtle text-dark">Đã bán</span>',
    warranty: '<span class="badge bg-warning-subtle text-warning">Bảo hành NCC</span>',
    damaged: '<span class="badge bg-danger-subtle text-danger">Hàng lỗi / hỏng</span>',
    returned: '<span class="badge bg-purple-subtle text-purple">Đã trả NCC</span>',
    liquidated: '<span class="badge bg-secondary-subtle text-secondary">Thanh lý</span>'
  };

  tbody.innerHTML = filtered.map((item, index) => {
    const receipt = item.receiptId;
    const supplierName = receipt && receipt.supplierId ? receipt.supplierId.name : "--";
    const receiptCode = receipt ? receipt.receiptCode : "--";
    const receiptDate = item.receivedAt ? new Date(item.receivedAt).toLocaleDateString("vi-VN") : "--";
    const costText = item.purchasePrice != null ? `${Number(item.purchasePrice).toLocaleString("vi-VN")} đ` : "--";

    let costCell = "";
    if (canViewCost) {
      costCell = `<td class="text-end imei-cost-col text-muted font-monospace">${costText}</td>`;
    }

    return `
      <tr>
        <td class="text-center">
          <input class="form-check-input imei-checkbox" type="checkbox" value="${item._id}">
        </td>
        <td class="text-center text-muted">${index + 1}</td>
        <td>
          <span class="font-monospace fw-bold text-primary">${item.identifier || "--"}</span>
        </td>
        <td class="text-center">${statusMap[item.status] || item.status}</td>
        <td>
          <span class="fw-semibold text-dark">${receiptCode}</span><br>
          <small class="text-muted">${receiptDate}</small>
        </td>
        <td><small class="fw-semibold text-secondary">${supplierName}</small></td>
        ${costCell}
        <td>
          <small class="text-muted">${item.note ? item.note : '<span class="text-muted opacity-50">--</span>'}</small>
        </td>
        <td class="text-center text-nowrap">
          <button class="btn btn-sm btn-outline-primary py-0 px-2 btn-change-single-status me-1" 
            type="button" 
            data-id="${item._id}" 
            data-identifier="${item.identifier || ""}" 
            data-status="${item.status}" 
            data-note="${item.note || ""}" 
            title="Đổi trạng thái thiết bị này">
            <i class="las la-exchange-alt"></i>
          </button>
          <a class="btn btn-sm btn-outline-secondary py-0 px-2" 
            href="/admin/inventory/tracker?keyword=${encodeURIComponent(item.identifier || "")}" 
            target="_blank" 
            title="Xem hồ sơ / nhật ký thiết bị">
            <i class="las la-history"></i>
          </a>
        </td>
      </tr>
    `;
  }).join("");

  bindTableEvents();
};

// Bắt sự kiện trên các dòng bảng
const bindTableEvents = () => {
  // Checkbox từng dòng
  document.querySelectorAll(".imei-checkbox").forEach((cb) => {
    cb.addEventListener("change", updateBulkActionBar);
  });

  // Nút đổi trạng thái 1 thiết bị
  document.querySelectorAll(".btn-change-single-status").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelector("#isBulkMode").value = "false";
      document.querySelector("#singleIdentifierGroup").style.display = "block";
      document.querySelector("#bulkCountGroup").style.display = "none";
      document.querySelector("#changeStatusModalTitle").textContent = "Cập nhật trạng thái thiết bị";

      document.querySelector("#statusItemId").value = btn.dataset.id;
      document.querySelector("#statusItemIdentifier").value = btn.dataset.identifier;
      document.querySelector("#statusSelect").value = btn.dataset.status;
      document.querySelector("#statusNote").value = btn.dataset.note || "";
      document.querySelector("#reasonCustom").value = "";
      document.querySelector("#reasonSelect").value = "";

      const msg = document.querySelector("#statusChangeMessage");
      if (msg) msg.textContent = "";

      if (changeStatusModal) changeStatusModal.show();
    });
  });
};

// Checkbox chọn tất cả
document.querySelector("#checkAllImei")?.addEventListener("change", (e) => {
  const isChecked = e.target.checked;
  document.querySelectorAll(".imei-checkbox").forEach((cb) => {
    cb.checked = isChecked;
  });
  updateBulkActionBar();
});

// Cập nhật thanh công cụ thao tác hàng loạt
const updateBulkActionBar = () => {
  const selectedCbs = document.querySelectorAll(".imei-checkbox:checked");
  const bulkBar = document.querySelector("#bulkActionBar");
  const countDisplay = document.querySelector("#selectedImeiCount");

  if (selectedCbs.length > 0) {
    if (bulkBar) bulkBar.style.removeProperty("display");
    if (countDisplay) countDisplay.textContent = selectedCbs.length;
  } else {
    if (bulkBar) bulkBar.style.setProperty("display", "none", "important");
  }
};

// Mở modal đổi trạng thái hàng loạt
document.querySelector("#btnOpenBulkStatusModal")?.addEventListener("click", () => {
  const selectedCbs = document.querySelectorAll(".imei-checkbox:checked");
  if (!selectedCbs.length) return;

  document.querySelector("#isBulkMode").value = "true";
  document.querySelector("#singleIdentifierGroup").style.display = "none";
  document.querySelector("#bulkCountGroup").style.display = "block";
  document.querySelector("#changeStatusModalTitle").textContent = "Đổi trạng thái hàng loạt thiết bị";
  document.querySelector("#bulkSelectedCountDisplay").textContent = selectedCbs.length;

  document.querySelector("#statusSelect").value = "warranty";
  document.querySelector("#statusNote").value = "";
  document.querySelector("#reasonCustom").value = "";
  document.querySelector("#reasonSelect").value = "";

  const msg = document.querySelector("#statusChangeMessage");
  if (msg) msg.textContent = "";

  if (changeStatusModal) changeStatusModal.show();
});

// Lắng nghe tìm kiếm & bộ lọc trong modal
document.querySelector("#imeiSearchInput")?.addEventListener("input", renderImeiTable);
document.querySelector("#imeiStatusFilter")?.addEventListener("change", renderImeiTable);

// Đồng bộ lý do mẫu
document.querySelector("#reasonSelect")?.addEventListener("change", (e) => {
  const customInput = document.querySelector("#reasonCustom");
  if (customInput && e.target.value) {
    customInput.value = e.target.value;
  }
});

// Submit form đổi trạng thái (Đơn lẻ & Hàng loạt)
document.querySelector("#changeStatusForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const isBulk = document.querySelector("#isBulkMode").value === "true";
  const status = document.querySelector("#statusSelect").value;
  const reason = document.querySelector("#reasonCustom").value.trim() || document.querySelector("#reasonSelect").value;
  const note = document.querySelector("#statusNote").value.trim();
  const msg = document.querySelector("#statusChangeMessage");

  try {
    let response;
    if (isBulk) {
      const selectedItemIds = [...document.querySelectorAll(".imei-checkbox:checked")].map((cb) => cb.value);
      response = await fetch("/admin/inventory/items/bulk-change-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ itemIds: selectedItemIds, status, reason, note })
      });
    } else {
      const id = document.querySelector("#statusItemId").value;
      response = await fetch(`/admin/inventory/item/change-status/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ status, reason, note })
      });
    }

    const result = await response.json();

    if (msg) {
      msg.textContent = result.message || "";
      msg.className = `form-message mt-2 mb-0 ${response.ok ? "text-success" : "text-danger"}`;
    }

    if (response.ok) {
      setTimeout(() => {
        if (changeStatusModal) changeStatusModal.hide();
        // Tải lại danh sách thiết bị mà không cần reload trang
        if (currentVariantId) {
          loadVariantItems(currentVariantId);
        }
      }, 600);
    }
  } catch (_err) {
    if (msg) {
      msg.textContent = "Lỗi kết nối khi gửi yêu cầu cập nhật trạng thái!";
      msg.className = "form-message mt-2 mb-0 text-danger";
    }
  }
});

