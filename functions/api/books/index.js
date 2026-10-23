import { json, getAdmin, sameOrigin } from "../../_utils.js";
import { slugify } from "../../_seo.js";
const MAX_BODY = 2_500_000;
async function body(request) {
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY) throw new Error("Book data is too large (maximum 2.5 MB). Export a backup and reduce image sizes.");
  return JSON.parse(text);
}
function validStatus(s) { return ["draft","published","hidden"].includes(s) ? s : "draft"; }
function validate(x) {
  const b = x && x.book;
  if (!b || !String(b.title||"").trim()) return {error:"Book title is required."};
  const book = {title:String(b.title).slice(0,220),subtitle:String(b.subtitle||"").slice(0,500),author:String(b.author||"").slice(0,180),org:String(b.org||"").slice(0,180),size:b.size==="a5"?"a5":"a4",order:Array.isArray(b.order)?b.order.map(String).slice(0,300):[]};
  const lectures = Array.isArray(x.lectures)?x.lectures.slice(0,300):[];
  if (!lectures.length) return {error:"Add at least one chapter before saving."};
  const serialized = JSON.stringify({book,lectures});
  if (serialized.length > MAX_BODY) return {error:"Book data is too large. Export a backup and reduce image sizes."};
  if (x.status==="published" && !lectures.some(l=>Array.isArray(l.steps)&&l.steps.length)) return {error:"Add chapter content before publishing."};
  return {book,lectures,status:validStatus(x.status)};
}
function publicShape(row) {
  const slug = row.slug || slugify(row.title) + "-" + String(row.id).slice(0,8);
  return {...row, slug, url_path:row.url_path || "books/" + slug};
}
export async function onRequestGet({request,env}) {
  if (!env.DB) return json({error:"D1 binding DB is missing."},503);
  const admin = await getAdmin(request,env);
  const url = new URL(request.url), id=url.searchParams.get("id");
  if (id) {
    const row = await env.DB.prepare("SELECT id,title,subtitle,author,org,page_size,status,book_json,lectures_json,slug,url_path,created_at,updated_at FROM books WHERE id=?").bind(id).first();
    if (!row || (!admin && row.status!=="published")) return json({error:"Book not found."},404);
    return json({book:{...publicShape(row),book:JSON.parse(row.book_json),lectures:JSON.parse(row.lectures_json)}});
  }
  const rows = admin
    ? await env.DB.prepare("SELECT id,title,subtitle,author,org,page_size,status,slug,url_path,created_at,updated_at FROM books ORDER BY updated_at DESC LIMIT 200").all()
    : await env.DB.prepare("SELECT id,title,subtitle,author,org,page_size,status,slug,url_path,created_at,updated_at FROM books WHERE status='published' ORDER BY updated_at DESC LIMIT 200").all();
  return json({books:(rows.results||[]).map(publicShape)});
}
export async function onRequestPost({request,env}) {
  if (!sameOrigin(request)) return json({error:"Invalid request origin."},403);
  if (!(await getAdmin(request,env))) return json({error:"Admin login required."},401);
  if (!env.DB) return json({error:"D1 binding DB is missing."},503);
  let x; try{x=await body(request)}catch{return json({error:"Invalid or oversized book data."},400)}
  const v=validate(x); if(v.error)return json({error:v.error},400);
  const now=new Date().toISOString(), id=crypto.randomUUID();
  const slug=slugify(v.book.title), url_path="books/"+slug;
  const duplicate=await env.DB.prepare("SELECT id,title FROM books WHERE url_path=? LIMIT 1").bind(url_path).first();
  if(duplicate)return json({error:"Duplicate book URL: /"+url_path+"/ already belongs to “"+duplicate.title+"”. Change the book title to make its URL unique.",code:"DUPLICATE_URL",url_path},409);
  try {
    await env.DB.prepare("INSERT INTO books (id,title,subtitle,author,org,page_size,book_json,lectures_json,status,slug,url_path,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(id,v.book.title,v.book.subtitle,v.book.author,v.book.org,v.book.size,JSON.stringify(v.book),JSON.stringify(v.lectures),v.status,slug,url_path,now,now).run();
  } catch(error) {
    if(/unique|constraint/i.test(String(error?.message||error)))return json({error:"This book URL already exists. Choose a different book title.",code:"DUPLICATE_URL",url_path},409);
    throw error;
  }
  return json({book:{id,...v.book,status:v.status,slug,url_path,created_at:now,updated_at:now}},201);
}
