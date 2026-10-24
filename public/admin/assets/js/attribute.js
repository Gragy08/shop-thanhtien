const optionList = document.querySelector("#optionList");
const addOptionButton = document.querySelector("#addOption");

const createOptionRow = () => {
  const row = document.createElement("tr");
  row.className = "attribute-option";
  row.innerHTML = `
    <td><input class="form-control option-label" name="optionLabel" required placeholder="Đen"></td>
    <td><input class="form-control option-value" name="optionValue" required placeholder="den"></td>
    <td class="text-center"><button class="btn btn-sm btn-outline-danger remove-option" type="button" aria-label="Xóa giá trị">×</button></td>
  `;
  return row;
};

addOptionButton?.addEventListener("click", () => optionList.appendChild(createOptionRow()));
optionList?.addEventListener("click", (event) => {
  if (!event.target.classList.contains("remove-option")) return;
  const rows = optionList.querySelectorAll(".attribute-option");
  if (rows.length === 1) {
    rows[0].querySelectorAll("input").forEach((input) => { input.value = ""; });
    return;
  }
  event.target.closest(".attribute-option").remove();
});

optionList?.addEventListener("input", (event) => {
  if (!event.target.classList.contains("option-label")) return;
  const row = event.target.closest(".attribute-option");
  const valueInput = row.querySelector(".option-value");
  if (!valueInput.dataset.edited) valueInput.value = event.target.value
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
});
optionList?.addEventListener("input", (event) => {
  if (event.target.classList.contains("option-value")) event.target.dataset.edited = "true";
});

const attributeForm = document.querySelector("#attributeForm");
attributeForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(attributeForm);
  const options = [...document.querySelectorAll(".attribute-option")].map((row) => ({
    label: row.querySelector(".option-label").value.trim(),
    value: row.querySelector(".option-value").value.trim()
  }));
  const body = {
    name: formData.get("name"),
    code: formData.get("code"),
    type: formData.get("type"),
    status: formData.get("status"),
    options: JSON.stringify(options)
  };
  const isEdit = attributeForm.dataset.edit === "true";
  const id = attributeForm.dataset.id;
  const url = isEdit ? `/admin/product/attribute/edit/${id}` : "/admin/product/attribute/create";
  const response = await fetch(url, {
    method: isEdit ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body)
  });
  const result = await response.json();
  const message = document.querySelector("#attributeMessage");
  message.textContent = result.message || "";
  message.classList.toggle("text-danger", !response.ok);
  message.classList.toggle("text-success", response.ok);
  if (response.ok) window.location.href = "/admin/product/attribute";
});

document.querySelectorAll(".attribute-delete").forEach((button) => {
  button.addEventListener("click", async () => {
    if (!window.confirm("Xóa thuộc tính này?")) return;
    const response = await fetch(`/admin/product/attribute/delete/${button.dataset.id}`, {
      method: "PATCH",
      credentials: "same-origin"
    });
    const result = await response.json();
    if (response.ok) {
      window.location.reload();
      return;
    }
    window.alert(result.message || "Không thể xóa thuộc tính.");
  });
});
