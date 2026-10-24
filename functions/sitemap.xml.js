// https://mathslearn.online/sitemap.xml — built live from the database, so every
// published note/paper/book is listed automatically and drafts never are.
// (Replaces the old static sitemap.xml, which only listed 4 pages.)
const ORIGIN = "https://mathslearn.online";
const STATIC_PAGES = [
  { path: "/", priority: "1.0", freq: "daily" },
  { path: "/notes", priority: "0.9", freq: "daily" },
  { path: "/books", priority: "0.8", freq: "weekly" },
  { path: "/about", priority: "0.4", freq: "monthly" },
];
const LEVELS = ["class-9", "class-10", "class-11", "class-12", "bsc", "iit-jam", "isi", "cmi", "tifr"];

const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function onRequestGet({ env }) {
  let rows = [];
  try {
    const res = await env.DB.prepare(
      "SELECT level, content_type, slug, updated_at FROM content WHERE status = 'published' ORDER BY updated_at DESC LIMIT 5000"
    ).all();
    rows = res.results || [];
  } catch (e) {
    // database not ready yet — still serve the static pages
  }

  const lines = [];
  for (const p of STATIC_PAGES) {
    lines.push(`  <url><loc>${ORIGIN}${p.path}</loc><changefreq>${p.freq}</changefreq><priority>${p.priority}</priority></url>`);
  }
  for (const l of LEVELS) {
    lines.push(`  <url><loc>${ORIGIN}/class?level=${l}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`);
  }
  for (const r of rows) {
    const loc = `${ORIGIN}/${r.content_type}/${r.level}/${encodeURIComponent(r.slug)}/`;
    lines.push(`  <url><loc>${esc(loc)}</loc><lastmod>${String(r.updated_at).slice(0, 10)}</lastmod></url>`);
  }

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${lines.join("\n")}\n</urlset>\n`,
    { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } }
  );
}
