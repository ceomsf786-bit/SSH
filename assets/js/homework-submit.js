(() => {
  const STUDENTS = {
    "RG11": 11,
    "IS10": 10,
    "AV09": 9,
    "MD09": 9,
    "FS06": 6,
    "Test09": 9,
    "md12": 12
  };

  const SUBJECTS = {
    12: [
      "English", "Afrikaans", "Mathematical Literacy", "Accounting",
      "Economics", "Religion Studies", "Business Studies", "History",
      "Life Sciences", "Life Orientation"
    ],
    11: [
      "Mathematics", "Mathematical Literacy", "English", "Afrikaans",
      "Business Studies", "Economics", "History", "Geography",
      "Accounting", "Physical Sciences", "Life Sciences", "Life Orientation"
    ],
    10: [
      "Mathematics", "Mathematical Literacy", "English", "Afrikaans",
      "Business Studies", "Economics", "History", "Geography",
      "Accounting", "Physical Sciences", "Life Sciences", "Life Orientation"
    ],
    9: [
      "Mathematics", "English", "Afrikaans", "Natural Sciences",
      "Economic and Management Sciences", "Social Sciences", "Technology", "Life Orientation"
    ],
    6: [
      "Mathematics", "English", "Afrikaans", "Natural Sciences and Technology",
      "Social Sciences", "Life Skills"
    ]
  };

  const UPLOAD_KEY = "SNT-T4-HOMEWORK-2026-ENK";
  const params = new URLSearchParams(window.location.search);
  const status = String(params.get("status") || "").trim();
  const returnedStudent = String(params.get("student") || "").trim();
  const returnedMessage = String(params.get("message") || "").trim();
  const $ = (id) => document.getElementById(id);

  const form = $("submissionForm");
  const studentSelect = $("studentSelect");
  const subjectSelect = $("subjectSelect");
  const weekSelect = $("weekSelect");
  const typedAnswers = $("typedAnswers");
  const cameraInput = $("cameraInput");
  const imageInput = $("imageInput");
  const retakeInput = $("retakeInput");
  const imageList = $("imageList");
  const submitBtn = $("submitBtn");
  const formMessage = $("formMessage");
  const resultCard = $("resultCard");
  const gradeBadge = $("gradeBadge");

  const maxImages = Number(window.SNT_HOMEWORK_MAX_IMAGES || 8);
  const maxImageBytes = Number(window.SNT_HOMEWORK_MAX_IMAGE_MB || 5) * 1024 * 1024;
  const maxPdfBytes = Number(window.SNT_HOMEWORK_MAX_PDF_MB || 10) * 1024 * 1024;
  let selectedImages = [];
  let pendingRetakeIndex = null;

  init();

  function init() {
    if (status === "success") {
      form.classList.add("hidden");
      gradeBadge.textContent = "Submitted";
      resultCard.classList.remove("hidden", "error");
      resultCard.innerHTML = `
        <h2>✅ Homework submitted</h2>
        <p><strong>${escapeHtml(returnedStudent || "Student")}</strong>, your homework was sent successfully.</p>
        <p>You can close this page now.</p>
      `;
      return;
    }

    if (status === "duplicate") {
      form.classList.add("hidden");
      gradeBadge.textContent = "Already submitted";
      resultCard.classList.remove("hidden");
      resultCard.classList.add("error");
      resultCard.innerHTML = `
        <h2>Already submitted</h2>
        <p>This homework has already been handed in.</p>
        <p>Please ask your teacher if a reset is needed.</p>
      `;
      return;
    }

    if (status === "error") {
      resultCard.classList.remove("hidden");
      resultCard.classList.add("error");
      resultCard.innerHTML = `<h2>Submission not completed</h2><p>${escapeHtml(returnedMessage || "Please try again.")}</p>`;
    }

    studentSelect.addEventListener("change", handleStudentChange);
    cameraInput.addEventListener("change", () => addSelectedImages(cameraInput));
    imageInput.addEventListener("change", () => addSelectedImages(imageInput));
    retakeInput.addEventListener("change", handleRetakeSelection);
    imageList.addEventListener("click", handleImageAction);
    form.addEventListener("submit", handleSubmit);
  }

  function handleStudentChange() {
    const student = studentSelect.value;
    const grade = STUDENTS[student];

    if (!grade) {
      gradeBadge.textContent = "Choose learner";
      subjectSelect.disabled = true;
      subjectSelect.innerHTML = `<option value="">Choose your name first</option>`;
      return;
    }

    gradeBadge.textContent = `Grade ${grade}`;
    const subjects = SUBJECTS[grade] || [];
    subjectSelect.disabled = false;
    subjectSelect.innerHTML = `<option value="">Choose subject</option>` +
      subjects.map((subject) => `<option value="${escapeHtml(subject)}">${escapeHtml(subject)}</option>`).join("");
  }

  function makeImageItem(file) {
    return {
      file,
      rotation: 0,
      previewUrl: URL.createObjectURL(file)
    };
  }

  function addSelectedImages(input) {
    clearMessage();
    const incoming = Array.from(input.files || []);
    if (!incoming.length) return;

    if (selectedImages.length + incoming.length > maxImages) {
      showMessage(`Please submit no more than ${maxImages} photos/images in total.`, true);
      input.value = "";
      return;
    }

    try {
      validateImages(incoming);
      selectedImages = selectedImages.concat(incoming.map(makeImageItem));
      renderSelectedImages();
    } catch (error) {
      showMessage(error.message || "One of the images cannot be used.", true);
    } finally {
      input.value = "";
    }
  }

  function handleRetakeSelection() {
    const incoming = Array.from(retakeInput.files || []);
    if (pendingRetakeIndex === null || !incoming.length) {
      retakeInput.value = "";
      return;
    }

    try {
      validateImages([incoming[0]]);
      const oldItem = selectedImages[pendingRetakeIndex];
      if (oldItem && oldItem.previewUrl) URL.revokeObjectURL(oldItem.previewUrl);
      selectedImages[pendingRetakeIndex] = makeImageItem(incoming[0]);
      renderSelectedImages();
    } catch (error) {
      showMessage(error.message || "The replacement photo cannot be used.", true);
    } finally {
      pendingRetakeIndex = null;
      retakeInput.value = "";
    }
  }

  function handleImageAction(event) {
    const button = event.target.closest("button[data-image-action]");
    if (!button) return;

    const index = Number(button.dataset.index);
    if (!Number.isInteger(index) || !selectedImages[index]) return;

    const action = button.dataset.imageAction;

    if (action === "rotate") {
      selectedImages[index].rotation = (selectedImages[index].rotation + 90) % 360;
      renderSelectedImages();
      return;
    }

    if (action === "retake") {
      pendingRetakeIndex = index;
      retakeInput.click();
      return;
    }

    if (action === "remove") {
      const item = selectedImages[index];
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      selectedImages.splice(index, 1);
      renderSelectedImages();
    }
  }

  function renderSelectedImages() {
    if (!selectedImages.length) {
      imageList.innerHTML = "";
      return;
    }

    imageList.innerHTML = selectedImages.map((item, index) => `
      <div class="image-card">
        <div class="image-preview">
          <img src="${item.previewUrl}" alt="Preview of homework image ${index + 1}" style="transform: rotate(${item.rotation}deg)">
        </div>
        <div class="image-meta">
          <div class="image-name">${index + 1}. ${escapeHtml(item.file.name || `Photo ${index + 1}`)}</div>
          <div class="image-size">${formatBytes(item.file.size)} • Rotation: ${item.rotation}°</div>
          <div class="image-actions">
            <button class="image-action" type="button" data-image-action="rotate" data-index="${index}">↻ Rotate 90°</button>
            <button class="image-action" type="button" data-image-action="retake" data-index="${index}">📷 Retake</button>
            <button class="image-action remove" type="button" data-image-action="remove" data-index="${index}">Remove</button>
          </div>
        </div>
      </div>
    `).join("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    clearMessage();

    const student = studentSelect.value.trim();
    const grade = STUDENTS[student];
    const subject = subjectSelect.value.trim();
    const week = weekSelect.value.trim();
    const text = typedAnswers.value.trim();
    const images = selectedImages.map((item) => ({ ...item }));

    if (!student || !grade) return showMessage("Choose your name.", true);
    if (!subject) return showMessage("Choose your subject.", true);
    if (!week) return showMessage("Choose the homework week.", true);
    if (!text && !images.length) return showMessage("Type answers, take photos, add images, or use a combination.", true);

    validateImages(images.map((item) => item.file));

    try {
      setBusy(true, "Preparing PDF...");
      const pdfData = await buildCombinedPdf({ student, grade, subject, week, text, images });
      const base64 = pdfData.split(",")[1] || "";
      const approxBytes = Math.ceil(base64.length * 3 / 4);

      if (!base64 || approxBytes > maxPdfBytes) {
        throw new Error(`The final PDF is too large. Keep it under ${window.SNT_HOMEWORK_MAX_PDF_MB || 10} MB.`);
      }

      const today = new Date().toISOString().slice(0, 10);
      setBusy(true, "Sending to Drive...");
      postToDrive({
        grade: String(grade),
        subject,
        task: week,
        student,
        activity_date: today,
        submission_mode: text && images.length ? "text+images" : text ? "typed" : "images",
        upload_key: UPLOAD_KEY,
        file_name: buildFileName(student, grade, subject, week, today),
        mime_type: "application/pdf",
        file_base64: base64
      });
    } catch (error) {
      setBusy(false, "Submit homework");
      showMessage(error.message || "Could not prepare submission.", true);
    }
  }

  function validateImages(files) {
    if (files.length > maxImages) throw new Error(`Please submit no more than ${maxImages} images.`);
    for (const file of files) {
      if (!["image/jpeg", "image/png"].includes(file.type)) {
        throw new Error("Please use a JPG or PNG photo/image.");
      }
      if (file.size > maxImageBytes) {
        throw new Error(`${file.name || "A photo"} is too large. Keep each image under ${window.SNT_HOMEWORK_MAX_IMAGE_MB || 5} MB.`);
      }
    }
  }

  async function buildCombinedPdf({ student, grade, subject, week, text, images }) {
    const { jsPDF } = window.jspdf;
    const preparedImages = [];

    for (const item of images) {
      preparedImages.push(await prepareImageForPdf(item));
    }

    const firstOrientation = text
      ? "portrait"
      : preparedImages.length && preparedImages[0].width > preparedImages[0].height
        ? "landscape"
        : "portrait";

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: firstOrientation });
    let hasContent = false;

    if (text) {
      renderTypedAnswers(pdf, { student, grade, subject, week, text });
      hasContent = true;
    }

    for (let i = 0; i < preparedImages.length; i++) {
      const image = preparedImages[i];
      const orientation = image.width > image.height ? "landscape" : "portrait";

      if (hasContent || i > 0) {
        pdf.addPage("a4", orientation);
      }

      const yStart = addImageHeader(
        pdf,
        student,
        grade,
        subject,
        week,
        `Homework image ${i + 1} of ${preparedImages.length}`
      );

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const marginX = 7;
      const bottomMargin = 7;
      const maxW = pageW - marginX * 2;
      const maxH = pageH - yStart - bottomMargin;
      const scale = Math.min(maxW / image.width, maxH / image.height);
      const w = image.width * scale;
      const h = image.height * scale;
      const x = (pageW - w) / 2;
      const y = yStart + Math.max(0, (maxH - h) / 2);

      pdf.addImage(image.dataUrl, image.format, x, y, w, h, undefined, "FAST");
      hasContent = true;
    }

    return pdf.output("datauristring");
  }

  function renderTypedAnswers(pdf, { student, grade, subject, week, text }) {
    let y = addHeader(pdf, student, grade, subject, week, "Typed answers / notes");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);

    const logicalLines = normalizeTypedText(text).split("\n");

    for (const logicalLine of logicalLines) {
      if (!logicalLine.trim()) {
        y += 3;
        continue;
      }

      const wrapped = pdf.splitTextToSize(logicalLine, 178);

      for (const line of wrapped) {
        if (y > 284) {
          pdf.addPage("a4", "portrait");
          y = addHeader(pdf, student, grade, subject, week, "Typed answers / notes (continued)");
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(11);
        }
        pdf.text(line, 16, y);
        y += 5.2;
      }
    }
  }

  function normalizeTypedText(value) {
    const lines = String(value || "")
      .replace(/\r\n?/g, "\n")
      .replace(/\t/g, "    ")
      .split("\n")
      .map((line) => line.replace(/[ \u00A0]+$/g, ""));

    const cleaned = [];
    let previousBlank = false;

    for (const line of lines) {
      const isBlank = !line.trim();
      if (isBlank && previousBlank) continue;
      cleaned.push(line);
      previousBlank = isBlank;
    }

    return cleaned.join("\n").trim();
  }

  async function prepareImageForPdf(item) {
    const source = await loadOrientedImage(item.file);
    const sourceWidth = source.width || source.naturalWidth;
    const sourceHeight = source.height || source.naturalHeight;

    if (!sourceWidth || !sourceHeight) {
      if (source.close) source.close();
      throw new Error("One of the homework images has invalid dimensions.");
    }

    const rotation = ((Number(item.rotation || 0) % 360) + 360) % 360;
    const quarterTurns = Math.round(rotation / 90) % 4;
    const longEdgeLimit = 3200;
    const resizeScale = Math.min(1, longEdgeLimit / Math.max(sourceWidth, sourceHeight));
    const drawW = Math.max(1, Math.round(sourceWidth * resizeScale));
    const drawH = Math.max(1, Math.round(sourceHeight * resizeScale));

    const canvas = document.createElement("canvas");
    if (quarterTurns % 2) {
      canvas.width = drawH;
      canvas.height = drawW;
    } else {
      canvas.width = drawW;
      canvas.height = drawH;
    }

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("This browser could not prepare the homework image.");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (quarterTurns === 1) {
      ctx.translate(canvas.width, 0);
      ctx.rotate(Math.PI / 2);
    } else if (quarterTurns === 2) {
      ctx.translate(canvas.width, canvas.height);
      ctx.rotate(Math.PI);
    } else if (quarterTurns === 3) {
      ctx.translate(0, canvas.height);
      ctx.rotate(-Math.PI / 2);
    }

    ctx.drawImage(source, 0, 0, drawW, drawH);
    if (source.close) source.close();

    const isPng = item.file.type === "image/png";
    const mime = isPng ? "image/png" : "image/jpeg";
    const format = isPng ? "PNG" : "JPEG";
    const dataUrl = isPng
      ? canvas.toDataURL(mime)
      : canvas.toDataURL(mime, 0.93);

    return {
      dataUrl,
      format,
      width: canvas.width,
      height: canvas.height
    };
  }

  async function loadOrientedImage(file) {
    if ("createImageBitmap" in window) {
      try {
        return await createImageBitmap(file, { imageOrientation: "from-image" });
      } catch (error) {
        // Fall back to the browser image decoder below.
      }
    }

    const dataUrl = await fileToDataUrl(file);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Could not open ${file.name || "the photo"}.`));
      img.src = dataUrl;
    });
  }

  function addHeader(pdf, student, grade, subject, week, detail) {
    const pageW = pdf.internal.pageSize.getWidth();

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(15);
    pdf.text("SNT Homework Submission", 16, 16);

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Student: ${student}`, 16, 23);
    pdf.text(`Grade: ${grade}`, 16, 29);
    pdf.text(`Subject: ${subject}`, 16, 35);
    pdf.text(`Term 4 activity: ${week}`, 16, 41);
    pdf.text(detail, 16, 47);

    pdf.setDrawColor(210);
    pdf.line(16, 51, pageW - 16, 51);
    return 57;
  }

  function addImageHeader(pdf, student, grade, subject, week, detail) {
    const pageW = pdf.internal.pageSize.getWidth();

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text("SNT Homework Submission", 10, 10);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    const meta = `${student} • Grade ${grade} • ${subject} • Term 4 ${week} • ${detail}`;
    const metaLines = pdf.splitTextToSize(meta, pageW - 20);
    pdf.text(metaLines, 10, 15);

    const lineY = 15 + (metaLines.length * 3.8) + 1;
    pdf.setDrawColor(210);
    pdf.line(10, lineY, pageW - 10, lineY);
    return lineY + 4;
  }

  function postToDrive(payload) {
    const endpoint = String(window.SNT_HOMEWORK_UPLOAD_ENDPOINT || "").trim();
    if (!endpoint) throw new Error("Drive upload endpoint is not configured.");

    const postForm = document.createElement("form");
    postForm.method = "POST";
    postForm.action = endpoint;
    postForm.style.display = "none";

    for (const [name, value] of Object.entries(payload)) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = String(value ?? "");
      postForm.appendChild(input);
    }

    document.body.appendChild(postForm);
    postForm.submit();
  }

  function buildFileName(student, grade, subject, week, date) {
    return `${date}__Grade-${grade}__${safeName(subject)}__${safeName(week)}__${safeName(student)}.pdf`;
  }

  function safeName(value) {
    return String(value || "")
      .replace(/[\\/:*?"<>|#%{}[\]]+/g, " ")
      .replace(/\s+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "Homework";
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error(`Could not read ${file.name || "the photo"}.`));
      reader.readAsDataURL(file);
    });
  }

  function getImageSize(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("One of the homework images could not be opened."));
      img.src = dataUrl;
    });
  }

  function setBusy(isBusy, label) {
    submitBtn.disabled = isBusy;
    submitBtn.textContent = label;
  }

  function showMessage(message, isError = false) {
    formMessage.textContent = message;
    formMessage.classList.remove("hidden", "error", "success");
    if (isError) formMessage.classList.add("error");
  }

  function clearMessage() {
    formMessage.textContent = "";
    formMessage.classList.add("hidden");
    formMessage.classList.remove("error", "success");
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char]));
  }
})();
