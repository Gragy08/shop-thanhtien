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

// Quản lý hình ảnh sản phẩm
const imagesContainer = document.querySelector("#productImagesContainer");
const noImagesText = document.querySelector("#noImagesText");

const addImageItem = (url, relativeUrl) => {
  if (!imagesContainer) return;
  if (noImagesText) noImagesText.style.display = "none";
  const finalRelative = relativeUrl || url;
  const fullUrl = url.startsWith("http") ? url : (url.startsWith("/") ? url : "/" + url);

  const existing = imagesContainer.querySelector(`img[data-src-relative="${finalRelative}"]`);
  if (existing) return;

  const box = document.createElement("div");
  box.className = "product-image-box position-relative border rounded p-1";
  box.style.width = "80px";
  box.style.height = "80px";
  box.innerHTML = `
    <img src="${fullUrl}" class="w-100 h-100 rounded" style="object-fit: cover;" data-src-relative="${finalRelative}" alt="" />
    <button type="button" class="btn btn-danger btn-xs position-absolute top-0 end-0 p-0 d-flex align-items-center justify-content-center remove-image-btn" style="width: 20px; height: 20px; font-size: 12px; border-radius: 50%; transform: translate(30%, -30%);" title="Xóa ảnh">&times;</button>
  `;
  imagesContainer.appendChild(box);
};

imagesContainer?.addEventListener("click", (e) => {
  const removeBtn = e.target.closest(".remove-image-btn");
  if (removeBtn) {
    const box = removeBtn.closest(".product-image-box");
    if (box) box.remove();
    if (!imagesContainer.querySelectorAll(".product-image-box").length && noImagesText) {
      noImagesText.style.display = "block";
    }
  }
});

window.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SELECT_FILE") {
    addImageItem(event.data.url, event.data.relativeUrl);
    const modalEl = document.getElementById("modalFileManager");
    if (modalEl && window.bootstrap) {
      const modalInstance = window.bootstrap.Modal.getInstance(modalEl);
      if (modalInstance) modalInstance.hide();
    }
  }
});

document.querySelector("#btnPasteMedia")?.addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (!text) return;
    try {
      const list = JSON.parse(text);
      if (Array.isArray(list)) {
        list.forEach((item) => addImageItem(item));
        return;
      }
    } catch {
      // Single URL/path
    }
    addImageItem(text.trim());
  } catch (_err) {
    window.alert("Không thể đọc bộ nhớ tạm!");
  }
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

  const getProductImages = () => {
    const imagesContainer = document.querySelector("#productImagesContainer");
    if (!imagesContainer) return [];
    const imgs = imagesContainer.querySelectorAll("img[data-src-relative]");
    return Array.from(imgs).map((img) => img.getAttribute("data-src-relative") || img.src);
  };

  const formData = new FormData(productEditForm);
  const body = {
    name: formData.get("name"),
    slug: formData.get("slug"),
    status: formData.get("status"),
    purchasePrice: formData.get("purchasePrice"),
    salePrice: formData.get("salePrice"),
    description: formData.get("description"),
    images: getProductImages(),
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

