/* ============================================================
   MathsLearn Admin — Content Editor
   Vanilla JS, contenteditable-based rich text editor with:
   - toolbar formatting (bold/italic/underline/headings/lists)
   - inline ($...$) and block ($$...$$) math, rendered via KaTeX
     in the live preview pane
   - formula / solved-example insert blocks
   - debounced autosave to the Pages API + localStorage backup
     (so a refresh never loses work)
   - word/character count, undo/redo
   ============================================================ */

(async function () {
  "use strict";

  const user = await MathsLearnAuth.requireAuth();
  if (!user) return;

  document.getElementById("logout-btn").addEventListener("click", () => MathsLearnAuth.logout());

  const params = new URLSearchParams(window.location.search);
  let contentId = params.get("id"); // null = creating new content
  let slugManuallyEdited = false;
  let lastSavedSnapshot = "";
  let currentStatus = "draft"; // status the server currently holds for this item

  const els = {
    title: document.getElementById("f-title"),
    slug: document.getElementById("f-slug"),
    type: document.getElementById("f-type"),
    level: document.getElementById("f-level"),
    subject: document.getElementById("f-subject"),
    chapter: document.getElementById("f-chapter"),
    language: document.getElementById("f-language"),
    seoTitle: document.getElementById("f-seo-title"),
    metaDesc: document.getElementById("f-meta-desc"),
    surface: document.getElementById("editor-surface"),
    statusPill: document.getElementById("status-pill"),
    saveStatus: document.getElementById("save-status"),
    saveStatusText: document.getElementById("save-status-text"),
    wordCount: document.getElementById("word-count"),
    charCount: document.getElementById("char-count"),
    previewPane: document.getElementById("preview-pane"),
    previewContent: document.getElementById("preview-content"),
    btnTogglePreview: document.getElementById("btn-toggle-preview"),
    topbarTitle: document.getElementById("editor-topbar-title"),
  };

  const LOCAL_KEY = `mathslearn-draft-${contentId || "new"}`;

  /* ---------- Slug helper ---------- */
  function slugify(text) {
    const base = (text || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\u0900-\u097F\s-]/g, "") // keep Devanagari range too
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    // Fallback for titles that slugify to nothing (e.g. pure non-Latin
    // scripts your regex above doesn't cover, or emoji-only titles):
    // use a short timestamp-based slug instead of publishing an empty URL.
    return base || `content-${Date.now().toString(36)}`;
  }

  /* ---------- URL of this item: /{type}/{level}/{slug}/ ---------- */
  const slugPrefixEl = document.getElementById("slug-prefix");
  const urlBox = document.getElementById("editor-url");
  const urlLabel = document.getElementById("editor-url-label");
  const urlLink = document.getElementById("editor-url-link");

  function updateSlugPrefix() {
    if (slugPrefixEl) slugPrefixEl.textContent = `${els.type.value}/${els.level.value}`;
  }
  function currentItem() {
    return {
      id: contentId, status: currentStatus, content_type: els.type.value,
      level: els.level.value, slug: els.slug.value.trim() || slugify(els.title.value),
    };
  }
  function updateLiveUrl() {
    if (!contentId || !urlBox) { if (urlBox) urlBox.hidden = true; return; }
    const item = currentItem();
    urlBox.hidden = false;
    if (currentStatus === "published") {
      urlLabel.textContent = "🔗 Live link:";
      urlLink.textContent = MathsLearnAuth.publicUrl(item);
      urlLink.href = MathsLearnAuth.viewHref(item);
    } else {
      urlLabel.textContent = "👁 Private preview (not public yet):";
      urlLink.textContent = "open preview";
      urlLink.href = MathsLearnAuth.viewHref(item);
    }
  }
  document.getElementById("btn-copy-url").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const ok = await MathsLearnAuth.copyText(MathsLearnAuth.publicUrl(currentItem()));
    if (ok) { const old = btn.textContent; btn.textContent = "Copied ✓"; setTimeout(() => (btn.textContent = old), 1500); }
  });
  [els.type, els.level, els.slug].forEach((el) => {
    el.addEventListener("input", () => { updateSlugPrefix(); updateLiveUrl(); });
    el.addEventListener("change", () => { updateSlugPrefix(); updateLiveUrl(); });
  });
  updateSlugPrefix();

  els.title.addEventListener("input", () => {
    els.topbarTitle.textContent = els.title.value.trim() || "New Content";
    if (!slugManuallyEdited) els.slug.value = slugify(els.title.value);
  });
  els.slug.addEventListener("input", () => { slugManuallyEdited = true; });

  try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch (e) { /* ignore */ }

  /* ---------- Toolbar: formatting ---------- */
  document.querySelectorAll("[data-cmd]").forEach((btn) => {
    btn.addEventListener("click", () => {
      els.surface.focus();
      document.execCommand(btn.dataset.cmd, false, null);
      scheduleAutosave();
    });
  });
  document.querySelectorAll("[data-block]").forEach((btn) => {
    btn.addEventListener("click", () => {
      els.surface.focus();
      document.execCommand("formatBlock", false, btn.dataset.block);
      scheduleAutosave();
    });
  });
  document.getElementById("btn-undo").addEventListener("click", () => { els.surface.focus(); document.execCommand("undo"); });
  document.getElementById("btn-redo").addEventListener("click", () => { els.surface.focus(); document.execCommand("redo"); });
  document.getElementById("btn-clear-format").addEventListener("click", () => {
    els.surface.focus();
    document.execCommand("removeFormat");
    scheduleAutosave();
  });

  /* ---------- Wrap the current selection in a <span> ----------
     Used for text size, text color and highlight — a small, robust
     helper instead of relying on the old execCommand('fontSize'/
     'foreColor'/'hiliteColor'), which produces messy, inconsistent
     markup across browsers. */
  function wrapSelection({ className, style }) {
    els.surface.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !els.surface.contains(sel.anchorNode)) {
      window.alert("Select the text you want to change first, then use this control.");
      return false;
    }
    const range = sel.getRangeAt(0);
    const span = document.createElement("span");
    if (className) span.className = className;
    if (style) Object.assign(span.style, style);
    try {
      range.surroundContents(span);
    } catch (e) {
      // Selection spans multiple elements (e.g. across a bold run) —
      // surroundContents can't wrap that directly, so extract + wrap.
      const frag = range.extractContents();
      span.appendChild(frag);
      range.insertNode(span);
    }
    sel.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    newRange.collapse(false);
    sel.addRange(newRange);
    scheduleAutosave();
    return true;
  }

  /* ---------- Text size: type any number (points) ----------
     Select text and enter e.g. 18, or set it with nothing selected and carry on
     typing. The box also shows the size at the cursor. */
  const sizeInput = document.getElementById("f-size-num");
  function applyFontSize(pt) {
    if (!(pt >= 6 && pt <= 120)) return;
    const fromInput = document.activeElement === sizeInput;
    const saved = lastRange ? lastRange.cloneRange() : null;   // the page selection from before the box was clicked
    els.surface.focus();
    const sel = window.getSelection();
    if (fromInput && saved) { sel.removeAllRanges(); sel.addRange(saved); }
    if (!sel.rangeCount || !els.surface.contains(sel.anchorNode)) return;
    sizeInput.value = pt;
    if (sel.isCollapsed) {                                   // nothing selected: size the text you type next
      const span = document.createElement("span");
      span.style.fontSize = pt + "pt";
      span.appendChild(document.createTextNode("\u200B"));
      sel.getRangeAt(0).insertNode(span);
      const r = document.createRange();
      r.setStart(span.firstChild, 1); r.collapse(true);
      sel.removeAllRanges(); sel.addRange(r);
      scheduleAutosave();
      return;
    }
    if (wrapSelection({ style: { fontSize: pt + "pt" } })) {
      // sizes inside the new span would fight with it — drop them
      els.surface.querySelectorAll('span[style*="font-size"]').forEach((sp) => {
        sp.querySelectorAll('span[style*="font-size"], [class^="text-size-"]').forEach((inner) => {
          inner.style.removeProperty("font-size");
          inner.classList.remove("text-size-sm", "text-size-md", "text-size-lg", "text-size-xl");
        });
      });
    }
  }
  sizeInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); applyFontSize(Number(sizeInput.value)); }
  });
  // choosing a number from the drop-down list (typing + Enter is handled above)
  sizeInput.addEventListener("input", (e) => {
    if (!e.inputType || e.inputType === "insertReplacementText") applyFontSize(Number(sizeInput.value));
  });

  /* ---------- Toolbar shows what is switched ON at the cursor ---------- */
  function currentBlockTag() {
    const sel = window.getSelection();
    if (!sel || !sel.anchorNode || !els.surface.contains(sel.anchorNode)) return null;
    let n = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
    while (n && n.parentElement !== els.surface) n = n.parentElement;
    return n ? n.tagName.toLowerCase() : null;
  }
  function updateToolbarState() {
    const sel = window.getSelection();
    if (!sel || !sel.anchorNode || !els.surface.contains(sel.anchorNode)) return;
    document.querySelectorAll("[data-cmd]").forEach((btn) => {
      let on = false;
      try { on = document.queryCommandState(btn.dataset.cmd); } catch (e) { /* not supported */ }
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", String(on));
    });
    const tag = currentBlockTag();
    document.querySelectorAll("[data-block]").forEach((btn) => {
      const want = btn.dataset.block;
      const on = tag === want || (want === "p" && (tag === "div" || tag === "p"));
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", String(on));
    });
    if (document.activeElement !== sizeInput) {
      const el = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
      if (el) sizeInput.value = Math.round(parseFloat(getComputedStyle(el).fontSize) * 0.75);
    }
  }
  document.addEventListener("selectionchange", updateToolbarState);
  els.surface.addEventListener("keyup", updateToolbarState);
  els.surface.addEventListener("mouseup", updateToolbarState);
  document.querySelectorAll("button.tb-btn").forEach((b) => b.addEventListener("click", () => setTimeout(updateToolbarState, 0)));
  // Clicking a toolbar button must not take the cursor away from the page
  document.querySelectorAll("button.tb-btn").forEach((b) => b.addEventListener("mousedown", (e) => e.preventDefault()));
  // Keyboard shortcuts: Ctrl+, subscript · Ctrl+. superscript (same as Google Docs)
  els.surface.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === "," || e.key === ".")) {
      e.preventDefault();
      document.execCommand(e.key === "," ? "subscript" : "superscript");
      scheduleAutosave(); updateToolbarState();
    }
  });

  /* ---------- Text color / highlight ---------- */
  document.getElementById("f-text-color").addEventListener("input", (e) => {
    wrapSelection({ style: { color: e.target.value } });
  });
  document.getElementById("f-highlight-color").addEventListener("input", (e) => {
    wrapSelection({ style: { backgroundColor: e.target.value, padding: "0 0.15em", borderRadius: "3px" } });
  });

  /* ---------- Fraction (LaTeX, matches the existing $...$ math system) ---------- */
  document.getElementById("btn-fraction").addEventListener("click", () => {
    insertAtCursor(document.createTextNode("$\\frac{a}{b}$"));
    scheduleAutosave();
  });

  /* ---------- Symbols popover ---------- */
  const SYMBOLS = ["π", "½", "⅓", "¼", "¾", "°", "±", "×", "÷", "≤", "≥", "≠", "≈", "√", "∞", "∑", "∫", "Δ", "θ", "α", "β", "λ", "→", "∈"];
  const symbolGrid = document.getElementById("symbol-grid");
  SYMBOLS.forEach((sym) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "symbol-btn";
    btn.textContent = sym;
    btn.addEventListener("click", () => {
      insertAtCursor(document.createTextNode(sym));
      scheduleAutosave();
      symbolsPopover.hidden = true;
    });
    symbolGrid.appendChild(btn);
  });

  const symbolsPopover = document.getElementById("symbols-popover");
  const symbolsToggle = document.getElementById("btn-symbols-toggle");
  symbolsToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    symbolsPopover.hidden = !symbolsPopover.hidden;
  });
  document.addEventListener("click", (e) => {
    if (!symbolsPopover.hidden && !symbolsPopover.contains(e.target) && e.target !== symbolsToggle) {
      symbolsPopover.hidden = true;
    }
  });

  /* ---------- Table insert ---------- */
  document.getElementById("btn-table").addEventListener("click", () => {
    const rows = parseInt(window.prompt("How many rows (including header)?", "3"), 10) || 3;
    const cols = parseInt(window.prompt("How many columns?", "3"), 10) || 3;
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    for (let c = 0; c < cols; c += 1) {
      const th = document.createElement("th");
      th.textContent = `Column ${c + 1}`;
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    for (let r = 0; r < Math.max(rows - 1, 1); r += 1) {
      const tr = document.createElement("tr");
      for (let c = 0; c < cols; c += 1) {
        const td = document.createElement("td");
        td.textContent = "—";
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    insertAtCursor(table);
    insertAtCursor(document.createElement("p"));
    scheduleAutosave();
  });

  /* ---------- Link insert ---------- */
  document.getElementById("btn-link").addEventListener("click", () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      window.alert("Select the text that should become a link first.");
      return;
    }
    const url = window.prompt("Link URL (e.g. https://mathslearn.online/notes/...)");
    if (!url) return;
    els.surface.focus();
    document.execCommand("createLink", false, url);
    scheduleAutosave();
  });

  /* ---------- Insert helpers (math / formula / example blocks) ---------- */
  function insertAtCursor(node) {
    els.surface.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !els.surface.contains(sel.anchorNode)) {
      els.surface.appendChild(node);
      return;
    }
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(node);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  document.getElementById("btn-math-inline").addEventListener("click", () => {
    insertAtCursor(document.createTextNode("$x^2$"));
    scheduleAutosave();
  });
  document.getElementById("btn-math-block").addEventListener("click", () => {
    const p = document.createElement("p");
    p.textContent = "$$\\int_0^1 x^2\\,dx = \\frac{1}{3}$$";
    insertAtCursor(p);
    scheduleAutosave();
  });
  document.getElementById("btn-formula-block").addEventListener("click", () => {
    const div = document.createElement("div");
    div.className = "formula-block";
    div.contentEditable = "true";
    div.textContent = "a = bq + r,  where 0 ≤ r < b";
    insertAtCursor(div);
    insertAtCursor(document.createElement("p"));
    scheduleAutosave();
  });
  document.getElementById("btn-example-block").addEventListener("click", () => {
    const div = document.createElement("div");
    div.className = "example-block";
    div.contentEditable = "true";
    div.innerHTML = "<strong>Solved Example.</strong><p style='margin:0.5rem 0 0;'>Write the question here, then the worked solution below.</p>";
    insertAtCursor(div);
    insertAtCursor(document.createElement("p"));
    scheduleAutosave();
  });

  /* ---------- Word / character count ---------- */
  function updateCounts() {
    const text = els.surface.textContent.trim();
    els.charCount.textContent = text.length;
    els.wordCount.textContent = text ? text.split(/\s+/).length : 0;
  }

  /* ---------- Preview (with KaTeX math rendering) ---------- */
  const MATH_DELIMITERS = [
    { left: "$$", right: "$$", display: true },
    { left: "$", right: "$", display: false },
  ];
  let previewRetryTimer = null;
  let previewTimer = null;

  function renderPreview(attempt = 0) {
    // Copy the content, but strip editing-only attributes so the
    // preview is read-only, exactly like the student's page.
    const clone = getCleanClone();
    clone.querySelectorAll("[contenteditable]").forEach((n) => n.removeAttribute("contenteditable"));
    // contenteditable turns spaces into non-breaking spaces; turn them
    // back so $...$ / $$...$$ delimiters are matched reliably.
    els.previewContent.innerHTML = clone.innerHTML.replace(/&nbsp;/g, " ");
    if (window.MathsShapes) window.MathsShapes.render(els.previewContent);

    if (typeof window.renderMathInElement !== "function") {
      // KaTeX scripts are loaded with `defer` from a CDN and may not be
      // ready yet (or may be blocked). Retry a few times, then tell the
      // admin instead of failing silently.
      if (attempt < 20) {
        clearTimeout(previewRetryTimer);
        previewRetryTimer = setTimeout(() => {
          if (!els.previewPane.hidden) renderPreview(attempt + 1);
        }, 250);
      } else {
        const note = document.createElement("p");
        note.style.cssText = "color:#b45309;font-size:0.85rem;";
        note.textContent = "Math renderer (KaTeX) could not be loaded — check your internet connection. Math shows as raw $...$ text until it loads.";
        els.previewContent.prepend(note);
      }
      return;
    }
    try {
      window.renderMathInElement(els.previewContent, {
        delimiters: MATH_DELIMITERS,
        throwOnError: false,
        macros: { "\\cosec": "\\csc" }, // \cosec is the usual Indian-textbook spelling of \csc
        strict: false,
        ignoredTags: ["script", "noscript", "style", "textarea", "option"], // allow math inside <code> too
      });
    } catch (e) {
      /* a parse error leaves the raw $...$ text, which is a safe fallback */
    }
  }

  // Keep the preview in sync while it is open (debounced).
  function refreshPreviewIfOpen() {
    if (els.previewPane.hidden) return;
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => renderPreview(), 300);
  }

  els.btnTogglePreview.addEventListener("click", () => {
    const willShow = els.previewPane.hidden;
    els.previewPane.hidden = !willShow;
    els.btnTogglePreview.textContent = willShow ? "Hide Preview" : "Show Preview";
    if (willShow) {
      renderPreview();
      els.previewPane.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });

  const btnFullscreen = document.getElementById("btn-fullscreen-preview");
  if (btnFullscreen) {
    btnFullscreen.addEventListener("click", () => {
      if (!window.MathsReader) return;
      const clone = getCleanClone();
      clone.querySelectorAll("[contenteditable]").forEach((n) => n.removeAttribute("contenteditable"));
      window.MathsReader.open({
        title: els.title.value.trim() || "Untitled",
        html: clone.innerHTML.replace(/&nbsp;/g, " "),
      });
    });
  }

  /* ---------- Insert a shape (or just type  show.circle(radius=5) ) ---------- */
  let lastRange = null;
  document.addEventListener("selectionchange", () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && els.surface.contains(sel.anchorNode)) lastRange = sel.getRangeAt(0).cloneRange();
  });
  const shapeSel = document.getElementById("shape-insert");
  if (shapeSel) {
    shapeSel.addEventListener("change", () => {
      const tpl = window.MathsShapes && window.MathsShapes.templates[shapeSel.value];
      if (tpl) {
        els.surface.focus();
        if (lastRange) { const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(lastRange); }
        const p = document.createElement("p");
        p.textContent = tpl;
        insertAtCursor(p);
        insertAtCursor(document.createElement("p"));
        scheduleAutosave();
      }
      shapeSel.value = "";
    });
  }

  /* ---------- Problem checker: marks trouble spots in yellow ----------
     Looks at every block while you write: broken maths, an unclosed $ or $$,
     Hindi inside maths without \text{}, a table pasted as plain text, an
     empty heading, or a show.xxx(...) shape that cannot be drawn. The yellow
     marker is never saved or shown to students. */
  const problemBadge = document.getElementById("problem-badge");
  const MATH_RE = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let lintTimer = null;
  let problemEls = [];
  let problemCursor = -1;

  function lintBlock(el) {
    const out = [];
    const text = (el.textContent || "").replace(/\u00a0/g, " ");
    if (/^\s*show\./i.test(text)) {
      if (window.MathsShapes) {
        const r = window.MathsShapes.validate(text);
        if (!r.ok) out.push("Shape: " + r.error);
      }
      return out;
    }
    if (/^H[1-6]$/.test(el.tagName) && !text.trim()) out.push("Empty heading");
    if (/\t[^\n]*\t/.test(text)) out.push("Looks like a table pasted as plain text — use the Table button");
    if ((text.match(/\$\$/g) || []).length % 2) out.push("Unclosed $$ — every $$ needs a closing $$");
    else if ((text.replace(/\$\$/g, "").match(/(?<!\\)\$/g) || []).length % 2) out.push("Unclosed $ — every $ needs a closing $");
    if (window.katex) {
      MATH_RE.lastIndex = 0;
      let m;
      while ((m = MATH_RE.exec(text))) {
        const display = m[1] !== undefined;
        const src = (display ? m[1] : m[2]).trim();
        if (!src) continue;
        if (/[\u0900-\u097F]/.test(src.replace(/\\text\{[^{}]*\}/g, ""))) { out.push("Hindi text inside maths must be inside \\text{…}"); break; }
        try {
          window.katex.renderToString(src, { throwOnError: true, displayMode: display, macros: { "\\cosec": "\\csc" }, strict: false });
        } catch (e) {
          out.push("Maths error: " + String(e.message || e).replace(/^KaTeX parse error:\s*/i, "").slice(0, 100));
          break;
        }
      }
    }
    return out;
  }

  function runLint() {
    const found = [];
    Array.from(els.surface.children).forEach((b) => {
      const msg = lintBlock(b).join(" • ");
      if (msg) {
        if (b.getAttribute("data-lint") !== msg) b.setAttribute("data-lint", msg);
        found.push(b);
      } else if (b.hasAttribute("data-lint")) b.removeAttribute("data-lint");
    });
    problemEls = found;
    if (problemBadge) {
      problemBadge.hidden = found.length === 0;
      problemBadge.textContent = `⚠ ${found.length} problem${found.length > 1 ? "s" : ""} — click to jump`;
    }
  }
  function scheduleLint() {
    clearTimeout(lintTimer);
    lintTimer = setTimeout(runLint, 700);
  }
  if (problemBadge) {
    const jump = () => {
      if (!problemEls.length) return;
      problemCursor = (problemCursor + 1) % problemEls.length;
      problemEls[problemCursor].scrollIntoView({ block: "center", behavior: "smooth" });
    };
    problemBadge.addEventListener("click", jump);
    problemBadge.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); jump(); } });
  }
  window.addEventListener("load", () => setTimeout(scheduleLint, 1200)); // KaTeX is loaded with `defer`

  /* ---------- Clean copy of the page (no runtime page spacers) ---------- */
  function getCleanClone() {
    const clone = els.surface.cloneNode(true);
    clone.querySelectorAll("[data-pg]").forEach((n) => {
      n.removeAttribute("data-pg");
      n.style.removeProperty("--pg");
      if (!n.getAttribute("style")) n.removeAttribute("style");
    });
    clone.querySelectorAll("[data-lint]").forEach((n) => n.removeAttribute("data-lint"));
    clone.removeAttribute("style");
    return clone;
  }

  /* ---------- Automatic pages ----------
     The sheet is A4 (297mm) with 15mm margins. When the next block would
     run into the bottom margin of a page, it is moved to the top of the
     next page, and the sheet grows by one page. This is editor-only (the
     spacers are never saved); the student view / PDF is paginated by the
     browser's print engine with the same A4 + 15mm settings. */
  const MM = 96 / 25.4;
  const PAGE_H = 297 * MM, PAGE_PAD = 15 * MM, PAGE_USABLE = PAGE_H - 2 * PAGE_PAD;
  const narrowMQ = window.matchMedia("(max-width: 900px)");
  const pageIndicator = document.getElementById("page-indicator");
  let totalPages = 1;
  let paginateTimer = null;
  let paginating = false;

  function repaginate() {
    if (paginating) return;
    paginating = true;
    try {
      const s = els.surface;
      const kids = Array.from(s.children);
      if (narrowMQ.matches) {
        kids.forEach((ch) => {
          if (ch.hasAttribute("data-pg")) {
            ch.removeAttribute("data-pg");
            ch.style.removeProperty("--pg");
            if (!ch.getAttribute("style")) ch.removeAttribute("style");
          }
        });
        s.style.minHeight = "";
        totalPages = 1;
        updatePageIndicator();
        return;
      }
      for (const ch of kids) {
        if (ch.hasAttribute("data-pg")) {
          ch.removeAttribute("data-pg");
          ch.style.removeProperty("--pg");
          if (!ch.getAttribute("style")) ch.removeAttribute("style");
        }
        const top = ch.offsetTop;
        const h = ch.offsetHeight;
        if (h > PAGE_USABLE) continue; // taller than one page: let it flow across
        const pageIdx = Math.floor(top / PAGE_H);
        const limit = (pageIdx + 1) * PAGE_H - PAGE_PAD;
        if (top + h > limit) {
          const prev = ch.previousElementSibling;
          const gap = Math.max(
            parseFloat(getComputedStyle(ch).marginTop) || 0,
            prev ? parseFloat(getComputedStyle(prev).marginBottom) || 0 : 0
          );
          ch.style.setProperty("--pg", (gap + ((pageIdx + 1) * PAGE_H + PAGE_PAD - top)) + "px");
          ch.setAttribute("data-pg", "1");
        }
      }
      const last = s.lastElementChild;
      const lastBottom = last ? last.offsetTop + last.offsetHeight : 0;
      totalPages = Math.max(1, Math.ceil((lastBottom + PAGE_PAD) / PAGE_H));
      s.style.minHeight = totalPages * PAGE_H + "px";
      updatePageIndicator();
    } finally {
      paginating = false;
    }
  }

  function schedulePaginate() {
    clearTimeout(paginateTimer);
    paginateTimer = setTimeout(() => requestAnimationFrame(repaginate), 150);
  }

  function updatePageIndicator() {
    if (!pageIndicator) return;
    let page = 1;
    const sel = window.getSelection();
    if (!narrowMQ.matches && sel && sel.anchorNode && els.surface.contains(sel.anchorNode)) {
      let n = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
      while (n && n.parentElement !== els.surface) n = n.parentElement;
      if (n) page = Math.min(totalPages, Math.floor(n.offsetTop / PAGE_H) + 1);
    }
    pageIndicator.textContent = `Page ${page} / ${totalPages}`;
  }

  document.addEventListener("selectionchange", updatePageIndicator);
  window.addEventListener("resize", schedulePaginate);
  els.surface.addEventListener("load", schedulePaginate, true); // images finishing loading
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedulePaginate);

  /* ---------- Full-screen editor ----------
     The toolbar moves to a rail on the left (outside the page), the
     Save / Preview / Exit buttons are pinned to the top of the screen. */
  const btnFsPreview = document.getElementById("btn-fs-preview");
  const btnFsSave = document.getElementById("btn-fs-save");
  const isFs = () => document.body.classList.contains("editor-fs");

  function syncFsPreview() {
    if (btnFsPreview) btnFsPreview.textContent = els.previewPane.hidden ? "👁 Preview" : "✏️ Back to editing";
  }
  function syncFsSave() {
    if (btnFsSave) btnFsSave.textContent = currentStatus === "published" ? "⬆ Update" : "💾 Save";
  }
  function enterFs() {
    document.body.classList.add("editor-fs");
    const de = document.documentElement;
    if (de.requestFullscreen) de.requestFullscreen().catch(() => {});
    syncFsPreview();
    syncFsSave();
    schedulePaginate();
    els.surface.focus();
  }
  function exitFs() {
    document.body.classList.remove("editor-fs");
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    schedulePaginate();
  }
  function toggleFs() { isFs() ? exitFs() : enterFs(); }

  ["btn-fs-editor", "btn-fs-editor-footer"].forEach((id) => {
    const b = document.getElementById(id);
    if (b) b.addEventListener("click", toggleFs);
  });
  document.getElementById("btn-fs-exit").addEventListener("click", exitFs);
  btnFsPreview.addEventListener("click", () => { els.btnTogglePreview.click(); syncFsPreview(); });
  btnFsSave.addEventListener("click", () => {
    document.getElementById(currentStatus === "published" ? "btn-publish" : "btn-save-draft").click();
  });
  document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && isFs()) exitFs(); });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !isFs()) return;
    const pop = document.getElementById("symbols-popover");
    if (pop && !pop.hidden) return; // let the symbol picker close first
    exitFs();
  });

  /* ---------- Save status indicator ---------- */
  function setSaveStatus(state, text) {
    els.saveStatus.className = `save-status ${state}`;
    els.saveStatusText.textContent = text;
  }

  /* ---------- Build payload ---------- */
  function buildPayload(status) {
    return {
      title: els.title.value.trim(),
      slug: els.slug.value.trim() || slugify(els.title.value),
      content_type: els.type.value,
      level: els.level.value,
      subject: els.subject.value.trim(),
      chapter: els.chapter.value.trim(),
      language: els.language.value,
      seo_title: els.seoTitle.value.trim(),
      meta_description: els.metaDesc.value.trim(),
      body_html: getCleanClone().innerHTML,
      status,
    };
  }

  /* ---------- Local backup (survives a refresh even before the
     server confirms a save) ---------- */
  function backupLocally() {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify({ ...buildPayload("draft"), savedAt: Date.now() }));
    } catch (e) {
      /* localStorage unavailable — server autosave is still the
         source of truth, so this is a soft failure */
    }
  }

  function restoreLocalBackupIfNewer() {
    if (contentId) return; // only offer recovery for content not yet loaded from the server
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (!raw) return;
      const backup = JSON.parse(raw);
      if (!backup.title && !backup.body_html) return;
      const ageMins = Math.round((Date.now() - (backup.savedAt || 0)) / 60000);
      const restore = window.confirm(
        `We found unsaved work from about ${ageMins} minute(s) ago ("${backup.title || "Untitled"}"). Restore it?`
      );
      if (restore) applyPayloadToForm(backup);
      else localStorage.removeItem(LOCAL_KEY);
    } catch (e) {
      /* corrupted backup — ignore */
    }
  }

  function applyPayloadToForm(data) {
    els.title.value = data.title || "";
    els.slug.value = data.slug || "";
    slugManuallyEdited = Boolean(data.slug);
    if (data.content_type) els.type.value = data.content_type;
    if (data.level) els.level.value = data.level;
    els.subject.value = data.subject || "";
    els.chapter.value = data.chapter || "";
    if (data.language) els.language.value = data.language;
    els.seoTitle.value = data.seo_title || "";
    els.metaDesc.value = data.meta_description || "";
    els.surface.innerHTML = data.body_html || "<p></p>";
    els.topbarTitle.textContent = data.title || "New Content";
    updateSlugPrefix();
    setStatusPill(data.status || "draft");
    updateCounts();
    schedulePaginate();
    scheduleLint();
  }

  function setStatusPill(status) {
    currentStatus = status;
    els.statusPill.className = `status-badge ${status}`;
    els.statusPill.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    const live = status === "published";
    document.getElementById("btn-publish").textContent = live ? "Update (changes go live)" : "Publish";
    document.getElementById("btn-unpublish").hidden = !live;
    document.getElementById("btn-save-draft").hidden = live;
    updateLiveUrl();
    syncFsSave();
  }

  /* ---------- Save to server ---------- */
  async function saveToServer(status) {
    const payload = buildPayload(status);
    const snapshot = JSON.stringify(payload);
    if (snapshot === lastSavedSnapshot && status === "draft") return; // nothing changed

    if (!payload.title) {
      setSaveStatus("error", "Add a title before saving");
      if (isFs()) exitFs();
      els.title.focus();
      return;
    }
    if (user.offline) {
      setSaveStatus("saved", "Offline preview — kept on this device only (no server connected)");
      return;
    }

    setSaveStatus("saving", "Saving…");
    try {
      let res;
      if (contentId) {
        res = await MathsLearnAuth.apiFetch(`/content/${encodeURIComponent(contentId)}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        res = await MathsLearnAuth.apiFetch("/content", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const err = new Error("save failed");
        try { err.userMessage = (await res.json()).error; } catch (x) { /* non-JSON error */ }
        throw err;
      }
      const saved = await res.json();
      if (saved.id && !contentId) {
        contentId = saved.id;
        const url = new URL(window.location.href);
        url.searchParams.set("id", contentId);
        window.history.replaceState({}, "", url);
        localStorage.removeItem(LOCAL_KEY); // server now has it; stop tracking the "new" backup
      }
      lastSavedSnapshot = snapshot;
      setStatusPill(status);
      setSaveStatus("saved", status === "published"
        ? `Published — live at ${new Date().toLocaleTimeString()}`
        : `Saved at ${new Date().toLocaleTimeString()}`);
    } catch (e) {
      setSaveStatus("error", e.userMessage || "Couldn't save — check your connection. Your work is still backed up locally.");
    }
  }

  let autosaveTimer = null;
  function scheduleAutosave() {
    updateCounts();
    schedulePaginate();
    scheduleLint();
    refreshPreviewIfOpen();
    backupLocally();
    clearTimeout(autosaveTimer);
    if (currentStatus === "published") {
      // Never autosave over a live page (that would unpublish it or push
      // half-finished edits to students). The public page stays as-is
      // until you press "Update"; edits are backed up on this device.
      setSaveStatus("", "Edited — not live yet. Press “Update” to publish these changes.");
      return;
    }
    setSaveStatus("", "Unsaved changes…");
    autosaveTimer = setTimeout(() => saveToServer("draft"), 2000);
  }

  els.surface.addEventListener("input", scheduleAutosave);
  [els.title, els.slug, els.type, els.level, els.subject, els.chapter, els.language, els.seoTitle, els.metaDesc].forEach((el) => {
    el.addEventListener("input", scheduleAutosave);
    el.addEventListener("change", scheduleAutosave);
  });

  document.getElementById("btn-save-draft").addEventListener("click", () => saveToServer("draft"));
  document.getElementById("btn-unpublish").addEventListener("click", async () => {
    if (!window.confirm("Unpublish this? Its public link will stop working until you publish it again.")) return;
    await saveToServer("draft");
  });
  document.getElementById("btn-publish").addEventListener("click", async () => {
    if (!els.title.value.trim() || !els.slug.value.trim()) {
      setSaveStatus("error", "Title and URL slug are required before publishing");
      if (isFs()) exitFs(); // title / slug boxes are hidden in full-screen mode
      (els.title.value.trim() ? els.slug : els.title).focus();
      return;
    }
    await saveToServer("published");
  });

  // Warn before leaving with unsaved changes.
  window.addEventListener("beforeunload", (e) => {
    const current = JSON.stringify(buildPayload(els.statusPill.textContent.toLowerCase()));
    if (current !== lastSavedSnapshot) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  /* ---------- Load existing content (editing) ---------- */
  async function loadExisting() {
    if (!contentId) {
      restoreLocalBackupIfNewer();
      updateCounts();
      return;
    }
    els.topbarTitle.textContent = "Loading…";
    try {
      const res = await MathsLearnAuth.apiFetch(`/content/${encodeURIComponent(contentId)}`);
      if (!res.ok) throw new Error("not found");
      const data = await res.json();
      applyPayloadToForm(data);
      lastSavedSnapshot = JSON.stringify(buildPayload(data.status || "draft"));
    } catch (e) {
      setSaveStatus("error", "Couldn't load this item — it may have been deleted.");
    }
  }

  loadExisting();
})();
