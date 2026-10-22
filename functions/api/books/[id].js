import { json, getAdmin, sameOrigin } from "../../_utils.js";
const MAX_BODY=2_500_000;
async function body(request){const t=await request.text();if(new TextEncoder().encode(t).byteLength>MAX_BODY)throw new Error("Too large");return JSON.parse(t);}
export async function onRequestPut({request,env,params}) {
  if(!sameOrigin(request))return json({error:"Invalid request origin."},403);
  if(!(await getAdmin(request,env)))return json({error:"Admin login required."},401);
  if(!env.DB)return json({error:"D1 binding DB is missing."},503);
  let x;try{x=await body(request)}catch{return json({error:"Invalid or oversized data."},400)}
  const id=String(params.id||"");
  const old=await env.DB.prepare("SELECT * FROM books WHERE id=?").bind(id).first();
  if(!old)return json({error:"Book not found."},404);
  if(x.status && ["draft","published","hidden"].includes(x.status) && !x.book){
    if(x.status==="published"){
      const existingLectures=JSON.parse(old.lectures_json);
      if(!Array.isArray(existingLectures)||!existingLectures.some(l=>Array.isArray(l.steps)&&l.steps.length))return json({error:"Add chapter content before publishing."},400);
    }
    const now=new Date().toISOString();
    await env.DB.prepare("UPDATE books SET status=?,updated_at=? WHERE id=?").bind(x.status,now,id).run();
    return json({book:{id,status:x.status,updated_at:now}});
  }
  const b=x.book;if(!b||!String(b.title||"").trim())return json({error:"Book title is required."},400);
  const book={title:String(b.title).slice(0,220),subtitle:String(b.subtitle||"").slice(0,500),author:String(b.author||"").slice(0,180),org:String(b.org||"").slice(0,180),size:b.size==="a5"?"a5":"a4",order:Array.isArray(b.order)?b.order.map(String).slice(0,300):[]};
  const lectures=Array.isArray(x.lectures)?x.lectures.slice(0,300):JSON.parse(old.lectures_json);
  const serialized=JSON.stringify({book,lectures});if(serialized.length>MAX_BODY)return json({error:"Book data is too large. Export a backup and reduce image sizes."},413);
  const status=["draft","published","hidden"].includes(x.status)?x.status:old.status;
  const now=new Date().toISOString();
  await env.DB.prepare("UPDATE books SET title=?,subtitle=?,author=?,org=?,page_size=?,book_json=?,lectures_json=?,status=?,updated_at=? WHERE id=?")
    .bind(book.title,book.subtitle,book.author,book.org,book.size,JSON.stringify(book),JSON.stringify(lectures),status,now,id).run();
  return json({book:{id,...book,status,updated_at:now}});
}
export async function onRequestDelete({request,env,params}) {
  if(!sameOrigin(request))return json({error:"Invalid request origin."},403);
  if(!(await getAdmin(request,env)))return json({error:"Admin login required."},401);
  if(!env.DB)return json({error:"D1 binding DB is missing."},503);
  const id=String(params.id||"");
  const row=await env.DB.prepare("SELECT id FROM books WHERE id=?").bind(id).first();
  if(!row)return json({error:"Book not found."},404);
  await env.DB.prepare("DELETE FROM books WHERE id=?").bind(id).run();
  return json({ok:true});
}
