import { json, getAdmin, sameOrigin, readJson, cleanText, sanitizeHtml } from "../../_utils.js";
import { buildContentUrlPath, slugify } from "../../_seo.js";
const TYPES = new Set(["Study Notes", "Question Paper", "Solved Examples", "Formula Sheet", "Solved Paper", "Unsolved Questions", "Important Questions"]);
const LEVELS = new Set(["School Mathematics", "Higher Secondary", "Undergraduate", "Entrance Preparation"]);

export async function onRequestPut({ request, env, params }) {
  if (!sameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  if (!await getAdmin(request, env)) return json({ error: "Admin login required." }, 401);
  if (!env.DB) return json({ error: "D1 binding DB is missing." }, 503);
  let data; try { data = await readJson(request); } catch { return json({ error: "Invalid or oversized request body." }, 400); }
  const item = validate(data); if (item.error) return json({ error: item.error }, 400);
  const current = await env.DB.prepare("SELECT id,slug,url_path FROM content WHERE id=?").bind(params.id).first();
  if (!current) return json({ error: "Content item not found." }, 404);
  const slug = slugify(item.slug || current.slug || item.title);
  const url_path = buildContentUrlPath(item, slug);
  const duplicate = await env.DB.prepare("SELECT id,title FROM content WHERE url_path=? AND id<>? LIMIT 1").bind(url_path, params.id).first();
  if (duplicate) return json({ error: `Duplicate URL: /${url_path}/ already belongs to “${duplicate.title}”. Change the URL slug before saving.`, code: "DUPLICATE_URL", url_path }, 409);
  const now = new Date().toISOString();
  try {
    const res = await env.DB.prepare(`UPDATE content SET title=?,content_type=?,paper_type=?,study_level=?,course=?,board_exam=?,topic=?,subject=?,chapter=?,excerpt=?,thumbnail_url=?,seo_description=?,body_html=?,status=?,slug=?,url_path=?,updated_at=? WHERE id=?`)
      .bind(item.title,item.content_type,item.paper_type,item.study_level,item.course,item.board_exam,item.topic,item.subject,item.chapter,item.excerpt,item.thumbnail_url,item.seo_description,item.body_html,item.status,slug,url_path,now,params.id).run();
    if (!res.meta?.changes) return json({ error: "Content item not found." }, 404);
  } catch (error) {
    if (/unique|constraint/i.test(String(error?.message || error))) return json({ error: "This URL already exists. Choose a different URL slug.", code: "DUPLICATE_URL", url_path }, 409);
    throw error;
  }
  return json({ item: { id: params.id, ...item, slug, url_path, created_at: current.created_at, updated_at: now } });
}
export async function onRequestDelete({ request, env, params }) {
  if (!sameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  if (!await getAdmin(request, env)) return json({ error: "Admin login required." }, 401);
  if (!env.DB) return json({ error: "D1 binding DB is missing." }, 503);
  const res = await env.DB.prepare("DELETE FROM content WHERE id = ?").bind(params.id).run();
  if (!res.meta?.changes) return json({ error: "Content item not found." }, 404);
  return json({ ok: true });
}
function validate(data) {
  const title=cleanText(data.title,180), content_type=cleanText(data.content_type||data.type,40), paper_type=cleanText(data.paper_type||data.paperType,40), study_level=cleanText(data.study_level||data.level,60), course=cleanText(data.course,80), board_exam=cleanText(data.board_exam||data.board,80), topic=cleanText(data.topic,160), seo_description=cleanText(data.seo_description||data.seo,300), subject=cleanText(data.subject,100), chapter=cleanText(data.chapter||data.topic,160), excerpt=cleanText(data.excerpt||data.seo_description||data.seo,360), thumbnail_url=cleanText(data.thumbnail_url,1000), slug=cleanText(data.slug,100), body_html=sanitizeHtml(data.body_html||data.body||""), status=data.status==="published"?"published":"draft";
  if(!title)return{error:"Title is required."}; if(status==="published"&&!body_html.trim())return{error:"Add content before publishing."}; if(!TYPES.has(content_type))return{error:"Invalid content type."}; if(!LEVELS.has(study_level))return{error:"Invalid study level."}; if(content_type==="Question Paper"&&!["Sample Paper","Previous Year Paper","Practice Set","Solved Paper"].includes(paper_type))return{error:"Select a valid question paper type."}; if(!course)return{error:"Class/course is required."}; if(thumbnail_url&&!thumbnail_url.toLowerCase().startsWith("https://"))return{error:"Thumbnail URL must start with https://."};
  return {title,content_type,paper_type:content_type==="Question Paper"?paper_type:"",study_level,course,board_exam,topic,subject,chapter,excerpt,thumbnail_url,seo_description,body_html,status,slug};
}
