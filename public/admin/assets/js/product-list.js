// Xử lý đổi trạng thái nhanh sản phẩm (active / inactive)
document.querySelectorAll(".product-status-switch").forEach((checkbox) => {
  checkbox.addEventListener("change", async (event) => {
    const id = checkbox.dataset.id;
    const isChecked = checkbox.checked;
    const nextStatus = isChecked ? "active" : "inactive";
    const badge = checkbox.closest("td")?.querySelector(".status-badge");

    try {
      const response = await fetch(`/admin/product/change-status/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ status: nextStatus })
      });
      const result = await response.json();

      if (!response.ok) {
        checkbox.checked = !isChecked;
        window.alert(result.message || "Không thể cập nhật trạng thái sản phẩm.");
        return;
      }

      if (badge) {
        if (nextStatus === "active") {
          badge.className = "badge bg-success-subtle text-success status-badge";
          badge.textContent = "Hoạt động";
        } else {
          badge.className = "badge bg-danger-subtle text-danger status-badge";
          badge.textContent = "Tạm dừng";
        }
      }
    } catch (_error) {
      checkbox.checked = !isChecked;
      window.alert("Lỗi kết nối khi cập nhật trạng thái!");
    }
  });
});

// Xóa mềm sản phẩm (chuyển vào Thùng rác)
document.querySelectorAll(".product-soft-delete").forEach((button) => {
  button.addEventListener("click", async () => {
    const id = button.dataset.id;
    if (!window.confirm("Bạn có chắc chắn muốn chuyển sản phẩm này vào Thùng rác (Lưu trữ)?")) return;

    try {
      const response = await fetch(`/admin/product/delete/${id}`, {
        method: "PATCH",
        credentials: "same-origin"
      });
      const result = await response.json();

      if (response.ok) {
        window.location.reload();
        return;
      }
      window.alert(result.message || "Không thể xóa sản phẩm.");
    } catch (_error) {
      window.alert("Lỗi kết nối khi xóa sản phẩm!");
    }
  });
});

// Khôi phục sản phẩm từ thùng rác
document.querySelectorAll(".product-restore").forEach((button) => {
  button.addEventListener("click", async () => {
    const id = button.dataset.id;
    if (!window.confirm("Khôi phục sản phẩm này trở lại danh sách hoạt động?")) return;

    try {
      const response = await fetch(`/admin/product/restore/${id}`, {
        method: "PATCH",
        credentials: "same-origin"
      });
      const result = await response.json();

      if (response.ok) {
        window.location.reload();
        return;
      }
      window.alert(result.message || "Không thể khôi phục sản phẩm.");
    } catch (_error) {
      window.alert("Lỗi kết nối khi khôi phục sản phẩm!");
    }
  });
});

// Xóa cứng vĩnh viễn sản phẩm
document.querySelectorAll(".product-hard-delete").forEach((button) => {
  button.addEventListener("click", async () => {
    const id = button.dataset.id;
    if (!window.confirm("CẢNH BÁO: Bạn có chắc chắn muốn XÓA VĨNH VIỄN sản phẩm này cùng toàn bộ biến thể khỏi hệ thống?\n\nThao tác này KHÔNG thể hoàn tác!")) return;

    try {
      const response = await fetch(`/admin/product/delete/${id}`, {
        method: "DELETE",
        credentials: "same-origin"
      });
      const result = await response.json();

      if (response.ok) {
        window.location.reload();
        return;
      }
      window.alert(result.message || "Không thể xóa vĩnh viễn sản phẩm.");
    } catch (_error) {
      window.alert("Lỗi kết nối khi xóa sản phẩm!");
    }
  });
});

// Modal xem chi tiết sản phẩm và các biến thể
const modalElement = document.querySelector("#productDetailModal");
let productModal = null;
if (modalElement && window.bootstrap) {
  productModal = window.bootstrap.Modal.getOrCreateInstance(modalElement);
}

document.querySelectorAll(".btn-view-product").forEach((button) => {
  button.addEventListener("click", async () => {
    const id = button.dataset.id;
    if (!id) return;

    if (productModal) {
      productModal.show();
    }

    const spinner = document.querySelector("#modalLoadingSpinner");
    const content = document.querySelector("#modalContent");
    if (spinner) spinner.style.display = "block";
    if (content) content.style.display = "none";

    try {
      const response = await fetch(`/admin/product/detail/${id}`, {
        credentials: "same-origin"
      });
      const data = await response.json();

      if (!response.ok || data.code !== "success") {
        window.alert(data.message || "Không thể tải chi tiết sản phẩm.");
        if (productModal) productModal.hide();
        return;
      }

      const { product, variants, canViewPurchasePrice } = data;

      // 1. Tiêu đề và Badges
      const modalTitle = document.querySelector("#productDetailModalLabel");
      if (modalTitle) modalTitle.textContent = product.name;

      const statusMap = {
        active: '<span class="badge bg-success-subtle text-success">Hoạt động</span>',
        draft: '<span class="badge bg-warning-subtle text-warning">Bản nháp</span>',
        inactive: '<span class="badge bg-danger-subtle text-danger">Tạm dừng</span>'
      };
      const statusBadge = document.querySelector("#modalProductStatusBadge");
      if (statusBadge) statusBadge.innerHTML = statusMap[product.status] || "";

      const typeMap = {
        imei: '<span class="badge bg-primary">IMEI - Điện thoại</span>',
        serial: '<span class="badge bg-info text-dark">Serial - Đồng hồ</span>',
        quantity: '<span class="badge bg-secondary">Số lượng</span>'
      };
      const typeBadge = document.querySelector("#modalProductTypeBadge");
      if (typeBadge) typeBadge.innerHTML = typeMap[product.inventoryType] || "";

      // 2. Thông tin chung
      const nameEl = document.querySelector("#modalProductName");
      if (nameEl) nameEl.textContent = product.name;

      const slugEl = document.querySelector("#modalProductSlug");
      if (slugEl) slugEl.textContent = `/${product.slug}`;

      const catEl = document.querySelector("#modalProductCategories");
      if (catEl) {
        catEl.innerHTML = (product.categoryIds && product.categoryIds.length)
          ? product.categoryIds.map((c) => `<span class="badge bg-secondary-subtle text-secondary me-1 mb-1">${c.name || c}</span>`).join("")
          : '<span class="text-muted">--</span>';
      }

      const invTypeEl = document.querySelector("#modalProductInventoryType");
      if (invTypeEl) invTypeEl.innerHTML = typeMap[product.inventoryType] || product.inventoryType;

      const salePriceEl = document.querySelector("#modalProductSalePrice");
      if (salePriceEl) {
        salePriceEl.textContent = product.salePrice != null
          ? Number(product.salePrice).toLocaleString("vi-VN") + " đ"
          : "--";
      }

      // Giá nhập (chỉ hiển thị nếu có quyền)
      const purchaseRow = document.querySelector("#modalPurchasePriceRow");
      const purchasePriceEl = document.querySelector("#modalProductPurchasePrice");
      if (purchaseRow && purchasePriceEl) {
        if (canViewPurchasePrice && product.purchasePrice != null) {
          purchaseRow.style.display = "flex";
          purchasePriceEl.textContent = Number(product.purchasePrice).toLocaleString("vi-VN") + " đ";
        } else {
          purchaseRow.style.display = "none";
        }
      }

      const stockEl = document.querySelector("#modalProductStockQuantity");
      if (stockEl) {
        const avail = product.totalAvailable ?? 0;
        const total = product.totalStock ?? 0;
        stockEl.textContent = `${avail} sản phẩm có sẵn` + (total > avail ? ` (Tổng tồn: ${total})` : "");
      }

      const createdEl = document.querySelector("#modalProductCreatedAt");
      if (createdEl) {
        createdEl.textContent = product.createdAt
          ? new Date(product.createdAt).toLocaleString("vi-VN")
          : "--";
      }

      // Mô tả
      const descRow = document.querySelector("#modalDescriptionRow");
      const descEl = document.querySelector("#modalProductDescription");
      if (descRow && descEl) {
        if (product.description && product.description.trim()) {
          descRow.style.display = "block";
          descEl.textContent = product.description.trim();
        } else {
          descRow.style.display = "none";
        }
      }

      // 3. Danh sách các biến thể
      const variantCountBadge = document.querySelector("#modalVariantCountBadge");
      if (variantCountBadge) variantCountBadge.textContent = `${variants ? variants.length : 0} biến thể`;

      // Ẩn/hiển thị cột giá nhập trong thead
      document.querySelectorAll(".modal-cost-col").forEach((col) => {
        col.style.display = canViewPurchasePrice ? "" : "none";
      });

      const tbody = document.querySelector("#modalVariantTableBody");
      if (tbody) {
        if (!variants || !variants.length) {
          const cols = canViewPurchasePrice ? 7 : 6;
          tbody.innerHTML = `<tr><td colspan="${cols}" class="text-center text-muted py-4">Sản phẩm này chưa có biến thể nào.</td></tr>`;
        } else {
          tbody.innerHTML = variants.map((v, index) => {
            const attrLabels = (v.attributeValues && v.attributeValues.length)
              ? v.attributeValues.map((a) => `<span class="badge bg-light text-dark border me-1">${a.attributeName}: <strong>${a.label}</strong></span>`).join("")
              : '<span class="text-muted">Mặc định</span>';

            const skuLabel = v.sku
              ? `<code class="text-dark fw-bold">${v.sku}</code>`
              : '<span class="text-muted">--</span>';

            const hasSaleOverride = v.salePriceOverride != null && v.salePriceOverride !== "";
            const finalSalePrice = hasSaleOverride ? v.salePriceOverride : product.salePrice;
            const salePriceDisplay = `<strong>${Number(finalSalePrice).toLocaleString("vi-VN")} đ</strong>` +
              (hasSaleOverride ? ' <span class="badge bg-info-subtle text-info ms-1" style="font-size: 10px;">Ghi đè</span>' : '');

            let costCell = "";
            if (canViewPurchasePrice) {
              const hasCostOverride = v.purchasePriceOverride != null && v.purchasePriceOverride !== "";
              const finalCostPrice = hasCostOverride ? v.purchasePriceOverride : product.purchasePrice;
              const costDisplay = finalCostPrice != null ? `${Number(finalCostPrice).toLocaleString("vi-VN")} đ` : "--";
              costCell = `<td class="text-end modal-cost-col text-muted">${costDisplay}${hasCostOverride ? ' <span class="badge bg-warning-subtle text-warning ms-1" style="font-size: 10px;">Ghi đè</span>' : ""}</td>`;
            }

            const availCount = v.stock?.available ?? 0;
            const totalCount = v.stock?.total ?? 0;
            const stockBadgeHtml = availCount > 0
              ? `<span class="badge bg-success-subtle text-success fs-6">${availCount}</span>`
              : '<span class="badge bg-light text-muted">0</span>';
            const stockDetailHtml = totalCount > availCount
              ? `<br><small class="text-muted" style="font-size: 11px;">(Tổng tồn: ${totalCount})</small>`
              : "";

            const statusBadgeHtml = v.status === "active"
              ? '<span class="badge bg-success-subtle text-success">Hoạt động</span>'
              : '<span class="badge bg-danger-subtle text-danger">Tạm dừng</span>';

            return `<tr>
              <td class="text-center text-muted">${index + 1}</td>
              <td>${attrLabels}</td>
              <td>${skuLabel}</td>
              <td class="text-end text-dark">${salePriceDisplay}</td>
              ${costCell}
              <td class="text-center">${stockBadgeHtml}${stockDetailHtml}</td>
              <td class="text-center">${statusBadgeHtml}</td>
            </tr>`;
          }).join("");
        }
      }

      // Link nút sửa trong modal footer
      const editBtn = document.querySelector("#modalEditProductBtn");
      if (editBtn) {
        editBtn.href = `/admin/product/edit/${product._id}`;
      }

      // Ẩn spinner, hiện nội dung modal
      if (spinner) spinner.style.display = "none";
      if (content) content.style.display = "block";
    } catch (err) {
      console.error(err);
      window.alert("Lỗi khi tải thông tin chi tiết sản phẩm!");
      if (productModal) productModal.hide();
    }
  });
});
