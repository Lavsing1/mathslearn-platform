/* ============================================================
   MathsLearn — view.html : renders ONE saved piece of content.
   Reached as  /{type}/{level}/{slug}/   (rewritten to view.html by
   _redirects), or locally as  view.html?t=&l=&s=
   Admin draft preview:  view.html?preview=<content id>
   ============================================================ */
(function () {
  "use strict";

  const TYPE_LABEL = {
    "notes": "Study Notes", "important-questions": "Important Questions", "solved-examples": "Solved Questions",
    "question-papers": "Question Paper", "solved-papers": "Solved Paper", "unsolved-questions": "Unsolved Questions",
    "formula-sheets": "Formula Sheet", "books": "Book",
  };
  const LEVEL_LABEL = {
    "class-9": "Class 9", "class-10": "Class 10", "class-11": "Class 11", "class-12": "Class 12",
    "bsc": "B.Sc Mathematics", "iit-jam": "IIT JAM", "isi": "ISI Entrance", "cmi": "CMI Entrance", "tifr": "TIFR GS",
  };
  const SITE = "https://mathslearn.online";

  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);

  function route() {
    const previewId = params.get("preview");
    if (previewId) return { previewId };
    if (params.get("t") && params.get("l") && params.get("s")) {
      return { type: params.get("t"), level: params.get("l"), slug: params.get("s") };
    }
    const parts = location.pathname.split("/").filter(Boolean).map((p) => {
      try { return decodeURIComponent(p); } catch (e) { return p; }
    });
    if (parts.length >= 3) return { type: parts[0], level: parts[1], slug: parts[2] };
    return null;
  }

  function showError(title, text) {
    $("view-loading").hidden = true;
    $("view-article").hidden = true;
    $("view-error").hidden = false;
    if (title) $("view-error-title").textContent = title;
    if (text) $("view-error-text").textContent = text;
    document.title = "Not found | MathsLearn";
  }

  /* Strip anything that could run script. Content comes from the
     admin editor, but a published page should never execute markup. */
  function sanitize(html) {
    const tpl = document.createElement("template");
    tpl.innerHTML = html || "";
    tpl.content.querySelectorAll("script, iframe, object, embed, link, meta, style, form, base").forEach((n) => n.remove());
    tpl.content.querySelectorAll("*").forEach((el) => {
      Array.from(el.attributes).forEach((a) => {
        const name = a.name.toLowerCase();
        const val = a.value.trim().toLowerCase();
        if (name.startsWith("on") || name === "contenteditable") el.removeAttribute(a.name);
        else if ((name === "href" || name === "src" || name === "xlink:href") && /^(javascript|data|vbscript):/.test(val) && !(name === "src" && /^data:image\//.test(val))) {
          el.removeAttribute(a.name);
        }
      });
      if (el.tagName === "A" && el.getAttribute("href")) {
        el.setAttribute("rel", "noopener noreferrer");
      }
    });
    return tpl.innerHTML;
  }

  function setMeta(item, isPreview) {
    const typeName = TYPE_LABEL[item.content_type] || item.content_type;
    const levelName = LEVEL_LABEL[item.level] || item.level;
    const title = item.seo_title || `${item.title} | ${levelName} ${typeName} | MathsLearn`;
    document.title = title;
    const desc = item.meta_description ||
      `${item.title} — ${typeName} for ${levelName} on MathsLearn.`;
    $("meta-desc").setAttribute("content", desc);
    const canon = `${SITE}/${encodeURIComponent(item.content_type)}/${encodeURIComponent(item.level)}/${encodeURIComponent(item.slug)}/`;
    $("canonical").setAttribute("href", canon);
    if (isPreview) {
      const m = document.createElement("meta");
      m.name = "robots"; m.content = "noindex, nofollow";
      document.head.appendChild(m);
    }
    return canon;
  }

  function renderMath(el, attempt = 0) {
    if (typeof window.renderMathInElement === "function") {
      try {
        window.renderMathInElement(el, {
          delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }],
          throwOnError: false,
          macros: { "\\cosec": "\\csc" }, // \cosec is the usual Indian-textbook spelling of \csc
          strict: false,
        });
      } catch (e) { /* keep raw text */ }
    } else if (attempt < 40) {
      setTimeout(() => renderMath(el, attempt + 1), 250);   // KaTeX is loaded with `defer`
    }
  }

  function render(item, isPreview) {
    const typeName = TYPE_LABEL[item.content_type] || item.content_type;
    const levelName = LEVEL_LABEL[item.level] || item.level;
    setMeta(item, isPreview);

    const bc = $("view-breadcrumb");
    bc.innerHTML = "";
    const mk = (text, href) => {
      const n = document.createElement(href ? "a" : "span");
      n.textContent = text; if (href) n.href = href; return n;
    };
    const sep = () => { const s = document.createElement("span"); s.className = "sep"; s.textContent = "/"; return s; };
    bc.append(mk("Home", "/index.html"), sep(), mk(levelName, `/class.html?level=${encodeURIComponent(item.level)}`), sep(), mk(item.title));

    const tags = $("view-tags");
    tags.innerHTML = "";
    const t1 = document.createElement("span"); t1.className = "tag"; t1.textContent = levelName;
    const t2 = document.createElement("span"); t2.className = "tag alt"; t2.textContent = typeName;
    tags.append(t1, t2);

    $("view-title").textContent = item.title;

    const body = $("view-body");
    body.innerHTML = sanitize(item.body_html);
    // The page already shows the title above — drop leading headings that only repeat it.
    {
      const norm = (t) => String(t || "").replace(/\s+/g, " ").trim().toLowerCase();
      const want = norm(item.title);
      let n = body.firstElementChild, guard = 0;
      while (n && /^H[1-3]$/.test(n.tagName) && norm(n.textContent) === want && guard++ < 3) {
        const next = n.nextElementSibling; n.remove(); n = next;
      }
    }
    const words = (body.textContent || "").trim().split(/\s+/).filter(Boolean).length;
    const mins = Math.max(1, Math.round(words / 200));
    const meta = $("view-meta");
    meta.innerHTML = "";
    const addMeta = (t) => { const s = document.createElement("span"); s.textContent = t; meta.appendChild(s); };
    if (item.subject) addMeta("📘 " + item.subject);
    if (item.chapter) addMeta("📑 " + item.chapter);
    addMeta(`🕑 ${mins} min read`);
    if (item.updated_at) addMeta("🗓️ Updated " + String(item.updated_at).slice(0, 10));

    // Books are read online only — no PDF download (same rule as the rest of the site).
    const isBook = item.content_type === "books";
    if (isBook) {
      $("btn-view-download").hidden = true;
      $("view-bar-text").textContent = "Books are read online — use full screen for a page-style reading view.";
    }
    $("view-preview-note").hidden = !isPreview;

    $("btn-view-fullscreen").addEventListener("click", () => {
      MathsReader.open({
        title: item.title,
        html: `<h1>${$("view-title").innerHTML}</h1>` + body.innerHTML,
        download: !isBook,
      });
    });

    $("view-loading").hidden = true;
    $("view-article").hidden = false;
    renderMath(body);
  }

  async function init() {
    const r = route();
    if (!r) return showError("Nothing to show here", "Open a note from the list to read it.");

    const isPreview = Boolean(r.previewId);
    const url = isPreview
      ? `/api/content/${encodeURIComponent(r.previewId)}`
      : `/api/public/content/${encodeURIComponent(r.level)}/${encodeURIComponent(r.type)}/${encodeURIComponent(r.slug)}`;
    try {
      const res = await fetch(url, { credentials: isPreview ? "include" : "omit" });
      if (res.status === 401) return showError("Log in to preview", "Draft previews are only visible to the admin. Log in at /admin/login.html first.");
      if (res.status === 404) return showError();
      const ct = res.headers.get("content-type") || "";
      if (!res.ok || !ct.includes("json")) return showError("Can't load this page right now", "Please try again in a moment.");
      render(await res.json(), isPreview);
    } catch (e) {
      showError("Can't load this page right now", "Check your internet connection and try again.");
    }
  }

  init();
})();
