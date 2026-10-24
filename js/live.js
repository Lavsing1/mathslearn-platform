/* ============================================================
   MathsLearn — live content on public pages
   Loads every PUBLISHED item from the API and puts it into the
   right grid (class.html tabs, notes.html list, books.html), each
   card linking to that item's own URL:
       /{type}/{level}/{slug}/      e.g. /notes/class-10/real-numbers/
   If the API can't be reached (local preview) the demo cards that
   ship with the site are left in place.
   Load this BEFORE main.js / class-page.js: they wait for
   MathsLive.ready before filtering.
   ============================================================ */
(function () {
  "use strict";

  const TYPE_LABEL = {
    "notes": "Notes", "important-questions": "Important", "solved-examples": "Solved",
    "question-papers": "Question Paper", "solved-papers": "Solved Paper",
    "unsolved-questions": "Unsolved", "formula-sheets": "Formula Sheet", "books": "Book",
  };
  const TYPE_ICON = {
    "notes": "📘", "important-questions": "★", "solved-examples": "✓", "question-papers": "📄",
    "solved-papers": "✔", "unsolved-questions": "?", "formula-sheets": "Σ", "books": "📚",
  };
  const LEVEL_LABEL = {
    "class-9": "Class 9", "class-10": "Class 10", "class-11": "Class 11", "class-12": "Class 12",
    "bsc": "B.Sc", "iit-jam": "IIT JAM", "isi": "ISI", "cmi": "CMI", "tifr": "TIFR",
  };

  const isLocal = location.protocol === "file:" ||
    ["localhost", "127.0.0.1", ""].includes(location.hostname);

  /* Public URL of one item. On the real site: /notes/class-10/slug/.
     When previewing locally (no URL rewrites): view.html?t=&l=&s= */
  function urlFor(item) {
    const t = encodeURIComponent(item.content_type);
    const l = encodeURIComponent(item.level);
    const s = encodeURIComponent(item.slug);
    return isLocal ? `view.html?t=${t}&l=${l}&s=${s}` : `/${t}/${l}/${s}/`;
  }

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function cardHtml(item) {
    const levelName = LEVEL_LABEL[item.level] || item.level;
    const typeName = TYPE_LABEL[item.content_type] || item.content_type;
    const sub = item.chapter || item.subject || "";
    return `
      <div class="card-thumb">${TYPE_ICON[item.content_type] || "∑"}</div>
      <div class="card-body">
        <div class="card-tags"><span class="tag">${esc(levelName)}</span><span class="tag alt">${esc(typeName)}</span></div>
        <h3>${esc(item.title)}</h3>
        ${sub ? `<p>${esc(sub)}</p>` : ""}
        <div class="card-meta"><span>${esc(item.subject || typeName)}</span><span>${esc(String(item.updated_at || "").slice(0, 10))}</span></div>
      </div>`;
  }

  function makeCard(item) {
    const a = document.createElement("a");
    a.className = "content-card";
    a.href = urlFor(item);
    a.setAttribute("data-card", "");
    a.setAttribute("data-live", "");
    a.dataset.level = item.level;
    a.dataset.class = item.level;
    a.dataset.type = item.content_type;
    a.dataset.subject = String(item.subject || "").toLowerCase();
    a.innerHTML = cardHtml(item);
    return a;
  }

  function makeBookCard(item) {
    const a = document.createElement("a");
    a.className = "book-card";
    a.href = urlFor(item);
    a.setAttribute("data-live", "");
    a.innerHTML = `<h3>${esc(item.title)}</h3><p>${esc(item.chapter || item.subject || LEVEL_LABEL[item.level] || "")}</p>`;
    return a;
  }

  async function loadInner() {
    let items;
    try {
      const res = await fetch("/api/public/content?limit=200", { credentials: "omit" });
      if (!res.ok) return;
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("json")) return;          // e.g. static host answering with HTML
      items = (await res.json()).items;
      if (!Array.isArray(items)) return;
    } catch (e) {
      return;                                     // offline / no API: keep demo cards
    }

    // API answered: real content replaces the demo cards.
    document.querySelectorAll("[data-card]:not([data-live])").forEach((n) => n.remove());
    document.querySelectorAll(".book-grid .book-card:not([data-live])").forEach((n) => n.remove());

    const listGrid = document.querySelector("[data-content-grid]");
    const bookGrid = document.querySelector(".book-grid");

    items.forEach((item) => {
      if (item.content_type === "books") {
        if (bookGrid) bookGrid.appendChild(makeBookCard(item));
        const typed = document.querySelector('[data-type-grid="books"]');
        if (typed) typed.appendChild(makeCard(item));
        return;
      }
      const typed = document.querySelector(`[data-type-grid="${item.content_type}"]`);
      if (typed) typed.appendChild(makeCard(item));
      else if (listGrid) listGrid.appendChild(makeCard(item));
    });
  }

  async function load() {
    try { await loadInner(); }
    finally { document.documentElement.classList.remove("live-loading"); }
  }

  window.MathsLive = { urlFor, TYPE_LABEL, LEVEL_LABEL, ready: load() };
})();
