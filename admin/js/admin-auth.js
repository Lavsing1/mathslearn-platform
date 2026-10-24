/* ============================================================
   MathsLearn Admin — auth helper
   Talks to the Pages Function API in /functions/api (same domain,
   so /api/* just works — no CORS, no extra config).
   ============================================================ */

const MathsLearnAuth = (function () {
  const API_BASE = "/api";

  async function login(username, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (res.ok) return { ok: true };
    let message = "Invalid username or password.";
    try {
      const data = await res.json();
      if (data && data.error) message = data.error;
    } catch (e) {
      /* non-JSON error body — keep default message */
    }
    return { ok: false, message };
  }

  async function logout() {
    try {
      await fetch(`${API_BASE}/auth/logout`, { method: "POST", credentials: "include" });
    } finally {
      window.location.href = "login.html";
    }
  }

  /* True when the admin pages are opened straight from disk or from a
     local dev server — there is no API/D1 behind them, so the
     editor and dashboard open in "offline preview" mode instead of
     bouncing to the login page. On the real site this is always false. */
  const IS_LOCAL = location.protocol === "file:" ||
    ["localhost", "127.0.0.1", ""].includes(location.hostname);

  async function me() {
    try {
      const res = await fetch(`${API_BASE}/me`, { credentials: "include" });
      const isJson = (res.headers.get("content-type") || "").includes("json");
      if (res.ok && isJson) return res.json();
      if (IS_LOCAL && (!isJson || res.status >= 404)) return { username: "offline preview", offline: true };
      return null;
    } catch (e) {
      if (IS_LOCAL) return { username: "offline preview", offline: true };
      throw e;
    }
  }

  /* Call at the top of every protected admin page. Redirects to
     login if there is no valid session. */
  async function requireAuth() {
    const user = await me();
    if (!user) {
      window.location.href = "login.html";
      return null;
    }
    const chip = document.querySelector("[data-admin-user]");
    if (chip) chip.textContent = user.username || user.email || "Admin";
    return user;
  }

  async function apiFetch(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
    if (res.status === 401) {
      window.location.href = "login.html";
      throw new Error("Not authenticated");
    }
    return res;
  }

  /* ---------- Labels + URLs shared by dashboard / manage / editor ---------- */
  const TYPES = {
    "notes": "Study Notes", "important-questions": "Important Questions", "solved-examples": "Solved Questions",
    "question-papers": "Question Paper", "solved-papers": "Solved Paper", "unsolved-questions": "Unsolved Questions",
    "formula-sheets": "Formula Sheet", "books": "Book",
  };
  const LEVELS = {
    "class-9": "Class 9", "class-10": "Class 10", "class-11": "Class 11", "class-12": "Class 12",
    "bsc": "B.Sc Mathematics", "iit-jam": "IIT JAM", "isi": "ISI Entrance", "cmi": "CMI Entrance", "tifr": "TIFR GS",
  };

  /* The public address of one item: /{type}/{level}/{slug}/ */
  function publicPath(item) {
    return `/${encodeURIComponent(item.content_type)}/${encodeURIComponent(item.level)}/${encodeURIComponent(item.slug)}/`;
  }
  function publicUrl(item) {
    return (IS_LOCAL ? location.origin : "https://mathslearn.online") + publicPath(item);
  }
  /* Where "View" should open: the live page when published, otherwise a
     private admin-only preview of the draft. */
  function viewHref(item) {
    if (item.status === "published") {
      return IS_LOCAL
        ? `../view.html?t=${encodeURIComponent(item.content_type)}&l=${encodeURIComponent(item.level)}&s=${encodeURIComponent(item.slug)}`
        : publicPath(item);
    }
    return `/view.html?preview=${encodeURIComponent(item.id)}`;
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) { window.prompt("Copy this link:", text); return false; }
  }

  return { API_BASE, IS_LOCAL, TYPES, LEVELS, login, logout, me, requireAuth, apiFetch, publicPath, publicUrl, viewHref, copyText };
})();
