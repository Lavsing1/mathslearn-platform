const app=document.getElementById('app');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeDataImage=s=>/^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(String(s||''))?s:'';
let bookData=null,bookMeta=null,readerPages=[],currentPage=0,searchTerm='';
function rich(s){let x=esc(s||'');x=x.replace(/\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^$\n]+?)\$/g,(_,dd,db,ip,id)=>{const display=dd!==undefined||db!==undefined,formula=dd??db??ip??id??'';return display?'<div class="formula display-formula" data-display="true">'+formula+'</div>':'<span class="formula" data-display="false">'+formula+'</span>';});x=x.replace(/\n\n/g,'</p><p>').replace(/\n/g,'<br>');return '<p>'+x+'</p>';}
function renderStep(s){
 const typ=String(s.type||'text');
 if(typ==='section'||typ==='subsection')return '<div class="topic-heading" data-topic="'+esc(s.heading||s.content||'')+'"><h3>'+rich(s.heading||s.content||'')+'</h3></div>';
 let out='<article class="block">';
 if(['definition','theorem','lemma','corollary','proof','example','remark','exercise'].includes(typ))out+='<div class="tag">'+esc(typ)+'</div>';
 if(s.heading)out+='<h3>'+rich(s.heading)+'</h3>';
 out+=rich(s.content||'');
 const im=safeDataImage(s.imageData);
 if(im){const iw=Math.max(20,Math.min(100,Number(s.imageWidth)||100));out+='<figure class="ml-image-block"><img src="'+im+'" alt="'+esc(s.imageAlt||'Book illustration')+'" style="width:'+iw+'%;display:block;margin:'+(s.imageAlign==='left'?'0 auto 0 0':s.imageAlign==='right'?'0 0 0 auto':'0 auto')+'"><figcaption>'+esc(s.imageCaption||'')+'</figcaption></figure>';}
 if(s.draw&&Array.isArray(s.draw.shapes)&&s.draw.shapes.length){
  out+='<div class="diagram"><svg viewBox="0 0 800 '+Math.max(120,Math.min(900,Number(s.draw.h)||300))+'" width="100%" role="img" aria-label="Mathematics diagram">';
  s.draw.shapes.forEach(d=>{if(d.t==='line'||d.t==='dash'||d.t==='arrow')out+='<line x1="'+Number(d.x1)+'" y1="'+Number(d.y1)+'" x2="'+Number(d.x2)+'" y2="'+Number(d.y2)+'" stroke="#1d4ed8" stroke-width="2.5" '+(d.t==='dash'?'stroke-dasharray="8 6"':'')+'/>';else if(d.t==='circ')out+='<circle cx="'+Number(d.x1)+'" cy="'+Number(d.y1)+'" r="'+Math.hypot(Number(d.x2)-Number(d.x1),Number(d.y2)-Number(d.y1))+'" fill="none" stroke="#1d4ed8" stroke-width="2.5"/>';else if(d.t==='rect')out+='<rect x="'+Math.min(Number(d.x1),Number(d.x2))+'" y="'+Math.min(Number(d.y1),Number(d.y2))+'" width="'+Math.abs(Number(d.x2)-Number(d.x1))+'" height="'+Math.abs(Number(d.y2)-Number(d.y1))+'" fill="none" stroke="#1d4ed8" stroke-width="2.5"/>';});
  out+='</svg></div>';
 }
 return out+'</article>';
}
function plain(s){return String(s||'').replace(/\$\$?[\s\S]*?\$\$?/g,' ').replace(/\\[()[\]]/g,' ').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();}
function makePages(lectures){
 const pages=[];
 (lectures||[]).forEach((l,ci)=>{
  const steps=Array.isArray(l.steps)?l.steps:[];
  // A digital page is a stable reading unit (up to four authored blocks), not a print/PDF page.
  const groups=[];if(!steps.length)groups.push([]);else for(let i=0;i<steps.length;i+=4)groups.push(steps.slice(i,i+4));
  groups.forEach((group,pi)=>{
   const topic=group.map(s=>s.heading||((s.type==='section'||s.type==='subsection')?s.content:'')).filter(Boolean).join(' · ');
   const text=[l.title,l.subtitle,...group.map(s=>[s.type,s.heading,s.content].join(' '))].join(' ');
   pages.push({chapterIndex:ci,chapterTitle:l.title||('Chapter '+(ci+1)),chapterSubtitle:l.subtitle||'',chapterPage:pi+1,chapterPages:groups.length,steps:group,topic,text});
  });
 });
 return pages;
}
function math(root){if(window.katex)root.querySelectorAll('.formula').forEach(e=>{const t=e.textContent;try{katex.render(t,e,{throwOnError:false,strict:'ignore',displayMode:e.dataset.display==='true'})}catch(err){e.textContent=t;e.classList.add('formula-error')}});}
function goPage(n){if(!readerPages.length)return;currentPage=Math.max(0,Math.min(readerPages.length-1,Number(n)||0));renderReader();window.scrollTo({top:0,behavior:'smooth'});}
function renderPageContent(p){
 let out='<div class="book-kicker">Chapter '+(p.chapterIndex+1)+' · Page '+(currentPage+1)+'</div>';
 if(p.chapterPage===1)out+='<h2>'+esc(p.chapterTitle)+'</h2>'+(p.chapterSubtitle?'<p class="muted">'+esc(p.chapterSubtitle)+'</p>':'');
 out+='<div class="book-page-content">'+p.steps.map(renderStep).join('')+'</div>';
 return out;
}
function renderReader(){
 const p=readerPages[currentPage];if(!p)return;
 const toc=Array.from(new Map(readerPages.map((x,i)=>[x.chapterIndex,{chapterIndex:x.chapterIndex,title:x.chapterTitle,page:i}])).values());
 const q=searchTerm.trim().toLowerCase();
 const results=q?readerPages.map((x,i)=>({p:x,i})).filter(x=>x.p.text.toLowerCase().includes(q)).slice(0,30):[];
 app.innerHTML='<div class="reader-tools"><label>Search this book by topic or keyword<input id="topicSearch" type="search" placeholder="e.g. continuity, theorem, eigenvalues" value="'+esc(searchTerm)+'"></label><label>Go to page<input id="pageJump" type="number" min="1" max="'+readerPages.length+'" value="'+(currentPage+1)+'"></label><button class="primary" id="jumpBtn" type="button">Go to page</button></div>'+
 (q?'<section class="search-results"><h2>Search results</h2><p class="muted">'+results.length+' matching page(s) shown'+(results.length===30?' (first 30)':'')+'.</p>'+(results.length?results.map(x=>'<button type="button" data-result-page="'+x.i+'"><strong>'+esc(x.p.topic||x.p.chapterTitle)+'</strong><small>Page '+(x.i+1)+' · Chapter '+(x.p.chapterIndex+1)+' — '+esc(x.p.chapterTitle)+'</small></button>').join(''):'<p class="muted">No matching topic found. Try another keyword.</p>')+'</section>':'')+
 '<div class="book-layout"><aside class="book-toc"><h2>Contents</h2>'+toc.map(x=>'<button class="toc-link '+(x.chapterIndex===p.chapterIndex?'active':'')+'" type="button" data-toc-page="'+x.page+'">'+(x.chapterIndex+1)+'. '+esc(x.title)+'</button>').join('')+'</aside>'+
 '<section><article class="book-sheet"><div class="book-kicker">MathsLearn · Mathematics Library</div><h1>'+esc(bookMeta.title||bookData.title||'Mathematics Book')+'</h1><p class="book-meta">'+esc(bookMeta.subtitle||bookData.subtitle||'')+(bookMeta.author||bookData.author?' · '+esc(bookMeta.author||bookData.author):'')+'</p>'+renderPageContent(p)+'</article>'+
 '<div class="page-controls"><button id="prevPage" type="button" '+(currentPage===0?'disabled':'')+'>← Previous</button><span class="page-count">Page '+(currentPage+1)+' of '+readerPages.length+'</span><button id="nextPage" type="button" '+(currentPage===readerPages.length-1?'disabled':'')+'>Next →</button></div><p class="muted" style="font-size:12px">Digital reader pages are generated from the book’s content blocks. Printed PDF page numbers may differ.</p></section></div>';
 const search=document.getElementById('topicSearch');search.addEventListener('input',e=>{searchTerm=e.target.value;const pos=e.target.selectionStart;renderReader();const el=document.getElementById('topicSearch');el.focus();el.setSelectionRange(pos,pos);});
 document.getElementById('jumpBtn').addEventListener('click',()=>{const n=Number(document.getElementById('pageJump').value);if(Number.isInteger(n)&&n>=1&&n<=readerPages.length)goPage(n-1);else document.getElementById('pageJump').focus();});
 document.getElementById('pageJump').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('jumpBtn').click();});
 document.getElementById('prevPage').addEventListener('click',()=>goPage(currentPage-1));document.getElementById('nextPage').addEventListener('click',()=>goPage(currentPage+1));
 app.querySelectorAll('[data-result-page]').forEach(b=>b.addEventListener('click',()=>goPage(Number(b.dataset.resultPage))));
 app.querySelectorAll('[data-toc-page]').forEach(b=>b.addEventListener('click',()=>goPage(Number(b.dataset.tocPage))));
 math(app);
}
async function main(){
 const id=new URLSearchParams(location.search).get('id');
 if(!id){
  const r=await fetch('/api/books',{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error||'Could not load books');
  app.innerHTML='<h1>Mathematics Books</h1><p class="muted">A textbook-style reading library. Open a book to search topics, browse chapters and jump to a digital page.</p>'+(((d.books||[]).length)?'<div class="grid">'+(d.books||[]).map(b=>'<article class="card"><div class="book-kicker">Mathematics textbook</div><h2>'+esc(b.title)+'</h2><p>'+esc(b.subtitle||'')+'</p><p class="muted">'+esc(b.author||'')+'</p><a class="btn" href="./index.html?id='+encodeURIComponent(b.id)+'">Open book →</a></article>').join('')+'</div>':'<p>No books published yet.</p>');
  return;
 }
 const r=await fetch('/api/books?id='+encodeURIComponent(id),{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error||'Book is not available');
 bookData=d.book;bookMeta=bookData.book||{};readerPages=makePages(bookData.lectures||[]);
 if(!readerPages.length)readerPages=[{chapterIndex:0,chapterTitle:'No chapters yet',chapterSubtitle:'',chapterPage:1,chapterPages:1,steps:[],topic:'',text:''}];
 renderReader();
}
main().catch(e=>app.innerHTML='<p class="error">'+esc(e.message)+'</p>');
