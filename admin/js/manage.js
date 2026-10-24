/* ============================================================
   MathsLearn Admin — Manage Content
   Everything you've saved, in one place: reopen to edit, see each
   item's own URL, copy it, publish / unpublish, archive, delete.
   ============================================================ */
(async function () {
  "use strict";

  const user = await MathsLearnAuth.requireAuth();
  if (!user) return;
  document.getElementById("logout-btn").addEventListener("click", () => MathsLearnAuth.logout());

  const A = MathsLearnAuth;
  const listEl = document.getElementById("manage-list");
  const countEl = document.getElementById("manage-count");
  const searchEl = document.getElementById("f-search");
  const levelEl = document.getElementById("f-level");
  const typeEl = document.getElementById("f-type");
  const tabs = Array.from(document.querySelectorAll(".status-tab"));
  const STATUS_LABEL = { published: "Published", draft: "Draft", archived: "Archived" };

  const params = new URLSearchParams(location.search);
  let status = params.get("status") || "";
  if (params.get("type")) typeEl.value = params.get("type");
  if (params.get("level")) levelEl.value = params.get("level");

  let items = new Map();

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  function setActiveTab() {
    tabs.forEach((t) => {
      const on = t.dataset.status === status;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", String(on));
    });
  }

  function rowHtml(item) {
    const st = item.status || "draft";
    const live = st === "published";
    const urlLine = live
      ? `<a class="url-link" href="${esc(A.viewHref(item))}" target="_blank" rel="noopener">${esc(A.publicPath(item))}</a>`
      : `<span class="url-muted">${esc(A.publicPath(item))} — ${st === "draft" ? "not public until published" : "archived, hidden from site"}</span>`;
    const toggle = live
      ? `<button class="btn btn-ghost btn-sm" data-action="draft" data-id="${esc(item.id)}">Unpublish</button>`
      : st === "draft"
        ? `<button class="btn btn-primary btn-sm" data-action="published" data-id="${esc(item.id)}">Publish</button>`
        : `<button class="btn btn-ghost btn-sm" data-action="draft" data-id="${esc(item.id)}">Restore</button>`;
    const archive = st === "archived" ? "" :
      `<button class="btn btn-ghost btn-sm" data-action="archived" data-id="${esc(item.id)}">Archive</button>`;
    return `
      <article class="manage-row">
        <div class="manage-main">
          <div class="manage-title-line">
            <strong class="manage-title">${esc(item.title || "Untitled")}</strong>
            <span class="status-badge ${esc(st)}">${esc(STATUS_LABEL[st] || st)}</span>
          </div>
          <div class="manage-meta">
            <span>${esc(A.LEVELS[item.level] || item.level || "—")}</span>
            <span>${esc(A.TYPES[item.content_type] || item.content_type || "—")}</span>
            ${item.subject ? `<span>${esc(item.subject)}</span>` : ""}
            <span>Updated ${item.updated_at ? esc(new Date(String(item.updated_at).replace(" ", "T") + "Z").toLocaleDateString()) : "—"}</span>
          </div>
          <div class="manage-url">🔗 ${urlLine}</div>
        </div>
        <div class="manage-actions">
          <a class="btn btn-primary btn-sm" href="editor.html?id=${encodeURIComponent(item.id)}">✏️ Edit</a>
          <a class="btn btn-ghost btn-sm" href="${esc(A.viewHref(item))}" target="_blank" rel="noopener">${live ? "View" : "Preview"}</a>
          ${live ? `<button class="btn btn-ghost btn-sm" data-action="copy" data-id="${esc(item.id)}">Copy link</button>` : ""}
          ${toggle}
          ${archive}
          <button class="btn btn-ghost btn-sm danger" data-action="delete" data-id="${esc(item.id)}">Delete</button>
        </div>
      </article>`;
  }

  function render(list) {
    items = new Map(list.map((i) => [i.id, i]));
    countEl.textContent = list.length ? `${list.length} item${list.length === 1 ? "" : "s"}` : "";
    if (!list.length) {
      listEl.innerHTML = `<div class="manage-empty">Nothing here yet. <a href="editor.html">Create new content →</a></div>`;
      return;
    }
    listEl.innerHTML = list.map(rowHtml).join("");
  }

  async function load() {
    setActiveTab();
    const q = new URLSearchParams();
    if (searchEl.value.trim()) q.set("q", searchEl.value.trim());
    if (levelEl.value) q.set("level", levelEl.value);
    if (typeEl.value) q.set("type", typeEl.value);
    if (status) q.set("status", status);
    try {
      const res = await A.apiFetch(`/content?${q.toString()}`);
      const isJson = (res.headers.get("content-type") || "").includes("json");
      if (!res.ok || !isJson) throw new Error("unavailable");
      const data = await res.json();
      render(data.items || data);
    } catch (e) {
      countEl.textContent = "";
      listEl.innerHTML = `<div class="manage-empty">Couldn't reach the content API${A.IS_LOCAL ? " (offline preview mode)" : ""}. Check that the D1 binding (DB) and admin secrets are set in Cloudflare Pages, then your saved content will appear here.</div>`;
    }
  }

  async function setStatus(id, next) {
    const res = await A.apiFetch(`/content/${encodeURIComponent(id)}/status`, {
      method: "PATCH", body: JSON.stringify({ status: next }),
    });
    if (!res.ok) throw new Error("status change failed");
  }

  listEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const id = btn.dataset.id;
    const item = items.get(id);
    const action = btn.dataset.action;
    try {
      if (action === "copy") {
        const ok = await A.copyText(A.publicUrl(item));
        if (ok) { const old = btn.textContent; btn.textContent = "Copied ✓"; setTimeout(() => (btn.textContent = old), 1500); }
        return;
      }
      if (action === "delete") {
        if (!window.confirm(`Delete "${item.title}" permanently? This cannot be undone.\n\n(Tip: use Archive to just hide it from the site.)`)) return;
        const res = await A.apiFetch(`/content/${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!res.ok) throw new Error("delete failed");
        return load();
      }
      if (action === "draft" && item.status === "published" &&
          !window.confirm("Unpublish this? Its public link will stop working until you publish it again.")) return;
      if (action === "archived" &&
          !window.confirm("Archive this? It will be hidden from the site (you can restore it later).")) return;
      btn.disabled = true;
      await setStatus(id, action);
      load();
    } catch (err) {
      btn.disabled = false;
      window.alert("That didn't work — please check your connection and try again.");
    }
  });

  tabs.forEach((t) => t.addEventListener("click", () => {
    status = t.dataset.status;
    const url = new URL(location.href);
    if (status) url.searchParams.set("status", status); else url.searchParams.delete("status");
    history.replaceState({}, "", url);
    load();
  }));
  searchEl.addEventListener("input", debounce(load, 300));
  [levelEl, typeEl].forEach((el) => el.addEventListener("change", load));

  load();
})();
