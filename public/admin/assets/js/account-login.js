const loginForm = document.querySelector("#accountLoginForm");
const loginButton = document.querySelector("#loginButton");
const loginMessage = document.querySelector("#loginMessage");

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginButton.disabled = true;
  loginMessage.textContent = "";

  const formData = new FormData(loginForm);
  const response = await fetch("/admin/account/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      email: formData.get("email"),
      password: formData.get("password"),
      rememberPassword: formData.get("rememberPassword") === "true"
    })
  });
  const result = await response.json();

  if (response.ok && result.code === "success") {
    window.location.href = "/admin/account-admin/list";
    return;
  }

  loginMessage.textContent = result.message || "Không thể đăng nhập.";
  loginButton.disabled = false;
});
