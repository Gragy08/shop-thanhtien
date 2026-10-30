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
});

