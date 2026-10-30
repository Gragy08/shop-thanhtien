const slugifyCategory = (value) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

const categoryName = document.querySelector("#name");
const categorySlug = document.querySelector("#slug");
document.querySelector("#generateSlug")?.addEventListener("click", () => {
  categorySlug.value = slugifyCategory(categoryName.value);
});

const categoryForm = document.querySelector("#categoryForm");
categoryForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(categoryForm);
  const body = Object.fromEntries(formData.entries());
  const isEdit = categoryForm.dataset.edit === "true";
  const id = categoryForm.dataset.id;
  const url = isEdit ? `/admin/product/category/edit/${id}` : "/admin/product/category/create";
  const response = await fetch(url, {
    method: isEdit ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body)
  });
  const result = await response.json();
  const message = document.querySelector("#categoryMessage");
  if (message) {
    message.textContent = result.message || "";
    message.classList.toggle("text-danger", !response.ok);
    message.classList.toggle("text-success", response.ok);
  }
  if (response.ok) {
    window.drawNotify("success", result.message || "Lưu danh mục thành công!");
    window.location.href = "/admin/product/category";
  } else {
    if (typeof notyf !== "undefined") notyf.error(result.message || "Không thể lưu danh mục.");
  }
});

document.querySelectorAll(".category-delete").forEach((button) => {
  button.addEventListener("click", async () => {
    if (!window.confirm("Xóa danh mục này? Danh mục có con sẽ không thể xóa.")) return;
    const response = await fetch(`/admin/product/category/delete/${button.dataset.id}`, {
      method: "PATCH",
      credentials: "same-origin"
    });
    const result = await response.json();
    if (response.ok) {
      window.drawNotify("success", result.message || "Xóa danh mục thành công!");
      window.location.reload();
      return;
    }
    if (typeof notyf !== "undefined") notyf.error(result.message || "Không thể xóa danh mục.");
    else window.alert(result.message || "Không thể xóa danh mục.");
  });
});
