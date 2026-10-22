const TYPE_PATHS = {
  "Study Notes": "notes",
  "Question Paper": "question-papers",
  "Solved Examples": "solved-examples",
  "Formula Sheet": "formula-sheets",
  "Solved Paper": "solved-papers",
  "Unsolved Questions": "unsolved-questions",
  "Important Questions": "important-questions"
};

export function slugify(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/g, "");
}

export function buildContentUrlPath(item, customSlug = "") {
  const prefix = TYPE_PATHS[item.content_type] || "notes";
  const course = slugify(item.course) || "general";
  const chapter = slugify(item.chapter || item.topic) || "general";
  const leaf = slugify(customSlug || item.title) || "content";
  return [prefix, course, chapter, leaf].join("/");
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[ch]);
}

export function absoluteCanonical(path) {
  return "https://mathslearn.online/" + String(path || "").replace(/^\/+|\/+$/g, "") + "/";
}

export function renderContentPage(item, path) {
  const title = escapeHtml(item.title);
  const description = escapeHtml(item.seo_description || item.excerpt || item.title);
  const canonical = escapeHtml(absoluteCanonical(path));
  const content = item.body_html || "";
  const course = escapeHtml(item.course || "");
  const subject = escapeHtml(item.subject || "Mathematics");
  const chapter = escapeHtml(item.chapter || item.topic || "");
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "LearningResource",
    name: item.title,
    description: item.seo_description || item.excerpt || item.title,
    learningResourceType: item.content_type,
    educationalLevel: item.course,
    inLanguage: "en",
    url: absoluteCanonical(path)
  }).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} | MathsLearn</title><meta name="description" content="${description}">
<link rel="canonical" href="${canonical}"><meta name="robots" content="index,follow">
<meta property="og:type" content="article"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${canonical}">
<script type="application/ld+json">${jsonLd}</script>
<link rel="stylesheet" href="/styles.css">
<style>body{background:#f7f9fc}.seo-wrap{max-width:900px;margin:32px auto;padding:0 18px}.seo-card{background:#fff;border:1px solid #dce4f0;border-radius:18px;padding:clamp(20px,4vw,42px);line-height:1.85;overflow-wrap:anywhere}.seo-meta{color:#5c6d86;font-size:14px}.seo-body img{max-width:100%;height:auto}.seo-body table{max-width:100%;display:block;overflow:auto}.seo-body h2,.seo-body h3{line-height:1.35;margin-top:1.7em}.seo-breadcrumb{font-size:14px;margin-bottom:14px}.seo-breadcrumb a{color:#245bc5}.seo-nav{display:flex;gap:16px;flex-wrap:wrap;margin-top:24px}</style></head>
<body><main class="seo-wrap"><nav class="seo-breadcrumb"><a href="/">MathsLearn</a> / <a href="/#notes">Study resources</a> / ${title}</nav>
<article class="seo-card"><p class="seo-meta">${course}${subject ? " · " + subject : ""}${chapter ? " · " + chapter : ""}</p><h1>${title}</h1>
${item.excerpt ? "<p>" + escapeHtml(item.excerpt) + "</p>" : ""}
<div class="seo-body">${content}</div>
<nav class="seo-nav"><a href="/">MathsLearn Home</a><a href="/#notes">More study resources</a></nav></article></main></body></html>`;
}

export async function onRequestContentPage({ request, env, params }, prefix) {
  if (!env.DB) return new Response("Service temporarily unavailable", {status:503});
  const pathPart = String(params?.path || "").replace(/^\/+|\/+$/g, "");
  if (!pathPart || pathPart.includes("..")) return new Response("Not found", {status:404});
  const path = prefix + "/" + pathPart;
  let item = await env.DB.prepare("SELECT id,title,content_type,course,subject,chapter,topic,excerpt,seo_description,body_html,status,url_path,slug FROM content WHERE url_path=? AND status='published' LIMIT 1").bind(path).first();
  if (!item) {
    const legacy = await env.DB.prepare("SELECT id,title,content_type,course,subject,chapter,topic,excerpt,seo_description,body_html,status,url_path,slug FROM content WHERE status='published' AND (url_path='' OR url_path IS NULL)").all();
    item = (legacy.results || []).find(row => buildContentUrlPath(row, slugify(row.title) + "-" + String(row.id).slice(0, 8)) === path) || null;
  }
  if (!item) return new Response("Not found", {status:404, headers:{"content-type":"text/plain; charset=utf-8","X-Robots-Tag":"noindex"}});
  return new Response(renderContentPage(item, path), {status:200,headers:{"content-type":"text/html; charset=utf-8","cache-control":"public, max-age=300","X-Content-Type-Options":"nosniff"}});
}
