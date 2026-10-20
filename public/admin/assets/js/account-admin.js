const showMessage = (selector, message, isError = true) => {
  const element = document.querySelector(selector);
  if (element) {
    element.textContent = message;
    element.classList.toggle("text-danger", isError);
    element.classList.toggle("text-success", !isError);
  }
};

const submitJson = async (url, method, body) => {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body)
  });
  return { response, result: await response.json() };
};

const accountForm = document.querySelector("#accountAdminForm");
accountForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(accountForm);
  const isEdit = accountForm.dataset.edit === "true";
  const id = accountForm.dataset.id;
  const body = Object.fromEntries(data.entries());
  const url = isEdit ? `/admin/account-admin/edit/${id}` : "/admin/account-admin/create";
  const { response, result } = await submitJson(url, isEdit ? "PATCH" : "POST", body);

  if (response.ok && result.code === "success") {
    window.location.href = "/admin/account-admin/list";
    return;
  }
  showMessage("#accountMessage", result.message || "Không thể lưu tài khoản.");
});

document.querySelector("#changePasswordButton")?.addEventListener("click", () => {
  document.querySelector("#changePasswordForm")?.classList.toggle("d-none");
});

document.querySelector("#changePasswordForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const id = form.dataset.id;
  const password = new FormData(form).get("password");
  const { response, result } = await submitJson(`/admin/account-admin/change-password/${id}`, "PATCH", { password });
  showMessage("#passwordMessage", result.message || "Không thể đổi mật khẩu.", !response.ok);
  if (response.ok) form.reset();
});

document.querySelectorAll(".account-delete").forEach((button) => {
  button.addEventListener("click", async () => {
    if (!window.confirm("Vô hiệu hóa tài khoản này?")) return;
    const id = button.dataset.id;
    const { response, result } = await submitJson(`/admin/account-admin/delete/${id}`, "PATCH", {});
    if (response.ok && result.code === "success") {
      window.location.reload();
      return;
    }
    window.alert(result.message || "Không thể vô hiệu hóa tài khoản.");
  });
});
