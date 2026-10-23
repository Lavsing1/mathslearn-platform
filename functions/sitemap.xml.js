import { buildContentUrlPath, slugify } from "./_seo.js";

const BASE = "https://mathslearn.online";
function xmlEscape(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function dateOnly(value) {
  return String(value || "").slice(0, 10) || new Date().toISOString().slice(0, 10);
}
function addEntry(entries, path, updatedAt) {
  const cleanPath = String(path || "").replace(/^\/+|\/+$/g, "");
  const url = cleanPath ? BASE + "/" + cleanPath + "/" : BASE + "/";
  entries.set(url, dateOnly(updatedAt));
}

export async function onRequestGet({ env }) {
  const entries = new Map();
  addEntry(entries, "", new Date().toISOString());

  // Keep sitemap available when the SEO URL migration has not been applied yet.
  // Do not run migrations or write to the database from this endpoint.
  if (env.DB) {
    let rows = [];
    try {
      const result = await env.DB.prepare(
        "SELECT id,title,content_type,course,board_exam,subject,topic,chapter,slug,url_path,updated_at FROM content WHERE status='published'"
      ).all();
      rows = result.results || [];
    } catch (error) {
      // Older production schemas may not have slug/url_path yet.
      try {
        const result = await env.DB.prepare(
          "SELECT id,title,content_type,course,board_exam,subject,topic,chapter,updated_at FROM content WHERE status='published'"
        ).all();
        rows = (result.results || []).map(item => ({ ...item, slug: "", url_path: "" }));
      } catch {
        // Return the homepage sitemap entry rather than throwing Error 1101.
        rows = [];
      }
    }

    for (const item of rows) {
      const legacySlug = (item.slug || slugify(item.title)) + (item.url_path ? "" : "-" + String(item.id).slice(0, 8));
      const path = item.url_path || buildContentUrlPath(item, legacySlug);
      addEntry(entries, path, item.updated_at);
    }

    let books = [];
    try {
      const result = await env.DB.prepare(
        "SELECT id,title,slug,url_path,updated_at FROM books WHERE status='published'"
      ).all();
      books = result.results || [];
    } catch {
      // The books table or SEO columns may not exist in an older production schema.
      try {
        const result = await env.DB.prepare(
          "SELECT id,title,updated_at FROM books WHERE status='published'"
        ).all();
        books = (result.results || []).map(book => ({ ...book, slug: "", url_path: "" }));
      } catch {
        books = [];
      }
    }

    for (const book of books) {
      const slug = book.slug || slugify(book.title) + "-" + String(book.id).slice(0, 8);
      const path = book.url_path || "books/" + slug;
      addEntry(entries, path, book.updated_at);
    }
  }

  const body = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    [...entries.entries()].map(([loc, lastmod]) =>
      '<url><loc>' + xmlEscape(loc) + '</loc><lastmod>' + xmlEscape(lastmod) + '</lastmod></url>'
    ).join("") +
    '</urlset>';

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=300"
    }
  });
}
