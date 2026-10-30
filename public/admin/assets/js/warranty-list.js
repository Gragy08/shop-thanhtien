document.addEventListener("DOMContentLoaded", () => {
  const selectAll = document.querySelector("#selectAllTickets");
  const itemCheckboxes = document.querySelectorAll(".ticket-select-item");
  const bulkToolbar = document.querySelector("#bulkActionToolbar");
  const selectedCountBadge = document.querySelector("#selectedCountBadge");
  const bulkStatusSelect = document.querySelector("#bulkTargetStatus");
  const btnApplyBulk = document.querySelector("#btnApplyBulkStatus");
  const btnDeselectAll = document.querySelector("#btnDeselectAll");

  // Hàm tính toán và cập nhật giao diện chọn hàng loạt
  const updateSelectionState = () => {
    const checkedItems = document.querySelectorAll(".ticket-select-item:checked");
    const count = checkedItems.length;

    if (selectedCountBadge) {
      selectedCountBadge.textContent = count;
    }

    if (bulkToolbar) {
      if (count > 0) {
        bulkToolbar.style.display = "block";
      } else {
        bulkToolbar.style.display = "none";
      }
    }

    if (selectAll) {
      if (itemCheckboxes.length > 0 && count === itemCheckboxes.length) {
        selectAll.checked = true;
        selectAll.indeterminate = false;
      } else if (count > 0) {
        selectAll.checked = false;
        selectAll.indeterminate = true;
      } else {
        selectAll.checked = false;
        selectAll.indeterminate = false;
      }
    }
  };

  // Click vào ô "Select All"
  selectAll?.addEventListener("change", (e) => {
    const isChecked = e.target.checked;
    itemCheckboxes.forEach((cb) => {
      cb.checked = isChecked;
    });
    updateSelectionState();
  });

  // Click từng checkbox của từng dòng
  itemCheckboxes.forEach((cb) => {
    cb.addEventListener("change", () => {
      updateSelectionState();
    });
  });

  // Nút bỏ chọn toàn bộ
  btnDeselectAll?.addEventListener("click", () => {
    itemCheckboxes.forEach((cb) => {
      cb.checked = false;
    });
    if (selectAll) {
      selectAll.checked = false;
      selectAll.indeterminate = false;
    }
    updateSelectionState();
  });

  // Áp dụng cập nhật trạng thái hàng loạt
  btnApplyBulk?.addEventListener("click", async () => {
    const checkedItems = document.querySelectorAll(".ticket-select-item:checked");
    const ticketIds = Array.from(checkedItems).map((cb) => cb.value);
    const targetStatus = bulkStatusSelect?.value;

    if (!ticketIds.length) {
      if (typeof notyf !== "undefined") notyf.error("Vui lòng chọn ít nhất một phiếu bảo hành!");
      else window.alert("Vui lòng chọn ít nhất một phiếu bảo hành!");
      return;
    }

    if (!targetStatus) {
      if (typeof notyf !== "undefined") notyf.error("Vui lòng chọn trạng thái mới cần chuyển sang!");
      else window.alert("Vui lòng chọn trạng thái mới cần chuyển sang!");
      bulkStatusSelect?.focus();
      return;
    }

    const statusTexts = {
      received: "Mới tiếp nhận",
      in_progress: "Đang sửa / Gửi hãng",
      completed: "Đã sửa xong (Chờ trả)",
      delivered: "Đã bàn giao trả khách (Hoàn kho)",
      cancelled: "Hủy phiếu"
    };

    const statusName = statusTexts[targetStatus] || targetStatus;
    let confirmMsg = `Bạn có chắc chắn muốn chuyển ${ticketIds.length} phiếu bảo hành đã chọn sang trạng thái "${statusName}"?`;
    if (targetStatus === "delivered") {
      confirmMsg += "\n\nLưu ý: Các thiết bị trong kho tương ứng sẽ tự động chuyển về trạng thái 'Đã bán' (sold).";
    }

    if (!window.confirm(confirmMsg)) {
      return;
    }

    btnApplyBulk.disabled = true;
    btnApplyBulk.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Đang cập nhật...';

    try {
      const res = await fetch("/admin/warranty/bulk-update-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          ticketIds,
          ticketStatus: targetStatus
        })
      });

      const data = await res.json();
      if (!res.ok || data.code !== "success") {
        if (typeof notyf !== "undefined") notyf.error(data.message || "Lỗi khi cập nhật trạng thái hàng loạt!");
        else window.alert(data.message || "Lỗi khi cập nhật trạng thái hàng loạt!");
        btnApplyBulk.disabled = false;
        btnApplyBulk.innerHTML = '<i class="las la-sync-alt me-1"></i> Áp dụng thay đổi';
        return;
      }

      window.drawNotify("success", data.message || "Cập nhật trạng thái thành công!");
      window.location.reload();
    } catch (err) {
      console.error(err);
      if (typeof notyf !== "undefined") notyf.error("Lỗi kết nối khi gửi dữ liệu!");
      else window.alert("Lỗi kết nối khi gửi dữ liệu!");
      btnApplyBulk.disabled = false;
      btnApplyBulk.innerHTML = '<i class="las la-sync-alt me-1"></i> Áp dụng thay đổi';
    }
  });

  // Chuyển trạng thái nhanh từng dòng từ nút hành động (nếu có)
  document.querySelectorAll(".btn-quick-status-row").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const ticketId = btn.dataset.id;
      const ticketCode = btn.dataset.code;
      const currentStatus = btn.dataset.status;

      const newStatus = window.prompt(
        `Cập nhật trạng thái cho phiếu [${ticketCode}]:\nNhập một trong các mã: received, in_progress, completed, delivered, cancelled`,
        currentStatus
      );

      if (!newStatus || newStatus === currentStatus) return;

      try {
        const res = await fetch(`/admin/warranty/update-status/${ticketId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ ticketStatus: newStatus.trim() })
        });
        const data = await res.json();
        if (data.code === "success") {
          window.drawNotify("success", data.message || "Cập nhật thành công!");
          window.location.reload();
        } else {
          if (typeof notyf !== "undefined") notyf.error(data.message || "Lỗi khi cập nhật!");
          else window.alert(data.message || "Lỗi khi cập nhật!");
        }
      } catch (e) {
        console.error(e);
        if (typeof notyf !== "undefined") notyf.error("Lỗi kết nối!");
        else window.alert("Lỗi kết nối!");
      }
    });
  });
});

