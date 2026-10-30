document.addEventListener("DOMContentLoaded", () => {
  const quickInput = document.querySelector("#quickLookupInput");
  const quickBtn = document.querySelector("#btnQuickLookup");
  const resultContainer = document.querySelector("#lookupResultContainer");
  const form = document.querySelector("#warrantyForm");
  const submitBtn = document.querySelector("#btnSubmitWarranty");
  const externalCheck = document.querySelector("#checkExternalDevice");

  // Thiết lập mặc định ngày hẹn trả là 3 ngày sau
  const expectedInput = document.querySelector("#inputExpectedReturnDate");
  if (expectedInput && !expectedInput.value) {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    expectedInput.value = window.formatDateVN ? window.formatDateVN(d) : `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }

  // Tiện ích: Tự động sinh mã định danh sửa chữa tạm thời khi không rõ IMEI
  const generateTempCode = () => {
    const dateStr = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const tempCode = `SC-${dateStr}-${randomSuffix}`;
    const idInput = document.querySelector("#inputIdentifier");
    if (idInput) {
      idInput.value = tempCode;
    }

    // Tự động bật chế độ "Máy ngoài cửa hàng" & "Sửa dịch vụ tính phí"
    if (externalCheck && !externalCheck.checked) {
      externalCheck.checked = true;
    }
    const noWarrantyRadio = document.querySelector("#warrantyStatusFalse");
    if (noWarrantyRadio) {
      noWarrantyRadio.checked = true;
    }

    // Gợi ý ghi chú ngoại quan
    const condInput = document.querySelector("#inputPhysicalCondition");
    if (condInput && (condInput.value === "Máy bình thường, không cấn móp" || !condInput.value)) {
      condInput.value = "Máy mất nguồn / Không rõ IMEI, nhận máy trần";
    }

    const prodNameInput = document.querySelector("#inputProductName");
    prodNameInput?.focus();
  };

  document.querySelector("#btnGenTempCode")?.addEventListener("click", generateTempCode);
  document.querySelector("#btnGenTempCodeInside")?.addEventListener("click", generateTempCode);
  document.querySelector("#btnHintGenCode")?.addEventListener("click", generateTempCode);

  // Tra cứu nhanh
  const executeLookup = async () => {
    const q = quickInput?.value.trim();
    if (!q) {
      if (typeof notyf !== "undefined") notyf.error("Vui lòng nhập mã IMEI hoặc số điện thoại để tra cứu!");
      else window.alert("Vui lòng nhập mã IMEI hoặc số điện thoại để tra cứu!");
      quickInput?.focus();
      return;
    }

    if (!resultContainer) return;
    resultContainer.style.display = "block";
    resultContainer.innerHTML = '<div class="text-center py-3 text-muted"><span class="spinner-border spinner-border-sm me-2"></span> Đang tra cứu thông tin máy và lịch sử mua hàng...</div>';

    try {
      const res = await fetch(`/admin/warranty/api/check-device?query=${encodeURIComponent(q)}`, {
        credentials: "same-origin"
      });
      const data = await res.json();

      if (!res.ok || data.code !== "success" || !data.found) {
        resultContainer.innerHTML = `
          <div class="alert alert-warning mb-0 small d-flex justify-content-between align-items-center">
            <div>
              <i class="las la-exclamation-triangle me-1 fs-5"></i>
              ${data.message || "Không tìm thấy thông tin máy trong hệ thống cửa hàng!"}
            </div>
            <button class="btn btn-sm btn-outline-warning" type="button" id="btnManualFill">
              Tự điền thông tin máy ngoài
            </button>
          </div>
        `;

        document.querySelector("#btnManualFill")?.addEventListener("click", () => {
          if (externalCheck) externalCheck.checked = true;
          document.querySelector("#inputIdentifier").value = q.toUpperCase();
          document.querySelector("#warrantyStatusFalse").checked = true;
          resultContainer.style.display = "none";
          document.querySelector("#inputProductName")?.focus();
        });
        return;
      }

      // Trường hợp 1: Tra cứu trúng đích danh mã IMEI
      if (data.type === "imei") {
        const d = data.device;
        const c = data.customer;
        const w = data.warrantyInfo;
        const isUnder = w?.isUnderWarranty;
        const expiryStr = w?.expiryDate ? new Date(w.expiryDate).toLocaleDateString("vi-VN") : "--";

        resultContainer.innerHTML = `
          <div class="alert alert-success border-success mb-0">
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div>
                <h6 class="fw-bold text-success mb-1">
                  <i class="las la-check-circle me-1"></i>
                  Đã tìm thấy thiết bị: ${d.productName} ${d.variantName ? `(${d.variantName})` : ''}
                </h6>
                <div class="small text-dark">
                  Mã IMEI: <strong class="font-monospace text-primary">${d.identifier}</strong> | 
                  Trạng thái hiện tại: <span class="badge bg-light text-dark border">${d.deviceStatus}</span>
                </div>
                <div class="small text-muted mt-1">
                  ${isUnder
                    ? `<span class="badge bg-success-subtle text-success"><i class="las la-shield-alt me-1"></i> Còn hạn bảo hành đến ${expiryStr}</span>`
                    : `<span class="badge bg-danger-subtle text-danger"><i class="las la-times-circle me-1"></i> Đã hết hạn bảo hành (${expiryStr})</span>`}
                  ${c ? `<span class="ms-2">Khách mua: <strong>${c.fullName}</strong> (${c.phone})</span>` : ''}
                </div>
              </div>
              <button class="btn btn-success btn-sm px-3" type="button" id="btnApplyImeiResult">
                <i class="las la-arrow-down me-1"></i> Áp dụng vào phiếu
              </button>
            </div>
          </div>
        `;

        document.querySelector("#btnApplyImeiResult")?.addEventListener("click", () => {
          document.querySelector("#inputIdentifier").value = d.identifier;
          document.querySelector("#inputProductName").value = d.productName;
          document.querySelector("#inputVariantName").value = d.variantName || "";

          if (data.order) {
            document.querySelector("#inputOrderCode").value = data.order.orderCode || "";
            if (data.order.purchaseDate) {
              document.querySelector("#inputPurchaseDate").value = window.formatDateVN ? window.formatDateVN(data.order.purchaseDate) : new Date(data.order.purchaseDate).toLocaleDateString("vi-VN");
            }
          }

          if (isUnder) {
            document.querySelector("#warrantyStatusTrue").checked = true;
          } else {
            document.querySelector("#warrantyStatusFalse").checked = true;
          }

          if (c) {
            document.querySelector("#inputCustomerPhone").value = c.phone || "";
            document.querySelector("#inputCustomerName").value = c.fullName || "";
            document.querySelector("#inputCustomerAddress").value = c.address || "";
          }

          resultContainer.style.display = "none";
          document.querySelector("#inputIssueDescription")?.focus();
        });
        return;
      }

      // Trường hợp 2: Tra cứu theo Số điện thoại khách hàng
      if (data.type === "phone") {
        const c = data.customer;
        const devices = data.devices || [];

        let devicesHtml = "";
        if (devices.length > 0) {
          devicesHtml = devices.map((dv, idx) => `
            <div class="p-2 border rounded bg-white mb-2 d-flex justify-content-between align-items-center select-customer-device" style="cursor: pointer;" data-device='${JSON.stringify(dv).replaceAll("'", "&#39;")}'>
              <div>
                <strong class="text-primary">${dv.productName}</strong> ${dv.variantName ? `<small class="text-muted">(${dv.variantName})</small>` : ''}
                <div class="small">
                  Mã IMEI: <code class="font-monospace fw-bold">${dv.identifier}</code> | Đơn mua: ${dv.orderCode} (${dv.purchaseDate ? new Date(dv.purchaseDate).toLocaleDateString("vi-VN") : "--"})
                </div>
              </div>
              <button class="btn btn-outline-primary btn-sm py-0" type="button">Chọn máy này</button>
            </div>
          `).join("");
        } else {
          devicesHtml = '<div class="small text-muted fst-italic">Khách hàng chưa có lịch sử mua máy định danh IMEI tại cửa hàng.</div>';
        }

        resultContainer.innerHTML = `
          <div class="alert alert-info border-info mb-0">
            <h6 class="fw-bold text-dark mb-1">
              <i class="las la-user-check me-1 text-primary"></i>
              Khách hàng: <strong>${c.fullName}</strong> (${c.phone})
            </h6>
            <div class="small text-muted mb-2">Địa chỉ: ${c.address || "Chưa có"}</div>
            <div class="small fw-bold text-dark mb-1">Danh sách thiết bị khách đã mua tại cửa hàng (bấm để chọn):</div>
            ${devicesHtml}
          </div>
        `;

        // Điền trước thông tin khách hàng vào form
        document.querySelector("#inputCustomerPhone").value = c.phone || "";
        document.querySelector("#inputCustomerName").value = c.fullName || "";
        document.querySelector("#inputCustomerAddress").value = c.address || "";

        // Sự kiện chọn thiết bị trong danh sách
        resultContainer.querySelectorAll(".select-customer-device").forEach((el) => {
          el.addEventListener("click", () => {
            const dv = JSON.parse(el.dataset.device.replaceAll("&#39;", "'"));
            document.querySelector("#inputIdentifier").value = dv.identifier;
            document.querySelector("#inputProductName").value = dv.productName;
            document.querySelector("#inputVariantName").value = dv.variantName || "";
            document.querySelector("#inputOrderCode").value = dv.orderCode || "";
            if (dv.purchaseDate) {
              document.querySelector("#inputPurchaseDate").value = window.formatDateVN ? window.formatDateVN(dv.purchaseDate) : new Date(dv.purchaseDate).toLocaleDateString("vi-VN");
            }
            resultContainer.style.display = "none";
            document.querySelector("#inputIssueDescription")?.focus();
          });
        });
      }
    } catch (err) {
      console.error(err);
      resultContainer.innerHTML = '<div class="alert alert-danger mb-0 small">Lỗi kết nối khi tra cứu thiết bị!</div>';
    }
  };

  quickBtn?.addEventListener("click", executeLookup);
  quickInput?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      executeLookup();
    }
  });

  // Tích chọn "Máy ngoài cửa hàng"
  externalCheck?.addEventListener("change", (e) => {
    if (e.target.checked) {
      document.querySelector("#warrantyStatusFalse").checked = true;
      document.querySelector("#inputOrderCode").value = "";
      document.querySelector("#inputPurchaseDate").value = "";
      document.querySelector("#inputIdentifier").focus();
    } else {
      document.querySelector("#warrantyStatusTrue").checked = true;
    }
  });

  // Gửi Form tạo phiếu tiếp nhận bảo hành
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const identifier = document.querySelector("#inputIdentifier").value.trim().toUpperCase();
    const productName = document.querySelector("#inputProductName").value.trim();
    const variantName = document.querySelector("#inputVariantName").value.trim();
    const isUnderWarranty = document.querySelector("input[name=isUnderWarranty]:checked")?.value === "true";
    const phone = document.querySelector("#inputCustomerPhone").value.trim();
    const fullName = document.querySelector("#inputCustomerName").value.trim();
    const address = document.querySelector("#inputCustomerAddress").value.trim();
    const issueDescription = document.querySelector("#inputIssueDescription").value.trim();
    const physicalCondition = document.querySelector("#inputPhysicalCondition").value.trim();
    const accessoriesAttached = document.querySelector("#inputAccessories").value.trim();
    const passcode = document.querySelector("#inputPasscode").value.trim();
    const expectedReturnDate = document.querySelector("#inputExpectedReturnDate").value;
    const repairCost = window.parseVND ? window.parseVND(document.querySelector("#inputRepairCost").value) : (parseFloat(document.querySelector("#inputRepairCost").value) || 0);
    const technicianNotes = document.querySelector("#inputTechnicianNotes").value.trim();

    if (!identifier) {
      if (typeof notyf !== "undefined") notyf.error("Vui lòng nhập hoặc quét mã IMEI thiết bị!");
      else window.alert("Vui lòng nhập hoặc quét mã IMEI thiết bị!");
      document.querySelector("#inputIdentifier").focus();
      return;
    }

    if (!issueDescription) {
      if (typeof notyf !== "undefined") notyf.error("Vui lòng nhập mô tả lỗi của máy khi tiếp nhận!");
      else window.alert("Vui lòng nhập mô tả lỗi của máy khi tiếp nhận!");
      document.querySelector("#inputIssueDescription").focus();
      return;
    }

    if (!phone || !fullName) {
      if (typeof notyf !== "undefined") notyf.error("Vui lòng điền số điện thoại và họ tên khách hàng!");
      else window.alert("Vui lòng điền số điện thoại và họ tên khách hàng!");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Đang tạo phiếu tiếp nhận...';

    try {
      const res = await fetch("/admin/warranty/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          identifier,
          productName,
          variantName,
          isUnderWarranty,
          phone,
          fullName,
          address,
          issueDescription,
          physicalCondition,
          accessoriesAttached,
          passcode,
          expectedReturnDate,
          repairCost,
          technicianNotes
        })
      });

      const data = await res.json();

      if (!res.ok || data.code !== "success") {
        if (typeof notyf !== "undefined") notyf.error(data.message || "Lỗi khi lập phiếu bảo hành!");
        else window.alert(data.message || "Lỗi khi lập phiếu bảo hành!");
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="las la-check-circle fs-4 me-1"></i> LẬP PHIẾU TIẾP NHẬN &amp; IN PHIẾU HẸN';
        return;
      }

      window.drawNotify("success", data.message || "Lập phiếu tiếp nhận bảo hành thành công!");
      // Tự động chuyển hướng sang trang chi tiết & in phiếu hẹn
      window.location.href = `/admin/warranty/${data.ticketId}`;
    } catch (err) {
      console.error(err);
      if (typeof notyf !== "undefined") notyf.error("Lỗi kết nối khi gửi dữ liệu!");
      else window.alert("Lỗi kết nối khi gửi dữ liệu!");
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="las la-check-circle fs-4 me-1"></i> LẬP PHIẾU TIẾP NHẬN &amp; IN PHIẾU HẸN';
    }
  });
});
