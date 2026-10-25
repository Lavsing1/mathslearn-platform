/* ============================================================
   MathsLearn — shapes you can type
   Write one line in a note, e.g.

       show.circle(radius=5)
       show.triangle(a=3, b=4, c=5)
       show.right_triangle(a=3, b=4, label=true)

   and the page draws it TO SCALE (1 unit = 1 cm, so on paper / in the PDF
   a radius of 5 really is 5 cm). Nothing is written on the drawing unless
   you ask: add  label=true  to show the lengths, or  vertices=true  for A, B, C.

   Shapes:  circle, triangle, right_triangle, rectangle, square, line,
            angle, polygon
   Options: label, vertices, unit, scale, caption (and per-shape sizes)

   MathsShapes.render(root)   replaces such lines inside `root` with drawings
   MathsShapes.validate(text) -> { ok, error }   (used by the editor's checker)
   ============================================================ */
(function () {
  "use strict";

  const FIT_W = 16, FIT_H = 15;               // largest drawing (cm) before it is shrunk to fit the page
  const fmt = (n) => Number(Number(n).toFixed(3));
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const rad = (deg) => (deg * Math.PI) / 180;

  /* ---------- reading  show.name(arg, key=value, key5 ...) ---------- */
  function splitTop(s) {
    const out = []; let cur = ""; let q = null;
    for (const ch of s) {
      if (q) { cur += ch; if (ch === q) q = null; }
      else if (ch === '"' || ch === "'") { q = ch; cur += ch; }
      else if (ch === ",") { out.push(cur); cur = ""; }
      else cur += ch;
    }
    if (cur.trim()) out.push(cur);
    return out.map((x) => x.trim()).filter(Boolean);
  }
  function val(v) {
    v = v.trim();
    if (/^(["']).*\1$/.test(v)) return v.slice(1, -1);
    if (/^[-+]?(\d+\.?\d*|\.\d+)$/.test(v)) return Number(v);
    const l = v.toLowerCase();
    if (["true", "yes", "on"].includes(l)) return true;
    if (["false", "no", "off", "none"].includes(l)) return false;
    return v;
  }
  function parseArgs(s) {
    const args = { pos: [] };
    for (const t of splitTop(s)) {
      let m;
      if ((m = t.match(/^([A-Za-z_]\w*)\s*[:=]\s*(.+)$/))) args[m[1].toLowerCase()] = val(m[2]);
      else if ((m = t.match(/^([A-Za-z_]+?)\s*([-+]?(?:\d+\.?\d*|\.\d+))$/))) args[m[1].toLowerCase()] = Number(m[2]); // radius5
      else if (/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) args.pos.push(Number(t));
      else if (/^[A-Za-z_]+$/.test(t)) args[t.toLowerCase()] = true;
      else throw new Error(`can't read "${t}"`);
    }
    return args;
  }
  function parseCall(text) {
    const m = String(text).replace(/\u00a0/g, " ").trim().match(/^show\.([A-Za-z_\-]+)\s*\(([\s\S]*)\)\s*;?$/i);
    if (!m) throw new Error("write it like  show.circle(radius=5)  — check the brackets");
    return { name: m[1].toLowerCase().replace(/[-_]/g, ""), args: parseArgs(m[2]) };
  }

  /* ---------- small helpers for numbers ---------- */
  function num(a, keys, posIdx) {
    for (const k of keys) if (a[k] !== undefined && a[k] !== true && a[k] !== false) {
      const n = Number(a[k]);
      if (!Number.isFinite(n) || n <= 0) throw new Error(`${k} must be a positive number`);
      return n;
    }
    if (posIdx !== undefined && a.pos[posIdx] !== undefined) {
      const n = a.pos[posIdx];
      if (!(n > 0)) throw new Error("sizes must be positive numbers");
      return n;
    }
    return null;
  }
  const must = (v, what, example) => { if (v == null) throw new Error(`needs ${what}, e.g. ${example}`); return v; };
  const unitOf = (a) => (a.unit === false ? "" : a.unit ? String(a.unit) : "cm");
  const withUnit = (v, a) => { const u = unitOf(a); return `${fmt(v)}${u ? " " + u : ""}`; };
  const labelText = (lab, v, a) => (lab === true ? withUnit(v, a) : String(lab));

  /* ---------- drawing surface (coordinates in cm, y grows downward) ---------- */
  function surface() {
    const e = [];
    const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    const grow = (x, y) => { box.x0 = Math.min(box.x0, x); box.y0 = Math.min(box.y0, y); box.x1 = Math.max(box.x1, x); box.y1 = Math.max(box.y1, y); };
    return {
      e, box, grow,
      circle(cx, cy, r, fill) { grow(cx - r, cy - r); grow(cx + r, cy + r); e.push(`<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}" class="s-shape${fill ? " s-fill" : ""}"/>`); },
      dot(x, y) { grow(x, y); e.push(`<circle cx="${fmt(x)}" cy="${fmt(y)}" r="0.07" fill="currentColor"/>`); },
      line(x1, y1, x2, y2, dash) { grow(x1, y1); grow(x2, y2); e.push(`<line x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}" class="s-line"${dash ? ' stroke-dasharray="0.2 0.15"' : ""}/>`); },
      poly(pts) { pts.forEach(([x, y]) => grow(x, y)); e.push(`<polygon points="${pts.map(([x, y]) => `${fmt(x)},${fmt(y)}`).join(" ")}" class="s-shape s-fill"/>`); },
      path(d, pts) { (pts || []).forEach(([x, y]) => grow(x, y)); e.push(`<path d="${d}" class="s-line"/>`); },
      text(x, y, s, anchor) {
        const w = String(s).length * 0.27;
        const a = anchor || "middle";
        grow(a === "middle" ? x - w / 2 : a === "start" ? x : x - w, y - 0.45); grow(a === "middle" ? x + w / 2 : a === "start" ? x + w : x, y + 0.25);
        e.push(`<text x="${fmt(x)}" y="${fmt(y)}" text-anchor="${a}" class="s-text">${esc(s)}</text>`);
      },
    };
  }
  const unit = (dx, dy) => { const l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
  function rightMark(c, vx, vy, d1, d2, s) {
    const p1 = [vx + d1[0] * s, vy + d1[1] * s], p2 = [p1[0] + d2[0] * s, p1[1] + d2[1] * s], p3 = [vx + d2[0] * s, vy + d2[1] * s];
    c.path(`M${fmt(p1[0])},${fmt(p1[1])} L${fmt(p2[0])},${fmt(p2[1])} L${fmt(p3[0])},${fmt(p3[1])}`, [p1, p2, p3]);
  }

  /* corners with optional letters (A, B, C…) and optional side lengths */
  function letters(a, dflt, showByDefault) {
    const v = a.vertices;
    if (v === false || (v === undefined && !showByDefault)) return null;
    return v === true || v === undefined ? dflt : String(v);
  }
  function drawPoly(c, pts, a, dflt, showByDefault, sideTexts) {
    c.poly(pts);
    const gx = pts.reduce((s, p) => s + p[0], 0) / pts.length, gy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const L = letters(a, dflt, showByDefault);
    if (L) pts.forEach((p, i) => { if (L[i]) { const [ux, uy] = unit(p[0] - gx, p[1] - gy); c.text(p[0] + ux * 0.5, p[1] + uy * 0.5 + 0.17, L[i]); } });
    if (a.label && sideTexts) pts.forEach((p, i) => {
      const q = pts[(i + 1) % pts.length]; if (!sideTexts[i]) return;
      const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
      const [ux, uy] = unit(mx - gx, my - gy);
      const d = 0.3 + Math.abs(ux) * (String(sideTexts[i]).length * 0.27) / 2 + Math.abs(uy) * 0.2;   // keep the label clear of its side
      c.text(mx + ux * d, my + uy * d + 0.17, sideTexts[i]);
    });
  }

  /* ---------- the shapes ---------- */
  const SHAPES = {
    circle(c, a) {
      let r = num(a, ["radius", "r", "rad"], 0);
      if (r == null) { const d = num(a, ["diameter", "d", "dia"]); if (d != null) r = d / 2; }
      must(r, "a radius", "show.circle(radius=5)");
      c.circle(0, 0, r, true);
      const mode = a.line === undefined ? "radius" : a.line;
      if (mode === "diameter") {
        c.line(-r, 0, r, 0); c.dot(0, 0);
        if (a.label) c.text(0, -0.3, labelText(a.label, 2 * r, a));
      } else if (mode !== false) {
        const t = rad(-25), px = r * Math.cos(t), py = r * Math.sin(t);
        c.line(0, 0, px, py); c.dot(0, 0);
        if (a.label) c.text(px / 2 - 0.4 * Math.sin(-t) * 0.9 - 0.15, py / 2 - 0.4 + 0.1, labelText(a.label, r, a));
      } else c.dot(0, 0);
      if (a.center) c.text(-0.3, 0.6, String(a.center));
      return `circle of radius ${fmt(r)}`;
    },

    triangle(c, a) {
      const base = num(a, ["base"]), height = num(a, ["height", "h"]);
      let A, B, C, sides;
      if (base && height) {                      // isosceles from base + height
        B = [0, 0]; C = [base, 0]; A = [base / 2, -height];
        const leg = Math.hypot(base / 2, height);
        drawPoly(c, [A, B, C], a, "ABC", true, [leg, base, leg].map((v) => withUnit(v, a)));
        const foot = [base / 2, 0]; c.line(A[0], A[1], foot[0], foot[1], true);
        rightMark(c, foot[0], foot[1], [-1, 0], [0, -1], Math.min(0.4, height * 0.15));
        return "triangle";
      }
      const x = num(a, ["a"], 0), y = num(a, ["b"], 1), z = num(a, ["c"], 2);
      must(x && y && z ? 1 : null, "three sides", "show.triangle(a=3, b=4, c=5)  (or base=6, height=4)");
      if (x + y <= z || x + z <= y || y + z <= x) throw new Error(`sides ${fmt(x)}, ${fmt(y)}, ${fmt(z)} cannot form a triangle`);
      const cx = (y * y + z * z - x * x) / (2 * z), cy = Math.sqrt(Math.max(0, y * y - cx * cx));
      A = [0, 0]; B = [z, 0]; C = [cx, -cy];
      drawPoly(c, [A, B, C], a, "ABC", true, [z, x, y].map((v) => withUnit(v, a)));   // sides AB=c, BC=a, CA=b
      return "triangle";
    },

    righttriangle(c, a) {
      const p = num(a, ["a", "base", "w"], 0), q = num(a, ["b", "height", "h"], 1);
      must(p && q ? 1 : null, "two sides", "show.right_triangle(a=3, b=4)");
      const B = [0, 0], C = [p, 0], A = [0, -q], hyp = Math.hypot(p, q);
      drawPoly(c, [A, B, C], a, "ABC", true, [q, p, hyp].map((v) => withUnit(v, a)));  // AB=q, BC=p, CA=hyp
      rightMark(c, 0, 0, [1, 0], [0, -1], Math.min(0.5, Math.min(p, q) * 0.15));
      return "right triangle";
    },

    rectangle(c, a) {
      const w = num(a, ["w", "width", "length", "l"], 0), h = num(a, ["h", "height", "breadth"], 1);
      must(w && h ? 1 : null, "a width and height", "show.rectangle(w=6, h=4)");
      const pts = [[0, 0], [w, 0], [w, -h], [0, -h]];
      drawPoly(c, pts, a, "ABCD", false, [w, h, w, h].map((v) => withUnit(v, a)));
      return "rectangle";
    },

    square(c, a) {
      const s = must(num(a, ["side", "s", "a"], 0), "a side", "show.square(side=4)");
      drawPoly(c, [[0, 0], [s, 0], [s, -s], [0, -s]], a, "ABCD", false, Array(4).fill(withUnit(s, a)));
      return "square";
    },

    line(c, a) {
      const L = must(num(a, ["length", "l"], 0), "a length", "show.line(length=6)");
      c.line(0, 0, L, 0); c.line(0, -0.15, 0, 0.15); c.line(L, -0.15, L, 0.15);
      if (a.label) c.text(L / 2, -0.3, labelText(a.label, L, a));
      const T = letters(a, "AB", false);
      if (T) { c.text(0, 0.7, T[0]); c.text(L, 0.7, T[1]); }
      return "line segment";
    },

    angle(c, a) {
      const deg = must(num(a, ["deg", "degrees", "angle"], 0), "an angle", "show.angle(deg=60)");
      if (deg >= 360) throw new Error("angle must be below 360");
      const R = num(a, ["size", "arm"]) || 4, r = Math.min(1.1, R * 0.3), t = rad(deg);
      c.line(0, 0, R, 0); c.line(0, 0, R * Math.cos(t), -R * Math.sin(t)); c.dot(0, 0);
      if (deg === 90) rightMark(c, 0, 0, [1, 0], [0, -1], 0.5);
      else c.path(`M${fmt(r)},0 A${fmt(r)},${fmt(r)} 0 ${deg > 180 ? 1 : 0} 0 ${fmt(r * Math.cos(t))},${fmt(-r * Math.sin(t))}`, [[r, 0], [r * Math.cos(t), -r * Math.sin(t)]]);
      if (a.label) { const m = t / 2, d = r + 0.65; c.text(d * Math.cos(m), -d * Math.sin(m) + 0.17, a.label === true ? `${fmt(deg)}°` : String(a.label)); }
      const T = letters(a, "AOB", false);
      if (T) { c.text(R + 0.45, 0.17, T[0]); c.text(-0.4, 0.6, T[1]); c.text(R * 1.0 * Math.cos(t) + 0.45 * Math.cos(t), -R * Math.sin(t) - 0.45 * Math.sin(t) + 0.17, T[2]); }
      return `angle of ${fmt(deg)} degrees`;
    },

    polygon(c, a) {
      const n = Math.round(num(a, ["n", "sides"], 0) || 0);
      if (n < 3 || n > 20) throw new Error("n (number of sides) must be between 3 and 20, e.g. show.polygon(n=5, side=3)");
      const side = num(a, ["side", "s"], 1), circR = num(a, ["radius", "r"]);
      const R = circR || (side ? side / (2 * Math.sin(Math.PI / n)) : 2.5);
      const pts = Array.from({ length: n }, (_, i) => [R * Math.cos(rad(-90 + (360 * i) / n)), R * Math.sin(rad(-90 + (360 * i) / n))]);
      const len = 2 * R * Math.sin(Math.PI / n);
      drawPoly(c, pts, a, "ABCDEFGHIJKLMNOPQRST".slice(0, n), false, Array(n).fill(withUnit(len, a)));
      return `regular polygon with ${n} sides`;
    },
  };
  const ALIAS = { rect: "rectangle", rt: "righttriangle", right: "righttriangle", poly: "polygon", segment: "line", sq: "square", tri: "triangle" };

  /* ---------- turning one call into an <figure><svg> ---------- */
  function build(text) {
    const { name, args } = parseCall(text);
    const fn = SHAPES[ALIAS[name] || name];
    if (!fn) throw new Error(`I don't know "${name}". Available: circle, triangle, right_triangle, rectangle, square, line, angle, polygon`);
    const c = surface();
    const what = fn(c, args);
    const pad = 0.7, ux = Number(args.scale) > 0 ? Number(args.scale) : 1;
    const w = c.box.x1 - c.box.x0 + 2 * pad, h = c.box.y1 - c.box.y0 + 2 * pad;
    const fit = Math.min(1, FIT_W / (w * ux), FIT_H / (h * ux));
    const k = ux * fit;
    const caption = args.caption || args.title || (fit < 1 ? "(drawn smaller to fit the page)" : "");
    return `<figure class="shape-figure"><svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(what)}" viewBox="${fmt(c.box.x0 - pad)} ${fmt(c.box.y0 - pad)} ${fmt(w)} ${fmt(h)}" width="${fmt(w * k)}cm" height="${fmt(h * k)}cm">${c.e.join("")}</svg>${caption ? `<figcaption>${esc(caption)}</figcaption>` : ""}</figure>`;
  }

  function validate(text) {
    try { build(text); return { ok: true }; }
    catch (e) { return { ok: false, error: e.message || String(e) }; }
  }

  /* ---------- replace  show.xxx(...)  lines inside an element ---------- */
  function render(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll("p, div, li").forEach((el) => {
      if (!el.isConnected || el.closest("figure.shape-figure, .katex, svg, pre")) return;
      if (el.querySelector("p, div, li, ul, ol, table, figure, svg")) return;
      const text = (el.textContent || "").replace(/\u00a0/g, " ").trim();
      if (!/^show\./i.test(text)) return;
      let html;
      try { html = build(text); }
      catch (e) { html = `<div class="shape-error">⚠ ${esc(text.split("(")[0])}: ${esc(e.message)}</div>`; }
      if (el.tagName === "LI") el.innerHTML = html;
      else { el.insertAdjacentHTML("beforebegin", html); el.remove(); }
    });
  }

  window.MathsShapes = {
    render, validate,
    templates: {
      circle: "show.circle(radius=5)",
      triangle: "show.triangle(a=3, b=4, c=5)",
      right_triangle: "show.right_triangle(a=3, b=4)",
      rectangle: "show.rectangle(w=6, h=4)",
      square: "show.square(side=4)",
      line: "show.line(length=6, label=true)",
      angle: "show.angle(deg=60, label=true)",
      polygon: "show.polygon(n=5, side=3)",
    },
  };
})();
