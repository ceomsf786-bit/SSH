/**
 * SNT Student Hub
 * Practice Work custom outside-link button wording
 *
 * Teacher can type a custom button name such as:
 * - Open worksheet
 * - Watch lesson
 * - Use calculator
 * - Complete activity
 *
 * No Supabase SQL changes required.
 */

(function () {
  "use strict";

  const LABEL_INPUT_ID = "admPracticeLinkLabel";
  const MARKER_PREFIX = "[[SNT_LINK_LABEL:";
  const MARKER_REGEX =
    /\[\[SNT_LINK_LABEL:([^\]]{1,80})\]\]\s*/i;

  /*
   * Allow only ordinary http:// or https:// links.
   */
  function isValidOutsideLink(value) {
    const link = String(value || "").trim();

    if (!link) return false;

    const lowerLink = link.toLowerCase();

    if (
      lowerLink === "#" ||
      lowerLink === "undefined" ||
      lowerLink === "null" ||
      lowerLink === "about:blank" ||
      lowerLink.startsWith("javascript:")
    ) {
      return false;
    }

    try {
      const url = new URL(link, window.location.href);

      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return false;
      }

      const currentPage =
        window.location.origin + window.location.pathname;

      if (
        url.href === window.location.href ||
        url.href === currentPage
      ) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /*
   * Clean the wording entered by the teacher.
   */
  function cleanButtonLabel(value) {
    return String(value || "")
      .replace(/[\[\]\r\n]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60);
  }

  /*
   * Remove our hidden label marker from Practice Work text.
   */
  function removeLabelMarker(value) {
    return String(value || "")
      .replace(MARKER_REGEX, "")
      .trim();
  }

  /*
   * Read the button label stored inside Practice Work text.
   */
  function getStoredLabel(value) {
    const match = String(value || "").match(MARKER_REGEX);

    return match
      ? cleanButtonLabel(match[1])
      : "";
  }

  /*
   * Add the new textbox beneath the teacher's outside-link field.
   */
  function addTeacherLinkLabelField() {
    if (document.getElementById(LABEL_INPUT_ID)) {
      return;
    }

    const urlInput =
      document.getElementById("admPracticeUrl");

    if (!urlInput) {
      return;
    }

    const urlContainer =
      urlInput.closest("div");

    if (!urlContainer || !urlContainer.parentElement) {
      return;
    }

    const newContainer =
      document.createElement("div");

    newContainer.className = "admin-full";

    newContainer.innerHTML = `
      <label for="${LABEL_INPUT_ID}">
        Outside-link button wording optional
      </label>

      <input
        id="${LABEL_INPUT_ID}"
        type="text"
        maxlength="60"
        placeholder="Example: Open worksheet"
      >

      <div class="hint" style="margin-top:6px">
        Leave blank to use “Open outside resource”.
      </div>
    `;

    urlContainer.parentElement.insertBefore(
      newContainer,
      urlContainer.nextSibling
    );
  }

  /*
   * Add the custom label to the existing Practice Work text
   * immediately before the normal save function runs.
   */
  function wrapPracticeWorkSave() {
    if (
      typeof window.adminSavePracticeWork !== "function" ||
      window.adminSavePracticeWork.sntLabelWrapped
    ) {
      return;
    }

    const originalSave =
      window.adminSavePracticeWork;

    async function wrappedSave() {
      const textInput =
        document.getElementById("admPracticeText");

      const urlInput =
        document.getElementById("admPracticeUrl");

      const labelInput =
        document.getElementById(LABEL_INPUT_ID);

      const originalText =
        removeLabelMarker(textInput?.value || "");

      const outsideUrl =
        String(urlInput?.value || "").trim();

      const buttonLabel =
        cleanButtonLabel(labelInput?.value || "");

      /*
       * Store the label only when an outside link exists.
       */
      if (
        textInput &&
        outsideUrl &&
        buttonLabel
      ) {
        textInput.value =
          `${MARKER_PREFIX}${buttonLabel}]]\n${originalText}`.trim();
      } else if (textInput) {
        textInput.value = originalText;
      }

      try {
        return await originalSave.apply(
          this,
          arguments
        );
      } finally {
        /*
         * Keep the hidden marker out of the visible teacher textbox
         * if saving fails.
         */
        if (
          textInput &&
          textInput.value.includes(MARKER_PREFIX)
        ) {
          textInput.value =
            removeLabelMarker(textInput.value);
        }
      }
    }

    wrappedSave.sntLabelWrapped = true;

    window.adminSavePracticeWork =
      wrappedSave;
  }

  /*
   * Clear the custom-label field whenever the teacher clears
   * the Practice Work form.
   */
  function wrapPracticeWorkClear() {
    if (
      typeof window.adminClearPracticeForm !== "function" ||
      window.adminClearPracticeForm.sntLabelWrapped
    ) {
      return;
    }

    const originalClear =
      window.adminClearPracticeForm;

    function wrappedClear() {
      const result =
        originalClear.apply(this, arguments);

      const labelInput =
        document.getElementById(LABEL_INPUT_ID);

      if (labelInput) {
        labelInput.value = "";
      }

      return result;
    }

    wrappedClear.sntLabelWrapped = true;

    window.adminClearPracticeForm =
      wrappedClear;
  }

  /*
   * Update each student Practice Work card.
   */
  function updateStudentPracticeCards() {
    document
      .querySelectorAll(".practice-card")
      .forEach((card) => {
        const textArea =
          card.querySelector(".sub");

        let customLabel = "";

        if (textArea) {
          const fullText =
            String(textArea.textContent || "");

          customLabel =
            getStoredLabel(fullText);

          const cleanText =
            removeLabelMarker(fullText);

          if (cleanText) {
            textArea.textContent = cleanText;
          } else {
            textArea.remove();
          }
        }

        const outsideButton =
          card.querySelector("a.practice-link");

        if (!outsideButton) {
          return;
        }

        const outsideUrl =
          outsideButton.getAttribute("href") || "";

        /*
         * No proper link means no button.
         */
        if (!isValidOutsideLink(outsideUrl)) {
          outsideButton.remove();
          return;
        }

        const buttonText =
          customLabel || "Open outside resource";

        outsideButton.textContent =
          `${buttonText} ↗`;
      });
  }

  /*
   * Hide the internal marker from the teacher's Practice Work table.
   */
  function cleanTeacherPracticeTable() {
    document
      .querySelectorAll(
        "#adminPracticeTable tbody tr td:nth-child(6)"
      )
      .forEach((cell) => {
        const cleanText =
          removeLabelMarker(cell.textContent || "");

        cell.textContent = cleanText;
      });
  }

  function runFixes() {
    addTeacherLinkLabelField();
    wrapPracticeWorkSave();
    wrapPracticeWorkClear();
    updateStudentPracticeCards();
    cleanTeacherPracticeTable();
  }

  function startFix() {
    runFixes();

    const observer =
      new MutationObserver(() => {
        runFixes();
      });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      startFix,
      { once: true }
    );
  } else {
    startFix();
  }
})();
