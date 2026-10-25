const changeStatusModalEl = document.querySelector("#changeStatusModal");
const changeStatusModal = changeStatusModalEl && window.bootstrap ? window.bootstrap.Modal.getOrCreateInstance(changeStatusModalEl) : null;
const changeStatusForm = document.querySelector("#changeStatusForm");

// Đồng bộ lý do mẫu
document.querySelector("#reasonSelect")?.addEventListener("change", (e) => {
  const customInput = document.querySelector("#reasonCustom");
  if (customInput && e.target.value) {
    customInput.value = e.target.value;
  }
});

// Mở modal đổi trạng thái thiết bị
document.querySelectorAll(".btn-quick-change-status").forEach((btn) => {
  btn.addEventListener("click", () => {
    const id = btn.dataset.id;
    const identifier = btn.dataset.identifier;
    const status = btn.dataset.status;
    const note = btn.dataset.note;

    document.querySelector("#statusItemId").value = id || "";
    document.querySelector("#statusItemIdentifier").value = identifier || "";
    document.querySelector("#statusSelect").value = status || "available";
    document.querySelector("#statusNote").value = note || "";
    document.querySelector("#reasonCustom").value = "";
    document.querySelector("#reasonSelect").value = "";

    const msg = document.querySelector("#statusChangeMessage");
    if (msg) msg.textContent = "";

    if (changeStatusModal) changeStatusModal.show();
  });
});

// Submit form đổi trạng thái thiết bị
changeStatusForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.querySelector("#statusItemId").value;
  const status = document.querySelector("#statusSelect").value;
  const reason = document.querySelector("#reasonCustom").value.trim() || document.querySelector("#reasonSelect").value;
  const note = document.querySelector("#statusNote").value.trim();
  const msg = document.querySelector("#statusChangeMessage");

  try {
    const response = await fetch(`/admin/inventory/item/change-status/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ status, reason, note })
    });
    const result = await response.json();

    if (msg) {
      msg.textContent = result.message || "";
      msg.className = `form-message mt-2 mb-0 ${response.ok ? "text-success" : "text-danger"}`;
    }

    if (response.ok) {
      setTimeout(() => {
        window.location.reload();
      }, 600);
    }
  } catch (_err) {
    if (msg) {
      msg.textContent = "Lỗi kết nối khi cập nhật trạng thái!";
      msg.className = "form-message mt-2 mb-0 text-danger";
    }
  }
});

