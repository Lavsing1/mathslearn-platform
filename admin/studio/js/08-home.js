'use strict';
/* =====================================================================
   HOME SCREEN  (js/08-home.js + css/home.css)
   Edit this file to change the home page. Nothing else draws it.
   ===================================================================== */
const HOMEK='mls.home.v1';
const HOME=Object.assign({tab:'all',q:'',sort:'recent',closed:{}},LS.get(HOMEK,{}));
const homeSave=()=>LS.set(HOMEK,HOME);

/* ---- small helpers ---- */
const IC={
  lec:'<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20l4-4 4 4M12 16v4"/>',
  book:'<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/>',
  quiz:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/>',
  tpl:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  more:'<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  chev:'<path d="M6 9l6 6 6-6"/>',
  play:'<path d="M7 4l13 8-13 8z"/>',
  save:'<path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16"/>'
};
const ic=n=>`<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]||''}</svg>`;
const hue=s=>{let h=0;for(const c of String(s||'x'))h=(h*31+c.charCodeAt(0))%360;return h};
const ago=t=>{if(!t)return 'never';const s=(Date.now()-t)/1000;if(s<60)return 'just now';if(s<3600)return Math.floor(s/60)+' min ago';if(s<86400)return Math.floor(s/3600)+' h ago';if(s<2592000)return Math.floor(s/86400)+' days ago';return fmtDate(t)};
const plural=(n,w)=>n+' '+w+(n===1?'':'s');
const homeLectures=()=>Object.values(db).filter(l=>!l.bookId||!BK[l.bookId]);
function storageInfo(){let n=0;try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);n+=k.length+(localStorage.getItem(k)||'').length}}catch(e){}const mb=n*2/1048576;return{mb,pct:Math.min(100,Math.round(mb/5*100))}}

/* ---- menus and cards ---- */
const menu=items=>`<details class="mn"><summary aria-label="More actions">${ic('more')}</summary><div class="mnb">${items.map(([a,t,id,cls])=>`<button class="${cls||''}" data-act="${a}"${id?` data-id="${id}"`:''}>${t}</button>`).join('')}</div></details>`;
function lecCard(l){return `<article class="hc" style="--h:${hue(l.chapter||l.title)}"><div class="hct"><span class="hci">${ic('lec')}</span>${menu([['expid','Export file',l.id],['shareid','Web page for students',l.id],['dupid','Duplicate',l.id],['delid','Delete',l.id,'dng']])}</div>
  <h3>${esc(l.title)}</h3><p class="hs">${esc(l.subtitle||'')}</p><div class="hm"><span>${plural(l.steps.length,'step')}</span><span>edited ${ago(l.updated)}</span></div>
  <div class="hab"><button class="btn pri" data-act="openid" data-id="${l.id}">Edit</button><button class="btn" data-act="presid" data-id="${l.id}">${ic('play')} Present</button></div></article>`}
function bookCard(b){const n=chaps(b).length;return `<article class="hc bkc" style="--h:${hue(b.title)}"><div class="cover"><b>${esc(b.title)}</b><small>${esc(b.author||'')}</small></div>
  <div class="hct" style="margin-top:12px"><span class="hm"><span>${plural(n,'chapter')}</span><span>${b.size==='a5'?'A5':'A4'}</span><span>edited ${ago(b.updated)}</span></span>${menu([['bkdel','Delete book',b.id,'dng']])}</div>
  <div class="hab"><button class="btn pri" data-act="bkopen" data-id="${b.id}">Open book</button></div></article>`}
function quizCard(z){return `<article class="hc qz" style="--h:${hue(z.title)}"><div class="hct"><span class="qnum">${z.questions.length}<small>Qs</small></span>${menu([['qzexp','Export file',z.id],['qzshare','Student page',z.id],['qzdel','Delete',z.id,'dng']])}</div>
  <h3>${esc(z.title)}</h3><div class="hm"><span>${z.time}s per question</span><span>edited ${ago(z.updated)}</span></div>
  <div class="hab"><button class="btn pri" data-act="qzlive" data-id="${z.id}">${ic('play')} Live session</button><button class="btn" data-act="qzopen" data-id="${z.id}">Edit</button></div></article>`}
const empty=(t,p,btns,sm)=>`<div class="hempty${sm?' sm':''}"><svg viewBox="0 0 120 80" aria-hidden="true"><rect x="10" y="12" width="100" height="56" rx="8" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="5 5"/><path d="M38 46h44M38 34h26" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg><h3>${t}</h3><p>${p}</p><div class="hab" style="justify-content:center">${btns||''}</div></div>`;

/* ---- body (tabs, sort, sections); search and sort only redraw this part ---- */
function homeBody(){
  const q=HOME.q.trim().toLowerCase(),m=(...a)=>!q||a.some(x=>String(x||'').toLowerCase().includes(q));
  const all={lec:homeLectures(),books:Object.values(BK),quiz:Object.values(QZ)};
  const cmp=HOME.sort==='name'?(a,b)=>String(a.title).localeCompare(String(b.title),undefined,{numeric:true}):(a,b)=>(b.updated||0)-(a.updated||0);
  const lec=all.lec.filter(l=>m(l.title,l.subtitle,l.chapter,l.author)).sort(cmp),books=all.books.filter(b=>m(b.title,b.subtitle,b.author)).sort(cmp),quiz=all.quiz.filter(z=>m(z.title,z.subtitle,z.author)).sort(cmp);
  const tabs=[['all','Everything',lec.length+books.length+quiz.length],['lec','Lectures',lec.length],['books','Books',books.length],['quiz','Quizzes',quiz.length]];
  const show=t=>HOME.tab==='all'||HOME.tab===t;let out=`<div class="htabs" role="tablist">${tabs.map(([k,t,n])=>`<button role="tab" aria-selected="${HOME.tab===k}" class="htab ${HOME.tab===k?'on':''}" data-act="htab" data-t="${k}">${t}<span>${n}</span></button>`).join('')}<span class="sp"></span><label class="hsort">Sort <select id="hsort"><option value="recent"${HOME.sort==='recent'?' selected':''}>Recently edited</option><option value="name"${HOME.sort==='name'?' selected':''}>Name (A–Z)</option></select></label></div>`;
  const none=!lec.length&&!books.length&&!quiz.length;
  if(none&&q)out+=empty('Nothing matches “'+esc(HOME.q)+'”','Try a shorter word, or clear the search.','<button class="btn" data-act="hclear">Clear search</button>');
  else{
    if(show('lec')){out+=`<section class="hsec"><h2>${ic('lec')} Lectures <span class="cnt">${lec.length}</span></h2>`;
      if(!lec.length)out+=empty('No lectures yet','A lecture is a list of steps you present one click at a time.','<button class="btn pri" data-act="new">Create a lecture</button><button class="btn" data-act="tpls">Start from a template</button>');
      else{const g=new Map();lec.forEach(l=>{const c=l.chapter||'';(g.get(c)||g.set(c,[]).get(c)).push(l)});
        [...g.keys()].sort((a,b)=>(a||'\uffff').localeCompare(b||'\uffff')).forEach(c=>{const closed=!q&&HOME.closed[c];out+=`<div class="hgrp"><button class="gh" data-act="hgrp" data-g="${esc(c)}" aria-expanded="${!closed}"><span class="chv ${closed?'sh':''}">${ic('chev')}</span>${esc(c||'No chapter')}<span class="cnt">${g.get(c).length}</span></button>${closed?'':'<div class="hgrid">'+g.get(c).map(lecCard).join('')+'</div>'}</div>`})}
      out+='</section>'}
    if(show('books')){out+=`<section class="hsec"><h2>${ic('book')} Books <span class="cnt">${books.length}</span></h2>`;
      out+=books.length?`<div class="hgrid">${books.map(bookCard).join('')}</div>`:empty('No books yet','Write a 200 to 300 page book chapter by chapter, with contents and numbered sections.','<button class="btn pri" data-act="bknew">Create a book</button>',lec.length+quiz.length>0);out+='</section>'}
    if(show('quiz')){out+=`<section class="hsec"><h2>${ic('quiz')} MCQ quizzes <span class="cnt">${quiz.length}</span></h2>`;
      out+=quiz.length?`<div class="hgrid">${quiz.map(quizCard).join('')}</div>`:empty('No quizzes yet','Timed multiple-choice questions with full solutions. Run them live in class, or share a page with students.','<button class="btn pri" data-act="qznew">Create a quiz</button>',lec.length+books.length>0);out+='</section>'}
  }
  const box=$('#hbody');if(box)box.innerHTML=out;
}

/* ---- whole screen ---- */
function renderHome(){
  const lec=homeLectures(),nb=Object.keys(BK).length,nq=Object.keys(QZ).length;
  const all=[...lec.map(x=>({t:'lec',x})),...Object.values(BK).map(x=>({t:'book',x})),...Object.values(QZ).map(x=>({t:'quiz',x}))].sort((a,b)=>(b.x.updated||0)-(a.x.updated||0));
  const last=all[0],hr=new Date().getHours(),greet=hr<12?'Good morning':hr<17?'Good afternoon':'Good evening';
  const au=(lec.concat(Object.values(BK),Object.values(QZ)).filter(x=>x.author).sort((a,b)=>(b.updated||0)-(a.updated||0))[0]||{}).author;
  const go={lec:['openid','Continue writing'],book:['bkopen','Continue the book'],quiz:['qzopen','Continue the quiz']};
  const kind={lec:'Lecture',book:'Book',quiz:'MCQ quiz'};
  const cont=last?`<div class="hcont" style="--h:${hue(last.x.title)}"><small>${ic(last.t==='lec'?'lec':last.t)} Pick up where you left off</small><b>${esc(last.x.title)}</b><span>${kind[last.t]} · edited ${ago(last.x.updated)}</span><button class="btn pri" data-act="${go[last.t][0]}" data-id="${last.x.id}">${go[last.t][1]}</button></div>`:'';
  const lb=+localStorage.getItem('mls.lastbackup')||0,old=all.length&&(!lb||Date.now()-lb>14*86400000),st=storageInfo();
  $('#home').innerHTML=`<header class="htop"><div class="hbrand"><span class="logo">∑</span><div><b>Mathematics Lecture Studio</b><small>Write · Teach · Examine</small></div></div>
  <label class="hsearch">${ic('search')}<input id="hsearch" type="search" placeholder="Search lectures, books and quizzes   ( / )" value="${esc(HOME.q)}" autocomplete="off" aria-label="Search"></label>
  <nav class="hnav"><button class="btn sm" data-act="help">Help</button>${menu([['open','Open a lecture, book or quiz file'],['backups','Restore from backup'],['expall','Export everything (backup)'],['flib','Auto-save everything into a file…'],['pdfpick','PDF reader'],['about','About and hosting']]).replace('class="mn"','class="mn right"').replace('aria-label="More actions"','aria-label="More"')}</nav></header>
  <main class="hmain"><section class="hhero"><div class="hwel"><h1>${greet}${au?', '+esc(au):''}.</h1><p>${all.length?`You have ${plural(lec.length,'lecture')}, ${plural(nb,'book')} and ${plural(nq,'quiz')}.`:'Welcome. Create your first lecture, book or quiz below.'}</p></div>${cont}</section>
  <section class="hcreate" aria-label="Create"><button class="tile" style="--c:#0e7c86" data-act="new"><span class="ti">${ic('lec')}</span><b>New lecture</b><small>Write and present step by step</small></button><button class="tile" style="--c:#7a4fc2" data-act="bknew"><span class="ti">${ic('book')}</span><b>New book</b><small>Chapters, contents, PDF</small></button><button class="tile" style="--c:#d9531e" data-act="qznew"><span class="ti">${ic('quiz')}</span><b>New MCQ quiz</b><small>Timer, sounds, live class</small></button><button class="tile" style="--c:#2b6cb0" data-act="tpls"><span class="ti">${ic('tpl')}</span><b>From a template</b><small>Analysis, calculus, proofs</small></button></section>
  <section class="hstat"><div class="chip ${old?'warn':''}">${ic('save')}<span>Last backup: <b>${ago(lb)}</b></span><button class="btn sm" data-act="expall">Back up now</button></div><div class="chip"><span>Browser storage <b>${st.mb<0.1?'<0.1':st.mb.toFixed(1)} MB</b> of about 5 MB</span><i class="sb"><i style="width:${Math.max(2,st.pct)}%" class="${st.pct>70?'hi':''}"></i></i></div></section>
  <div id="hbody"></div>
  <footer class="hfoot"><span id="fsline"></span><span class="sp"></span><span>Free · works offline · your files stay on your device</span></footer></main>
  <input type="file" id="fi" accept=".json,application/json" class="hidden">`;
  homeBody();fsUI();
}

/* ---- behaviour ---- */
Object.assign(acts,{
  htab(d){HOME.tab=d.t;homeSave();homeBody()},
  hgrp(d){HOME.closed[d.g]=!HOME.closed[d.g];homeSave();homeBody()},
  hclear(){HOME.q='';homeSave();const s=$('#hsearch');if(s)s.value='';homeBody()},
  delid(d){const l=db[d.id];if(!l)return;modal('<h3>Delete this lecture?</h3><p>'+esc(l.title)+' will be removed from the home screen. A copy stays in Backups.</p><button class="btn dng" data-act="delidok" data-id="'+d.id+'">Delete lecture</button> <button class="btn" data-act="mclose">Cancel</button>')},
  delidok(d){if(db[d.id]){backup(db[d.id],0);delete db[d.id];LS.set(K_DB,db)}closeModal();renderHome()}
});
document.addEventListener('input',e=>{if(e.target.id==='hsearch'){HOME.q=e.target.value;homeSave();homeBody()}});
document.addEventListener('change',e=>{if(e.target.id==='hsort'){HOME.sort=e.target.value;homeSave();homeBody()}});
document.addEventListener('click',e=>{document.querySelectorAll('details.mn[open]').forEach(d=>{if(!d.contains(e.target)||e.target.closest('.mnb button'))d.open=false})});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!$('#home').classList.contains('hidden')&&!/INPUT|TEXTAREA|SELECT/.test((document.activeElement||{}).tagName||'')&&!$('#modal').innerHTML){e.preventDefault();const s=$('#hsearch');if(s)s.focus()}});
