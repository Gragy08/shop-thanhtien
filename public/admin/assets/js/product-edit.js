const productEditForm = document.querySelector("#productEditForm");

const slugifyProduct = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// Tự động tạo slug từ tên sản phẩm
document.querySelector("#generateProductSlug")?.addEventListener("click", () => {
  const nameVal = document.querySelector("#name")?.value || "";
  const slugInput = document.querySelector("#slug");
  if (slugInput) {
    slugInput.value = slugifyProduct(nameVal);
  }
});

// Lọc tìm kiếm danh mục sản phẩm
document.querySelector("#categorySearch")?.addEventListener("input", (event) => {
  const keyword = event.target.value.trim().toLowerCase();
  document.querySelectorAll(".category-check").forEach((category) => {
    category.hidden = keyword !== "" && !category.dataset.categoryName.includes(keyword);
  });
});

// Submit form cập nhật sản phẩm
productEditForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = productEditForm.dataset.id;
  const message = document.querySelector("#productEditMessage");

  const categoryIds = [...document.querySelectorAll("input[name=categoryId]:checked")].map((input) => input.value);
  if (!categoryIds.length) {
    if (message) {
      message.textContent = "Vui lòng chọn ít nhất một danh mục cho sản phẩm!";
      message.className = "form-message mt-3 mb-0 text-danger";
    }
    return;
  }

  const rows = [...document.querySelectorAll("#variantEditTable tbody tr[data-variant-id]")];
  const variants = rows.map((row) => ({
    id: row.dataset.variantId,
    sku: row.querySelector(".variant-sku")?.value?.trim() || "",
    purchasePriceOverride: row.querySelector(".variant-purchase")?.value !== "" ? row.querySelector(".variant-purchase")?.value : null,
    salePriceOverride: row.querySelector(".variant-sale")?.value !== "" ? row.querySelector(".variant-sale")?.value : null,
    status: row.querySelector(".variant-status")?.checked ? "active" : "inactive"
  }));

  const formData = new FormData(productEditForm);
  const body = {
    name: formData.get("name"),
    slug: formData.get("slug"),
    status: formData.get("status"),
    purchasePrice: formData.get("purchasePrice"),
    salePrice: formData.get("salePrice"),
    description: formData.get("description"),
    categoryIds,
    variants
  };

  try {
    const response = await fetch(`/admin/product/edit/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body)
    });

    const result = await response.json();

    if (message) {
      message.textContent = result.message || "";
      message.className = `form-message mt-3 mb-0 ${response.ok ? "text-success" : "text-danger"}`;
    }

    if (response.ok) {
      setTimeout(() => {
        window.location.href = "/admin/product";
      }, 600);
    }
  } catch (_error) {
    if (message) {
      message.textContent = "Lỗi kết nối khi gửi yêu cầu cập nhật!";
      message.className = "form-message mt-3 mb-0 text-danger";
    }
  }
});

