'use strict';
/* ====================================================================
   CORE: helpers, storage, math rendering, lecture model, undo/redo
   ==================================================================== */
const $=s=>document.querySelector(s);
const uid=()=>Math.random().toString(36).slice(2,8)+Date.now().toString(36).slice(-4);
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const LS={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));if((k==='mls.db.v1'||k==='mls.books.v1'||k==='mls.quiz.v1')&&typeof fsSync==='function')fsSync();return true}catch(e){return false}}};
const K_DB='mls.db.v1',K_BK='mls.bk.v1';
const DEF={theme:'light',bg:'#fffdf8',fg:'#1c2230',size:30,eq:1.2,lh:1.55,align:'left',layout:'classic',pm:'step',pgap:0.35,num:false,qed:true,paper:'none',eqn:false};
const THEMES={light:['#fffdf8','#1c2230'],dark:['#10141c','#ebe8df'],sepia:['#f4ead3','#3a2e1c'],board:['#0f2b22','#eef5ef']};
const TYPES={text:'',definition:'Definition',theorem:'Theorem',lemma:'Lemma',corollary:'Corollary',proof:'Proof',example:'Example',remark:'Remark',exercise:'Exercise',blank:'Blank board',section:'Section heading',subsection:'Subsection heading'};
const MAC={'\\R':'\\mathbb{R}','\\N':'\\mathbb{N}','\\Z':'\\mathbb{Z}','\\Q':'\\mathbb{Q}','\\C':'\\mathbb{C}','\\eps':'\\varepsilon','\\abs':'\\left|#1\\right|','\\norm':'\\left\\|#1\\right\\|'};

try{const raw0=localStorage.getItem('mls.db.v1');if(raw0&&!localStorage.getItem('mls.premig.v2'))localStorage.setItem('mls.premig.v2',raw0)}catch(e){}
let db=LS.get(K_DB,{}),L=null,cur=0,undo=[],redo=[],lastSnap={k:'',t:0},lastFocus=null,allPrev=false,saveT=null,palTab='Greek';
let PZ=1;let P={on:false,started:false,n:0,from:'editor'};

/* ---------- math + text rendering ---------- */
function tex(m,d){try{return katex.renderToString(m,{displayMode:!!d,throwOnError:true,strict:'ignore',macros:{...MAC}})}catch(e){return `<span class="mx" title="${esc(e.message)}">${esc(m)}</span>`}}
function rich(t,inline){
  const M=[];
  let s=String(t||'').replace(/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g,(_,a,b)=>{M.push(a!==undefined?`<span class="dm">${tex(eqPrep(a.trim()),true)}</span>`:tex(b,false));return `\u0001${M.length-1}\u0002`});
  s=esc(s).replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>');s=fmt(s).replace(/\(@([\w-]+)\)/g,(m,k)=>EQ.map[k]!=null?'('+EQ.map[k]+')':'(?)');
  s=inline?s.replace(/\n/g,' '):'<p>'+s.replace(/\n{2,}/g,'</p><p>').replace(/\n/g,'<br>')+'</p>';
  return s.replace(/\u0001(\d+)\u0002/g,(_,i)=>M[i]);
}
const FM={r:'color:var(--cr,#d62828)',b:'color:var(--cb,#1d4ed8)',g:'color:var(--cg,#15803d)',o:'color:var(--co,#d86a00)',hy:'background:#fff176;color:#111',hg:'background:#a5f3b3;color:#111',hp:'background:#ffc2d1;color:#111',pu:'color:var(--cpu,#8e44ad)',pk:'color:var(--cpk,#e11d74)'};
function fmt(s){for(let k=0;k<6;k++){const n=s.replace(/\[(r|b|g|o|pu|pk|hy|hg|hp|u|i|h|v|#[0-9a-fA-F]{6})\]([\s\S]*?)\[\/\1\]/g,(_,t,x)=>t==='u'?'<u>'+x+'</u>':t==='i'?'<i>'+x+'</i>':t==='h'?'<span class="fh">'+x+'</span>':t==='v'?'<span class="rv" tabindex="0" title="Click to reveal / hide">'+x+'</span>':t[0]==='#'?'<span style="color:'+t+'">'+x+'</span>':'<span style="'+FM[t]+'">'+x+'</span>');if(n===s)break;s=n}return s}
let EQ={n:0,on:false,map:{}};
function eqInit(i){EQ.on=!!L.settings.eqn;EQ.map={};let n=0;L.steps.forEach((st,j)=>{if(j===i)EQ.n=n;String(st.content||'').replace(/\$\$([\s\S]+?)\$\$/g,(_,a)=>{n++;const m=a.match(/\{#([\w-]+)\}/);if(m)EQ.map[m[1]]=(CHN()?CHN()+'.':'')+n;return''})});if(i>=L.steps.length)EQ.n=n}
function eqPrep(a){a=a.replace(/\{#[\w-]+\}/,'').trim();if(EQ.on){EQ.n++;a+='\\tag{'+(CHN()?CHN()+'.':'')+EQ.n+'}'}return a}
const lum=h=>{const n=parseInt(String(h).slice(1),16)||0;return((n>>16&255)*.299+(n>>8&255)*.587+(n&255)*.114)/255};
const PEN=bg=>lum(bg)<.5?'--cr:#ff7b7b;--cb:#7db3ff;--cg:#63da8f;--co:#ffb35c;--cpu:#c792ea;--cpk:#ff7eb6':'';
function numOf(i){const t=L.steps[i].type;let n=0;for(let j=0;j<=i;j++)if(L.steps[j].type===t)n++;return n}
function mkFn(src){try{let e=String(src||'').toLowerCase().replace(/\s+/g,'').replace(/\^/g,'**').replace(/\bpi\b/g,'Math.PI').replace(/\b(asin|acos|atan|sin|cos|tan|sqrt|abs|exp|log)\b/g,'Math.$1').replace(/\bln\b/g,'Math.log').replace(/(\d)(x|\(|Math)/g,'$1*$2').replace(/(x|\))(\d|\(|x|Math)/g,'$1*$2');
  if(e.replace(/Math\.(asin|acos|atan|sin|cos|tan|sqrt|abs|exp|log|PI)/g,'').replace(/[0-9x+\-*\/().,]/g,'')!=='')return null;const f=new Function('x','return '+e);f(1);return x=>{try{const v=f(x);return typeof v==='number'?v:NaN}catch(_){return NaN}}}catch(_){return null}}
function sv(s,hit){
 const c=(s.c&&s.c!=='#1d2b3a')?s.c:'currentColor',x1=s.x1,y1=s.y1,x2=s.x2,y2=s.y2,at=o=>Object.entries(o).map(([k,v])=>k+'="'+v+'"').join(' ');
 const st=hit?{stroke:'transparent','stroke-width':18,fill:'transparent','pointer-events':'all'}:{stroke:c,'stroke-width':2.5,fill:'none'};
 const E=(t,o)=>'<'+t+' '+at({...st,'stroke-linecap':'round','stroke-linejoin':'round',...o})+'/>';
 const T=(x,y,tx,sz,an)=>'<text '+at({x,y,'font-size':sz,'text-anchor':an||'start','font-style':'italic','font-family':'Cambria,Georgia,serif',fill:hit?'transparent':c,stroke:'none','pointer-events':hit?'all':'none'})+'>'+esc(tx||'')+'</text>';
 const hd=(x,y,a)=>{const p=d=>(x+12*Math.cos(a+d))+' '+(y+12*Math.sin(a+d));return E('path',{d:'M'+p(2.7)+'L'+x+' '+y+'L'+p(-2.7)})};
 const an=Math.atan2(y2-y1,x2-x1),mx=(x1+x2)/2,my=(y1+y2)/2,dg=an*180/Math.PI,len=Math.hypot(x2-x1,y2-y1),pts=q=>(q||[]).map(z=>z.join(',')).join(' ');
 switch(s.t){
 case'line':return E('line',{x1,y1,x2,y2});
 case'dash':return E('line',{x1,y1,x2,y2,...(hit?{}:{'stroke-dasharray':'8 6'})});
 case'arrow':return E('line',{x1,y1,x2,y2})+hd(x2,y2,an);
 case'dim':return E('line',{x1,y1,x2,y2})+hd(x2,y2,an)+hd(x1,y1,an+Math.PI)+T(mx,my-8,s.txt,16,'middle');
 case'rect':return E('rect',{x:Math.min(x1,x2),y:Math.min(y1,y2),width:Math.abs(x2-x1),height:Math.abs(y2-y1)});
 case'tri':return E('polygon',{points:mx+','+y1+' '+x1+','+y2+' '+x2+','+y2});
 case'poly':return E('polygon',{points:pts(s.p)});
 case'circ':return E('circle',{cx:x1,cy:y1,r:len});
 case'ell':return E('ellipse',{cx:mx,cy:my,rx:Math.abs(x2-x1)/2,ry:Math.abs(y2-y1)/2});
 case'pt':return E('circle',{cx:x1,cy:y1,r:4,...(hit?{}:{fill:c})})+T(x1+8,y1-8,s.txt,18);
 case'lab':return T(x1,y1,s.txt,20);
 case'pen':return E('polyline',{points:pts(s.p)});
 case'nl':{const q=(s.txt||'-5,5').split(',').map(Number),lo=q[0],n=Math.max(1,Math.round(q[1]-lo)),a=Math.min(x1,x2),b=Math.max(x1,x2);let o=E('line',{x1:a,y1,x2:b,y2:y1})+hd(b,y1,0)+hd(a,y1,Math.PI);if(n<=40)for(let k=0;k<=n;k++){const x=a+(b-a)*k/n;o+=E('line',{x1:x,y1:y1-6,x2:x,y2:y1+6})+T(x,y1+24,String(lo+k),14,'middle')}return o}
 case'ival':{const t=s.txt||'[)',a=Math.min(x1,x2),b=Math.max(x1,x2),f=cl=>hit?'transparent':cl?c:'#fff';return E('line',{x1:a,y1,x2:b,y2:y1,'stroke-width':6})+E('circle',{cx:a,cy:y1,r:7,fill:f(t[0]==='[')})+E('circle',{cx:b,cy:y1,r:7,fill:f(t[1]===']')})}
 case'fn':{const f=mkFn(s.f),a=s.a!=null?s.a:-3,b=s.b!=null?s.b:3,X0=Math.min(x1,x2),X1=Math.max(x1,x2),Y0=Math.min(y1,y2),Y1=Math.max(y1,y2);if(!f)return E('rect',{x:X0,y:Y0,width:X1-X0,height:Y1-Y0});
  const N=140,ys=[];let lo=1e9,hi=-1e9;for(let i=0;i<=N;i++){const y=f(a+(b-a)*i/N);ys.push(y);if(isFinite(y)){lo=Math.min(lo,y);hi=Math.max(hi,y)}}if(!isFinite(lo)||lo===hi){lo=(isFinite(lo)?lo:0)-1;hi=lo+2}lo=Math.max(lo,-50);hi=Math.min(hi,50);
  const px=x=>X0+(x-a)/(b-a)*(X1-X0),py=y=>Y1-(y-lo)/(hi-lo)*(Y1-Y0);let pt='';ys.forEach((y,i)=>{if(isFinite(y)&&y>=lo&&y<=hi)pt+=px(a+(b-a)*i/N).toFixed(1)+','+py(y).toFixed(1)+' '});
  const ax=(0>=a&&0<=b)?px(0):X0,ay=(0>=lo&&0<=hi)?py(0):Y1;return E('line',{x1:X0,y1:ay,x2:X1,y2:ay,'stroke-width':1.5})+E('line',{x1:ax,y1:Y0,x2:ax,y2:Y1,'stroke-width':1.5})+E('polyline',{points:pt.trim(),'stroke-width':3})+T((X0+X1)/2,Y0-6,'y = '+(s.f||''),14,'middle')}
 case'ang':{const r=len||30,sw=(s.sw||60)*Math.PI/180,P=a=>(x1+r*Math.cos(a))+' '+(y1+r*Math.sin(a));return E('path',{d:'M'+P(an)+'A'+r+' '+r+' 0 0 1 '+P(an+sw)})+T(x1+(r+18)*Math.cos(an+sw/2),y1+(r+18)*Math.sin(an+sw/2)+5,s.txt||(s.sw||60)+'°',15,'middle')}
 case'par':return E('line',{x1,y1,x2,y2})+E('path',{d:'M-5 -7L3 0L-5 7M-12 -7L-4 0L-12 7',transform:'translate('+mx+' '+my+') rotate('+dg+')'});
 case'perp':{const z=Math.max(10,Math.min(30,len/3));return E('path',{d:'M'+z+' 0L'+z+' '+(-z)+'L0 '+(-z),transform:'translate('+x1+' '+y1+') rotate('+dg+')'})}
 }return''}
const drawHTML=s=>(s.draw&&s.draw.shapes&&s.draw.shapes.length)?`<svg class="dg" viewBox="0 0 800 ${s.draw.h||300}" role="img" aria-label="Diagram">${s.draw.shapes.map(x=>sv(x,0)).join('')}</svg>`:'';
const okDraw=d=>(d&&Array.isArray(d.shapes))?{h:Math.max(120,Math.min(900,+d.h||300)),shapes:d.shapes.filter(x=>x&&typeof x.t==='string').map(x=>({...x,id:String(x.id||uid())}))}:undefined;
function stepHTML(s,next,i){eqInit(i);
  if(s.type==='section'||s.type==='subsection'){const sub=s.type==='subsection';let a=0,b=0;for(let j=0;j<=i;j++){if(L.steps[j].type==='section'){a++;b=0}else if(L.steps[j].type==='subsection')b++}const c=CHN(),no=(c?c+'.':'')+a+(sub?'.'+b:''),t=s.heading||s.content||'';
    return `<section class="blk t-section ${sub?'sub':''}${s.pb?' pbk':''}" data-toc="${sub?2:1}"><div class="${sub?'subh':'sech'}"><span class="sn">${no}</span> ${rich(t,1)}</div></section>`}
  const ty=TYPES.hasOwnProperty(s.type)?s.type:'text',lab=TYPES[ty];
  const num=(L.settings.num&&lab&&ty!=='proof'&&ty!=='remark')?' '+(CHN()?CHN()+'.':'')+numOf(i):'';
  const qed=L.settings.qed!==false&&ty==='proof'&&!(next&&next.type==='proof');
  const imageBlock = s.imageData ? `<figure class="ml-image-block"><img src="${String(s.imageData).replace(/&/g,'&amp;').replace(/"/g,'&quot;')}" alt="${esc(s.imageAlt||s.heading||'Book illustration')}" style="width:${Math.max(20,Math.min(100,Number(s.imageWidth)||100))}%;display:block;margin:${s.imageAlign==='left'?'0 auto 0 0':s.imageAlign==='right'?'0 0 0 auto':'0 auto'}"><figcaption>${esc(s.imageCaption||'')}</figcaption></figure>` : '';
  return `<section class="blk t-${ty}${s.pb?' pbk':''}"><div class="bh">${lab?`<span class="tag">${lab}${num}</span>`:''}${s.heading?`<span class="bt">${rich(s.heading,1)}</span>`:''}</div><div class="bc">${rich(s.content)}${imageBlock}${qed?'<span class="qed">∎</span>':''}${drawHTML(s)}</div></section>`;
}
const stepAt=i=>stepHTML(L.steps[i],L.steps[i+1],i);
function lvStyle(st){st={...DEF,...st};const [bg,fg]=st.theme==='custom'?[st.bg,st.fg]:(THEMES[st.theme]||THEMES.light);return `--lbg:${bg};--lfg:${fg};--ls:${st.size}px;--leq:${st.eq};--llh:${st.lh};--lal:${st.align};--pgap:${st.pgap};${PEN(bg)}`}
const lay=()=>'lv lay-'+(L.settings.layout||'classic')+' mode-'+(L.settings.pm==='step'?'step':'cont')+' paper-'+(L.settings.paper||'none');

/* ---------- lecture model ---------- */
const newStep=(type='text',heading='',content='')=>({id:uid(),type,heading,content});
function mk(title,sub,arr,settings){return{id:uid(),title,subtitle:sub,created:Date.now(),updated:Date.now(),settings:{...DEF,...(settings||{})},steps:arr.map(a=>newStep(...a))}}
function sample(){return mk('Uniqueness of Limits','Real Analysis · Sequences',[
 ['definition','Convergence of a sequence','A sequence $(a_n)$ converges to $L\\in\\R$ if for every $\\varepsilon>0$ there exists $N\\in\\N$ such that\n$$|a_n-L|<\\varepsilon \\quad \\text{for all } n\\ge N.$$'],
 ['theorem','Uniqueness of the limit','If $a_n\\to L$ and $a_n\\to M$, then $L=M$.'],
 ['proof','Step 1: Assume the opposite','Suppose $L\\ne M$ and put $\\varepsilon=\\dfrac{|L-M|}{2}>0$.'],
 ['proof','Step 2: Choose indices','There are $N_1,N_2$ with $|a_n-L|<\\varepsilon$ for $n\\ge N_1$ and $|a_n-M|<\\varepsilon$ for $n\\ge N_2$. Take $n\\ge\\max\\{N_1,N_2\\}$.'],
 ['proof','Step 3: Triangle inequality','$$|L-M|\\le|L-a_n|+|a_n-M|<2\\varepsilon=|L-M|.$$\nThis says $|L-M|<|L-M|$, a contradiction. Hence $L=M$.'],
 ['example','Check with a sequence','$a_n=\\dfrac1n\\to0$: given $\\varepsilon>0$, choose $N>\\dfrac1\\varepsilon$.']
],{theme:'board'})}

/* ---------- storage ---------- */
function setStatus(t){const e=$('#stat');if(e)e.textContent=t}
function persist(){clearTimeout(saveT);saveT=setTimeout(flush,250);setStatus('Saving…')}
function flush(){
  clearTimeout(saveT);if(!L)return;
  L.updated=Date.now();db[L.id]=L;
  const ok=LS.set(K_DB,db);backup(L,120000);
  setStatus(ok?'Saved '+new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'Could not save. Export now.');
}
function backup(l,gap){const bk=LS.get(K_BK,[]);const last=bk.find(b=>b.id===l.id);if(last&&Date.now()-last.t<gap)return;bk.unshift({id:l.id,t:Date.now(),data:JSON.parse(JSON.stringify(l))});LS.set(K_BK,bk.slice(0,15))}
function exportLec(l){const t=JSON.stringify({app:'MathLectureStudio',version:2,...l},null,2);deliver((l.title||'lecture').replace(/[\\/:*?"<>|]+/g,'_')+'.lecture.json',new Blob([t],{type:'application/json'}),t)}
function importLec(o){
  if(!o||!Array.isArray(o.steps))throw new Error('bad');
  const l={id:(o.id&&!db[o.id])?String(o.id):uid(),title:String(o.title||'Imported lecture'),subtitle:String(o.subtitle||''),created:o.created||Date.now(),updated:Date.now(),
    settings:{...DEF,...(o.settings||{})},
    steps:o.steps.map(s=>({id:uid(),type:TYPES.hasOwnProperty(s.type)?s.type:'text',heading:String(s.heading||''),content:String(s.content||''),pb:!!s.pb,draw:okDraw(s.draw),note:String(s.note||'').slice(0,2000)}))};
  l.chapter=String(o.chapter||'');l.author=String(o.author||'').slice(0,120);l.org=String(o.org||'').slice(0,160);if(Array.isArray(o.marks))l.marks=o.marks.slice(0,500);if(o.bookId)l.bookId=String(o.bookId);
  if(!l.steps.length)l.steps.push(newStep());
  db[l.id]=l;LS.set(K_DB,db);return l;
}

/* ---------- undo / redo ---------- */
const state=()=>JSON.stringify({t:L.title,s:L.subtitle,st:L.steps,se:L.settings});
function snap(k){const n=Date.now();if(k&&lastSnap.k===k&&n-lastSnap.t<1500){lastSnap.t=n;return}undo.push(state());if(undo.length>200)undo.shift();redo=[];lastSnap={k,t:n}}
function restore(j){const o=JSON.parse(j);L.title=o.t;L.subtitle=o.s;L.steps=o.st;L.settings=o.se;cur=Math.min(cur,L.steps.length-1);lastSnap={k:'',t:0};$('#ttl').value=L.title;$('#sub').value=L.subtitle;refresh();persist()}


/* ---------- loading helpers: scripts, and stylesheet text for exports ---------- */
const NOCSS='To make PDFs and share pages, open the app from its web address (for example GitHub Pages) or use the single-file version (Mathematics-Lecture-Studio.html). Browsers do not let a page read its own style files when it is opened straight from a folder.';
let APPCSS='';
function loadScript(src){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=()=>rej(new Error('Could not load '+src));document.head.appendChild(s)})}
async function loadCssText(){if(location.protocol==='file:')return;const parts=[];for(const l of document.querySelectorAll('link[rel=stylesheet]')){try{const r=await fetch(l.href);if(r.ok)parts.push(await r.text())}catch(e){}}APPCSS=parts.join('\n')}
const cssText=()=>APPCSS+'\n'+[...document.querySelectorAll('style')].map(s=>s.textContent).join('\n');
const cssOk=()=>cssText().includes('KaTeX_Main');
function noCss(){const e=new Error(NOCSS);e.isNote=true;return e}
async function libText(id,file,glob){const e=document.getElementById(id);if(e)return e.textContent;if(!window[glob])await loadScript(file);return window[glob]}
function handleErr(err){if(err&&err.isNote)note(err.message);else console.error(err)}

/* ---------- in-app dialogs (browser confirm/prompt boxes are blocked inside previews) ---------- */
let ASKRES=null,ASKKIND='y';
function ask(title,text,ok){return new Promise(res=>{if(ASKRES)ASKRES(ASKKIND==='t'?null:false);ASKRES=res;ASKKIND='y';modal('<h3>'+esc(title)+'</h3><p>'+esc(text)+'</p><button class="btn pri" data-act="askyes">'+esc(ok||'OK')+'</button> <button class="btn" data-act="askno">Cancel</button>')})}
function askText(title,def,hint){return new Promise(res=>{if(ASKRES)ASKRES(ASKKIND==='t'?null:false);ASKRES=res;ASKKIND='t';modal('<h3>'+esc(title)+'</h3>'+(hint?'<p class="hint">'+esc(hint)+'</p>':'')+'<input id="asktxt" value="'+esc(def||'')+'" style="width:100%;box-sizing:border-box;min-height:40px;padding:6px 10px;border:1px solid #b8c1cc;border-radius:8px;font:inherit"><div style="margin-top:12px"><button class="btn pri" data-act="askyes">OK</button> <button class="btn" data-act="askno">Cancel</button></div>');setTimeout(()=>{const i=$('#asktxt');if(i){i.focus();i.select()}},30)})}
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target&&e.target.id==='asktxt'){e.preventDefault();acts.askyes()}});
