/* ============================================================
   MathsLearn — clean "Download PDF"
   Builds a separate, minimal A4 document (title + rendered content +
   source line) in a hidden frame and prints THAT, instead of printing
   the whole website page. This avoids blank first pages, shifted
   content and cut formulas caused by the site layout, and the
   watermark is drawn as SVG so it prints even with "Background
   graphics" switched off.
   MathsPrint.print({ title, meta, html, source })
   ============================================================ */
(function () {
  "use strict";

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // Remove everything that is only for editing / screen use.
  function cleanHtml(html, title) {
    const box = document.createElement("div");
    box.innerHTML = html;
    // The document already starts with the title — drop headings that only repeat it.
    const norm = (t) => String(t || "").replace(/\s+/g, " ").trim().toLowerCase();
    let n = box.firstElementChild, guard = 0;
    while (n && /^H[1-3]$/.test(n.tagName) && norm(n.textContent) === norm(title) && guard++ < 3) {
      const next = n.nextElementSibling; n.remove(); n = next;
    }
    box.querySelectorAll("[data-pg]").forEach((n) => {
      n.removeAttribute("data-pg");
      n.style.removeProperty("--pg");
      if (!n.getAttribute("style")) n.removeAttribute("style");
    });
    box.querySelectorAll("[contenteditable]").forEach((n) => n.removeAttribute("contenteditable"));
    box.querySelectorAll("button, script, [data-print-source]").forEach((n) => n.remove());
    return box.innerHTML;
  }

  const CSS = `
    @page { size: A4; margin: 15mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #111; }
    body { font: 16px/1.65 "Open Sans", Roboto, "Noto Sans Devanagari", "Segoe UI", system-ui, sans-serif;
           -webkit-print-color-adjust: exact; print-color-adjust: exact; overflow-wrap: anywhere; }
    .doc-title { font-size: 1.7rem; line-height: 1.25; margin: 0 0 .25em; }
    .doc-meta { color: #555; font-size: .85rem; margin: 0 0 1em; padding-bottom: .6em; border-bottom: 1px solid #ccc; }
    .doc-body { display: block; }
    .doc-body h1 { font-size: 1.45rem; margin: 1.2em 0 .5em; }
    .doc-body h2 { font-size: 1.25rem; margin: 1.4em 0 .5em; }
    .doc-body h3 { font-size: 1.1rem; margin: 1.2em 0 .4em; }
    .doc-body h1, .doc-body h2, .doc-body h3 { line-height: 1.3; break-after: avoid; page-break-after: avoid; }
    .doc-body p { margin: .55em 0; orphans: 3; widows: 3; }
    .doc-body p:has(> strong:first-child) { margin-top: 1.1em; }
    .doc-body ul, .doc-body ol { margin: .5em 0; padding-left: 1.6em; }
    .doc-body p, .doc-body li, .doc-body tr, .doc-body img, .doc-body .katex-display,
    .doc-body .formula-block, .doc-body .example-block { break-inside: avoid; page-break-inside: avoid; }
    .doc-body img { max-width: 100%; height: auto; }
    .doc-body table { border-collapse: collapse; width: 100%; margin: .8em 0; }
    .doc-body th, .doc-body td { border: 1px solid #bbb; padding: .35em .5em; text-align: center; }
    .doc-body .katex-display { overflow: visible; margin: .6em 0 .8em; text-align: center; }
    .doc-body .katex-display > .katex { white-space: normal; }
    .doc-body .formula-block { border: 1px solid #c7d2fe; background: #f5f7ff; border-radius: 6px; padding: .6em 1em; margin: .8em 0; }
    .doc-body .example-block { border-left: 4px solid #0d9488; background: #f0fdfa; padding: .6em 1em; margin: .8em 0; }
    .shape-figure { margin: .9em auto; text-align: center; break-inside: avoid; page-break-inside: avoid; }
    .shape-figure svg { max-width: 100%; height: auto; color: #111; }
    .shape-figure .s-shape, .shape-figure .s-line { fill: none; stroke: currentColor; stroke-width: 0.05; }
    .shape-figure .s-fill { fill: rgba(79,70,229,0.08); }
    .shape-figure .s-text { fill: currentColor; font: 0.5px sans-serif; }
    .shape-figure figcaption { font-size: .8rem; color: #555; }
    .shape-error { display: none; }
    .mcq-options { display: flex; flex-wrap: wrap; align-items: baseline; gap: .3rem 2.6rem; margin: .4em 0 .9em; }
    .mcq-opt { min-width: 4.5rem; }
    .doc-source { margin-top: 1.8em; padding-top: .5em; border-top: 1px dashed #999; font-size: .72rem; color: #555; }
    .wm { position: fixed; left: 0; top: 0; width: 100%; height: 100%; pointer-events: none; }
  `;

  function build({ title = "Document", meta = "", html = "", source = "" } = {}) {
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .filter((l) => /katex/i.test(l.href))
      .map((l) => `<link rel="stylesheet" href="${esc(l.href)}">`).join("");
    const stamp = new Date().toLocaleString();
    const src = source || (window.location.origin + window.location.pathname);
    return `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8">
<title>${esc(title)}</title>${links}<style>${CSS}</style></head><body>
<svg class="wm" aria-hidden="true"><defs><pattern id="wmp" width="320" height="220" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)"><text x="10" y="120" font-family="sans-serif" font-size="22" fill="rgba(0,0,0,0.08)">MathsLearn.online</text></pattern></defs><rect width="100%" height="100%" fill="url(#wmp)"/></svg>
<h1 class="doc-title">${esc(title)}</h1>${meta ? `<div class="doc-meta">${esc(meta)}</div>` : ""}
<div class="doc-body">${cleanHtml(html, title)}</div>
<div class="doc-source">Downloaded from ${esc(src)} on ${esc(stamp)} — MathsLearn.online</div>
</body></html>`;
  }

  function print(opts) {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;";
    let done = false;
    const cleanup = () => { if (frame.parentNode) frame.remove(); };
    const go = async () => {
      if (done) return; done = true;
      const w = frame.contentWindow;
      try { if (w.document.fonts && w.document.fonts.ready) await w.document.fonts.ready; } catch (e) { /* ignore */ }
      w.addEventListener("afterprint", () => setTimeout(cleanup, 500));
      setTimeout(cleanup, 5 * 60 * 1000);
      w.focus();
      w.print();
    };
    frame.onload = go;
    frame.srcdoc = build(opts);
    document.body.appendChild(frame);
    setTimeout(go, 8000); // if a stylesheet is slow, print anyway
  }

  window.MathsPrint = { print, build };
})();
