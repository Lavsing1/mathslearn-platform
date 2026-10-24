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

  /* ---------- Text size (fixed set — never arbitrarily tiny/huge) ---------- */
  const fontSizeSelect = document.getElementById("f-font-size");
  fontSizeSelect.addEventListener("change", () => {
    if (!fontSizeSelect.value) return;
    wrapSelection({ className: `text-size-${fontSizeSelect.value}` });
    fontSizeSelect.value = "";
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
    const clone = els.surface.cloneNode(true);
    clone.querySelectorAll("[contenteditable]").forEach((n) => n.removeAttribute("contenteditable"));
    // contenteditable turns spaces into non-breaking spaces; turn them
    // back so $...$ / $$...$$ delimiters are matched reliably.
    els.previewContent.innerHTML = clone.innerHTML.replace(/&nbsp;/g, " ");

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
      const clone = els.surface.cloneNode(true);
      clone.querySelectorAll("[contenteditable]").forEach((n) => n.removeAttribute("contenteditable"));
      window.MathsReader.open({
        title: els.title.value.trim() || "Untitled",
        html: clone.innerHTML.replace(/&nbsp;/g, " "),
      });
    });
  }

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
      body_html: els.surface.innerHTML,
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
  }

  /* ---------- Save to server ---------- */
  async function saveToServer(status) {
    const payload = buildPayload(status);
    const snapshot = JSON.stringify(payload);
    if (snapshot === lastSavedSnapshot && status === "draft") return; // nothing changed

    if (!payload.title) {
      setSaveStatus("error", "Add a title before saving");
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
