/* ============================================================
   MathsLearn Admin — Dashboard (overview + quick links).
   Full editing / publishing / deleting lives in manage.html.
   ============================================================ */
(async function () {
  "use strict";

  const user = await MathsLearnAuth.requireAuth();
  if (!user) return;
  document.getElementById("logout-btn").addEventListener("click", () => MathsLearnAuth.logout());

  const A = MathsLearnAuth;
  const recent = document.getElementById("recent-list");

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  async function loadStats() {
    try {
      const res = await A.apiFetch("/stats");
      if (!res.ok) throw new Error("stats unavailable");
      const s = await res.json();
      document.querySelector('[data-stat="total"]').textContent = s.total ?? "0";
      document.querySelector('[data-stat="published"]').textContent = s.published ?? "0";
      document.querySelector('[data-stat="drafts"]').textContent = s.drafts ?? "0";
      document.querySelector('[data-stat="books"]').textContent = s.books ?? "0";
    } catch (e) {
      document.querySelectorAll("[data-stat]").forEach((el) => (el.textContent = "—"));
    }
  }

  async function loadRecent() {
    try {
      const res = await A.apiFetch("/content");
      const isJson = (res.headers.get("content-type") || "").includes("json");
      if (!res.ok || !isJson) throw new Error("unavailable");
      const data = await res.json();
      const list = (data.items || data).slice(0, 6);
      if (!list.length) {
        recent.innerHTML = `<div class="manage-empty">No content yet. <a href="editor.html">Write your first note →</a></div>`;
        return;
      }
      recent.innerHTML = list.map((item) => {
        const st = item.status || "draft";
        return `
        <article class="manage-row">
          <div class="manage-main">
            <div class="manage-title-line">
              <strong class="manage-title">${esc(item.title || "Untitled")}</strong>
              <span class="status-badge ${esc(st)}">${esc(st.charAt(0).toUpperCase() + st.slice(1))}</span>
            </div>
            <div class="manage-meta">
              <span>${esc(A.LEVELS[item.level] || item.level)}</span>
              <span>${esc(A.TYPES[item.content_type] || item.content_type)}</span>
            </div>
          </div>
          <div class="manage-actions">
            <a class="btn btn-primary btn-sm" href="editor.html?id=${encodeURIComponent(item.id)}">✏️ Edit</a>
            <a class="btn btn-ghost btn-sm" href="${esc(A.viewHref(item))}" target="_blank" rel="noopener">${st === "published" ? "View" : "Preview"}</a>
          </div>
        </article>`;
      }).join("");
    } catch (e) {
      recent.innerHTML = `<div class="manage-empty">Couldn't reach the content API${A.IS_LOCAL ? " (offline preview mode)" : ""}. Check that the D1 binding (DB) and admin secrets are set in Cloudflare Pages, then your content will show up here.</div>`;
    }
  }

  loadStats();
  loadRecent();
})();
