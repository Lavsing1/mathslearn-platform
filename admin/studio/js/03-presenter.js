'use strict';
/* ====================================================================
   PRESENTER: step and page presenter, presenter pencils
   ==================================================================== */
/* ---------- presenter ---------- */
function openPres(){
  flush();P.on=true;P.started=false;P.n=0;P.t0=Date.now();PN.tool=null;marksLoad();
  $('#pres').classList.remove('hidden');renderPres();applyStyles();
}
function renderPres(){renderPres0();mountDraw()}
function renderPres0(){if(L.settings.pm!=='step')return renderCont();
  $('#pres').innerHTML=`<button class="pb px" data-act="pexit" title="Esc">Exit</button>
  <div class="tscr" id="tscr" ${P.started?'style="display:none"':''}><h1>${rich(L.title,1)}</h1>${L.subtitle?`<p>${rich(L.subtitle,1)}</p>`:''}${metaLine(L)?`<p style="opacity:.7;font-size:.6em">${metaLine(L)}</p>`:''}<button class="start" data-act="pstart">Start lecture</button><small>Space or → next step · ← back · F full screen · + / − text size · Esc exit</small></div>
  <div class="stream ${P.started?'':'hidden'}" id="stream"></div>
  <footer class="pbar ${P.started?'':'hidden'}" id="pbar"><button class="pb" data-act="pback">Back</button>
  <button class="nx" id="nx" data-act="pnext">Next step</button><span class="cnt" id="cnt"></span>
  ${PENBAR()}<button class="pb" data-act="pfont" data-d="-2" title="Smaller text">A−</button><button class="pb" data-act="pfont" data-d="2" title="Larger text">A+</button>
  <button class="pb" data-act="ptheme">Theme</button><button class="pb" data-act="psettings">Style</button><button class="pb" data-act="pfull" title="F">Full screen</button><button class="pb" data-act="prestart">Restart</button></footer>`;
  if(P.started){$('#stream').innerHTML=L.steps.slice(0,P.n).map((_,i)=>stepAt(i)).join('');pui()}
}
function pui(){
  const end=P.n>=L.steps.length;
  $('#cnt').textContent=P.n+' / '+L.steps.length;
  const nx=$('#nx');nx.disabled=end;nx.textContent=end?'Lecture complete':'Next step';
}
function pstart(){P.started=true;P.n=0;$('#tscr').style.display='none';$('#stream').classList.remove('hidden');$('#pbar').classList.remove('hidden');$('#stream').innerHTML='';pnext()}
function pnext(){if(L.settings.pm!=='step')return pscroll(1);
  if(!P.started)return pstart();
  if(P.n>=L.steps.length)return;
  const st=$('#stream');st.insertAdjacentHTML('beforeend',stepAt(P.n));P.n++;pui();
  const el=st.lastElementChild,room=st.clientHeight-60;
  const top=el.offsetHeight<room?el.offsetTop+el.offsetHeight-st.clientHeight+90:el.offsetTop-24;
  st.scrollTo({top:Math.max(0,top),behavior:'smooth'});
}
function pback(){if(L.settings.pm!=='step')return pscroll(-1);
  if(!P.started||P.n<=0)return;
  const st=$('#stream');if(st.lastElementChild)st.lastElementChild.remove();P.n--;pui();
  const el=st.lastElementChild;if(el)st.scrollTo({top:Math.max(0,el.offsetTop+el.offsetHeight-st.clientHeight+90),behavior:'smooth'});
}
function pexit(){
  if(document.fullscreenElement)document.exitFullscreen();
  if(L)marksSave();P.on=false;$('#pres').classList.add('hidden');flush();
  if(P.from==='home'){L=null;show('home');renderHome()}else if(L){renderPreview()}
}
function fs(){const p=$('#pres');if(document.fullscreenElement)document.exitFullscreen();else if(p.requestFullscreen)p.requestFullscreen().catch(()=>{})}
function font(d){L.settings.size=Math.max(16,Math.min(72,L.settings.size+d));persist();applyStyles()}

/* ---------- presenter pencils (saved with the lecture) ---------- */
let PN={tool:null,strokes:[],cur:null,wi:1};const PC={p1:'#ff4d4d',p2:'#4da3ff',p3:'#22b35e',ink:'var(--lfg)',hl:'#ffe500'},PW=[3,5,9];
const PENBAR=()=>{const b=(k,l,st,t)=>`<button class="pb ${PN.tool===k?'on':''}" style="${st}" data-act="ppen" data-c="${k}" title="${t}">${l}</button>`;
 return b('p1','✎','background:#ff4d4d;color:#fff','Red pencil (1)')+b('p2','✎','background:#4da3ff;color:#fff','Blue pencil (2)')+b('p3','✎','background:#22b35e;color:#fff','Green pencil (3)')+b('ink','✎','background:var(--lfg);color:var(--lbg)','Ink pencil, same colour as text (4)')+b('hl','H','background:#ffe500;color:#000','Highlighter (5)')+b('laser','◉','','Laser pointer (L)')+`<button class="pb ${PN.tool==='era'?'on':''}" data-act="peras" title="Eraser (E)">⌫</button><button class="pb" data-act="psize" title="Pencil thickness">◔</button><button class="pb" data-act="pundo" title="Undo last pencil stroke (Z)">↶</button><button class="pb" data-act="pclr" title="Clear marks (Delete)">Clear ✎</button><button class="pb ${PN.tool?'':'on'}" data-act="phand" title="Stop drawing (0)">☝</button><button class="pb" data-act="pfit" title="Fit text to the screen">Fit</button><button class="pb" data-act="pout" title="Outline: jump to any step (O)">≡</button><span class="cnt" id="ptm" title="Time since you started"></span>`};
function mountDraw(){const pr=$('#pres');if(!pr||!L)return;['pdraw','plz'].forEach(i=>{const o=$('#'+i);if(o)o.remove()});const s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.id='pdraw';pr.appendChild(s);const z=document.createElement('div');z.id='plz';pr.appendChild(z);const st=$('#stream');if(st)st.addEventListener('scroll',pdraw);pUI()}
function pdraw(){const s=$('#pdraw'),st=$('#stream');if(!s)return;s.innerHTML='<g transform="translate(0,'+(-(st?st.scrollTop:0))+')" fill="none" stroke-linecap="round" stroke-linejoin="round">'+PN.strokes.map(k=>'<polyline style="stroke:'+k.c+'" stroke-width="'+k.w+'" opacity="'+(k.o||1)+'" points="'+k.p.map(q=>q.join(',')).join(' ')+'"/>').join('')+'</g>'}
function pUI(){const s=$('#pdraw');if(s)s.classList.toggle('act',!!PN.tool);const z=$('#plz');if(z&&PN.tool!=='laser')z.style.display='none';document.querySelectorAll('#pres [data-act=ppen],#pres [data-act=peras],#pres [data-act=phand]').forEach(b=>b.classList.toggle('on',b.dataset.act==='ppen'?PN.tool===b.dataset.c:b.dataset.act==='peras'?PN.tool==='era':!PN.tool));pdraw()}
const pXY=e=>{const st=$('#stream');return[Math.round(e.clientX*10)/10,Math.round((e.clientY+(st?st.scrollTop:0))*10)/10]};
function perase(e){const q=pXY(e),n=PN.strokes.length;PN.strokes=PN.strokes.filter(k=>!k.p.some(z=>Math.hypot(z[0]-q[0],z[1]-q[1])<20));if(PN.strokes.length!==n)pdraw()}
function marksSave(){const W=innerWidth||1;L.marks=PN.strokes.map(k=>({c:k.c,w:k.w,o:k.o,p:k.p.map(q=>[Math.round(q[0]/W*1e4)/1e4,q[1]])}));persist()}
function marksLoad(){const W=innerWidth,ok=Object.values(PC);PN.strokes=(Array.isArray(L.marks)?L.marks:[]).filter(k=>k&&Array.isArray(k.p)).map(k=>({c:ok.includes(k.c)?k.c:PC.p1,w:Math.max(1,Math.min(40,+k.w||4)),o:Math.max(.1,Math.min(1,+k.o||1)),p:k.p.filter(q=>Array.isArray(q)).map(q=>[(+q[0]||0)*W,+q[1]||0])}))}
document.addEventListener('pointerdown',e=>{const s=e.target.closest&&e.target.closest('#pdraw');if(!s||!PN.tool)return;e.preventDefault();s.setPointerCapture&&s.setPointerCapture(e.pointerId);
 if(PN.tool==='laser'){PN.cur={laser:1};const z=$('#plz');if(z){z.style.display='block';z.style.left=(e.clientX-11)+'px';z.style.top=(e.clientY-11)+'px'}return}
 if(PN.tool==='era'){PN.cur={era:1};perase(e);return}
 const q=pXY(e),hl=PN.tool==='hl';PN.cur={c:PC[PN.tool],w:hl?PW[PN.wi]*5:PW[PN.wi],o:hl?.38:1,p:[q,[q[0]+.1,q[1]]]};PN.strokes.push(PN.cur);pdraw()});
document.addEventListener('pointermove',e=>{if(PN.tool==='laser'){const z=$('#plz');if(z){const on=e.target.closest&&e.target.closest('#pdraw');z.style.display=on?'block':'none';z.style.left=(e.clientX-11)+'px';z.style.top=(e.clientY-11)+'px'}return}if(!PN.cur)return;if(PN.cur.era)return perase(e);PN.cur.p.push(pXY(e));pdraw()});
const pUp=e=>{PN.cur=null;if(e.pointerType==='touch'){const z=$('#plz');if(z)z.style.display='none'}};
document.addEventListener('pointerup',pUp);document.addEventListener('pointercancel',pUp);
document.addEventListener('wheel',e=>{if(e.target.closest&&e.target.closest('#pdraw')){const st=$('#stream');if(st)st.scrollBy({top:e.deltaY})}},{passive:true});
document.addEventListener('click',e=>{const r=e.target.closest&&e.target.closest('.rv');if(r&&!r.closest('#edmain'))r.classList.toggle('show')});
