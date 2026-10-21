'use strict';
/* ====================================================================
   BOOKS: chapters, sections, contents, book PDF
   ==================================================================== */
/* ---------- books: chapters, sections, contents ---------- */
const BKK='mls.books.v1';let BK=LS.get(BKK,{}),BKC=null;
const bkSave=()=>LS.set(BKK,BK),chaps=b=>b.order.map(id=>db[id]).filter(Boolean);
function CHN(){const b=L&&L.bookId&&BK[L.bookId];return b?b.order.indexOf(L.id)+1:0}
function bkNewCh(bid,title){const l=mk(title,'',[['section','Introduction',''],['text','','Start writing here. Use $...$ for maths.']],{num:true});l.bookId=bid;db[l.id]=l;return l}
function bkOpenId(id){BKC=id;show('book');renderBook()}
document.body.insertAdjacentHTML('beforeend','<div id="book" class="hidden"></div>');
function renderBook(){const b=BK[BKC];if(!b){show('home');renderHome();return}const cs=chaps(b),v=k=>esc(b[k]||'');
  $('#book').innerHTML=`<div class="bkw"><div class="bkbar"><button class="btn" data-act="bkhome">◀ Home</button><span class="sp"></span><button class="btn" data-act="bkexp">Export book file</button><button class="btn pri" data-act="bkpdf" title="Title page, contents with page numbers and every chapter">Make book PDF</button></div>
  <h1>${esc(b.title||'Book')}</h1><p class="hint">The contents page and its page numbers are made automatically when you press Make book PDF.</p><div class="bkf"><label>Title</label><input data-bk="title" value="${v('title')}"><label>Subtitle</label><input data-bk="subtitle" value="${v('subtitle')}"><div class="row"><div><label>Author</label><input data-bk="author" value="${v('author')}"></div><div><label>Institution / course</label><input data-bk="org" value="${v('org')}"></div></div>
  <label>Page size for the PDF</label><select data-bk="size"><option value="a4"${b.size==='a4'?' selected':''}>A4 (standard)</option><option value="a5"${b.size==='a5'?' selected':''}>A5 (book size)</option></select></div>
  <h2>Chapters (${cs.length})</h2><div class="chl">${cs.map((c,i)=>`<div class="chr"><b>${i+1}.</b><span class="cht">${esc(c.title)}</span><span class="m">${c.steps.length} blocks</span><button class="btn pri" data-act="bkch" data-id="${c.id}">Write</button><button class="btn" data-act="bkup" data-id="${c.id}" title="Move up">↑</button><button class="btn" data-act="bkdown" data-id="${c.id}" title="Move down">↓</button><button class="btn dng" data-act="bkchdel" data-id="${c.id}">Delete</button></div>`).join('')||'<p class="hint">No chapters yet.</p>'}</div>
  <button class="btn big" data-act="bkaddch">+ Add chapter</button><p class="hint">Inside a chapter, add a block of type <b>Section heading</b> or <b>Subsection heading</b> and type the title in the Heading box. They are numbered (2.1, 2.2) and listed in the contents. Theorems and equations are numbered per chapter.</p></div>`}
document.addEventListener('input',e=>{const k=e.target.dataset&&e.target.dataset.bk,b=BK[BKC];if(k&&b){b[k]=e.target.value;b.updated=Date.now();bkSave()}});
document.addEventListener('change',e=>{if(e.target.dataset&&e.target.dataset.bk==='size'&&BK[BKC]){BK[BKC].size=e.target.value==='a5'?'a5':'a4';bkSave()}});
function bkImport(o){const bs=o.book||{},bid=(bs.id&&!BK[bs.id])?String(bs.id):uid(),map={};(o.lectures||[]).forEach(x=>{const l=importLec(x);l.bookId=bid;map[x.id]=l.id});
  const order=(Array.isArray(bs.order)?bs.order:[]).map(i=>map[i]).filter(Boolean);Object.values(map).forEach(i=>{if(!order.includes(i))order.push(i)});
  BK[bid]={id:bid,title:String(bs.title||'Imported book'),subtitle:String(bs.subtitle||''),author:String(bs.author||''),org:String(bs.org||''),size:bs.size==='a5'?'a5':'a4',created:bs.created||Date.now(),updated:Date.now(),order};bkSave();LS.set(K_DB,db);return bid}
function fsMergeBooks(bs){(Array.isArray(bs)?bs:[]).forEach(b=>{if(!b||!b.id)return;const o=BK[b.id];if(!o||(b.updated||0)>o.updated)BK[b.id]={id:String(b.id),title:String(b.title||''),subtitle:String(b.subtitle||''),author:String(b.author||''),org:String(b.org||''),size:b.size==='a5'?'a5':'a4',created:b.created||Date.now(),updated:b.updated||Date.now(),order:(Array.isArray(b.order)?b.order:[]).map(String)}});bkSave()}
const _home=acts.home;acts.home=function(){if(L&&L.bookId&&BK[L.bookId]){const id=L.bookId;flush();L=null;closeModal();bkOpenId(id)}else _home()};
const _ol=openLecture;openLecture=function(id){_ol(id);const b=document.querySelector('#editor [data-act=home]');if(b&&db[id]&&db[id].bookId&&BK[db[id].bookId])b.textContent='◀ Book'};
