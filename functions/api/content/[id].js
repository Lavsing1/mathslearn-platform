import { json, getAdmin, sameOrigin, readJson, cleanText, sanitizeHtml } from "../../_utils.js";
const TYPES = new Set(["Study Notes", "Question Paper", "Solved Examples", "Formula Sheet"]);
const LEVELS = new Set(["School Mathematics", "Higher Secondary", "Undergraduate", "Entrance Preparation"]);
export async function onRequestPut({ request, env, params }) {
  if (!sameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  if (!await getAdmin(request, env)) return json({ error: "Admin login required." }, 401);
  if (!env.DB) return json({ error: "D1 binding DB is missing." }, 503);
  let d; try { d = await readJson(request); } catch { return json({ error: "Invalid or oversized request body." }, 400); }
  const item = validate(d); if (item.error) return json({ error: item.error }, 400);
  const now = new Date().toISOString();
  const res = await env.DB.prepare(`UPDATE content SET title=?,content_type=?,paper_type=?,study_level=?,course=?,board_exam=?,topic=?,subject=?,chapter=?,excerpt=?,thumbnail_url=?,seo_description=?,body_html=?,status=?,updated_at=? WHERE id=?`)
    .bind(item.title,item.content_type,item.paper_type,item.study_level,item.course,item.board_exam,item.topic,item.subject,item.chapter,item.excerpt,item.thumbnail_url,item.seo_description,item.body_html,item.status,now,params.id).run();
  if (!res.meta?.changes) return json({ error: "Content item not found." }, 404);
  return json({ item: { id: params.id, ...item, updated_at: now } });
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
  const title=cleanText(data.title,180), content_type=cleanText(data.content_type||data.type,40), paper_type=cleanText(data.paper_type||data.paperType,40), study_level=cleanText(data.study_level||data.level,60), course=cleanText(data.course,80), board_exam=cleanText(data.board_exam||data.board,80), topic=cleanText(data.topic,160), seo_description=cleanText(data.seo_description||data.seo,300), subject=cleanText(data.subject,100), chapter=cleanText(data.chapter||data.topic,160), excerpt=cleanText(data.excerpt||data.seo_description||data.seo,360), thumbnail_url=cleanText(data.thumbnail_url,1000), body_html=sanitizeHtml(data.body_html||data.body||""), status=data.status==="published"?"published":"draft";
  if(!title)return{error:"Title is required."}; if(status==="published"&&!body_html.trim())return{error:"Add content before publishing."}; if(!TYPES.has(content_type))return{error:"Invalid content type."}; if(!LEVELS.has(study_level))return{error:"Invalid study level."}; if(content_type==="Question Paper"&&!["Sample Paper","Previous Year Paper","Practice Set","Solved Paper"].includes(paper_type))return{error:"Select a valid question paper type."}; if(!course)return{error:"Class/course is required."}; if(thumbnail_url&&!/^https:\\/\\//i.test(thumbnail_url))return{error:"Thumbnail URL must start with https://."};
  return {title,content_type,paper_type:content_type==="Question Paper"?paper_type:"",study_level,course,board_exam,topic,subject,chapter,excerpt,thumbnail_url,seo_description,body_html,status};
}
