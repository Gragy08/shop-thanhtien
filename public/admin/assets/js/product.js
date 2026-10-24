const productForm = document.querySelector("#productForm");
const variantTable = document.querySelector("#variantTable");
const attributes = window.attributeList || [];

const slugifyProduct = (value) => value
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

document.querySelector("#generateProductSlug")?.addEventListener("click", () => {
  document.querySelector("#slug").value = slugifyProduct(document.querySelector("#name").value);
});

const cartesian = (groups) => groups.reduce(
  (result, group) => result.flatMap((current) => group.map((item) => [...current, item])),
  [[]]
);

const productBaseToken = () => slugifyProduct(
  document.querySelector("#slug").value || document.querySelector("#name").value
).toUpperCase();

const createVariantSku = (combination) => [
  productBaseToken(),
  ...combination.map((item) => slugifyProduct(item.value || item.label).toUpperCase())
].filter(Boolean).join("-");

const selectedAttributes = () => {
  const ids = [...document.querySelectorAll(".attribute-check:checked")].map((input) => input.value);
  return attributes.filter((attribute) => ids.includes(String(attribute._id)));
};

document.querySelector("#categorySearch")?.addEventListener("input", (event) => {
  const keyword = event.target.value.trim().toLowerCase();
  document.querySelectorAll(".category-check").forEach((category) => {
    category.hidden = keyword !== "" && !category.dataset.categoryName.includes(keyword);
  });
});

document.querySelector("#attributeSearch")?.addEventListener("input", (event) => {
  const keyword = event.target.value.trim().toLowerCase();
  document.querySelectorAll(".attribute-check-row").forEach((attribute) => {
    attribute.hidden = keyword !== "" && !attribute.dataset.attributeName.includes(keyword);
  });
});

const renderVariants = () => {
  const selected = selectedAttributes();
  const message = document.querySelector("#productMessage");
  if (selected.length > 2) {
    message.textContent = "Chỉ được chọn tối đa 2 thuộc tính.";
    message.className = "form-message mt-3 mb-0 text-danger";
    return;
  }
  if (selected.some((attribute) => !attribute.options?.length)) {
    message.textContent = "Mỗi thuộc tính được chọn phải có ít nhất một giá trị.";
    message.className = "form-message mt-3 mb-0 text-danger";
    return;
  }
  if (!selected.length) {
    message.textContent = "Hãy chọn ít nhất một thuộc tính để sinh variant.";
    message.className = "form-message mt-3 mb-0 text-danger";
    return;
  }

  const combinations = cartesian(selected.map((attribute) => attribute.options.map((option) => ({
    attributeId: String(attribute._id),
    attributeName: attribute.name,
    type: attribute.type,
    label: option.label,
    value: option.value
  }))));
  const purchasePrice = document.querySelector("[name=purchasePrice]").value;
  const salePrice = document.querySelector("[name=salePrice]").value;
  const head = ["<th>Trạng thái</th>", ...selected.map((attribute) => `<th>${attribute.name}</th>`), "<th>SKU</th>", "<th>Giá nhập ghi đè</th>", "<th>Giá bán ghi đè</th>"].join("");
  const body = combinations.map((combination) => {
    const values = JSON.stringify(combination).replaceAll('"', "&quot;");
    const cells = combination.map((item, index) => `<td><input class="form-control variant-value" data-index="${index}" value="${item.label.replaceAll('"', '&quot;')}" ${item.type === "color" ? "" : "readonly"}></td>`).join("");
    const sku = createVariantSku(combination);
    return `<tr data-values="${values}"><td><div class="form-check form-switch form-switch-success"><input class="form-check-input variant-status" type="checkbox" checked></div></td>${cells}<td><input class="form-control variant-sku" value="${sku}" data-auto="true"></td><td><input class="form-control variant-purchase" type="number" min="0" value="${purchasePrice}" data-inherited="true"></td><td><input class="form-control variant-sale" type="number" min="0" value="${salePrice}" data-inherited="true"></td></tr>`;
  }).join("");
  variantTable.querySelector("thead tr").innerHTML = head;
  variantTable.querySelector("tbody").innerHTML = body;
  message.textContent = `${combinations.length} variant đã được sinh.`;
  message.className = "form-message mt-3 mb-0 text-success";
};

document.querySelector("#generateVariants")?.addEventListener("click", renderVariants);

variantTable?.addEventListener("input", (event) => {
  if (event.target.classList.contains("variant-purchase") || event.target.classList.contains("variant-sale")) {
    event.target.dataset.inherited = "false";
  }
  if (event.target.classList.contains("variant-sku")) {
    event.target.dataset.auto = "false";
  }
});

["purchasePrice", "salePrice"].forEach((fieldName) => {
  document.querySelector(`[name=${fieldName}]`)?.addEventListener("input", (event) => {
    const selector = fieldName === "purchasePrice" ? ".variant-purchase" : ".variant-sale";
    document.querySelectorAll(`${selector}[data-inherited="true"]`).forEach((input) => {
      input.value = event.target.value;
    });
  });
});

document.querySelectorAll(".attribute-check").forEach((checkbox) => checkbox.addEventListener("change", () => {
  const count = document.querySelectorAll(".attribute-check:checked").length;
  if (count > 2) checkbox.checked = false;
}));

productForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(productForm);
  const rows = [...variantTable.querySelectorAll("tbody tr[data-values]")];
  const variants = rows.map((row) => {
    const values = JSON.parse(row.dataset.values.replaceAll("&quot;", '"'));
    row.querySelectorAll(".variant-value").forEach((input, index) => { values[index].label = input.value.trim(); });
    return {
      sku: row.querySelector(".variant-sku").value.trim(),
      attributeValues: values.map(({ attributeId, attributeName, value, label }) => ({ attributeId, attributeName, value, label })),
      purchasePriceOverride: row.querySelector(".variant-purchase").dataset.inherited === "true" ? "" : row.querySelector(".variant-purchase").value,
      salePriceOverride: row.querySelector(".variant-sale").dataset.inherited === "true" ? "" : row.querySelector(".variant-sale").value,
      status: row.querySelector(".variant-status").checked ? "active" : "inactive"
    };
  });
  const body = {
    name: formData.get("name"),
    slug: formData.get("slug"),
    inventoryType: formData.get("inventoryType"),
    status: formData.get("status"),
    purchasePrice: formData.get("purchasePrice"),
    salePrice: formData.get("salePrice"),
    description: formData.get("description"),
    categoryIds: JSON.stringify([...document.querySelectorAll("input[name=categoryId]:checked")].map((input) => input.value)),
    attributeIds: JSON.stringify([...document.querySelectorAll(".attribute-check:checked")].map((input) => input.value)),
    variants: JSON.stringify(variants)
  };
  const response = await fetch("/admin/product/create", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(body) });
  const result = await response.json();
  const message = document.querySelector("#productMessage");
  message.textContent = result.message || "";
  message.className = `form-message mt-3 mb-0 ${response.ok ? "text-success" : "text-danger"}`;
  if (response.ok) window.location.href = "/admin/protected-health";
});
