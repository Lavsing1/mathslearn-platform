/* ============================================================
   MathsLearn — Core Script
   Handles: mobile nav, theme toggle, search box, listing filters
   ============================================================ */

(function () {
  "use strict";

  /* ---------- Mobile nav ---------- */
  const navToggle = document.querySelector(".nav-toggle");
  const mainNav = document.querySelector(".main-nav");

  if (navToggle && mainNav) {
    navToggle.addEventListener("click", () => {
      const isOpen = mainNav.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
      document.body.style.overflow = isOpen ? "hidden" : "";
    });

    mainNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        mainNav.classList.remove("open");
        navToggle.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
      });
    });
  }

  /* ---------- Theme toggle (persisted) ---------- */
  const THEME_KEY = "mathslearn-theme";
  const themeToggle = document.querySelector(".theme-toggle");
  const root = document.documentElement;

  function applyTheme(theme) {
    if (theme === "light" || theme === "dark") {
      root.setAttribute("data-theme", theme);
    } else {
      root.removeAttribute("data-theme");
    }
  }

  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) applyTheme(saved);
  } catch (e) {
    /* localStorage unavailable — fall back silently to system theme */
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const current = root.getAttribute("data-theme");
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const currentlyDark = current ? current === "dark" : prefersDark;
      const next = currentlyDark ? "light" : "dark";
      applyTheme(next);
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch (e) {
        /* ignore persistence errors */
      }
    });
  }

  /* ---------- Hero / header search ---------- */
  document.querySelectorAll("[data-search-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = form.querySelector("input[type='search']");
      const query = (input && input.value.trim()) || "";
      const destination = query
        ? `notes.html?q=${encodeURIComponent(query)}`
        : "notes.html";
      window.location.href = destination;
    });
  });

  /* ---------- Listing page: client-side filter/search demo ---------- */
  const grid = document.querySelector("[data-content-grid]");
  if (grid) {
    const getCards = () => Array.from(grid.querySelectorAll("[data-card]"));
    const searchInput = document.querySelector("[data-filter-search]");
    const classSelect = document.querySelector("[data-filter-class]");
    const subjectSelect = document.querySelector("[data-filter-subject]");
    const typeSelect = document.querySelector("[data-filter-type]");
    const emptyState = document.querySelector("[data-empty-state]");

    const params = new URLSearchParams(window.location.search);
    const initialQuery = params.get("q");
    if (initialQuery && searchInput) searchInput.value = initialQuery;
    // Menu links like notes.html?type=formula-sheets pre-select that filter.
    const initialType = params.get("type");
    if (initialType && typeSelect && Array.from(typeSelect.options).some((o) => o.value === initialType)) {
      typeSelect.value = initialType;
    }

    function matches(card) {
      const text = card.textContent.toLowerCase();
      const q = (searchInput && searchInput.value.trim().toLowerCase()) || "";
      const cls = (classSelect && classSelect.value) || "";
      const subject = (subjectSelect && subjectSelect.value) || "";
      const type = (typeSelect && typeSelect.value) || "";

      if (q && !text.includes(q)) return false;
      if (cls && card.dataset.class !== cls) return false;
      if (subject && card.dataset.subject !== subject) return false;
      if (type && card.dataset.type !== type) return false;
      return true;
    }

    function applyFilters() {
      let visibleCount = 0;
      getCards().forEach((card) => {
        const show = matches(card);
        card.style.display = show ? "" : "none";
        if (show) visibleCount += 1;
      });
      if (emptyState) {
        emptyState.style.display = visibleCount === 0 ? "" : "none";
      }
    }

    [searchInput, classSelect, subjectSelect, typeSelect].forEach((el) => {
      if (el) el.addEventListener("input", applyFilters);
    });

    applyFilters();
    // Re-run once live (published) content has been added to the grid.
    if (window.MathsLive) window.MathsLive.ready.then(applyFilters);
  }

  /* ---------- Article preview toggle (editor-rendered content pages) ---------- */
  document.querySelectorAll("[data-toggle-solution]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = document.querySelector(btn.dataset.toggleSolution);
      if (!target) return;
      const isHidden = target.hasAttribute("hidden");
      if (isHidden) {
        target.removeAttribute("hidden");
        btn.textContent = "Hide Solution";
      } else {
        target.setAttribute("hidden", "");
        btn.textContent = "Show Solution";
      }
    });
  });

  /* ---------- Download PDF (watermarked) ----------
     Never present on Books pages — books are read online only, not
     downloadable, by design. Uses the browser's own print-to-PDF so
     formulas/formatting print exactly as rendered on screen; a
     watermark naming the exact source URL is stamped on at print
     time so a downloaded file is traceable back to this page. */
  const downloadBtn = document.querySelector("[data-download-pdf]");
  if (downloadBtn) {
    const sourceLine = document.querySelector("[data-print-source]");

    function stampWatermark() {
      if (!sourceLine) return;
      const canonical = document.querySelector("link[rel='canonical']");
      const url = (canonical && canonical.href) || window.location.href;
      const stamp = new Date().toLocaleString();
      sourceLine.textContent = `Downloaded from ${url} on ${stamp} — MathsLearn.online`;
    }

    window.addEventListener("beforeprint", stampWatermark);
    downloadBtn.addEventListener("click", () => {
      stampWatermark();
      window.print();
    });
  }

  /* ---------- Footer year ---------- */
  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = new Date().getFullYear();
  });
})();
