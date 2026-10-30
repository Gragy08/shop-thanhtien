const supplierForm = document.querySelector("#supplierForm");

supplierForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = Object.fromEntries(new FormData(supplierForm).entries());
  const isEdit = supplierForm.dataset.edit === "true";
  const id = supplierForm.dataset.id;
  const response = await fetch(isEdit ? `/admin/inventory/supplier/edit/${id}` : "/admin/inventory/supplier/create", {
    method: isEdit ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body)
  });
  const result = await response.json();
  const message = document.querySelector("#supplierMessage");
  if (message) {
    message.textContent = result.message || "";
    message.className = `form-message mt-3 mb-0 ${response.ok ? "text-success" : "text-danger"}`;
  }
  if (response.ok) {
    window.drawNotify("success", result.message || "Lưu nhà cung cấp thành công!");
    window.location.href = "/admin/inventory/supplier";
  } else {
    if (typeof notyf !== "undefined") notyf.error(result.message || "Không thể lưu nhà cung cấp.");
  }
});

document.querySelectorAll(".supplier-delete").forEach((button) => {
  button.addEventListener("click", async () => {
    if (!window.confirm("Vô hiệu hóa nhà cung cấp này?")) return;
    const response = await fetch(`/admin/inventory/supplier/delete/${button.dataset.id}`, {
      method: "PATCH",
      credentials: "same-origin"
    });
    const result = await response.json();
    if (response.ok) {
      window.drawNotify("success", result.message || "Vô hiệu hóa nhà cung cấp thành công!");
      window.location.reload();
      return;
    }
    if (typeof notyf !== "undefined") notyf.error(result.message || "Không thể vô hiệu hóa nhà cung cấp.");
    else window.alert(result.message || "Không thể vô hiệu hóa nhà cung cấp.");
  });
});
