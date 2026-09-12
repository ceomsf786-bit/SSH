(() => {
  const params = new URLSearchParams(window.location.search);
  const grade = Number(params.get("grade"));
  const subject = String(params.get("subject") || "").trim();
  const task = String(params.get("task") || "").trim();
  const uploadKey = String(params.get("key") || "").trim();
  const status = String(params.get("status") || "").trim();
  const returnedStudent = String(params.get("student") || "").trim();
  const returnedDate = String(params.get("date") || "").trim();
  const returnedMessage = String(params.get("message") || "").trim();

  const $ = (id) => document.getElementById(id);
  const form = $("submissionForm");
  const setupError = $("setupError");
  const resultCard = $("resultCard");
  const studentSelect = $("studentSelect");
  const activityDate = $("activityDate");
  const imageInput = $("imageInput");
  const typedAnswers = $("typedAnswers");
  const imagePanel = $("imagePanel");
  const typedPanel = $("typedPanel");
  const imageList = $("imageList");
  const submitBtn = $("submitBtn");
  const formMessage = $("formMessage");

  const maxImages = Number(window.SNT_HOMEWORK_MAX_IMAGES || 8);
  const maxImageBytes = Number(window.SNT_HOMEWORK_MAX_IMAGE_MB || 5) * 1024 * 1024;
  const maxPdfBytes = Number(window.SNT_HOMEWORK_MAX_PDF_MB || 10) * 1024 * 1024;

  init();

  async function init() {
    renderContext();

    if (!Number.isInteger(grade) || grade < 4 || grade > 12 || !subject) {
      showSetupError("This submission link is incomplete. Please open it from the homework document or Student Hub.");
      return;
    }

    if (status) {
      renderReturnedStatus();
      if (status === "success" || status === "duplicate") return;
    }

    if (!window.SNT_HOMEWORK_UPLOAD_ENDPOINT) {
      showSetupError("Homework upload is not connected to Drive yet. Please tell your teacher.");
      return;
    }

    if (!uploadKey) {
      showSetupError("This homework link is missing its submission key. Please open the original homework link again.");
      return;
    }

    if (!window.sb || typeof window.sb.rpc !== "function") {
      showSetupError("Student list connection is unavailable. Please tell your teacher.");
      return;
    }

    form.classList.remove("hidden");
    bindEvents();
    await loadStudents();
  }

  function renderContext() {
    $("contextBox").classList.remove("hidden");
    $("gradeBadge").textContent = Number.isInteger(grade) ? `Grade ${grade}` : "Grade missing";
    $("subjectBadge").textContent = subject || "Subject missing";
    if (task) {
      $("taskBadge").textContent = task;
      $("taskBadge").classList.remove("hidden");
    }
  }

  function renderReturnedStatus() {
    resultCard.classList.remove("hidden");
    if (status === "success") {
      resultCard.innerHTML = `
        <h2>✅ Homework submitted</h2>
        <p><strong>${escapeHtml(returnedStudent || "Student")}</strong>, your ${escapeHtml(subject)} homework has been sent successfully.</p>
        <p>Homework date: <strong>${escapeHtml(returnedDate || "-")}</strong></p>
        <p>You cannot submit this same homework again.</p>
      `;
      rememberSubmitted(returnedStudent, returnedDate);
      return;
    }
    if (status === "duplicate") {
      resultCard.classList.add("error");
      resultCard.innerHTML = `
        <h2>Already submitted</h2>
        <p>This homework has already been handed in for <strong>${escapeHtml(returnedStudent || "this student")}</strong>.</p>
        <p>If the wrong work was sent, ask your teacher to reset it.</p>
      `;
      return;
    }
    resultCard.classList.add("error");
    resultCard.innerHTML = `
      <h2>Submission not completed</h2>
      <p>${escapeHtml(returnedMessage || "Please check the details and try again.")}</p>
    `;
  }

  function showSetupError(message) {
    setupError.textContent = message;
    setupError.classList.remove("hidden");
  }

  function bindEvents() {
    document.querySelectorAll('input[name="submissionMode"]').forEach((radio) => {
      radio.addEventListener("change", renderMode);
    });
    imageInput.addEventListener("change", renderSelectedImages);
    studentSelect.addEventListener("change", checkLocalDuplicate);
    activityDate.addEventListener("change", checkLocalDuplicate);
    form.addEventListener("submit", handleSubmit);
    renderMode();
  }

  async function loadStudents() {
    studentSelect.innerHTML = `<option value="">Loading students...</option>`;
    const { data, error } = await window.sb.rpc("list_grade_students", { p_grade: grade });
    if (error) {
      studentSelect.innerHTML = `<option value="">Could not load students</option>`;
      showFormMessage(`Could not load student names: ${error.message}`, true);
      return;
    }
    const names = (data || [])
      .map((row) => String(row.full_name || "").trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    if (!names.length) {
      studentSelect.innerHTML = `<option value="">No students found for Grade ${grade}</option>`;
      return;
    }
    studentSelect.innerHTML =
      `<option value="">Choose your name</option>` +
      names.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
  }

  function renderMode() {
    const mode = selectedMode();
    imagePanel.classList.toggle("hidden", mode !== "images");
    typedPanel.classList.toggle("hidden", mode !== "typed");
    clearFormMessage();
  }

  function selectedMode() {
    return document.querySelector('input[name="submissionMode"]:checked')?.value || "images";
  }

  function renderSelectedImages() {
    const files = Array.from(imageInput.files || []);
    imageList.innerHTML = files.map((file) => `
      <div class="file-row">
        <span>${escapeHtml(file.name)}</span>
        <span>${formatBytes(file.size)}</span>
      </div>
    `).join("");
  }

  function checkLocalDuplicate() {
    clearFormMessage();
    const student = studentSelect.value;
    const date = activityDate.value;
    if (!student || !date) return;
    if (localStorage.getItem(submissionStorageKey(student, date)) === "1") {
      showFormMessage("This homework was already submitted from this device. Ask your teacher if you need a reset.", true);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    clearFormMessage();

    const student = studentSelect.value.trim();
    const date = activityDate.value;
    const mode = selectedMode();

    if (!student) return showFormMessage("Choose your name.", true);
    if (!date) return showFormMessage("Choose the date the homework was given.", true);

    if (localStorage.getItem(submissionStorageKey(student, date)) === "1") {
      return showFormMessage("This homework was already submitted from this device.", true);
    }

    try {
      setBusy(true, "Preparing PDF...");
      let pdfData;

      if (mode === "typed") {
        const text = typedAnswers.value.trim();
        if (!text) throw new Error("Type your answers before submitting.");
        pdfData = buildTypedPdf(student, date, text);
      } else {
        const files = Array.from(imageInput.files || []);
        validateImages(files);
        pdfData = await buildImagePdf(student, date, files);
      }

      const base64 = pdfData.split(",")[1] || "";
      const approxBytes = Math.ceil(base64.length * 3 / 4);
      if (!base64 || approxBytes > maxPdfBytes) {
        throw new Error(`The final PDF is too large. Keep it under ${window.SNT_HOMEWORK_MAX_PDF_MB || 10} MB.`);
      }

      setBusy(true, "Sending to Drive...");
      postToDrive({
        grade: String(grade),
        subject,
        task,
        student,
        activity_date: date,
        submission_mode: mode,
        upload_key: uploadKey,
        file_name: buildFileName(student, date),
        mime_type: "application/pdf",
        file_base64: base64
      });
    } catch (error) {
      setBusy(false, "Submit homework");
      showFormMessage(error.message || "Could not prepare submission.", true);
    }
  }

  function validateImages(files) {
    if (!files.length) throw new Error("Add at least one homework photo.");
    if (files.length > maxImages) throw new Error(`Please submit no more than ${maxImages} images.`);
    for (const file of files) {
      if (!["image/jpeg", "image/png"].includes(file.type)) {
        throw new Error("Only JPG and PNG images are allowed.");
      }
      if (file.size > maxImageBytes) {
        throw new Error(`${file.name} is too large. Keep each image under ${window.SNT_HOMEWORK_MAX_IMAGE_MB || 5} MB.`);
      }
    }
  }

  function buildTypedPdf(student, date, text) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    const left = 16;
    let y = addPdfHeader(pdf, student, date, "Typed answers");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);

    const lines = pdf.splitTextToSize(text, 178);
    for (const line of lines) {
      if (y > 282) {
        pdf.addPage();
        y = addPdfHeader(pdf, student, date, "Typed answers (continued)");
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(11);
      }
      pdf.text(line, left, y);
      y += 6;
    }
    return pdf.output("datauristring");
  }

  async function buildImagePdf(student, date, files) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: "mm", format: "a4" });

    for (let i = 0; i < files.length; i++) {
      if (i > 0) pdf.addPage();
      const yStart = addPdfHeader(pdf, student, date, `Homework photo ${i + 1} of ${files.length}`);
      const dataUrl = await fileToDataUrl(files[i]);
      const size = await getImageSize(dataUrl);

      const marginX = 12;
      const bottomMargin = 12;
      const maxW = 210 - marginX * 2;
      const maxH = 297 - yStart - bottomMargin;
      const scale = Math.min(maxW / size.width, maxH / size.height);
      const w = size.width * scale;
      const h = size.height * scale;
      const x = (210 - w) / 2;
      const format = files[i].type === "image/png" ? "PNG" : "JPEG";
      pdf.addImage(dataUrl, format, x, yStart, w, h, undefined, "FAST");
    }
    return pdf.output("datauristring");
  }

  function addPdfHeader(pdf, student, date, detail) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(15);
    pdf.text("SNT Homework Submission", 16, 16);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Student: ${student}`, 16, 23);
    pdf.text(`Grade: ${grade}    Subject: ${subject}`, 16, 29);
    pdf.text(`Homework date: ${date}${task ? `    Activity: ${task}` : ""}`, 16, 35);
    pdf.text(detail, 16, 41);
    pdf.setDrawColor(210);
    pdf.line(16, 45, 194, 45);
    return 51;
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

  function buildFileName(student, date) {
    const taskPart = task ? `__${safeName(task)}` : "";
    return `${date}__Grade-${grade}__${safeName(subject)}${taskPart}__${safeName(student)}.pdf`;
  }

  function submissionStorageKey(student, date) {
    return `snt-hw-submitted:${grade}:${subject}:${task}:${date}:${student}`;
  }

  function rememberSubmitted(student, date) {
    if (student && date) localStorage.setItem(submissionStorageKey(student, date), "1");
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
      reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
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

  function showFormMessage(message, isError = false) {
    formMessage.textContent = message;
    formMessage.classList.remove("hidden", "error", "success");
    if (isError) formMessage.classList.add("error");
  }

  function clearFormMessage() {
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
