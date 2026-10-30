const receiptEditForm = document.querySelector("#receiptEditForm");
const editHasInvoiceCheckbox = document.querySelector("#receiptEditForm #hasInvoice");
const editInvoiceNumberGroup = document.querySelector("#receiptEditForm #invoiceNumberGroup");
const editInvoiceNumberInput = document.querySelector("#receiptEditForm #invoiceNumber");

editHasInvoiceCheckbox?.addEventListener("change", (event) => {
  const isChecked = event.target.checked;
  if (editInvoiceNumberGroup) {
    editInvoiceNumberGroup.style.display = isChecked ? "block" : "none";
  }
  if (editInvoiceNumberInput) {
    editInvoiceNumberInput.required = isChecked;
    if (!isChecked) {
      editInvoiceNumberInput.value = "";
    }
  }
});

receiptEditForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = receiptEditForm.dataset.id;
  const formData = new FormData(receiptEditForm);
  const body = Object.fromEntries(formData.entries());
  body.hasInvoice = editHasInvoiceCheckbox?.checked ?? false;
  if (body.totalCost && window.parseVND) {
    body.totalCost = window.parseVND(body.totalCost);
  }

  const response = await fetch(`/admin/inventory/receipt/edit/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body)
  });
  const result = await response.json();
  const message = document.querySelector("#receiptEditMessage");
  if (message) {
    message.textContent = result.message || "";
    message.className = `form-message mt-3 mb-0 ${response.ok ? "text-success" : "text-danger"}`;
  }
  if (response.ok) {
    window.drawNotify("success", result.message || "Cập nhật phiếu nhập thành công!");
    window.location.href = `/admin/inventory/receipt/${id}`;
  } else {
    if (typeof notyf !== "undefined") notyf.error(result.message || "Lỗi cập nhật phiếu nhập!");
  }
});

const deleteReceipt = async (button, hard) => {
  const message = hard
    ? "Xóa vĩnh viễn phiếu nhập này và toàn bộ hàng hóa liên quan khỏi hệ thống? Thao tác này không thể hoàn tác!"
    : "Xóa mềm phiếu nhập và chuyển vào Lưu trữ (ẩn hàng hóa liên quan khỏi kho)?";
  if (!window.confirm(message)) return;
  const response = await fetch(`/admin/inventory/receipt/delete/${button.dataset.id}`, {
    method: hard ? "DELETE" : "PATCH",
    credentials: "same-origin"
  });
  const result = await response.json();
  if (response.ok) {
    window.drawNotify("success", result.message || "Thao tác thành công!");
    window.location.reload();
    return;
  }
  if (typeof notyf !== "undefined") notyf.error(result.message || "Không thể thực hiện thao tác xóa.");
  else window.alert(result.message || "Không thể thực hiện thao tác xóa.");
};

const restoreReceipt = async (button) => {
  if (!window.confirm("Khôi phục phiếu nhập này và đưa hàng hóa trở lại kho?")) return;
  const response = await fetch(`/admin/inventory/receipt/restore/${button.dataset.id}`, {
    method: "PATCH",
    credentials: "same-origin"
  });
  const result = await response.json();
  if (response.ok) {
    window.drawNotify("success", result.message || "Khôi phục phiếu nhập thành công!");
    window.location.reload();
    return;
  }
  if (typeof notyf !== "undefined") notyf.error(result.message || "Không thể khôi phục phiếu nhập.");
  else window.alert(result.message || "Không thể khôi phục phiếu nhập.");
};

document.querySelectorAll(".receipt-soft-delete").forEach((button) =>
  button.addEventListener("click", () => deleteReceipt(button, false))
);
document.querySelectorAll(".receipt-hard-delete").forEach((button) =>
  button.addEventListener("click", () => deleteReceipt(button, true))
);
document.querySelectorAll(".receipt-restore").forEach((button) =>
  button.addEventListener("click", () => restoreReceipt(button))
);
