import { slugify, escapeHtml } from "../_seo.js";
const BASE="https://mathslearn.online";
function rich(value){return escapeHtml(value||"").replace(/\n\n/g,"</p><p>").replace(/\n/g,"<br>");}
function renderBook(row,slug,book,lectures){
  const title=escapeHtml(row.title), description=escapeHtml(row.subtitle||("Mathematics book by "+(row.author||"MathsLearn")));
  const url=BASE+"/books/"+encodeURIComponent(slug)+"/";
  const chapters=(lectures||[]).map((l,i)=>'<section><h2>Chapter '+(i+1)+': '+escapeHtml(l.title||("Chapter "+(i+1)))+'</h2>'+(l.subtitle?'<p>'+escapeHtml(l.subtitle)+'</p>':'')+(l.steps||[]).map(s=>'<article><h3>'+escapeHtml(s.heading||s.type||"Topic")+'</h3><p>'+rich(s.content||"")+'</p></article>').join("")+'</section>').join("");
  const data=JSON.stringify({"@context":"https://schema.org","@type":"Book","name":row.title,"author":row.author?{"@type":"Person","name":row.author}:undefined,"description":row.subtitle||row.title,"url":url}).replace(/</g,"\\u003c");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} | MathsLearn</title><meta name="description" content="${description}"><link rel="canonical" href="${escapeHtml(url)}"><meta name="robots" content="index,follow"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${escapeHtml(url)}"><script type="application/ld+json">${data}</script><link rel="stylesheet" href="/styles.css"><style>body{background:#f7f9fc}.book-wrap{max-width:900px;margin:32px auto;padding:0 18px}.book-card{background:white;border:1px solid #dce4f0;border-radius:18px;padding:clamp(20px,4vw,42px);line-height:1.85;overflow-wrap:anywhere}.book-card img{max-width:100%;height:auto}.book-card h2{margin-top:2em}.muted{color:#60708a}</style></head><body><main class="book-wrap"><article class="book-card"><p class="muted"><a href="/">MathsLearn</a> / Books</p><h1>${title}</h1><p>${description}</p><p class="muted">${escapeHtml(row.author||"")} ${row.org?" · "+escapeHtml(row.org):""}</p><p><a href="/books/?id=${encodeURIComponent(row.id)}">Open interactive book reader →</a></p><h2>Contents</h2>${(lectures||[]).map((l,i)=>'<p><a href="#chapter-'+(i+1)+'">Chapter '+(i+1)+': '+escapeHtml(l.title||("Chapter "+(i+1)))+'</a></p>').join("")}${chapters}</article></main></body></html>`;
}
export async function onRequest(context){
  const {request,env,params}=context;
  const slug=String(params.slug||"").replace(/^\/+|\/+$/g,"");
  if(slug==="index.html"||!slug)return context.next();
  if(!env.DB)return new Response("Service temporarily unavailable",{status:503});
  let row=await env.DB.prepare("SELECT id,title,subtitle,author,org,status,book_json,lectures_json,slug,url_path FROM books WHERE url_path=? AND status='published' LIMIT 1").bind("books/"+slug).first();
  if(!row){
    const legacy=await env.DB.prepare("SELECT id,title,subtitle,author,org,status,book_json,lectures_json,slug,url_path FROM books WHERE status='published' AND (url_path='' OR url_path IS NULL)").all();
    row=(legacy.results||[]).find(x=>(x.slug||slugify(x.title)+"-"+String(x.id).slice(0,8))===slug)||null;
  }
  if(!row)return new Response("Not found",{status:404,headers:{"content-type":"text/plain; charset=utf-8","X-Robots-Tag":"noindex"}});
  const book=JSON.parse(row.book_json||"{}"),lectures=JSON.parse(row.lectures_json||"[]");
  return new Response(renderBook(row,slug,book,lectures),{status:200,headers:{"content-type":"text/html; charset=utf-8","cache-control":"public, max-age=300","X-Content-Type-Options":"nosniff"}});
}
