/**
 * SNT Student Hub
 * Practice Work outside-link button fix
 *
 * Hides the "Open outside resource" button when no proper
 * outside link was entered by the teacher.
 */

(function () {
  "use strict";

  const BUTTON_TEXT = "open outside resource";

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

  function removeEmptyOutsideLinkButtons(root = document) {
    const elements = root.querySelectorAll
      ? root.querySelectorAll("a, button")
      : [];

    elements.forEach((element) => {
      const buttonText = String(element.textContent || "")
        .trim()
        .toLowerCase();

      if (!buttonText.includes(BUTTON_TEXT)) {
        return;
      }

      const outsideLink =
        element.getAttribute("href") ||
        element.dataset.url ||
        element.dataset.href ||
        "";

      if (!isValidOutsideLink(outsideLink)) {
        element.remove();
      }
    });
  }

  function startPracticeWorkLinkFix() {
    removeEmptyOutsideLinkButtons();

    const observer = new MutationObserver((changes) => {
      changes.forEach((change) => {
        change.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) {
            return;
          }

          removeEmptyOutsideLinkButtons(node);
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      startPracticeWorkLinkFix,
      { once: true }
    );
  } else {
    startPracticeWorkLinkFix();
  }
})();
