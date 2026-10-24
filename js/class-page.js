/* ============================================================
   MathsLearn — Class / Exam landing page
   Reads ?level= from the URL, shows the right heading, and keeps
   every content type (Notes, Important Questions, Solved
   Questions, Question Papers, Formula Sheets) in its own tab so
   nothing shows up mixed together.
   ============================================================ */

(function () {
  "use strict";

  const LEVELS = {
    "class-9": { name: "Class 9", group: "School", icon: "9" },
    "class-10": { name: "Class 10", group: "School", icon: "10" },
    "class-11": { name: "Class 11", group: "School", icon: "11" },
    "class-12": { name: "Class 12", group: "School", icon: "12" },
    "bsc": { name: "B.Sc Mathematics", group: "Undergraduate", icon: "🎓" },
    "iit-jam": { name: "IIT JAM", group: "Competitive & Entrance", icon: "⚡" },
    "isi": { name: "ISI Entrance", group: "Competitive & Entrance", icon: "Σ" },
    "cmi": { name: "CMI Entrance", group: "Competitive & Entrance", icon: "∞" },
    "tifr": { name: "TIFR GS", group: "Competitive & Entrance", icon: "◆" },
  };

  const params = new URLSearchParams(window.location.search);
  const levelSlug = params.get("level") || "class-10";
  const level = LEVELS[levelSlug] || { name: "This Level", group: "", icon: "•" };

  /* ---------- Heading / breadcrumb / title ---------- */
  const headingEl = document.getElementById("level-heading");
  const subEl = document.getElementById("level-sub");
  const iconEl = document.getElementById("level-icon");
  const breadcrumbEl = document.getElementById("breadcrumb-level");
  const titleEl = document.getElementById("page-title");

  if (headingEl) headingEl.textContent = level.name;
  if (iconEl) iconEl.textContent = level.icon;
  if (breadcrumbEl) breadcrumbEl.textContent = level.name;
  if (titleEl) titleEl.textContent = `${level.name} — Notes, Important Questions & Papers | MathsLearn`;
  if (subEl) {
    subEl.textContent = `Everything for ${level.name} — pick a tab below. Each content type stays in its own tab, so notes, important questions, solved questions, papers and formula sheets never show up mixed together.`;
  }

  /* ---------- Filter every content-type grid down to this level ---------- */
  function filterGrids() {
  document.querySelectorAll("[data-type-grid]").forEach((grid) => {
    const type = grid.dataset.typeGrid;
    const cards = Array.from(grid.querySelectorAll("[data-card]"));
    let visible = 0;

    cards.forEach((card) => {
      const match = card.dataset.level === levelSlug;
      card.style.display = match ? "" : "none";
      if (match) visible += 1;
    });

    const countBadge = document.querySelector(`[data-count="${type}"]`);
    if (countBadge) countBadge.textContent = String(visible);

    const emptyState = document.querySelector(`[data-empty-panel="${type}"]`);
    if (emptyState) emptyState.hidden = visible !== 0;
  });
  }

  filterGrids();
  if (window.MathsLive) window.MathsLive.ready.then(filterGrids);

  /* ---------- Tabs ---------- */
  const tabs = Array.from(document.querySelectorAll("[role='tab']"));
  const panels = Array.from(document.querySelectorAll("[role='tabpanel']"));

  function activate(tabId, { focus = false } = {}) {
    tabs.forEach((tab) => {
      const isActive = tab.id === tabId;
      tab.setAttribute("aria-selected", String(isActive));
      tab.tabIndex = isActive ? 0 : -1;
      if (isActive && focus) tab.focus();
    });
    panels.forEach((panel) => {
      panel.hidden = panel.getAttribute("aria-labelledby") !== tabId;
    });
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activate(tab.id));
    tab.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        activate(tabs[(index + 1) % tabs.length].id, { focus: true });
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        activate(tabs[(index - 1 + tabs.length) % tabs.length].id, { focus: true });
      }
    });
  });

  // Open a specific tab via ?tab=important-questions, else default to the first.
  const requestedTab = params.get("tab");
  const requestedTabEl = requestedTab && document.getElementById(`tab-${requestedTab}`);
  activate(requestedTabEl ? requestedTabEl.id : (tabs[0] && tabs[0].id));
})();
