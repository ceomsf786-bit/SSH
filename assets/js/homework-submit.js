(() => {
  const STUDENTS = {
    "RG 11": 11,
    "IS 10": 10,
    "AV09": 9,
    "MD09": 9,
    "FS06": 6
  };

  const SUBJECTS = {
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
  const $ = (id) => document.getElementById(id);

  const form = $("submissionForm");
  const studentSelect = $("studentSelect");
  const subjectSelect = $("subjectSelect");
  const weekSelect = $("weekSelect");
  const typedAnswers = $("typedAnswers");
  const imageInput = $("imageInput");
  const imageList = $("imageList");
  const submitBtn = $("submitBtn");
  const formMessage = $("formMessage");
  const resultCard = $("resultCard");
  const gradeBadge = $("gradeBadge");

  const maxImages = Number(window.SNT_HOMEWORK_MAX_IMAGES || 8);
  const maxImageBytes = Number(window.SNT_HOMEWORK_MAX_IMAGE_MB || 5) * 1024 * 1024;
  const maxPdfBytes = Number(window.SNT_HOMEWORK_MAX_PDF_MB || 10) * 1024 * 1024;

  init();

  function init() {
    studentSelect.addEventListener("change", handleStudentChange);
    imageInput.addEventListener("change", renderSelectedImages);
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

  function renderSelectedImages() {
    const files = Array.from(imageInput.files || []);
    imageList.innerHTML = files.map((file) => `
      <div class="file-row">
        <span>${escapeHtml(file.name)}</span>
        <span>${formatBytes(file.size)}</span>
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
    const files = Array.from(imageInput.files || []);

    if (!student || !grade) return showMessage("Choose your name.", true);
    if (!subject) return showMessage("Choose your subject.", true);
    if (!week) return showMessage("Choose the homework week.", true);
    if (!text && !files.length) return showMessage("Type answers, add images, or use both.", true);

    validateImages(files);

    try {
      setBusy(true, "Preparing PDF...");
      const pdfData = await buildCombinedPdf({ student, grade, subject, week, text, files });
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
        submission_mode: text && files.length ? "text+images" : text ? "typed" : "images",
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
        throw new Error("Only JPG and PNG images are allowed.");
      }
      if (file.size > maxImageBytes) {
        throw new Error(`${file.name} is too large. Keep each image under ${window.SNT_HOMEWORK_MAX_IMAGE_MB || 5} MB.`);
      }
    }
  }

  async function buildCombinedPdf({ student, grade, subject, week, text, files }) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    let hasContent = false;

    if (text) {
      let y = addHeader(pdf, student, grade, subject, week, "Typed answers / notes");
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
      const lines = pdf.splitTextToSize(text, 178);
      for (const line of lines) {
        if (y > 282) {
          pdf.addPage();
          y = addHeader(pdf, student, grade, subject, week, "Typed answers / notes (continued)");
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(11);
        }
        pdf.text(line, 16, y);
        y += 6;
      }
      hasContent = true;
    }

    for (let i = 0; i < files.length; i++) {
      if (hasContent || i > 0) pdf.addPage();
      const yStart = addHeader(pdf, student, grade, subject, week, `Homework image ${i + 1} of ${files.length}`);
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
      hasContent = true;
    }

    return pdf.output("datauristring");
  }

  function addHeader(pdf, student, grade, subject, week, detail) {
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
    pdf.line(16, 51, 194, 51);
    return 57;
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
