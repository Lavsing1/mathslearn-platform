import { buildContentUrlPath, slugify } from "./_seo.js";
const BASE = "https://mathslearn.online";
function xmlEscape(value) { return String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;"); }
export async function onRequestGet({ env }) {
  if (!env.DB) return new Response("Sitemap temporarily unavailable", {status:503});
  const rows = await env.DB.prepare("SELECT id,title,content_type,course,board_exam,subject,topic,chapter,slug,url_path,updated_at FROM content WHERE status='published'").all();
  const entries = new Map();
  entries.set(BASE + "/", new Date().toISOString().slice(0,10));
  for (const item of rows.results || []) {
    const legacySlug = (item.slug || slugify(item.title)) + (item.url_path ? "" : "-" + String(item.id).slice(0,8));
    const path = item.url_path || buildContentUrlPath(item, legacySlug);
    const url = BASE + "/" + path.replace(/^\/+|\/+$/g,"") + "/";
    entries.set(url, String(item.updated_at || "").slice(0,10) || new Date().toISOString().slice(0,10));
  }
  const books = await env.DB.prepare("SELECT id,title,slug,url_path,updated_at FROM books WHERE status='published'").all();
  for (const book of books.results || []) {
    const slug = book.slug || slugify(book.title) + "-" + String(book.id).slice(0,8);
    const path = book.url_path || "books/" + slug;
    const url = BASE + "/" + path.replace(/^\/+|\/+$/g,"") + "/";
    entries.set(url, String(book.updated_at || "").slice(0,10) || new Date().toISOString().slice(0,10));
  }
  const body = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    [...entries.entries()].map(([loc,lastmod]) => '<url><loc>'+xmlEscape(loc)+'</loc><lastmod>'+xmlEscape(lastmod)+'</lastmod></url>').join("") +
    '</urlset>';
  return new Response(body, {status:200,headers:{"content-type":"application/xml; charset=utf-8","cache-control":"public, max-age=300"}});
}
