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


  /* ---------- A4 pages: no block is cut by a page end ----------
     Each block that would run into the bottom margin of a page is moved to
     the top of the next page (screen only; printing is paginated by the
     browser from a clean copy, see js/printdoc.js). */
  const PAGE_H = 297 * MM_TO_PX, PAGE_PAD = 15 * MM_TO_PX, PAGE_USABLE = PAGE_H - 2 * PAGE_PAD;
  function paginate() {
    if (!sheet) return;
    const kids = Array.from(sheet.children);
    kids.forEach((ch) => {
      if (ch.hasAttribute("data-pg")) { ch.removeAttribute("data-pg"); ch.style.removeProperty("--pg"); if (!ch.getAttribute("style")) ch.removeAttribute("style"); }
    });
    if (sheet.style.zoom) { sheet.style.minHeight = ""; return; } // small screens: continuous sheet
    for (const ch of kids) {
      if (ch.hasAttribute("data-pg")) { ch.removeAttribute("data-pg"); ch.style.removeProperty("--pg"); }
      const top = ch.offsetTop, h = ch.offsetHeight;
      if (h > PAGE_USABLE) continue;
      const idx = Math.floor(top / PAGE_H);
      if (top + h > (idx + 1) * PAGE_H - PAGE_PAD) {
        const prev = ch.previousElementSibling;
        const gap = Math.max(parseFloat(getComputedStyle(ch).marginTop) || 0, prev ? parseFloat(getComputedStyle(prev).marginBottom) || 0 : 0);
        ch.style.setProperty("--pg", (gap + (idx + 1) * PAGE_H + PAGE_PAD - top) + "px");
        ch.setAttribute("data-pg", "1");
      }
    }
    const last = sheet.lastElementChild;
    const bottom = last ? last.offsetTop + last.offsetHeight : 0;
    sheet.style.minHeight = Math.max(1, Math.ceil((bottom + PAGE_PAD) / PAGE_H)) * PAGE_H + "px";
  }

  function close() {
    if (!overlay) return;
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("resize", fitToScreen);
    window.removeEventListener("resize", paginate);
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
    printBtn.addEventListener("click", () => {
      if (window.MathsPrint) window.MathsPrint.print({ title: title || "Document", html: sheet ? sheet.innerHTML : html });
      else window.print();
    });
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
    if (window.MathsShapes) window.MathsShapes.render(sheet);
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
          macros: { "\\cosec": "\\csc" }, // \cosec is the usual Indian-textbook spelling of \csc
          strict: false,
        });
      } catch (e) { /* leave raw text */ }
    }

    fitToScreen();
    paginate();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(paginate);
    window.addEventListener("resize", fitToScreen);
    window.addEventListener("resize", paginate);
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
