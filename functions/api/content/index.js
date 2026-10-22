import { json, getAdmin, sameOrigin, readJson, cleanText, sanitizeHtml } from "../../_utils.js";
const TYPES = new Set(["Study Notes", "Question Paper", "Solved Examples", "Formula Sheet", "Solved Paper", "Unsolved Questions", "Important Questions"]);
const LEVELS = new Set(["School Mathematics", "Higher Secondary", "Undergraduate", "Entrance Preparation"]);

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: "D1 binding DB is missing. Configure wrangler.toml and deploy again." }, 503);
  const url = new URL(request.url);
  const admin = await getAdmin(request, env);
  const conditions = [];
  const binds = [];
  if (!admin || url.searchParams.get("public") === "1") conditions.push("status = 'published'");
  const filters = [["type", "content_type"], ["level", "study_level"], ["course", "course"], ["board", "board_exam"], ["subject", "subject"], ["chapter", "chapter"]];
  for (const [param, column] of filters) {
    const v = cleanText(url.searchParams.get(param), 100);
    if (v) { conditions.push(`${column} = ?`); binds.push(v); }
  }
  const q = cleanText(url.searchParams.get("q"), 100);
  if (q) {
    conditions.push("(title LIKE ? OR topic LIKE ? OR subject LIKE ? OR chapter LIKE ? OR excerpt LIKE ? OR course LIKE ? OR board_exam LIKE ? OR seo_description LIKE ?)");
    const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
    binds.push(pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await env.DB.prepare(`SELECT id,title,content_type,paper_type,study_level,course,board_exam,topic,subject,chapter,excerpt,thumbnail_url,seo_description,body_html,status,created_at,updated_at FROM content ${where} ORDER BY updated_at DESC LIMIT 200`).bind(...binds).all();
  return json({ items: result.results || [] });
}
export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  const admin = await getAdmin(request, env);
  if (!admin) return json({ error: "Admin login required." }, 401);
  if (!env.DB) return json({ error: "D1 binding DB is missing." }, 503);
  let data;
  try { data = await readJson(request); } catch { return json({ error: "Invalid or oversized request body." }, 400); }
  const item = validate(data);
  if (item.error) return json({ error: item.error }, 400);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO content (id,title,content_type,paper_type,study_level,course,board_exam,topic,subject,chapter,excerpt,thumbnail_url,seo_description,body_html,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id,item.title,item.content_type,item.paper_type,item.study_level,item.course,item.board_exam,item.topic,item.subject,item.chapter,item.excerpt,item.thumbnail_url,item.seo_description,item.body_html,item.status,now,now).run();
  return json({ item: { id, ...item, created_at: now, updated_at: now } }, 201);
}
function validate(data) {
  const title = cleanText(data.title, 180);
  const content_type = cleanText(data.content_type || data.type, 40);
  const paper_type = cleanText(data.paper_type || data.paperType, 40);
  const study_level = cleanText(data.study_level || data.level, 60);
  const course = cleanText(data.course, 80);
  const board_exam = cleanText(data.board_exam || data.board, 80);
  const topic = cleanText(data.topic, 160);
  const seo_description = cleanText(data.seo_description || data.seo, 300);
  const subject = cleanText(data.subject, 100);
  const chapter = cleanText(data.chapter || data.topic, 160);
  const excerpt = cleanText(data.excerpt || data.seo_description || data.seo, 360);
  const thumbnail_url = cleanText(data.thumbnail_url, 1000);
  const body_html = sanitizeHtml(data.body_html || data.body || "");
  const status = data.status === "published" ? "published" : "draft";
  if (!title) return { error: "Title is required." };
  if (!TYPES.has(content_type)) return { error: "Invalid content type." };
  if (!LEVELS.has(study_level)) return { error: "Invalid study level." };
  if (content_type === "Question Paper" && !["Sample Paper","Previous Year Paper","Practice Set","Solved Paper"].includes(paper_type)) return { error: "Select a valid question paper type." };
  if (!course) return { error: "Class/course is required." };
  if (thumbnail_url && !thumbnail_url.toLowerCase().startsWith("https://")) return { error: "Thumbnail URL must start with https://." };
  if (body_html.length > 300000) return { error: "Content is too large." };
  if (status === "published" && !body_html.trim()) return { error: "Add content before publishing." };
  return { title, content_type, paper_type:content_type === "Question Paper" ? paper_type : "", study_level, course, board_exam, topic, subject, chapter, excerpt, thumbnail_url, seo_description, body_html, status };
}
export { validate };
