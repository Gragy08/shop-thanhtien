document.addEventListener("DOMContentLoaded", function () {
  const pathAdmin = window.pathAdmin || "admin";
  const currentFolder = window.currentFolder || "";
  const domainCDN = window.domainCDN || "";

  // Helper show quick feedback
  function showToast(message, isError = false) {
    window.alert(message);
  }

  // 1. Tạo thư mục mới
  const formCreateFolder = document.querySelector("#formCreateFolder");
  if (formCreateFolder) {
    formCreateFolder.addEventListener("submit", async function (e) {
      e.preventDefault();
      const folderNameInput = formCreateFolder.querySelector('[name="folderName"]');
      const folderName = folderNameInput ? folderNameInput.value.trim() : "";
      if (!folderName) {
        showToast("Vui lòng nhập tên thư mục!", true);
        return;
      }

      const formData = new FormData();
      formData.append("folderName", folderName);
      if (currentFolder) {
        formData.append("folderPath", currentFolder);
      }

      try {
        const res = await fetch(`/${pathAdmin}/file-manager/folder/create`, {
          method: "POST",
          body: formData
        });
        const data = await res.json();
        if (data.code === "success") {
          window.location.reload();
        } else {
          showToast(data.message || "Lỗi tạo thư mục!", true);
        }
      } catch (err) {
        showToast("Lỗi kết nối khi tạo thư mục!", true);
      }
    });
  }

  // 2. Xóa thư mục
  const deleteFolderBtns = document.querySelectorAll("[button-delete-folder]");
  deleteFolderBtns.forEach((btn) => {
    btn.addEventListener("click", async function () {
      const folderPath = btn.getAttribute("data-folder-path");
      const folderName = btn.getAttribute("data-folder-name");

      if (!folderPath) return;

      const confirmed = window.confirm(`Bạn có chắc muốn xóa thư mục "${folderName}"? Toàn bộ tệp và thư mục con bên trong sẽ bị xóa vĩnh viễn.`);
      if (!confirmed) return;

      try {
        const res = await fetch(`/${pathAdmin}/file-manager/folder/delete?folderPath=${encodeURIComponent(folderPath)}`, {
          method: "DELETE"
        });
        const data = await res.json();
        if (data.code === "success") {
          window.location.reload();
        } else {
          showToast(data.message || "Lỗi xóa thư mục!", true);
        }
      } catch (err) {
        showToast("Lỗi kết nối khi xóa thư mục!", true);
      }
    });
  });

  // 3. Tải lên tệp tin (Kéo thả + Chọn tệp)
  const dropzone = document.getElementById("dropzoneUpload");
  const fileInput = document.getElementById("fileUploadInput");
  const btnChooseFiles = document.getElementById("btnChooseFiles");
  const progressWrapper = document.getElementById("uploadProgressWrapper");
  const progressBar = document.getElementById("uploadProgressBar");
  const progressPercent = document.getElementById("uploadPercentText");
  const progressStatus = document.getElementById("uploadStatusText");

  if (dropzone && fileInput) {
    if (btnChooseFiles) {
      btnChooseFiles.addEventListener("click", (e) => {
        e.stopPropagation();
        fileInput.click();
      });
    }

    dropzone.addEventListener("click", () => {
      fileInput.click();
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add("border-primary", "bg-primary-subtle");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove("border-primary", "bg-primary-subtle");
      });
    });

    dropzone.addEventListener("drop", (e) => {
      const files = e.dataTransfer?.files;
      if (files && files.length) {
        uploadFiles(files);
      }
    });

    fileInput.addEventListener("change", (e) => {
      const files = e.target.files;
      if (files && files.length) {
        uploadFiles(files);
      }
    });
  }

  function uploadFiles(files) {
    if (!files || !files.length) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }
    if (currentFolder) {
      formData.append("folderPath", currentFolder);
    }

    if (progressWrapper) progressWrapper.style.display = "block";
    if (progressBar) progressBar.style.width = "0%";
    if (progressPercent) progressPercent.innerText = "0%";
    if (progressStatus) progressStatus.innerText = `Đang tải lên ${files.length} tệp tin...`;

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/${pathAdmin}/file-manager/upload?folderPath=${encodeURIComponent(currentFolder)}`, true);

    xhr.upload.onprogress = function (e) {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        if (progressBar) progressBar.style.width = `${percent}%`;
        if (progressPercent) progressPercent.innerText = `${percent}%`;
      }
    };

    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (data.code === "success") {
            if (progressStatus) progressStatus.innerText = "Tải lên thành công! Đang tải lại trang...";
            setTimeout(() => {
              window.location.reload();
            }, 600);
          } else {
            showToast(data.message || "Lỗi khi lưu tệp trên CDN!", true);
            if (progressWrapper) progressWrapper.style.display = "none";
          }
        } catch (err) {
          showToast("Lỗi định dạng phản hồi từ server!", true);
          if (progressWrapper) progressWrapper.style.display = "none";
        }
      } else {
        showToast(`Lỗi HTTP ${xhr.status}: Không thể tải lên tệp!`, true);
        if (progressWrapper) progressWrapper.style.display = "none";
      }
    };

    xhr.onerror = function () {
      showToast("Lỗi kết nối tới máy chủ khi tải lên tệp!", true);
      if (progressWrapper) progressWrapper.style.display = "none";
    };

    xhr.send(formData);
  }

  // 4. Copy URL từng file
  const copyBtns = document.querySelectorAll("[button-copy]");
  copyBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const content = btn.getAttribute("data-content") || btn.getAttribute("data-relative");
      if (content && navigator.clipboard) {
        navigator.clipboard.writeText(content).then(() => {
          const originalHTML = btn.innerHTML;
          btn.innerHTML = '<i class="las la-check text-success"></i>';
          setTimeout(() => {
            btn.innerHTML = originalHTML;
          }, 1500);
        });
      }
    });
  });

  // 5. Checkbox All & Checkbox Item
  const checkboxAll = document.querySelector(".checkbox-all");
  const itemCheckboxes = document.querySelectorAll(".checkbox-input");
  if (checkboxAll) {
    checkboxAll.addEventListener("change", () => {
      itemCheckboxes.forEach((cb) => {
        cb.checked = checkboxAll.checked;
      });
    });
  }

  // 6. Copy link các file đã chọn
  const btnCopyMulti = document.querySelector("[button-copy-multi]");
  if (btnCopyMulti) {
    btnCopyMulti.addEventListener("click", () => {
      const selected = document.querySelectorAll(".checkbox-input:checked");
      if (!selected.length) {
        showToast("Vui lòng chọn ít nhất một tệp tin!", true);
        return;
      }

      const links = [];
      selected.forEach((cb) => {
        links.push(cb.value);
      });

      if (navigator.clipboard) {
        navigator.clipboard.writeText(JSON.stringify(links)).then(() => {
          showToast(`Đã sao chép đường dẫn của ${links.length} tệp tin vào bộ nhớ tạm!`);
        });
      }
    });
  }

  // 7. Modal Preview File
  const modalPreviewEl = document.getElementById("modalPreviewFile");
  if (modalPreviewEl) {
    const previewContainer = modalPreviewEl.querySelector(".inner-preview");
    const previewTitle = document.getElementById("modalPreviewTitle");
    const previewDownload = document.getElementById("modalPreviewDownload");

    let clickedBtn = null;
    document.querySelectorAll("[button-preview-file]").forEach((btn) => {
      btn.addEventListener("click", () => {
        clickedBtn = btn;
      });
    });

    modalPreviewEl.addEventListener("shown.bs.modal", () => {
      if (!clickedBtn || !previewContainer) return;

      const fileUrl = clickedBtn.getAttribute("data-file");
      const mimetype = clickedBtn.getAttribute("data-mimetype") || "";
      const filename = clickedBtn.getAttribute("data-filename") || "Tệp tin";

      if (previewTitle) previewTitle.innerText = `Xem trước: ${filename}`;
      if (previewDownload) previewDownload.href = fileUrl;

      if (mimetype.includes("image")) {
        previewContainer.innerHTML = `<img src="${fileUrl}" class="img-fluid rounded shadow-sm" style="max-height: 65vh; object-fit: contain;" />`;
      } else if (mimetype.includes("audio")) {
        previewContainer.innerHTML = `
          <div class="w-100 p-4 text-center">
            <i class="las la-volume-up text-info fs-1 mb-3"></i>
            <audio controls class="w-100">
              <source src="${fileUrl}" type="${mimetype}">
              Trình duyệt của bạn không hỗ trợ phát âm thanh.
            </audio>
          </div>
        `;
      } else if (mimetype.includes("video")) {
        previewContainer.innerHTML = `
          <video controls class="w-100 rounded" style="max-height: 65vh;">
            <source src="${fileUrl}" type="${mimetype}">
            Trình duyệt của bạn không hỗ trợ phát video.
          </video>
        `;
      } else if (mimetype.includes("pdf")) {
        previewContainer.innerHTML = `<iframe src="${fileUrl}" style="width: 100%; height: 65vh; border: none;" class="rounded"></iframe>`;
      } else {
        previewContainer.innerHTML = `
          <div class="text-center py-5">
            <i class="las la-file text-secondary fs-1 mb-2"></i>
            <p class="text-muted">Định dạng tệp này không hỗ trợ xem trực tiếp.</p>
            <a href="${fileUrl}?type=download" class="btn btn-sm btn-outline-primary">
              <i class="las la-download me-1"></i> Tải về máy để xem
            </a>
          </div>
        `;
      }
    });

    modalPreviewEl.addEventListener("hidden.bs.modal", () => {
      clickedBtn = null;
      if (previewContainer) previewContainer.innerHTML = "";
    });
  }

  // 8. Đổi tên tệp tin
  const modalChangeNameEl = document.getElementById("modalChangeFileName");
  const formChangeFileName = document.getElementById("formChangeFileName");
  const editFileId = document.getElementById("editFileId");
  const editFileName = document.getElementById("editFileName");

  if (modalChangeNameEl && formChangeFileName) {
    let renameBtn = null;
    document.querySelectorAll("[button-change-file-name]").forEach((btn) => {
      btn.addEventListener("click", () => {
        renameBtn = btn;
      });
    });

    modalChangeNameEl.addEventListener("shown.bs.modal", () => {
      if (renameBtn) {
        if (editFileId) editFileId.value = renameBtn.getAttribute("data-file-id") || "";
        if (editFileName) {
          editFileName.value = renameBtn.getAttribute("data-file-name") || "";
          editFileName.focus();
        }
      }
    });

    modalChangeNameEl.addEventListener("hidden.bs.modal", () => {
      renameBtn = null;
      if (editFileId) editFileId.value = "";
      if (editFileName) editFileName.value = "";
    });

    formChangeFileName.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fileId = editFileId ? editFileId.value : "";
      const newName = editFileName ? editFileName.value.trim() : "";

      if (!fileId || !newName) {
        showToast("Tên tệp tin không được để trống!", true);
        return;
      }

      const formData = new FormData();
      formData.append("fileName", newName);

      try {
        const res = await fetch(`/${pathAdmin}/file-manager/change-file-name/${fileId}`, {
          method: "PATCH",
          body: formData
        });
        const data = await res.json();
        if (data.code === "success") {
          window.location.reload();
        } else {
          showToast(data.message || "Lỗi khi đổi tên file!", true);
        }
      } catch (err) {
        showToast("Lỗi kết nối khi đổi tên file!", true);
      }
    });
  }

  // 9. Xóa tệp tin
  const deleteFileBtns = document.querySelectorAll("[button-delete-file]");
  deleteFileBtns.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const fileId = btn.getAttribute("data-file-id");
      const fileName = btn.getAttribute("data-file-name");

      if (!fileId) return;

      const confirmed = window.confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn tệp "${fileName}"?`);
      if (!confirmed) return;

      try {
        const res = await fetch(`/${pathAdmin}/file-manager/delete-file/${fileId}`, {
          method: "DELETE"
        });
        const data = await res.json();
        if (data.code === "success") {
          window.location.reload();
        } else {
          showToast(data.message || "Lỗi khi xóa tệp tin!", true);
        }
      } catch (err) {
        showToast("Lỗi kết nối khi xóa tệp tin!", true);
      }
    });
  });
});


