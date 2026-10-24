/* ============================================================
   MathsLearn — Full-screen A4 "PDF view"
   MathsReader.open({ title, html, onClose }) shows the content on
   real A4-sized white sheets (210 x 297 mm, 15 mm margins — the same
   margins used by @page when printing), full screen, with an Exit
   button pinned at the top. Used by content pages and the admin
   editor preview, so what you see here is what the PDF looks like.
   ============================================================ */
(function () {
  "use strict";

  const MM_TO_PX = 96 / 25.4;          // CSS: 1in = 96px = 25.4mm
  const SHEET_W = 210 * MM_TO_PX;      // A4 width in px
  let overlay = null;
  let sheet = null;
  let onCloseCb = null;

  function fitToScreen() {
    if (!sheet) return;
    const avail = window.innerWidth - 24;
    const scale = Math.min(1, avail / SHEET_W);
    sheet.style.zoom = scale < 1 ? String(scale) : "";
  }

  function close() {
    if (!overlay) return;
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("resize", fitToScreen);
    document.removeEventListener("fullscreenchange", onFsChange);
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    overlay.remove();
    overlay = sheet = null;
    document.body.classList.remove("reader-open");
    document.documentElement.style.overflow = "";
    const cb = onCloseCb; onCloseCb = null;
    if (cb) cb();
  }

  function onKey(e) { if (e.key === "Escape") close(); }
  // If the browser leaves fullscreen (Esc / swipe), also leave reader.
  function onFsChange() { if (!document.fullscreenElement) close(); }

  function open({ title = "", html = "", onClose = null, math = true, download = true } = {}) {
    if (overlay) close();
    onCloseCb = onClose;

    overlay = document.createElement("div");
    overlay.className = "reader-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "Full screen document view");

    const bar = document.createElement("div");
    bar.className = "reader-bar";
    const t = document.createElement("span");
    t.className = "reader-title";
    t.textContent = title || "Document";
    const actions = document.createElement("div");
    actions.className = "reader-actions";
    const printBtn = document.createElement("button");
    printBtn.type = "button";
    printBtn.className = "reader-btn";
    printBtn.textContent = "⬇ Download PDF";
    printBtn.addEventListener("click", () => window.print());
    const exitBtn = document.createElement("button");
    exitBtn.type = "button";
    exitBtn.className = "reader-btn reader-exit";
    exitBtn.textContent = "✕ Exit";
    exitBtn.addEventListener("click", close);
    if (download) actions.append(printBtn);
    actions.append(exitBtn);
    bar.append(t, actions);

    const scroller = document.createElement("div");
    scroller.className = "reader-scroll";
    sheet = document.createElement("div");
    sheet.className = "reader-sheet article-body";
    sheet.innerHTML = html;
    // Read-only, and no interactive-only controls inside the sheet.
    sheet.querySelectorAll("[contenteditable]").forEach((n) => n.removeAttribute("contenteditable"));
    sheet.querySelectorAll("button, [data-print-source]").forEach((n) => {
      if (n.hasAttribute("data-print-source")) {
        const url = window.location.origin + window.location.pathname;
        n.textContent = "Downloaded from " + url + " — MathsLearn.online";
      } else n.remove();
    });
    scroller.appendChild(sheet);
    overlay.append(bar, scroller);
    document.body.appendChild(overlay);
    document.body.classList.add("reader-open");
    document.documentElement.style.overflow = "hidden";

    if (math && typeof window.renderMathInElement === "function") {
      try {
        window.renderMathInElement(sheet, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false },
          ],
          throwOnError: false,
        });
      } catch (e) { /* leave raw text */ }
    }

    fitToScreen();
    window.addEventListener("resize", fitToScreen);
    document.addEventListener("keydown", onKey);
    exitBtn.focus();

    // Real full screen where the browser allows it (not iPhone Safari —
    // there the overlay still fills the whole window).
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().then(() => {
        document.addEventListener("fullscreenchange", onFsChange);
      }).catch(() => {});
    }
  }

  window.MathsReader = { open, close };
})();
