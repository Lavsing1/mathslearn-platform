'use strict';
/* ====================================================================
   EDITOR: screens, text formatting, diagrams, symbol palette, settings, editor actions (acts)
   ==================================================================== */
/* ---------- screens ---------- */
function show(n){$('#home').classList.toggle('hidden',n!=='home');$('#editor').classList.toggle('hidden',n!=='editor');const b=$('#book');if(b)b.classList.toggle('hidden',n!=='book');const q=$('#quiz');if(q)q.classList.toggle('hidden',n!=='quiz')}
function fmtDate(t){return new Date(t).toLocaleString([],{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
function openLecture(id){
  L=db[id];L.settings={...DEF,...L.settings};if(!L.steps.length)L.steps.push(newStep());
  cur=0;undo=[];redo=[];lastSnap={k:'',t:0};allPrev=false;
  show('editor');buildEditor();refresh();setStatus('Saved');
}
function buildEditor(){
  $('#editor').innerHTML=`<header class="top"><button class="btn" data-act="home">Home</button>
  <input id="ttl" placeholder="Lecture title" aria-label="Lecture title"><input id="sub" placeholder="Subtitle" aria-label="Subtitle"><span class="sp"></span>
  <button class="btn" data-act="undo" title="Ctrl+Z">Undo</button><button class="btn" data-act="redo" title="Ctrl+Y">Redo</button>
  <span class="seg"><button class="btn" data-m="cont" data-act="setm" title="All blocks on one scrolling page">Continuous Page</button><button class="btn" data-m="step" data-act="setm" title="Reveal step by step">Step Presentation</button></span><button class="btn" data-act="settings">Style</button><button class="btn" data-act="pdfsave" title="Make a real PDF file with all pages (opens in any PDF reader, and can be opened here to edit again)">Save PDF</button><button class="btn" data-act="fsave" title="Pick a file on your computer. This lecture will then auto-save into it">Save to file…</button><button class="btn" data-act="share" title="Download a web page students can open (no app needed)">Share page</button><button class="btn" data-act="help" title="Guide and shortcuts">?</button><button class="btn" data-act="export">Export</button><button class="btn" data-act="print">Print / PDF</button>
  <button class="btn pri" data-act="present">Present</button><span id="stat" class="stat"></span></header>
  <div class="cols"><aside class="steps"><div class="stb"><button class="btn pri" data-act="add" title="Ctrl+Enter">Add step</button><button class="btn" data-act="dup">Duplicate</button><button class="btn dng" data-act="del">Delete</button><button class="btn" data-act="up" title="Alt+Up">Up</button><button class="btn" data-act="down" title="Alt+Down">Down</button></div><ul id="sl"></ul></aside>
  <main class="ed" id="edmain"></main>
  <section class="pv"><div class="pvh"><span>Live preview <button class="btn" data-act="pz" data-d="-1" title="Smaller preview">−</button><button class="btn" data-act="pz" data-d="1" title="Larger preview">+</button></span><label><input type="checkbox" id="allp"> Show all steps</label></div><div id="pvbox"></div></section></div>`;
  $('#ttl').value=L.title;$('#sub').value=L.subtitle;
}
function refresh(){renderSteps();renderMain();renderPreview();applyStyles()}
const firstLine=s=>String(s||'').replace(/\$/g,'').split('\n')[0].slice(0,50);
const itemLabel=s=>s.heading||firstLine(s.content)||'(empty step)';
function renderSteps(){
  $('#sl').innerHTML=L.steps.map((s,i)=>`<li class="si ${i===cur?'on':''}" draggable="true" data-act="pick" data-i="${i}"><span class="n">${i+1}</span>${TYPES[s.type]?`<span class="tg t-${s.type}">${TYPES[s.type]}</span>`:''}<span class="lt">${esc(itemLabel(s))}</span></li>`).join('');
  const on=$('#sl .on');if(on&&on.scrollIntoView)on.scrollIntoView({block:"nearest"});
}
function renderMain(){
  const s=L.steps[cur];
  $('#edmain').innerHTML=`<label for="ty">Block type</label><select id="ty">${Object.entries(TYPES).map(([k,v])=>`<option value="${k}"${k===s.type?' selected':''}>${v||'Plain text'}</option>`).join('')}</select>
  <label for="hd">Heading</label><input id="hd" placeholder="e.g. Step 1: Choose ε">
  <label for="ct">Content: use $x^2$ for inline maths, $$ ... $$ for a displayed equation, **bold**, blank line for a new paragraph</label>
  <div class="tabs fb"><button class="btn" data-act="fmt" data-t="**" title="Bold (Ctrl+B)"><b>B</b></button><button class="btn" data-act="fmt" data-t="i" title="Italic (Ctrl+I)"><i>I</i></button><button class="btn" data-act="fmt" data-t="u" title="Underline (Ctrl+U)"><u>U</u></button><button class="btn" data-act="fmt" data-t="h" title="Heading">H</button><button class="btn sw" style="border-color:#d62828" data-act="fmt" data-t="r" title="Red pencil"></button><button class="btn sw" style="border-color:#1d4ed8" data-act="fmt" data-t="b" title="Blue pencil"></button><button class="btn sw" style="border-color:#15803d" data-act="fmt" data-t="g" title="Green pencil"></button><button class="btn sw" style="border-color:#ea7a00" data-act="fmt" data-t="o" title="Orange pencil"></button><button class="btn" style="background:#fff176" data-act="fmt" data-t="hy" title="Highlight">▮</button><button class="btn" style="background:#a5f3b3" data-act="fmt" data-t="hg" title="Highlight">▮</button><button class="btn" style="background:#ffc2d1" data-act="fmt" data-t="hp" title="Highlight">▮</button><button class="btn sw" style="border-color:#8e44ad" data-act="fmt" data-t="pu" title="Purple pencil"></button><button class="btn sw" style="border-color:#e11d74" data-act="fmt" data-t="pk" title="Pink pencil"></button><select id="frm" title="Insert a standard formula or definition"><option value="">Analysis formulas…</option><option value="0">ε–N: sequence converges</option><option value="1">Cauchy sequence</option><option value="2">ε–δ: limit of a function</option><option value="3">Supremum (two conditions)</option><option value="4">Open set in ℝ</option><option value="5">Heine–Borel (compact)</option><option value="6">Uniform continuity</option><option value="7">Riemann integral as a limit</option><option value="8">2×2 matrix</option><option value="9">Triangle inequality</option></select><select id="snip" title="Insert a proof pattern"><option value="">Proof pattern…</option><option value="0">By contradiction</option><option value="1">By induction</option><option value="2">ε–δ start</option><option value="3">Cases</option><option value="4">Without loss of generality</option><option value="5">Add and subtract trick</option></select><input type="color" id="cpick" value="#9333ea" title="Any colour for the selection" style="width:42px;height:34px;padding:2px"><button class="btn" data-act="fmt" data-t="v" title="Hide this text until clicked (answers / hints)">Hide</button><button class="btn" data-act="fmtclr" title="Remove colour/format tags from the selection (or whole block)">Clear</button></div><div class="hint">Select words, then tap a pencil. With nothing selected, an empty pair is inserted so you can type coloured text.</div><textarea id="ct" spellcheck="false" placeholder="Type here. Use the buttons below for symbols."></textarea>
  <div class="tabs" id="tabs"></div><div id="pal"></div><label class="chk"><input type="checkbox" id="pbk"> Start a new page before this block when printing</label><label>Private note to yourself (never shown on screen, in print or in the Web page)</label><textarea id="stn" rows="2" style="width:100%" placeholder="e.g. remind students about the counterexample"></textarea><div id="dgw"></div>`;
  $('#hd').value=s.heading;$('#ct').value=s.content;$('#pbk').checked=!!s.pb;$('#stn').value=s.note||'';renderPal();renderDiagram();
}
function renderPreview(){
  const pv=$('#pvbox');if(!pv)return;
  pv.innerHTML=((allPrev||L.settings.pm!=='step')?L.steps.map((_,i)=>stepAt(i)):[stepAt(cur)]).join('');
}
function updTyping(){const li=$('#sl .on .lt');if(li)li.textContent=itemLabel(L.steps[cur]);renderPreview()}
function applyStyles(){
  if(!L)return;document.querySelectorAll('[data-m]').forEach(b=>b.classList.toggle('on',b.dataset.m===(L.settings.pm==='step'?'step':'cont')));const st=lvStyle(L.settings);
  const pb=$('#pvbox');if(pb){pb.className=lay();pb.setAttribute('style',st+';--pz:'+PZ)}
  const p=$('#pres');p.className=lay()+(P.on?'':' hidden');p.setAttribute('style',st);
}

/* ---------- text formatting (tags inside the text, safe around $...$) ---------- */
const TC={r:'#d62828',b:'#1d4ed8',g:'#15803d',o:'#ea7a00',pu:'#8e44ad',pk:'#e11d74'},HC={hy:'#fff176',hg:'#a5f3b3',hp:'#ffc2d1'};
function mathAt(v,pos){const re=/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;let m;while((m=re.exec(v))){const d=m[1]!=null?2:1;if(pos>=m.index+d&&pos<=m.index+m[0].length-d)return{s:m.index+d}}return null}
function fmtApply(t){
  const el=$('#ct');if(!el)return;const v=el.value,a=el.selectionStart,b=el.selectionEnd,sel=v.slice(a,b),ra=mathAt(v,a),rb=mathAt(v,b);
  const bad='Your selection cuts through a formula. Select inside one formula, or select whole formulas including both $ signs.';
  if((ra||rb)&&!(ra&&rb&&ra.s===rb.s)){note(bad);return}
  if(!ra&&(sel.match(/\$/g)||[]).length%2){note(bad);return}
  const col=t[0]==='#'?t:TC[t];let o,c;
  if(ra){if(!sel){note('Select the part of the formula you want to colour.');return}
    if(col){o='\\textcolor{'+col+'}{';c='}'}else if(HC[t]){o='\\bbox['+HC[t]+']{';c='}'}else if(t==='**'){o='\\boldsymbol{';c='}'}else if(t==='u'){o='\\underline{';c='}'}else{note('Inside a formula only colours, highlight, bold and underline work.');return}}
  else{o=t==='**'?'**':'['+t+']';c=t==='**'?'**':'[/'+t+']'}
  snap('fmt');el.value=v.slice(0,a)+o+sel+c+v.slice(b);const p=sel?b+o.length+c.length:a+o.length;el.focus();el.setSelectionRange(p,p);syncField(el)}
function fmtClear(){
  const el=$('#ct');if(!el)return;snap('fmt');let a=el.selectionStart,b=el.selectionEnd;if(a===b){a=0;b=el.value.length}
  const cl=s=>s.replace(/\[\/?(r|b|g|o|pu|pk|hy|hg|hp|u|i|h|v|#[0-9a-fA-F]{6})\]/g,'').replace(/\*\*/g,'');
  el.value=el.value.slice(0,a)+cl(el.value.slice(a,b))+el.value.slice(b);syncField(el)}
function pscroll(d){const s=$('#stream');if(s)s.scrollBy({top:d*s.clientHeight*.8,behavior:'smooth'})}
function renderCont(){
  $('#pres').innerHTML=`<button class="pb px" data-act="pexit" title="Esc">Exit</button><div class="stream" id="stream"><div class="pg"><h1 class="ct">${rich(L.title,1)}</h1>${L.subtitle?`<div class="cs">${rich(L.subtitle,1)}</div>`:''}${metaLine(L)?`<div class="cs">${metaLine(L)}</div>`:''}${L.steps.map((_,i)=>stepAt(i)).join('')}</div></div>
  <footer class="pbar" id="pbar"><button class="pb" data-act="pback">Up</button><button class="pb" data-act="pnext">Down</button><span style="flex:1"></span>${PENBAR()}<button class="pb" data-act="pfont" data-d="-2">A−</button><button class="pb" data-act="pfont" data-d="2">A+</button><button class="pb" data-act="ptheme">Theme</button><button class="pb" data-act="psettings">Style</button><button class="pb" data-act="pmode">Step mode</button><button class="pb" data-act="pfull" title="F">Full screen</button></footer>`}
/* ---------- diagrams (SVG, saved per step) ---------- */
const DC=['#1d2b3a','#d62828','#1d4ed8','#15803d','#ea7a00'];
const GT=[['sel','Select / move / resize','⬚'],['line','Line','╱'],['arrow','Arrow','→'],['dash','Dashed line','┄'],['dim','Dimension line + label','↔'],['rect','Rectangle','▭'],['tri','Triangle','△'],['poly','Polygon: tap points, double-tap to finish','⬠'],['circ','Circle (centre, then radius)','○'],['ell','Ellipse','⬭'],['pt','Point + label','•'],['lab','Text label','Aa'],['ang','Angle arc (drag from vertex)','∠'],['par','Parallel mark on a line','∥'],['perp','Perpendicular (right-angle) mark','⊾'],['nl','Number line: drag, then give min,max','⟷'],['ival','Interval on a line: drag, then type like [) ','[ )'],['fn','Function graph: drag a box, then type f(x)','ƒ'],['pen','Freehand pencil','✎'],['era','Eraser (drag over shapes)','⌫']];
let D={tool:'sel',sel:null,col:'#1d4ed8',poly:null,snap:false},DG=null;
const dgS=()=>L&&L.steps[cur]&&L.steps[cur].draw,dgSel=()=>{const d=dgS();return d&&d.shapes.find(x=>x.id===D.sel)};
function renderDiagram(){
  const w=$('#dgw');if(!w)return;const d=dgS();
  if(!d){w.innerHTML='<div class="tabs"><button class="btn" data-act="dgadd">+ Add diagram area to this step</button></div>';return}
  w.innerHTML=`<label>Diagram (drawn under the text, saved with the lecture)</label><div class="tabs">${GT.map(g=>`<button class="btn ${D.tool===g[0]?'on':''}" data-act="dgtool" data-k="${g[0]}" title="${g[1]}" aria-label="${g[1]}">${g[2]}</button>`).join('')}</div>
  <div class="tabs">${DC.map(c=>`<button class="btn sw" style="border:3px solid ${c};width:36px;${D.col===c?'background:#dbe7f3':''}" data-act="dgcol" data-c="${c}" title="Shape colour"></button>`).join('')}<button class="btn ${D.snap?'on':''}" data-act="dgsnap" title="Snap to grid">⌗ Snap</button><button class="btn" data-act="dgcopy">Duplicate</button><button class="btn" data-act="dglab">Edit label</button><button class="btn" data-act="dgdel">Delete</button><button class="btn" data-act="dgclr">Clear</button><button class="btn" data-act="dgtall">Taller</button><button class="btn" data-act="dgshort">Shorter</button><button class="btn dng" data-act="dgrm">Remove</button></div>
  <svg id="dgs" class="dgs" viewBox="0 0 800 ${d.h}">${dgInner()}</svg>`}
function dgInner(){
  const d=dgS();if(!d)return'';let o=d.shapes.map(x=>'<g data-id="'+x.id+'">'+sv(x,0)+sv(x,1)+'</g>').join('');
  const s=dgSel();if(s&&!['pen','poly','pt','lab'].includes(s.t))o+=[[s.x1,s.y1,1],[s.x2,s.y2,2]].map(h=>`<circle data-h="${h[2]}" cx="${h[0]}" cy="${h[1]}" r="9" fill="#fff" stroke="#e11d74" stroke-width="3"/>`).join('');
  else if(s&&s.t==='poly')o+=s.p.map((q,i)=>`<circle data-h="v${i}" cx="${q[0]}" cy="${q[1]}" r="8" fill="#fff" stroke="#e11d74" stroke-width="3"/>`).join('');
  else if(s)o+=`<circle cx="${s.x1}" cy="${s.y1}" r="6" fill="none" stroke="#e11d74" stroke-width="3" pointer-events="none"/>`;
  if(D.poly)o+='<polyline fill="none" stroke="#e11d74" stroke-width="2" stroke-dasharray="5 4" points="'+D.poly.map(q=>q.join(',')).join(' ')+'"/>'+D.poly.map(q=>`<circle cx="${q[0]}" cy="${q[1]}" r="4" fill="#e11d74"/>`).join('');
  return o}
function dgRefresh(){const v=$('#dgs');if(v)v.innerHTML=dgInner()}
function dgDelSel(){const d=dgS();if(!d||!D.sel)return;snap();d.shapes=d.shapes.filter(x=>x.id!==D.sel);D.sel=null;persist();dgRefresh();renderPreview()}
const gp=(e,svg)=>{const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const q=p.matrixTransform(svg.getScreenCTM().inverse());if(D.snap){q.x=Math.round(q.x/20)*20;q.y=Math.round(q.y/20)*20}return{x:Math.round(q.x*10)/10,y:Math.round(q.y*10)/10}};
function polyEnd(){const d=dgS();if(d&&D.poly&&D.poly.length>=3){snap();const p=D.poly;d.shapes.push({id:uid(),t:'poly',p,x1:p[0][0],y1:p[0][1],x2:p[p.length-1][0],y2:p[p.length-1][1],c:D.col});persist();renderPreview()}D.poly=null;dgRefresh()}
document.addEventListener('pointerdown',e=>{
  const svg=e.target.closest&&e.target.closest('#dgs');if(!svg||!L)return;const d=dgS();if(!d)return;e.preventDefault();
  const p=gp(e,svg),T=D.tool,hit=e.target.closest('[data-id]'),hd=e.target.closest('[data-h]');
  if(T==='sel'){if(hd&&D.sel){snap();DG={h:hd.dataset.h,id:D.sel}}else if(hit){D.sel=hit.dataset.id;snap();DG={mv:1,id:D.sel,ox:p.x,oy:p.y,o:JSON.parse(JSON.stringify(dgSel()))}}else D.sel=null;if(DG)svg.setPointerCapture&&svg.setPointerCapture(e.pointerId);return dgRefresh()}
  if(T==='era'){snap();DG={era:1};if(hit){d.shapes=d.shapes.filter(x=>x.id!==hit.dataset.id);DG.ch=1;dgRefresh()}svg.setPointerCapture&&svg.setPointerCapture(e.pointerId);return}
  if(T==='pt'||T==='lab'){askText(T==='pt'?'Point label (for example A or O)':'Label text (for example x or 60°)','').then(t=>{if(t===null)return;snap();d.shapes.push({id:uid(),t:T,x1:p.x,y1:p.y,x2:p.x,y2:p.y,c:D.col,txt:t});persist();dgRefresh();renderPreview()});return}
  if(T==='poly'){if(D.poly&&D.poly.length>=3&&Math.hypot(p.x-D.poly[0][0],p.y-D.poly[0][1])<14)return polyEnd();(D.poly=D.poly||[]).push([p.x,p.y]);return dgRefresh()}
  snap();const n={id:uid(),t:T,x1:p.x,y1:p.y,x2:p.x,y2:p.y,c:D.col,p:[[p.x,p.y]]};d.shapes.push(n);DG={id:n.id,new:1};svg.setPointerCapture&&svg.setPointerCapture(e.pointerId)});
document.addEventListener('pointermove',e=>{
  if(!DG)return;const svg=$('#dgs'),d=dgS();if(!svg||!d)return;const p=gp(e,svg);
  if(DG.era){const h=document.elementFromPoint(e.clientX,e.clientY),g=h&&h.closest&&h.closest('#dgs [data-id]');if(g){d.shapes=d.shapes.filter(x=>x.id!==g.dataset.id);DG.ch=1;dgRefresh()}return}
  const sh=d.shapes.find(x=>x.id===DG.id);if(!sh)return;
  if(DG.mv){const o=DG.o,dx=p.x-DG.ox,dy=p.y-DG.oy;sh.x1=o.x1+dx;sh.x2=o.x2+dx;sh.y1=o.y1+dy;sh.y2=o.y2+dy;if(o.p)sh.p=o.p.map(q=>[q[0]+dx,q[1]+dy])}
  else if(DG.h&&DG.h[0]==='v'){sh.p[+DG.h.slice(1)]=[p.x,p.y];sh.x1=sh.p[0][0];sh.y1=sh.p[0][1]}else if(DG.h==='1'){sh.x1=p.x;sh.y1=p.y}else if(DG.h==='2'||DG.new){sh.x2=p.x;sh.y2=p.y;if(sh.t==='pen')sh.p.push([p.x,p.y])}
  DG.ch=1;dgRefresh()});
async function dgEnd(){if(!DG)return;const g=DG;DG=null;const d=dgS();if(!d)return;
  if(g.new){const sh=d.shapes.find(x=>x.id===g.id);if(sh){const big=Math.hypot(sh.x2-sh.x1,sh.y2-sh.y1)>4;
    if(sh.t==='pen'?sh.p.length<3:!big)d.shapes=d.shapes.filter(x=>x!==sh);
    else{if(sh.t==='dim')sh.txt=(await askText('Measurement label','5 cm'))||'';if(sh.t==='nl')sh.txt=(await askText('Number line: min,max','-5,5'))||'-5,5';if(sh.t==='ival')sh.txt=(await askText('Interval ends','[)','Type [ or ( then ] or ), for example [)'))||'[)';if(sh.t==='fn'){sh.f=(await askText('f(x) = ?','x^2','For example x^2, sin(x), x^3-2*x'))||'x';const rg=((await askText('x range: min,max','-3,3'))||'-3,3').split(',').map(Number);if(rg[0]<rg[1]){sh.a=rg[0];sh.b=rg[1]}}if(sh.t==='ang'){const v=parseFloat(await askText('Angle in degrees','60'));if(v>0&&v<360){sh.sw=v;sh.txt=v+'°'}}}}}
  if(g.ch||g.new){persist();renderPreview()}dgRefresh()}
document.addEventListener('pointerup',dgEnd);document.addEventListener('pointercancel',dgEnd);
document.addEventListener('dblclick',e=>{if(D.tool==='poly'&&D.poly&&e.target.closest&&e.target.closest('#dgs')){D.poly.pop();polyEnd()}});
/* ---------- symbol palette ---------- */
const G=s=>s.split(' ').map(x=>[x,x]);
const PAL={
 Greek:G('\\alpha \\beta \\gamma \\delta \\varepsilon \\epsilon \\zeta \\eta \\theta \\lambda \\mu \\nu \\xi \\pi \\rho \\sigma \\tau \\varphi \\chi \\psi \\omega \\Gamma \\Delta \\Theta \\Lambda \\Sigma \\Phi \\Psi \\Omega'),
 Symbols:G('\\le \\ge \\ne \\approx \\equiv \\in \\notin \\subset \\subseteq \\cup \\cap \\setminus \\emptyset \\to \\mapsto \\Rightarrow \\Leftrightarrow \\forall \\exists \\infty \\pm \\cdot \\times \\therefore \\because \\mid \\R \\N \\Z \\Q \\C \\partial \\nabla \\neg \\land \\lor \\ldots \\cdots \\circ \\quad'),
 Structures:[
  ['\\frac{a}{b}','\\frac{§}{}'],['x^{n}','^{§}'],['x_{n}','_{§}'],['\\sqrt{x}','\\sqrt{§}'],['\\sqrt[n]{x}','\\sqrt[§]{}'],['|x|','\\left|§\\right|'],['\\|x\\|','\\left\\|§\\right\\|'],
  ['\\lim_{n\\to\\infty}','\\lim_{§ \\to \\infty}'],['\\sum_{n=1}^{\\infty}','\\sum_{n=1}^{\\infty} §'],['\\int_a^b','\\int_{a}^{b} § \\,dx'],['\\sup_{x}','\\sup_{§}'],['\\inf_{x}','\\inf_{§}'],
  ['(a_n)_{n\\ge1}','(a_n)_{n=1}^{\\infty}'],['\\{x:\\ \\}','\\{ § : \\}'],['[a,b]','[§, ]'],['\\overline{A}','\\overline{§}'],['\\bigcup_{i}','\\bigcup_{i \\in I} §'],['\\bigcap_{i}','\\bigcap_{i \\in I} §'],
  ['f:A\\to B','f : § \\to '],['\\text{if}','\\text{§}'],['\\left(\\ \\right)','\\left( § \\right)'],['\\begin{cases}','\\begin{cases} § & \\text{if } \\\\ & \\text{otherwise} \\end{cases}'],['\\max\\{\\}','\\max\\{§\\}'],['\\binom{n}{k}','\\binom{§}{}']
 ],
 'Real Analysis':[
  ['Limit of a function (ε–δ)','$\\lim_{x\\to a}f(x)=L$ means: for every $\\varepsilon>0$ there is $\\delta>0$ such that $0<|x-a|<\\delta\\implies|f(x)-L|<\\varepsilon$.'],
  ['Convergent sequence','$a_n\\to L$ means: for every $\\varepsilon>0$ there is $N\\in\\N$ such that $|a_n-L|<\\varepsilon$ for all $n\\ge N$.'],
  ['Cauchy sequence','$(a_n)$ is Cauchy if for every $\\varepsilon>0$ there is $N$ such that $|a_m-a_n|<\\varepsilon$ for all $m,n\\ge N$.'],
  ['Continuity at a point','$f$ is continuous at $a$ if for every $\\varepsilon>0$ there is $\\delta>0$ such that $|x-a|<\\delta\\implies|f(x)-f(a)|<\\varepsilon$.'],
  ['Uniform continuity','$f$ is uniformly continuous on $A$ if for every $\\varepsilon>0$ there is $\\delta>0$ such that for all $x,y\\in A$, $|x-y|<\\delta\\implies|f(x)-f(y)|<\\varepsilon$.'],
  ['Supremum','$s=\\sup A$ if $s$ is an upper bound of $A$ and for every $\\varepsilon>0$ there is $x\\in A$ with $x>s-\\varepsilon$.'],
  ['Open set','$U\\subseteq\\R$ is open if for every $x\\in U$ there is $r>0$ with $(x-r,x+r)\\subseteq U$.'],
  ['Triangle inequality','$$|x+y|\\le|x|+|y|$$']
 ]
};
function renderPal(){
  $('#tabs').innerHTML=Object.keys(PAL).map(k=>`<button class="btn ${k===palTab?'on':''}" data-act="ptab" data-k="${k}">${k}</button>`).join('');
  $('#pal').innerHTML=PAL[palTab].map((it,i)=>palTab==='Real Analysis'?`<button class="sn" data-act="ins" data-i="${i}">${esc(it[0])}</button>`:`<button data-act="ins" data-i="${i}" title="${esc(it[1].replace('§',''))}">${tex(it[0],false)}</button>`).join('');
}
function insertAt(str,wrap){
  const el=(lastFocus&&document.contains(lastFocus))?lastFocus:$('#ct');if(!el)return;
  snap('ins');
  const v=el.value,a=el.selectionStart??v.length,b=el.selectionEnd??a,sel=v.slice(a,b);
  const inside=((v.slice(0,a).match(/\$/g)||[]).length%2)===1;
  let t=str;const has=t.includes('§'),idx=t.indexOf('§');
  if(!has&&/[a-zA-Z]$/.test(t))t+=' ';
  t=t.replace('§',sel);
  const pre=(wrap&&!inside)?'$':'',post=pre;
  el.value=v.slice(0,a)+pre+t+post+v.slice(b);
  const c=a+pre.length+(has?idx+sel.length:t.length);
  el.focus();el.setSelectionRange(c,c);
  syncField(el);
}
function syncField(t){
  if(t.id==='hd'){L.steps[cur].heading=t.value}else if(t.id==='ct'){L.steps[cur].content=t.value}else return;
  persist();updTyping();
}

/* ---------- settings / modals ---------- */
function modal(html){const m=$('#modal');m.innerHTML=`<div class="mc">${html}</div>`;m.classList.remove('hidden')}
function closeModal(){if(ASKRES){const r=ASKRES;ASKRES=null;r(ASKKIND==='t'?null:false)}$('#modal').classList.add('hidden');$('#modal').innerHTML=''}
function settingsModal(){
  const s=L.settings,sel=(k,opts)=>`<select data-st="${k}">${opts.map(o=>`<option value="${o}"${s[k]===o?' selected':''}>${o}</option>`).join('')}</select>`;
  const rg=(k,l,min,max,step)=>`<label>${l}</label><div class="rg"><input type="range" data-st="${k}" min="${min}" max="${max}" step="${step}" value="${s[k]}"><span>${s[k]}</span></div>`;
  const bgfg=s.theme==='custom'?[s.bg,s.fg]:(THEMES[s.theme]||THEMES.light);
  modal(`<h3>Lecture style</h3><div class="row"><div><label>Theme</label>${sel('theme',['light','dark','sepia','board','custom'])}</div><div><label>Layout</label>${sel('layout',['classic','boxed','plain'])}</div></div>
  <div class="row"><div><label>Background colour</label><input type="color" data-st="bg" value="${bgfg[0]}"></div><div><label>Text colour</label><input type="color" data-st="fg" value="${bgfg[1]}"></div></div>
  ${rg('size','Text size',16,64,1)}${rg('eq','Equation size',0.9,1.9,0.05)}${rg('lh','Line spacing',1.2,2.3,0.05)}
  <label>Alignment</label>${sel('align',['left','center','justify'])}<label>Paper</label>${sel('paper',['none','ruled','grid'])}${rg('pgap','Gap between blocks (Continuous Page)',0,1.2,0.05)}<label><input type="checkbox" data-st="num" ${s.num?'checked':''} style="width:auto"> Number definitions, theorems, lemmas, examples</label><label><input type="checkbox" data-st="qed" ${s.qed!==false?'checked':''} style="width:auto"> QED mark at end of proof</label><label><input type="checkbox" data-st="eqn" ${s.eqn?'checked':''} style="width:auto"> Number display equations. Label one with {#name} inside $$ and cite it as (@name)</label><div class=\"row\"><div><label>Author</label><input data-meta=\"author\" value=\"${esc(L.author||'')}\"></div><div><label>Institution / course</label><input data-meta=\"org\" value=\"${esc(L.org||'')}\"></div></div><label>Chapter (groups lectures on the home screen)</label><input data-chap value="${esc(L.chapter||'')}" placeholder="e.g. Real Analysis">
  <div class="foot"><button class="btn pri" data-act="mclose">Done</button></div>`);
}
function backupsModal(){
  const bk=LS.get(K_BK,[]);
  modal(`<h3>Backups</h3><p style="margin:0 0 8px;color:#5d6b7e">Restoring creates a new copy. Nothing is overwritten.</p>${bk.map((b,i)=>`<div class="bk"><span><b>${esc(b.data.title)}</b><br><small>${fmtDate(b.t)} · ${b.data.steps.length} steps</small></span><button class="btn" data-act="restore" data-i="${i}">Restore</button></div>`).join('')||'<p>No backups yet.</p>'}<div class="foot"><button class="btn" data-act="mclose">Close</button></div>`);
}
function newModal(){
  modal(`<h3>New lecture</h3><label>Title</label><input id="nt" placeholder="e.g. Sequences and Limits"><label>Subtitle</label><input id="ns" placeholder="e.g. Real Analysis, Chapter 2"><div class="foot"><button class="btn" data-act="mclose">Cancel</button><button class="btn pri" data-act="create">Create</button></div>`);
  setTimeout(()=>$('#nt')&&$('#nt').focus(),30);
}

/* ---------- editor actions ---------- */
function move(from,to){if(from===to||to<0||to>=L.steps.length)return;snap();const [s]=L.steps.splice(from,1);L.steps.splice(to,0,s);cur=to;renderSteps();renderPreview();persist()}
function printLecture(){
  const p=$('#printarea');p.className=lay()+' mode-cont';
  p.setAttribute('style',lvStyle({...L.settings,theme:'light',size:Math.min(L.settings.size,20)}));
  p.innerHTML=`<h1>${esc(L.title)}</h1><div style="opacity:.7;margin-bottom:1em">${esc(L.subtitle)}${metaLine(L)?' — '+metaLine(L):''}</div>`+L.steps.map((_,i)=>stepAt(i)).join('');
  p.querySelectorAll('.rv').forEach(x=>x.classList.add('show'));window.print();
}
const acts={
  home(){flush();L=null;closeModal();show('home');renderHome()},
  new(){newModal()},
  create(){const t=$('#nt').value.trim()||'Untitled lecture',s=$('#ns').value.trim();const l=mk(t,s,[['text','','']]);db[l.id]=l;LS.set(K_DB,db);closeModal();openLecture(l.id)},
  open(){FSOK?acts.fopen():$('#fi').click()},
  openid(d){openLecture(d.id)},
  presid(d){openLecture(d.id);P.from='home';openPres()},
  expid(d){exportLec(db[d.id])},
  dupid(d){const c=JSON.parse(JSON.stringify(db[d.id]));c.id=uid();c.title+=' (copy)';c.updated=Date.now();db[c.id]=c;LS.set(K_DB,db);renderHome()},
  backups(){backupsModal()},
  restore(d){const b=LS.get(K_BK,[])[+d.i];if(!b)return;const c=JSON.parse(JSON.stringify(b.data));c.id=uid();c.title+=' (restored)';c.updated=Date.now();db[c.id]=c;LS.set(K_DB,db);closeModal();renderHome()},
  mclose(){closeModal()},
  askyes(){const r=ASKRES,i=$('#asktxt'),v=i?i.value:true;ASKRES=null;closeModal();if(r)r(v)},
  askno(){closeModal()},
  pick(d){D.sel=null;D.poly=null;cur=+d.i;renderSteps();renderMain();renderPreview()},
  add(){snap();L.steps.splice(cur+1,0,newStep());cur++;refresh();persist();$('#hd').focus()},
  dup(){snap();const c=JSON.parse(JSON.stringify(L.steps[cur]));c.id=uid();L.steps.splice(cur+1,0,c);cur++;refresh();persist()},
  del(){snap();L.steps.splice(cur,1);if(!L.steps.length)L.steps.push(newStep());cur=Math.min(cur,L.steps.length-1);refresh();persist()},
  up(){move(cur,cur-1)},down(){move(cur,cur+1)},
  undo(){if(!undo.length)return;redo.push(state());restore(undo.pop())},
  redo(){if(!redo.length)return;undo.push(state());restore(redo.pop())},
  settings(){settingsModal()},
  export(){flush();exportLec(L)},
  print(){printLecture()},
  present(){P.from='editor';openPres()},
  ptab(d){palTab=d.k;renderPal()},
  ins(d){const it=PAL[palTab][+d.i];insertAt(it[1],palTab!=='Real Analysis')},
  pstart(){pstart()},pnext(){pnext()},pback(){pback()},pexit(){pexit()},prestart(){P.started=false;P.n=0;renderPres()},
  pfull(){fs()},pfont(d){font(+d.d)},ptheme(){const k=['light','dark','sepia','board'];const i=k.indexOf(L.settings.theme);L.settings.theme=k[(i+1)%k.length];persist();applyStyles()},
  psettings(){settingsModal()},
  ppen(d){PN.tool=d.c;pUI()},peras(){PN.tool='era';pUI()},phand(){PN.tool=null;pUI()},pclr(){PN.strokes=[];pdraw()},
  about(){modal(`<div class="hl-h"><h3>About Mathematics Lecture Studio</h3><p>Version 2. A single HTML file: no account, no server, no tracking. Lectures are stored in this browser on this device.</p>
<h4>Put it online for everyone (free, GitHub Pages)</h4><ul><li>Create a GitHub repository and upload this file as <code>index.html</code>.</li><li>Repository → Settings → Pages → Deploy from branch → <code>main</code> / root → Save.</li><li>After a minute you get a link like <code>https://yourname.github.io/repo/</code>. Anyone can open it, and each person's lectures stay in their own browser.</li><li>On a phone: open the link, then browser menu → "Add to Home screen".</li></ul>
<h4>Moving lectures between devices</h4><ul><li><b>Export</b> or <b>Export all lectures</b>, send the file, then <b>Open lecture file</b> on the other device.</li><li>For students, use <b>Web page</b>: one file that opens anywhere.</li></ul>
<h4>Good to know</h4><ul><li>Clearing browser data deletes lectures and backups, so Export important work.</li><li>Formulas use KaTeX, a large subset of LaTeX. Full LaTeX and TikZ are not supported; diagrams use the built-in drawing tools.</li></ul>
<button class="btn" data-act="help">Open the guide</button> <button class="btn pri" data-act="mclose">Close</button></div>`)},
  async fopen(){try{const [fh]=await showOpenFilePicker({types:FTYPES});const o=JSON.parse(await(await fh.getFile()).text());if(o.book){bkImport(o);renderHome();note('Book imported.');return}if(o.quiz){quizImportOne(o.quiz);renderHome();note('Quiz imported.');return}const arr=Array.isArray(o.lectures)?o.lectures:[o],ids=fsMerge(arr);fsMergeBooks(o.books);fsMergeQuiz(o.quizzes);
    if(arr.length>1){if(await ask('Keep all lectures in this file?','This file holds '+arr.length+' lectures. Keep ALL your lectures auto-saved into this file from now on?','Yes, auto-save into it')){FS.lib=fh;await hput('lib',fh)}}else if(ids[0]){FS.map[ids[0]]=fh;await hput('lec:'+ids[0],fh)}
    LS.set(K_DB,db);await fsCheck();renderHome();if(arr.length===1&&ids[0])openLecture(ids[0])}catch(e){if(!e||e.name!=='AbortError')note('Could not open that file: '+((e&&e.message)||e))}},
  async fsave(){if(!FSOK){note('This browser cannot auto-save into a file you choose. That works in Chrome or Edge on a computer. A copy is being downloaded instead.');return exportLec(L)}
    try{const fh=await showSaveFilePicker({suggestedName:(L.title||'lecture').replace(/[\\/:*?"<>|]+/g,'_')+'.lecture.json',types:FTYPES});FS.map[L.id]=fh;await hput('lec:'+L.id,fh);flush();fsSync();setStatus('Auto-saving into '+fh.name)}catch(e){if(!e||e.name!=='AbortError')note('Could not use that file: '+((e&&e.message)||e))}},
  async flib(){if(!FSOK){note('This browser cannot auto-save into a file you choose. That works in Chrome or Edge on a computer. All lectures are being downloaded instead.');return acts.expall()}
    try{const fh=await showSaveFilePicker({suggestedName:'my-lectures.lecture.json',types:FTYPES});FS.lib=fh;await hput('lib',fh);fsSync();fsUI()}catch(e){if(!e||e.name!=='AbortError')note('Could not use that file: '+((e&&e.message)||e))}},
  async fallow(){for(const fh of [FS.lib,...Object.values(FS.map)]){if(fh&&fh.requestPermission)try{await fh.requestPermission({mode:'readwrite'})}catch(e){}}await fsCheck();fsSync();fsUI()},
  async funlink(){if(!(await ask('Stop auto-saving into files?','The files stay on your disk and your lectures stay in this browser.','Stop auto-saving')))return;FS.lib=null;FS.map={};await hclear();fsUI()},
  pdfpick(){if(window.showOpenFilePicker){showOpenFilePicker({types:[{description:'PDF',accept:{'application/pdf':['.pdf']}}]}).then(async([fh])=>pdfOpen(new Uint8Array(await(await fh.getFile()).arrayBuffer()),fh.name)).catch(e=>{if(e&&e.name!=='AbortError')note('Could not open that PDF: '+e.message)})}else $('#pdfin').click()},
  async pdfsave(){if(!L)return;flush();const name=(L.title||'lecture').replace(/[\\/:*?"<>|]+/g,'_')+'.pdf';let fh=null;
    if(window.showSaveFilePicker){try{fh=FS.pdf&&FS.pdf[L.id];if(!(fh&&fh.queryPermission&&await fh.queryPermission({mode:'readwrite'})==='granted'))fh=await showSaveFilePicker({suggestedName:name,types:[{description:'PDF',accept:{'application/pdf':['.pdf']}}]});(FS.pdf=FS.pdf||{})[L.id]=fh}catch(e){if(e&&e.name==='AbortError')return;fh=null}}
    modal('<h3>Making your PDF…</h3><p id="pgp">Preparing…</p>');
    try{const bytes=await makePdf(L,(i,n)=>{const e=$('#pgp');if(e)e.textContent='Page '+i+' of '+n});PR.last={bytes,name};const how=await savePdfBytes(bytes,name,fh);closeModal();
      modal('<h3>PDF ready</h3><p>'+esc(how)+'</p><p class="hint">It opens in any PDF reader. Open it in this app\'s reader and press "Edit as lecture" to change it again.</p><button class="btn pri" data-act="pdfview">Open in reader</button> <button class="btn" data-act="mclose">Close</button>')}
    catch(e){closeModal();note('Could not make the PDF here ('+((e&&e.message)||e)+'). Use Print and choose Save as PDF instead.')}},
  dlclose(){const b=$('#dlbar');if(b)b.remove()},
  dltext(){modal('<h3>Copy this text</h3><p class="hint">Select all, copy, and paste it into a file named something.lecture.json. Then use Open lecture file.</p><textarea style="width:100%;height:50vh" readonly>'+esc(DLT)+'</textarea><button class="btn pri" data-act="mclose">Close</button>')},
  pdfview(){closeModal();if(PR.last)pdfOpen(PR.last.bytes,PR.last.name)},
  pdfprev(){pdfGo(PR.cur-1)},pdfnext(){pdfGo(PR.cur+1)},pdfzi(){PR.fit=false;PR.scale=Math.min(4,PR.scale*1.2);pdfLayout()},pdfzo(){PR.fit=false;PR.scale=Math.max(.3,PR.scale/1.2);pdfLayout()},pdffit(){PR.fit=true;pdfLayout()},
  pdfclose(){const v=$('#pdfv');v.hidden=true;$('#pdfpages').innerHTML='';PR.doc=null},
  async pdfedit(){try{const o=JSON.parse(new TextDecoder().decode(PR.att));if(o.book){const bid=bkImport(o);acts.pdfclose();bkOpenId(bid);return}const x=(o.lectures||[o])[0];let id;if(x.id&&db[x.id]&&(await ask('This lecture already exists here','Replace it with the version in this PDF (a backup is kept). If you press Cancel, the PDF opens as a separate copy.','Replace it'))){backup(db[x.id],0);delete db[x.id]}
      id=importLec(x).id;LS.set(K_DB,db);acts.pdfclose();openLecture(id)}catch(e){note('Could not read the lecture inside this PDF.')}},
  bknew(){modal('<h3>New book</h3><label>Title</label><input id="bkt" placeholder="e.g. A First Course in Real Analysis"><label>Author</label><input id="bka"><div style="margin-top:12px"><button class="btn pri" data-act="bkcreate">Create book</button> <button class="btn" data-act="mclose">Cancel</button></div>')},
  bkcreate(){const t=($('#bkt').value||'').trim()||'Untitled book',a=($('#bka').value||'').trim(),id=uid(),ch=bkNewCh(id,'Chapter title');BK[id]={id,title:t,subtitle:'',author:a,org:'',size:'a4',created:Date.now(),updated:Date.now(),order:[ch.id]};bkSave();LS.set(K_DB,db);closeModal();bkOpenId(id)},
  bkopen(d){bkOpenId(d.id)},
  bkhome(){show('home');renderHome()},
  bkch(d){openLecture(d.id)},
  bkaddch(){const b=BK[BKC];if(!b)return;const l=bkNewCh(b.id,'Chapter '+(b.order.length+1));b.order.push(l.id);b.updated=Date.now();bkSave();LS.set(K_DB,db);renderBook()},
  bkup(d){const o=BK[BKC].order,i=o.indexOf(d.id);if(i>0){[o[i-1],o[i]]=[o[i],o[i-1]];bkSave();renderBook()}},
  bkdown(d){const o=BK[BKC].order,i=o.indexOf(d.id);if(i>=0&&i<o.length-1){[o[i+1],o[i]]=[o[i],o[i+1]];bkSave();renderBook()}},
  bkchdel(d){modal('<h3>Delete this chapter?</h3><p>'+esc(db[d.id]?db[d.id].title:'')+' will be removed from the book. A backup copy is kept.</p><button class="btn dng" data-act="bkchdelok" data-id="'+d.id+'">Delete chapter</button> <button class="btn" data-act="mclose">Cancel</button>')},
  bkchdelok(d){const b=BK[BKC];if(db[d.id]){backup(db[d.id],0);delete db[d.id]}b.order=b.order.filter(x=>x!==d.id);bkSave();LS.set(K_DB,db);closeModal();renderBook()},
  bkdel(d){modal('<h3>Delete this book?</h3><p>'+esc(BK[d.id]?BK[d.id].title:'')+' and all its chapters will be removed from this browser. A backup copy of each chapter is kept. Export the book first if you may need it.</p><button class="btn dng" data-act="bkdelok" data-id="'+d.id+'">Delete book</button> <button class="btn" data-act="mclose">Cancel</button>')},
  bkdelok(d){const b=BK[d.id];if(b){chaps(b).forEach(c=>{backup(c,0);delete db[c.id]});delete BK[d.id]}bkSave();LS.set(K_DB,db);closeModal();renderHome()},
  bkexp(){const b=BK[BKC];if(!b)return;const t=JSON.stringify({app:'MathLectureStudio',version:2,book:b,lectures:chaps(b)},null,2);deliver((b.title||'book').replace(/[\\/:*?"<>|]+/g,'_')+'.book.json',new Blob([t],{type:'application/json'}),t)},
  async bkpdf(){const b=BK[BKC];if(!b)return;if(!chaps(b).length)return note('Add a chapter first.');const name=(b.title||'book').replace(/[\\/:*?"<>|]+/g,'_')+'.pdf';let fh=null;
    if(window.showSaveFilePicker){try{fh=FS.pdf&&FS.pdf['book:'+b.id];if(!(fh&&fh.queryPermission&&await fh.queryPermission({mode:'readwrite'})==='granted'))fh=await showSaveFilePicker({suggestedName:name,types:[{description:'PDF',accept:{'application/pdf':['.pdf']}}]});(FS.pdf=FS.pdf||{})['book:'+b.id]=fh}catch(e){if(e&&e.name==='AbortError')return;fh=null}}
    modal('<h3>Making your book PDF…</h3><p id="pgp">Preparing…</p><p class="hint">Long books take a few minutes. Keep this tab open.</p>');
    try{const bytes=await makePdf(null,(i,n)=>{const e=$('#pgp');if(e)e.textContent='Page '+i+' of '+n},b);PR.last={bytes,name};const how=await savePdfBytes(bytes,name,fh);closeModal();
      modal('<h3>Book PDF ready</h3><p>'+esc(how)+'</p><p class="hint">Open it in this app\'s reader and press "Edit as lecture" to bring the whole book back for editing.</p><button class="btn pri" data-act="pdfview">Open in reader</button> <button class="btn" data-act="mclose">Close</button>')}
    catch(e){closeModal();note('Could not make the book PDF here ('+((e&&e.message)||e)+').')}},
  qznew(){modal('<h3>New MCQ quiz</h3><label>Title</label><input id="qzt" placeholder="e.g. Real Analysis: sequences"><label>Default seconds per question</label><input id="qzs" type="number" min="5" max="600" value="30"><div style="margin-top:12px"><button class="btn pri" data-act="qzcreate">Create quiz</button> <button class="btn" data-act="mclose">Cancel</button></div>')},
  qzcreate(){const id=uid(),z=qzClean({id,title:($('#qzt').value||'').trim()||'Untitled quiz',time:+$('#qzs').value||30,questions:[qzSample(0)]});QZ[id]=z;qzNow();closeModal();qzOpenId(id)},
  qzopen(d){qzOpenId(d.id)},qzhome(){show('home');renderHome()},
  qzdel(d){modal('<h3>Delete this quiz?</h3><p>'+esc(QZ[d.id]?QZ[d.id].title:'')+' will be removed from this browser. Export it first if you may need it again.</p><button class="btn dng" data-act="qzdelok" data-id="'+d.id+'">Delete quiz</button> <button class="btn" data-act="mclose">Cancel</button>')},
  qzdelok(d){delete QZ[d.id];qzNow();closeModal();renderHome()},
  qzaddq(){const z=QZ[QZC];z.questions.push({id:uid(),q:'',opts:['','','',''],ans:[0],multi:false,sol:'',time:0});touchQ(z);renderQuiz(true)},
  qzsample(){const z=QZ[QZC];z.questions.push(qzSample(z.questions.length%2));touchQ(z);renderQuiz(true)},
  qzqup(d){const a=QZ[QZC].questions,i=+d.i;if(i>0){[a[i-1],a[i]]=[a[i],a[i-1]];touchQ(QZ[QZC]);renderQuiz(true)}},
  qzqdn(d){const a=QZ[QZC].questions,i=+d.i;if(i<a.length-1){[a[i+1],a[i]]=[a[i],a[i+1]];touchQ(QZ[QZC]);renderQuiz(true)}},
  qzqdup(d){const a=QZ[QZC].questions,i=+d.i,c=JSON.parse(JSON.stringify(a[i]));c.id=uid();a.splice(i+1,0,c);touchQ(QZ[QZC]);renderQuiz(true)},
  qzqdel(d){modal('<h3>Delete question '+(+d.i+1)+'?</h3><button class="btn dng" data-act="qzqdelok" data-i="'+d.i+'">Delete</button> <button class="btn" data-act="mclose">Cancel</button>')},
  qzqdelok(d){QZ[QZC].questions.splice(+d.i,1);touchQ(QZ[QZC]);closeModal();renderQuiz(true)},
  qzoadd(d){const q=QZ[QZC].questions[+d.i];if(q.opts.length<6){q.opts.push('');touchQ(QZ[QZC]);renderQuiz(true)}},
  qzorm(d){const q=QZ[QZC].questions[+d.i],j=+d.j;if(q.opts.length<=2)return;q.opts.splice(j,1);q.ans=q.ans.filter(x=>x!==j).map(x=>x>j?x-1:x);touchQ(QZ[QZC]);renderQuiz(true)},
  qzlive(d){qlOpen(d.id||QZC)},
  qzshare(d){const z=QZ[d.id||QZC];if(!z)return;if(!z.questions.length)return note('Add at least one question first.');dlFile((z.title||'quiz').replace(/[\\/:*?"<>|]+/g,'_')+' - student quiz.html',quizHTML(z),'text/html')},
  qzexp(d){const z=QZ[d.id||QZC];if(!z)return;const t=JSON.stringify({app:'MathLectureStudio',version:2,quiz:z},null,2);deliver((z.title||'quiz').replace(/[\\/:*?"<>|]+/g,'_')+'.quiz.json',new Blob([t],{type:'application/json'}),t)},
  qlfs(d){QL.fs=Math.max(12,Math.min(40,QL.fs+(+d.d)*2));QL.z.fs=QL.fs;touchQ(QL.z);qlRender()},
  qlstart(){SFX.click();qlGo(0)},qlexit(){qlExit()},qlmute(){SFX.m=!SFX.m;if(!SFX.m)SFX.click();qlRender()},
  qlpoll(){QL.poll=!QL.poll;qlRender()},qlrestart(){QL.tally=QL.z.questions.map(q=>q.opts.map(()=>0));SFX.click();qlGo(0)},
  qlpick(d){if(QL.ph!=='q')return;const j=+d.j,q=QL.z.questions[QL.i];if(j>=q.opts.length)return;if(q.multi){const x=QL.pick.indexOf(j);if(x>=0)QL.pick.splice(x,1);else QL.pick.push(j)}else QL.pick=[j];SFX.click();qlRender()},
  qlreveal(){qlReveal(false)},qlnext(){if(QL.ph==='end'||QL.ph==='title')return;SFX.click();qlGo(QL.i+1)},
  qlpause(){if(QL.ph!=='q')return;QL.paused=!QL.paused;SFX.click();qlRender()},qladd(){if(QL.ph!=='q')return;QL.left+=10;QL.tot=Math.max(QL.tot,QL.left);SFX.click();qlTimeUI()},
  qltal(d){const t=QL.tally[QL.i];t[+d.j]=Math.max(0,t[+d.j]+(+d.d));SFX.click();qlRender()},
  help(){try{localStorage.setItem('mls.seen','1')}catch(e){}modal(helpHTML())},
  tpls(){modal('<h3>Start from a template</h3>'+Object.keys(TPL).map(k=>`<button class="btn tp" data-act="tpl" data-k="${k}"><b>${TPL[k].n}</b><small>${TPL[k].d}</small></button>`).join('')+'<button class="btn" data-act="mclose">Cancel</button>')},
  tpl(d){const l=TPL[d.k].b();db[l.id]=l;LS.set(K_DB,db);closeModal();openLecture(l.id)},
  share(){if(!L)return;flush();dlFile((L.title||'lecture').replace(/[^\w-]+/g,'_')+'.html',shareHTML(L),'text/html')},
  shareid(d){const l=db[d.id];if(l)dlFile((l.title||'lecture').replace(/[^\w-]+/g,'_')+'.html',shareHTML(l),'text/html')},
  pundo(){PN.strokes.pop();pdraw()},
  pout(){modal('<h3>Outline</h3>'+L.steps.map((s,i)=>`<button class="btn tp" data-act="pgo" data-i="${i}">${i+1}. ${TYPES[s.type]?TYPES[s.type]+' — ':''}${esc((s.heading||s.content||'(empty)').replace(/\$/g,'').slice(0,70))}</button>`).join('')+'<button class="btn" data-act="mclose">Close</button>')},
  pgo(d){const i=+d.i;closeModal();if(L.settings.pm!=='step'){const b=document.querySelectorAll('#stream .blk')[i];if(b)b.scrollIntoView({behavior:'smooth',block:'start'});return}
    if(!P.started){P.started=true;$('#tscr').style.display='none';$('#stream').classList.remove('hidden');$('#pbar').classList.remove('hidden')}
    P.n=i+1;const st=$('#stream');st.innerHTML=L.steps.slice(0,P.n).map((_,j)=>stepAt(j)).join('');pui();st.scrollTo({top:st.scrollHeight})},
  pz(d){PZ=Math.max(.5,Math.min(2,PZ+(+d.d)*.1));applyStyles()},
  psize(){PN.wi=(PN.wi+1)%3;pUI()},
  pfit(){const st=$('#stream');if(!st)return;let s=64;while(s>16){L.settings.size=s;applyStyles();if(st.scrollHeight<=st.clientHeight+4)break;s-=2}L.settings.size=Math.max(16,s);persist();applyStyles()},
  expall(){const t=JSON.stringify({app:'MathLectureStudio',version:2,lectures:Object.values(db),books:Object.values(BK),quizzes:Object.values(QZ)},null,2);deliver('all-lectures.lectures.json',new Blob([t],{type:'application/json'}),t)},
  dgsnap(){D.snap=!D.snap;renderDiagram()},
  dgcopy(){const sh=dgSel();if(!sh)return note('Select a shape first.');snap();const c=JSON.parse(JSON.stringify(sh));c.id=uid();['x1','x2'].forEach(k=>c[k]+=24);['y1','y2'].forEach(k=>c[k]+=24);if(c.p)c.p=c.p.map(q=>[q[0]+24,q[1]+24]);dgS().shapes.push(c);D.sel=c.id;persist();renderDiagram();renderPreview()},
  setm(d){snap();L.settings.pm=d.m;persist();applyStyles();renderPreview()},
  pmode(){L.settings.pm=L.settings.pm==='step'?'cont':'step';P.started=false;P.n=0;persist();applyStyles();renderPres()},
  fmt(d){fmtApply(d.t)},fmtclr(){fmtClear()},
  dgadd(){snap();L.steps[cur].draw={h:320,shapes:[]};renderDiagram();persist()},
  dgtool(d){D.tool=d.k;D.poly=null;renderDiagram()},
  dgcol(d){D.col=d.c;const sh=dgSel();if(sh){snap();sh.c=d.c;persist();renderPreview()}renderDiagram()},
  async dglab(){const sh=dgSel();if(!sh)return note('Select a shape first.');const v=await askText('Label or measurement',sh.txt||'');if(v!==null){snap();sh.txt=v;persist();renderDiagram();renderPreview()}},
  dgdel(){dgDelSel()},
  async dgclr(){const d=dgS();if(d&&d.shapes.length&&(await ask('Clear this diagram?','All shapes in this diagram will be removed. Undo brings them back.','Clear'))){snap();d.shapes=[];D.sel=null;persist();renderDiagram();renderPreview()}},
  dgtall(){const d=dgS();snap();d.h=Math.min(900,d.h+60);persist();renderDiagram();renderPreview()},
  dgshort(){const d=dgS();snap();d.h=Math.max(120,d.h-60);persist();renderDiagram();renderPreview()},
  async dgrm(){if(await ask('Remove this diagram?','The diagram area is removed from this step. Undo brings it back.','Remove')){snap();delete L.steps[cur].draw;D.sel=null;persist();renderDiagram();renderPreview()}}
};
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-act]');
  if(b&&acts[b.dataset.act]){try{const r=acts[b.dataset.act](b.dataset);if(r&&r.catch)r.catch(handleErr)}catch(err){handleErr(err)}if(b.tagName==='BUTTON'&&P.on)b.blur()}
  else if(e.target.id==='modal')closeModal();
});
document.addEventListener('mousedown',e=>{if(e.target.closest('#pal,.fb button'))e.preventDefault()});
document.addEventListener('focusin',e=>{if(e.target.id==='hd'||e.target.id==='ct')lastFocus=e.target});
document.addEventListener('input',e=>{
  const t=e.target;if(!L)return;
  if(t.id==='ttl'){snap('ttl');L.title=t.value;persist()}
  else if(t.id==='sub'){snap('sub');L.subtitle=t.value;persist()}
  else if(t.id==='hd'||t.id==='ct'){snap(t.id+cur);syncField(t)}
  else if(t.id==='ty'){snap();L.steps[cur].type=t.value;persist();renderSteps();renderPreview()}
  else if(t.id==='stn'){L.steps[cur].note=t.value;persist()}
  else if(t.id==='pbk'){snap();L.steps[cur].pb=t.checked;persist()}
  else if(t.id==='allp'){allPrev=t.checked;renderPreview()}
  else if(t.dataset&&t.dataset.meta){if(t.dataset.meta==='author'||t.dataset.meta==='org')L[t.dataset.meta]=t.value;persist()}
  else if(t.dataset&&t.dataset.chap!==undefined){L.chapter=t.value;persist()}
  else if(t.dataset&&t.dataset.st){
    const k=t.dataset.st;snap('st'+k);
    L.settings[k]=(t.type==='checkbox')?t.checked:(t.type==='range')?+t.value:t.value;
    if(t.type==='range')t.nextElementSibling.textContent=t.value;
    if(k==='bg'||k==='fg'){L.settings.theme='custom';const ts=document.querySelector('[data-st=theme]');if(ts)ts.value='custom';if(k==='bg'&&!L.settings.fg)L.settings.fg=DEF.fg}
    if(k==='theme'&&t.value!=='custom'){const c=THEMES[t.value];const bg=document.querySelector('[data-st=bg]'),fg=document.querySelector('[data-st=fg]');if(bg){bg.value=c[0];L.settings.bg=c[0]}if(fg){fg.value=c[1];L.settings.fg=c[1]}}
    persist();applyStyles();
  }
});
document.addEventListener('change',e=>{
  if(e.target.id==='frm'){const t=FORM[+e.target.value];e.target.selectedIndex=0;const el=$('#ct');if(!el||!t)return;snap('frm');el.setRangeText(t,el.selectionStart,el.selectionEnd,'end');el.focus();syncField(el);return}
  if(e.target.id==='snip'){const t=SNIP[+e.target.value];e.target.selectedIndex=0;const el=$('#ct');if(!el||!t)return;snap('snip');el.setRangeText(t,el.selectionStart,el.selectionEnd,'end');el.focus();syncField(el);return}
  if(e.target.id==='cpick'){fmtApply(e.target.value);return}
  if(e.target.id==='fi'&&e.target.files[0]){
    const r=new FileReader();
    r.onload=()=>{try{const o=JSON.parse(r.result);if(o.book){bkImport(o);renderHome();note('Book imported.');return}if(o.quiz){quizImportOne(o.quiz);renderHome();note('Quiz imported.');return}const arr=Array.isArray(o.lectures)?o.lectures:[o];let l;arr.forEach(x=>{l=importLec(x)});if(arr.length>1){renderHome();note('Imported '+arr.length+' lectures.')}else openLecture(l.id)}catch(err){note('This file is not a valid lecture file.')}};
    r.readAsText(e.target.files[0]);e.target.value='';
  }
});
/* drag to reorder */
let dragI=null;
document.addEventListener('dragstart',e=>{const li=e.target.closest&&e.target.closest('.si');if(li){dragI=+li.dataset.i;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',String(dragI))}});
document.addEventListener('dragover',e=>{const li=e.target.closest&&e.target.closest('.si');if(li&&dragI!==null){e.preventDefault();document.querySelectorAll('.dragover').forEach(x=>x.classList.remove('dragover'));li.classList.add('dragover')}});
document.addEventListener('drop',e=>{const li=e.target.closest&&e.target.closest('.si');if(li&&dragI!==null){e.preventDefault();const to=+li.dataset.i,from=dragI;dragI=null;move(from,to)}});
document.addEventListener('dragend',()=>{dragI=null;document.querySelectorAll('.dragover').forEach(x=>x.classList.remove('dragover'))});

