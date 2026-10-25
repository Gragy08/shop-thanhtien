document.addEventListener("DOMContentLoaded", () => {
  let targetOrderId = null;
  const cancelModalEl = document.querySelector("#modalCancelOrder");
  const cancelModal = cancelModalEl && window.bootstrap ? window.bootstrap.Modal.getOrCreateInstance(cancelModalEl) : null;
  const orderCodeEl = document.querySelector("#cancelOrderCode");
  const reasonInput = document.querySelector("#cancelOrderReason");
  const confirmBtn = document.querySelector("#btnConfirmCancelOrder");

  document.querySelectorAll(".btn-cancel-order").forEach((btn) => {
    btn.addEventListener("click", () => {
      targetOrderId = btn.dataset.id;
      const code = btn.dataset.code || "--";
      if (orderCodeEl) orderCodeEl.textContent = code;
      if (reasonInput) reasonInput.value = "Khách hủy đơn hàng";
      if (cancelModal) cancelModal.show();
    });
  });

  confirmBtn?.addEventListener("click", async () => {
    if (!targetOrderId) return;

    const cancelReason = reasonInput?.value.trim() || "Khách hủy đơn hàng";
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Đang xử lý...';

    try {
      const response = await fetch(`/admin/order/cancel/${targetOrderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ cancelReason })
      });

      const result = await response.json();

      if (!response.ok || result.code !== "success") {
        window.alert(result.message || "Lỗi khi hủy đơn hàng!");
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="las la-ban me-1"></i> Xác nhận hủy &amp; Hoàn kho';
        return;
      }

      window.alert(result.message);
      if (cancelModal) cancelModal.hide();
      window.location.reload();
    } catch (err) {
      console.error(err);
      window.alert("Lỗi kết nối khi gửi yêu cầu hủy đơn!");
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<i class="las la-ban me-1"></i> Xác nhận hủy &amp; Hoàn kho';
    }
  });
});

