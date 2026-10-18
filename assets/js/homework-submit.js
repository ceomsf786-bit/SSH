(() => {
  const STUDENTS = {
    "MD12": 12,
    "RG11": 11,
    "UI11": 11,
    "ARA10": 10,
    "IS10": 10,
    "NM10": 10,
    "YVDP10": 10,
    "ZA10": 10,
    "AV09": 9,
    "MD09": 9,
    "Test09": 9,
    "FS06": 6
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
  const gradeSelect = $("gradeSelect");
  const studentSelect = $("studentSelect");
  const subjectSelect = $("subjectSelect");
  const weekSelect = $("weekSelect");
  const typedAnswers = $("typedAnswers");
  const cameraInput = $("cameraInput");
  const imageInput = $("imageInput");
  const retakeInput = $("retakeInput");
  const imageList = $("imageList");
  const documentInput = $("documentInput");
  const documentList = $("documentList");
  const submitBtn = $("submitBtn");
  const formMessage = $("formMessage");
  const resultCard = $("resultCard");
  const gradeBadge = $("gradeBadge");

  const maxImages = Number(window.SNT_HOMEWORK_MAX_IMAGES || 8);
  const maxImageBytes = Number(window.SNT_HOMEWORK_MAX_IMAGE_MB || 5) * 1024 * 1024;
  const maxPdfBytes = Number(window.SNT_HOMEWORK_MAX_PDF_MB || 10) * 1024 * 1024;
  let selectedImages = [];
  let selectedDocument = null;
  let pendingRetakeIndex = null;
  const visitId = makeVisitId();
  const trackingImages = [];

  function makeVisitId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  }

  // Fire-and-forget telemetry: failed tracking MUST NOT break submission.
  function track(event, student = "", grade = "", subject = "", week = "") {
    const endpoint = String(window.SNT_HOMEWORK_UPLOAD_ENDPOINT || "").trim();
    if (!endpoint) return;
    const u = new URL(endpoint);
    u.searchParams.set("action", "track");
    u.searchParams.set("upload_key", UPLOAD_KEY);
    u.searchParams.set("event", event);
    u.searchParams.set("visit_id", visitId);
    if (student) u.searchParams.set("student", student);
    if (grade) u.searchParams.set("grade", String(grade));
    if (subject) u.searchParams.set("subject", subject);
    if (week) u.searchParams.set("week", week);
    const ping = new Image();
    trackingImages.push(ping);
    const remove = () => { const i = trackingImages.indexOf(ping); if (i >= 0) trackingImages.splice(i, 1); };
    ping.onload = remove;
    ping.onerror = remove;
    ping.src = u.toString();
  }

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

    track("page_open");
    gradeSelect.addEventListener("change", handleGradeChange);
    studentSelect.addEventListener("change", handleStudentChange);
    cameraInput.addEventListener("change", () => addSelectedImages(cameraInput));
    imageInput.addEventListener("change", () => addSelectedImages(imageInput));
    retakeInput.addEventListener("change", handleRetakeSelection);
    imageList.addEventListener("click", handleImageAction);
    documentInput.addEventListener("change", handleDocumentSelection);
    form.addEventListener("submit", handleSubmit);
  }

  function handleGradeChange() {
    const grade = Number(gradeSelect.value || 0);
    gradeBadge.textContent = grade ? `Grade ${grade}` : "Choose grade";

    subjectSelect.disabled = true;
    subjectSelect.innerHTML = `<option value="">Choose student first</option>`;

    if (!grade) {
      studentSelect.disabled = true;
      studentSelect.innerHTML = `<option value="">Choose grade first</option>`;
      return;
    }

    const names = Object.keys(STUDENTS)
      .filter((name) => STUDENTS[name] === grade)
      .sort((a, b) => a.localeCompare(b));

    studentSelect.disabled = false;
    studentSelect.innerHTML = `<option value="">Choose your name</option>` +
      names.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
  }

  function handleStudentChange() {
    const student = studentSelect.value;
    const grade = Number(gradeSelect.value || 0);

    if (!student || !grade || STUDENTS[student] !== grade) {
      subjectSelect.disabled = true;
      subjectSelect.innerHTML = `<option value="">Choose student first</option>`;
      return;
    }

    gradeBadge.textContent = `Grade ${grade}`;
    track("student_selected", student, grade);

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

  function handleDocumentSelection() {
    clearMessage();
    const file = (documentInput.files || [])[0] || null;

    if (!file) {
      selectedDocument = null;
      renderSelectedDocument();
      return;
    }

    try {
      validateDocument(file);
      selectedDocument = file;
      renderSelectedDocument();
    } catch (error) {
      selectedDocument = null;
      documentInput.value = "";
      renderSelectedDocument();
      showMessage(error.message || "This document cannot be used.", true);
    }
  }

  function renderSelectedDocument() {
    if (!selectedDocument) {
      documentList.innerHTML = "";
      return;
    }

    documentList.innerHTML = `
      <div class="file-row">
        <span>📄 ${escapeHtml(selectedDocument.name || "Homework document")}</span>
        <span>${formatBytes(selectedDocument.size)}</span>
      </div>
    `;
  }

  function validateDocument(file) {
    const name = String(file.name || "").toLowerCase();
    const allowedExt = [".pdf", ".doc", ".docx"].some((ext) => name.endsWith(ext));
    const allowedMime = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ].includes(file.type);

    if (!allowedExt && !allowedMime) {
      throw new Error("Please upload a PDF, DOC or DOCX file.");
    }

    if (file.size > maxPdfBytes) {
      throw new Error(`${file.name || "The document"} is too large. Keep it under ${window.SNT_HOMEWORK_MAX_PDF_MB || 10} MB.`);
    }
  }

  function documentMimeType(file) {
    const name = String(file.name || "").toLowerCase();
    if (file.type) return file.type;
    if (name.endsWith(".pdf")) return "application/pdf";
    if (name.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (name.endsWith(".doc")) return "application/msword";
    return "application/octet-stream";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    clearMessage();

    const chosenGrade = Number(gradeSelect.value || 0);
    const student = studentSelect.value.trim();
    const grade = STUDENTS[student];
    const subject = subjectSelect.value.trim();
    const week = weekSelect.value.trim();
    const text = typedAnswers.value.trim();
    const images = selectedImages.map((item) => ({ ...item }));
    const documentFile = selectedDocument;

    if (!chosenGrade) return showMessage("Choose your grade.", true);
    if (!student || !grade || grade !== chosenGrade) return showMessage("Choose your name.", true);
    if (!subject) return showMessage("Choose your subject.", true);
    if (!week) return showMessage("Choose the homework week.", true);
    if (!text && !images.length && !documentFile) {
      return showMessage("Type answers, take photos, add images, or upload a PDF/Word document.", true);
    }
    if (documentFile && (text || images.length)) {
      return showMessage("Please use either the PDF/Word upload OR typed answers/photos for one submission.", true);
    }

    validateImages(images.map((item) => item.file));
    if (documentFile) validateDocument(documentFile);

    try {
      const today = new Date().toISOString().slice(0, 10);
      track("submission_attempt", student, grade, subject, week);

      if (documentFile) {
        setBusy(true, "Preparing document...");
        const dataUrl = await fileToDataUrl(documentFile);
        const base64 = dataUrl.split(",")[1] || "";
        const approxBytes = Math.ceil(base64.length * 3 / 4);

        if (!base64 || approxBytes > maxPdfBytes) {
          throw new Error(`The document is too large. Keep it under ${window.SNT_HOMEWORK_MAX_PDF_MB || 10} MB.`);
        }

        setBusy(true, "Sending to Drive...");
        postToDrive({
          grade: String(grade),
          subject,
          task: week,
          student,
          activity_date: today,
          submission_mode: "document",
          upload_key: UPLOAD_KEY,
          visit_id: visitId,
          file_name: documentFile.name,
          mime_type: documentMimeType(documentFile),
          file_base64: base64
        });
        return;
      }

      setBusy(true, "Preparing PDF...");
      const pdfData = await buildCombinedPdf({ student, grade, subject, week, text, images });
      const base64 = pdfData.split(",")[1] || "";
      const approxBytes = Math.ceil(base64.length * 3 / 4);

      if (!base64 || approxBytes > maxPdfBytes) {
        throw new Error(`The final PDF is too large. Keep it under ${window.SNT_HOMEWORK_MAX_PDF_MB || 10} MB.`);
      }

      setBusy(true, "Sending to Drive...");
      postToDrive({
        grade: String(grade),
        subject,
        task: week,
        student,
        activity_date: today,
        submission_mode: text && images.length ? "text+images" : text ? "typed" : "images",
        upload_key: UPLOAD_KEY,
        visit_id: visitId,
        file_name: buildFileName(student, grade, subject, week, today),
        mime_type: "application/pdf",
        file_base64: base64
      });
    } catch (error) {
      track("client_error", student, grade, subject, week);
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
