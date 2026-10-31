document.addEventListener("DOMContentLoaded", () => {
  const ticketId = window.WARRANTY_TICKET_ID;
  const btnPrintK80 = document.querySelector("#btnPrintK80");
  const btnPrintA5 = document.querySelector("#btnPrintA5");
  const btnPrintHandoverA5 = document.querySelector("#btnPrintHandoverA5");
  const btnPrintHandoverK80 = document.querySelector("#btnPrintHandoverK80");

  // In mẫu phiếu tiếp nhận A5
  btnPrintA5?.addEventListener("click", () => {
    document.body.className = "print-a5";
    window.print();
  });

  // In mẫu bill tiếp nhận K80
  btnPrintK80?.addEventListener("click", () => {
    document.body.className = "print-k80";
    window.print();
  });

  // In biên bản bàn giao trả máy A5
  btnPrintHandoverA5?.addEventListener("click", () => {
    document.body.className = "print-handover-a5";
    window.print();
  });

  // In biên bản bàn giao trả máy K80
  btnPrintHandoverK80?.addEventListener("click", () => {
    document.body.className = "print-handover-k80";
    window.print();
  });

  // 1. Xử lý chuyển trạng thái nhanh thông thường
  document.querySelectorAll(".btn-change-status").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const nextStatus = btn.dataset.status;
      let confirmMsg = "";
      let cancelReason = "";

      if (nextStatus === "in_progress") {
        confirmMsg = "Chuyển phiếu sang trạng thái 'Đang xử lý / Sửa chữa'?";
      } else if (nextStatus === "completed") {
        confirmMsg = "Xác nhận đã xử lý / sửa chữa xong thiết bị này?";
      } else if (nextStatus === "cancelled") {
        cancelReason = window.prompt("Nhập lý do hủy phiếu bảo hành:", "Khách không đồng ý sửa chữa");
        if (cancelReason === null) return;
        confirmMsg = "Bạn có chắc chắn muốn hủy phiếu bảo hành này?";
      }

      if (confirmMsg && !window.confirm(confirmMsg)) return;

      try {
        const res = await fetch(`/admin/warranty/update-status/${ticketId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            ticketStatus: nextStatus,
            cancelReason
          })
        });

        const data = await res.json();
        if (data.code === "success") {
          window.drawNotify("success", data.message || "Cập nhật thành công!");
          window.location.reload();
        } else {
          if (typeof notyf !== "undefined") notyf.error(data.message || "Lỗi khi cập nhật trạng thái!");
          else window.alert(data.message || "Lỗi khi cập nhật trạng thái!");
        }
      } catch (e) {
        console.error(e);
        if (typeof notyf !== "undefined") notyf.error("Lỗi kết nối khi cập nhật!");
        else window.alert("Lỗi kết nối khi cập nhật!");
      }
    });
  });

  // 2. Xử lý Modal Bàn giao trả máy (Form #formDeliverTicket)
  const formDeliver = document.querySelector("#formDeliverTicket");
  const btnSubmitDeliver = document.querySelector("#btnSubmitDeliver");

  formDeliver?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const resolution = document.querySelector("#deliverResolution")?.value;
    const replacedParts = document.querySelector("#deliverReplacedParts")?.value.trim();
    const partsWarrantyMonths = parseInt(document.querySelector("#deliverPartsWarrantyMonths")?.value) || 0;
    const repairCost = parseFloat(document.querySelector("#deliverRepairCost")?.value) || 0;
    const paymentMethod = document.querySelector("#deliverPaymentMethod")?.value;
    const handoverNotes = document.querySelector("#deliverHandoverNotes")?.value.trim();

    if (!window.confirm("Xác nhận bàn giao trả máy cho khách hàng? Thiết bị trong kho sẽ tự động chuyển về trạng thái 'Đã bán'.")) {
      return;
    }

    if (btnSubmitDeliver) {
      btnSubmitDeliver.disabled = true;
      btnSubmitDeliver.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Đang xử lý...';
    }

    try {
      const res = await fetch(`/admin/warranty/deliver/${ticketId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          resolution,
          replacedParts,
          partsWarrantyMonths,
          repairCost,
          paymentMethod,
          handoverNotes
        })
      });

      const data = await res.json();
      if (!res.ok || data.code !== "success") {
        if (typeof notyf !== "undefined") notyf.error(data.message || "Lỗi khi bàn giao trả máy!");
        else window.alert(data.message || "Lỗi khi bàn giao trả máy!");
        if (btnSubmitDeliver) {
          btnSubmitDeliver.disabled = false;
          btnSubmitDeliver.innerHTML = '<i class="las la-check-circle me-1"></i> Bàn giao trả máy';
        }
        return;
      }

      window.drawNotify("success", data.message || "Bàn giao trả máy thành công!");
      window.location.reload();
    } catch (err) {
      console.error(err);
      if (typeof notyf !== "undefined") notyf.error("Lỗi kết nối khi gửi dữ liệu!");
      else window.alert("Lỗi kết nối khi gửi dữ liệu!");
      if (btnSubmitDeliver) {
        btnSubmitDeliver.disabled = false;
        btnSubmitDeliver.innerHTML = '<i class="las la-check-circle me-1"></i> Bàn giao trả máy';
      }
    }
  });

  // 3. Xử lý Modal Đổi máy mới 1-đổi-1 (Form #formExchange1to1)
  const formExchange = document.querySelector("#formExchange1to1");
  const btnSubmitExchange = document.querySelector("#btnSubmitExchange");
  const inputSearchNewImei = document.querySelector("#inputSearchNewImei");
  const btnSearchNewImei = document.querySelector("#btnSearchNewImei");
  const availableImeiList = document.querySelector("#availableImeiList");
  const inputSelectedReplacementImei = document.querySelector("#inputSelectedReplacementImei");

  // Tra cứu các IMEI đang có sẵn trong kho
  const loadAvailableImeis = async (keyword = "") => {
    if (!availableImeiList) return;
    availableImeiList.innerHTML = '<div class="text-center py-2 text-muted small"><span class="spinner-border spinner-border-sm me-1"></span> Đang tải danh sách IMEI có sẵn trong kho...</div>';

    try {
      const res = await fetch(`/admin/warranty/api/search-available-imei?keyword=${encodeURIComponent(keyword)}`, {
        credentials: "same-origin"
      });
      const data = await res.json();

      if (!res.ok || data.code !== "success" || !data.items || !data.items.length) {
        availableImeiList.innerHTML = '<div class="alert alert-warning py-2 px-3 small mb-0">Không tìm thấy thiết bị nào có trạng thái "Sẵn có" (available) trong kho khớp với từ khóa!</div>';
        return;
      }

      availableImeiList.innerHTML = data.items.map((it) => `
        <div class="p-2 border rounded bg-white mb-2 d-flex justify-content-between align-items-center select-imei-item" style="cursor: pointer;" data-imei="${it.identifier}" data-name="${it.productName} (${it.variantName})">
          <div>
            <strong class="font-monospace text-primary fs-6">${it.identifier}</strong>
            <div class="small text-dark">${it.productName} ${it.variantName ? `<span class="text-muted">(${it.variantName})</span>` : ''}</div>
          </div>
          <button type="button" class="btn btn-outline-success btn-sm py-0">Chọn máy này</button>
        </div>
      `).join("");

      availableImeiList.querySelectorAll(".select-imei-item").forEach((el) => {
        el.addEventListener("click", () => {
          const chosenImei = el.dataset.imei;
          if (inputSelectedReplacementImei) {
            inputSelectedReplacementImei.value = chosenImei;
          }
          if (inputSearchNewImei) {
            inputSearchNewImei.value = chosenImei;
          }
          availableImeiList.innerHTML = `
            <div class="alert alert-success py-2 px-3 small mb-0 d-flex justify-content-between align-items-center">
              <div><i class="las la-check-circle me-1 fs-5"></i> Đã chọn IMEI mới xuất đổi: <strong class="font-monospace">${chosenImei}</strong></div>
              <button class="btn btn-sm btn-outline-secondary py-0" type="button" id="btnReselectImei">Chọn lại</button>
            </div>
          `;
          document.querySelector("#btnReselectImei")?.addEventListener("click", () => loadAvailableImeis());
        });
      });
    } catch (e) {
      console.error(e);
      availableImeiList.innerHTML = '<div class="alert alert-danger py-2 small mb-0">Lỗi khi tải danh sách IMEI!</div>';
    }
  };

  btnSearchNewImei?.addEventListener("click", () => {
    loadAvailableImeis(inputSearchNewImei?.value.trim());
  });

  inputSearchNewImei?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      loadAvailableImeis(inputSearchNewImei?.value.trim());
    }
  });

  // Khi mở modal đổi máy 1-đổi-1 thì tự load danh sách gợi ý
  document.querySelector("#modalExchange1to1")?.addEventListener("show.bs.modal", () => {
    loadAvailableImeis();
  });

  // Submit đổi máy 1-đổi-1
  formExchange?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const replacementImei = inputSelectedReplacementImei?.value.trim().toUpperCase() || inputSearchNewImei?.value.trim().toUpperCase();
    const exchangeReason = document.querySelector("#exchangeReason")?.value.trim();
    const priceDifference = parseFloat(document.querySelector("#exchangePriceDifference")?.value) || 0;
    const handoverNotes = document.querySelector("#exchangeHandoverNotes")?.value.trim();

    if (!replacementImei) {
      if (typeof notyf !== "undefined") notyf.error("Vui lòng chọn hoặc quét mã IMEI mới từ kho để đổi cho khách!");
      else window.alert("Vui lòng chọn hoặc quét mã IMEI mới từ kho để đổi cho khách!");
      inputSearchNewImei?.focus();
      return;
    }

    if (!window.confirm(`XÁC NHẬN ĐỔI MỚI 1-ĐỔI-1:\n- Xuất máy mới: IMEI ${replacementImei} (chuyển sang 'sold')\n- Thu hồi máy lỗi: IMEI hiện tại (chuyển sang 'damaged')\nBạn có chắc chắn muốn tiến hành?`)) {
      return;
    }

    if (btnSubmitExchange) {
      btnSubmitExchange.disabled = true;
      btnSubmitExchange.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Đang thực hiện đổi máy...';
    }

    try {
      const res = await fetch(`/admin/warranty/exchange-1to1/${ticketId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          replacementImei,
          exchangeReason,
          priceDifference,
          handoverNotes
        })
      });

      const data = await res.json();
      if (!res.ok || data.code !== "success") {
        if (typeof notyf !== "undefined") notyf.error(data.message || "Lỗi khi đổi máy 1-đổi-1!");
        else window.alert(data.message || "Lỗi khi đổi máy 1-đổi-1!");
        if (btnSubmitExchange) {
          btnSubmitExchange.disabled = false;
          btnSubmitExchange.innerHTML = '<i class="las la-sync-alt me-1"></i> Xác nhận Đổi 1-Đổi-1';
        }
        return;
      }

      window.drawNotify("success", data.message || "Đổi mới 1-đổi-1 thành công!");
      window.location.reload();
    } catch (err) {
      console.error(err);
      if (typeof notyf !== "undefined") notyf.error("Lỗi kết nối khi gửi yêu cầu đổi máy!");
      else window.alert("Lỗi kết nối khi gửi yêu cầu đổi máy!");
      if (btnSubmitExchange) {
        btnSubmitExchange.disabled = false;
        btnSubmitExchange.innerHTML = '<i class="las la-sync-alt me-1"></i> Xác nhận Đổi 1-Đổi-1';
      }
    }
  });

  // ========================================================
  // 3. XỬ LÝ CHỈNH SỬA PHIẾU BẢO HÀNH (MODAL #modalEditTicket)
  // ========================================================
  const formEditTicket = document.querySelector("#formEditTicket");
  const btnSubmitEditTicket = document.querySelector("#btnSubmitEditTicket");

  const editSearchPartInput = document.querySelector("#editSearchPartInput");
  const editPartSearchResults = document.querySelector("#editPartSearchResults");
  const editPartsTableBody = document.querySelector("#editPartsTableBody");
  const editPartsTableFoot = document.querySelector("#editPartsTableFoot");
  const editPartsTotalAmountText = document.querySelector("#editPartsTotalAmountText");
  const editHiddenPartsJson = document.querySelector("#editHiddenPartsJson");
  const editRepairCostInput = document.querySelector("#editRepairCost");

  let editPartsList = Array.isArray(window.INITIAL_WARRANTY_PARTS) ? [...window.INITIAL_WARRANTY_PARTS] : [];
  let editPartSearchTimer = null;

  editSearchPartInput?.addEventListener("input", (e) => {
    const keyword = e.target.value.trim();
    clearTimeout(editPartSearchTimer);

    if (!keyword) {
      if (editPartSearchResults) editPartSearchResults.style.display = "none";
      return;
    }

    editPartSearchTimer = setTimeout(async () => {
      try {
        const res = await fetch(`/admin/warranty/api/search-parts?q=${encodeURIComponent(keyword)}`, {
          credentials: "same-origin"
        });
        const data = await res.json();
        renderEditPartResults(keyword, data.results || []);
      } catch (err) {
        console.error("Lỗi tìm kiếm linh kiện:", err);
      }
    }, 220);
  });

  const renderEditPartResults = (keyword, items) => {
    if (!editPartSearchResults) return;

    let html = "";

    // 1. Dòng chọn linh kiện ngoài
    html += `
      <div class="dropdown-item p-2 border-bottom edit-part-search-item bg-light-subtle" data-type="external" data-name="${keyword.replaceAll('"', '&quot;')}">
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <strong class="text-primary">[Linh kiện ngoài]</strong>
            <span class="ms-1">${keyword}</span>
          </div>
          <span class="badge bg-secondary">Nhập tự do</span>
        </div>
      </div>
    `;

    // 2. Danh sách linh kiện kho
    if (items && items.length) {
      for (const item of items) {
        const isOutOfStock = item.availableStock <= 0;
        const priceStr = Number(item.unitPrice || 0).toLocaleString("vi-VN") + " đ";
        const stockHtml = isOutOfStock
          ? '<span class="badge bg-danger-subtle text-danger border border-danger-subtle">Hết hàng - Không thể chọn</span>'
          : `<small class="text-success fw-medium">Còn ${item.availableStock} sẵn</small>`;
        const itemJson = JSON.stringify(item).replaceAll("'", "&#39;");

        html += `
          <div class="dropdown-item p-2 border-bottom edit-part-search-item ${isOutOfStock ? "bg-light text-muted" : ""}"
            data-type="inventory"
            data-out-of-stock="${isOutOfStock ? "true" : "false"}"
            data-item='${itemJson}'
            style="cursor: ${isOutOfStock ? "not-allowed" : "pointer"}; opacity: ${isOutOfStock ? "0.6" : "1"};">
            <div class="d-flex justify-content-between align-items-center">
              <div>
                <strong class="${isOutOfStock ? "text-muted" : "text-dark"}">${item.productName}</strong>
                <span class="text-muted ms-1">(${item.variantName})</span>
                <div class="small text-muted">Mã SKU: ${item.variantSku || "--"}</div>
              </div>
              <div class="text-end">
                <span class="fw-bold ${isOutOfStock ? "text-muted" : "text-dark"} d-block">${priceStr}</span>
                ${stockHtml}
              </div>
            </div>
          </div>
        `;
      }
    }

    editPartSearchResults.innerHTML = html;
    editPartSearchResults.style.display = "block";

    editPartSearchResults.querySelectorAll(".edit-part-search-item").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (el.dataset.outOfStock === "true") {
          e.preventDefault();
          e.stopPropagation();
          const msg = "Linh kiện kho này đã hết hàng! Nếu cửa hàng mua ngoài để thay cho khách, vui lòng chọn dòng [Linh kiện ngoài] ở đầu danh sách.";
          if (typeof notyf !== "undefined") notyf.error(msg);
          else window.alert(msg);
          return;
        }

        const type = el.dataset.type;
        if (type === "external") {
          const name = el.dataset.name;
          addEditPartToList({
            partType: "external",
            partName: name,
            variantId: null,
            productId: null,
            sku: "",
            price: 0,
            quantity: 1,
            isDeducted: false
          });
        } else {
          const item = JSON.parse(el.dataset.item.replaceAll("&#39;", "'"));
          addEditPartToList({
            partType: "inventory",
            partName: `${item.productName} (${item.variantName})`,
            variantId: item.variantId,
            productId: item.productId,
            sku: item.variantSku || "",
            price: item.unitPrice || 0,
            quantity: 1,
            maxStock: item.availableStock || 1,
            isDeducted: false
          });
        }
        editPartSearchResults.style.display = "none";
        if (editSearchPartInput) editSearchPartInput.value = "";
      });
    });
  };

  const addEditPartToList = (part) => {
    const existing = editPartsList.find((p) => {
      if (part.variantId && p.variantId) {
        return String(p.variantId) === String(part.variantId);
      }
      return p.partName.toLowerCase() === part.partName.toLowerCase();
    });

    if (existing) {
      const limit = part.maxStock || existing.maxStock;
      if (existing.partType === "inventory" && limit && existing.quantity >= limit) {
        const msg = `Linh kiện "${existing.partName}" trong kho chỉ còn tối đa ${limit} sẵn!`;
        if (typeof notyf !== "undefined") notyf.error(msg);
        else window.alert(msg);
        return;
      }
      if (limit) existing.maxStock = limit;
      existing.quantity += 1;
    } else {
      editPartsList.push(part);
    }

    renderEditPartsTable();
  };

  const renderEditPartsTable = () => {
    if (!editPartsTableBody) return;

    if (!editPartsList.length) {
      editPartsTableBody.innerHTML = `
        <tr id="editEmptyPartsRow">
          <td class="text-center py-3 text-muted small" colspan="6">
            Chưa thêm linh kiện nào.
          </td>
        </tr>
      `;
      if (editPartsTableFoot) editPartsTableFoot.style.display = "none";
      if (editHiddenPartsJson) editHiddenPartsJson.value = "[]";
      return;
    }

    let total = 0;
    editPartsTableBody.innerHTML = editPartsList.map((item, idx) => {
      const lineTotal = (item.price || 0) * (item.quantity || 1);
      total += lineTotal;

      const typeBadge = item.partType === "inventory"
        ? '<span class="badge bg-primary-subtle text-primary border border-primary">Kho</span>'
        : '<span class="badge bg-secondary-subtle text-secondary border">Ngoài</span>';

      const priceCell = item.partType === "external"
        ? `<div class="d-flex justify-content-end align-items-center">
            <input class="form-control form-control-sm text-end edit-part-price-input" 
              type="number" min="0" step="1000" value="${item.price || ''}" 
              placeholder="0" data-index="${idx}" style="width: 105px;">
            <span class="small text-muted ms-1">đ</span>
          </div>`
        : `<span class="fw-medium text-dark">${item.price > 0 ? Number(item.price).toLocaleString("vi-VN") + " đ" : "--"}</span>`;

      return `
        <tr>
          <td>
            <strong class="text-dark">${item.partName}</strong>
            ${item.sku ? `<code class="small d-block text-muted">${item.sku}</code>` : ""}
          </td>
          <td class="text-center">${typeBadge}</td>
          <td class="text-center">
            <input class="form-control form-control-sm text-center edit-part-qty-input"
              type="number" min="1" max="${item.partType === "inventory" && item.maxStock ? item.maxStock : 99}" value="${item.quantity || 1}" data-index="${idx}" style="width: 65px; margin: 0 auto;">
          </td>
          <td class="text-end">
            ${priceCell}
          </td>
          <td class="text-end fw-semibold text-dark">
            <span class="edit-part-line-total-text" data-index="${idx}">${lineTotal > 0 ? Number(lineTotal).toLocaleString("vi-VN") + " đ" : "0 đ"}</span>
          </td>
          <td class="text-center">
            <button class="btn btn-sm btn-outline-danger py-0 px-2 btn-remove-edit-part" type="button" data-index="${idx}">
              Xóa
            </button>
          </td>
        </tr>
      `;
    }).join("");

    if (editPartsTableFoot) editPartsTableFoot.style.display = "";
    if (editPartsTotalAmountText) {
      editPartsTotalAmountText.textContent = total > 0 ? Number(total).toLocaleString("vi-VN") + " đ" : "0 đ";
    }

    if (editHiddenPartsJson) {
      editHiddenPartsJson.value = JSON.stringify(editPartsList);
    }

    editPartsTableBody.querySelectorAll(".edit-part-price-input").forEach((input) => {
      input.addEventListener("input", (e) => {
        const idx = parseInt(input.dataset.index, 10);
        const val = Math.max(0, parseFloat(e.target.value) || 0);
        if (editPartsList[idx]) {
          editPartsList[idx].price = val;
          const currentLineTotal = val * (editPartsList[idx].quantity || 1);
          const lineTotalEl = editPartsTableBody.querySelector(`.edit-part-line-total-text[data-index="${idx}"]`);
          if (lineTotalEl) {
            lineTotalEl.textContent = currentLineTotal > 0 ? Number(currentLineTotal).toLocaleString("vi-VN") + " đ" : "0 đ";
          }
          let newTotal = 0;
          for (const p of editPartsList) {
            newTotal += (p.price || 0) * (p.quantity || 1);
          }
          if (editPartsTotalAmountText) {
            editPartsTotalAmountText.textContent = newTotal > 0 ? Number(newTotal).toLocaleString("vi-VN") + " đ" : "0 đ";
          }
          if (editHiddenPartsJson) {
            editHiddenPartsJson.value = JSON.stringify(editPartsList);
          }
        }
      });
    });

    editPartsTableBody.querySelectorAll(".edit-part-qty-input").forEach((input) => {
      input.addEventListener("input", (e) => {
        const idx = parseInt(input.dataset.index, 10);
        let val = Math.max(1, parseInt(e.target.value, 10) || 1);
        if (editPartsList[idx]) {
          if (editPartsList[idx].partType === "inventory" && editPartsList[idx].maxStock && val > editPartsList[idx].maxStock) {
            val = editPartsList[idx].maxStock;
            e.target.value = val;
            const msg = `Linh kiện "${editPartsList[idx].partName}" chỉ còn ${editPartsList[idx].maxStock} sẵn trong kho!`;
            if (typeof notyf !== "undefined") notyf.error(msg);
          }
          editPartsList[idx].quantity = val;
          const currentLineTotal = (editPartsList[idx].price || 0) * val;
          const lineTotalEl = editPartsTableBody.querySelector(`.edit-part-line-total-text[data-index="${idx}"]`);
          if (lineTotalEl) {
            lineTotalEl.textContent = currentLineTotal > 0 ? Number(currentLineTotal).toLocaleString("vi-VN") + " đ" : "0 đ";
          }
          let newTotal = 0;
          for (const p of editPartsList) {
            newTotal += (p.price || 0) * (p.quantity || 1);
          }
          if (editPartsTotalAmountText) {
            editPartsTotalAmountText.textContent = newTotal > 0 ? Number(newTotal).toLocaleString("vi-VN") + " đ" : "0 đ";
          }
          if (editHiddenPartsJson) {
            editHiddenPartsJson.value = JSON.stringify(editPartsList);
          }
        }
      });
      input.addEventListener("change", (e) => {
        const idx = parseInt(input.dataset.index, 10);
        let val = Math.max(1, parseInt(e.target.value, 10) || 1);
        if (editPartsList[idx]) {
          if (editPartsList[idx].partType === "inventory" && editPartsList[idx].maxStock && val > editPartsList[idx].maxStock) {
            val = editPartsList[idx].maxStock;
          }
          editPartsList[idx].quantity = val;
          renderEditPartsTable();
        }
      });
    });

    editPartsTableBody.querySelectorAll(".btn-remove-edit-part").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.index, 10);
        editPartsList.splice(idx, 1);
        renderEditPartsTable();
      });
    });
  };

  if (editPartsTableBody) {
    renderEditPartsTable();
  }

  document.addEventListener("click", (e) => {
    if (editPartSearchResults && !editPartSearchResults.contains(e.target) && e.target !== editSearchPartInput) {
      editPartSearchResults.style.display = "none";
    }
  });

  // Submit chỉnh sửa phiếu
  formEditTicket?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const repairCost = window.parseVND ? window.parseVND(document.querySelector("#editRepairCost")?.value) : (parseFloat(document.querySelector("#editRepairCost")?.value) || 0);
    const expectedReturnDate = document.querySelector("#editExpectedReturnDate")?.value;
    const technicianNotes = document.querySelector("#editTechnicianNotes")?.value.trim();
    const issueDescription = document.querySelector("#editIssueDescription")?.value.trim();
    const physicalCondition = document.querySelector("#editPhysicalCondition")?.value.trim();
    const accessoriesAttached = document.querySelector("#editAccessories")?.value.trim();
    const passcode = document.querySelector("#editPasscode")?.value.trim();

    if (!issueDescription) {
      if (typeof notyf !== "undefined") notyf.error("Mô tả hiện tượng lỗi không được để trống!");
      else window.alert("Mô tả hiện tượng lỗi không được để trống!");
      return;
    }

    if (btnSubmitEditTicket) {
      btnSubmitEditTicket.disabled = true;
      btnSubmitEditTicket.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Đang lưu...';
    }

    try {
      const res = await fetch(`/admin/warranty/edit/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          repairCost,
          expectedReturnDate,
          technicianNotes,
          issueDescription,
          physicalCondition,
          accessoriesAttached,
          passcode,
          requiredParts: editPartsList
        })
      });

      const data = await res.json();
      if (!res.ok || data.code !== "success") {
        if (typeof notyf !== "undefined") notyf.error(data.message || "Lỗi khi cập nhật phiếu!");
        else window.alert(data.message || "Lỗi khi cập nhật phiếu!");
        if (btnSubmitEditTicket) {
          btnSubmitEditTicket.disabled = false;
          btnSubmitEditTicket.innerHTML = "Lưu thay đổi";
        }
        return;
      }

      window.drawNotify("success", data.message || "Cập nhật phiếu thành công!");
      window.location.reload();
    } catch (err) {
      console.error(err);
      if (typeof notyf !== "undefined") notyf.error("Lỗi kết nối khi gửi dữ liệu!");
      else window.alert("Lỗi kết nối khi gửi dữ liệu!");
      if (btnSubmitEditTicket) {
        btnSubmitEditTicket.disabled = false;
        btnSubmitEditTicket.innerHTML = "Lưu thay đổi";
      }
    }
  });
});

