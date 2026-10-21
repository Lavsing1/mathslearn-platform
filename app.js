const $ = (id) => document.getElementById(id);
let items = [];
let authenticated = false;
let editingId = null;
let contentCache = [];

function toast(message) {
  const t = $('toast'); if (!t) return;
  t.textContent = message; t.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}
function safe(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function value(id) { return ($(id)?.value || '').trim(); }
function lower(id) { return value(id).toLowerCase(); }
async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const response = await fetch(path, { credentials: 'same-origin', ...options, headers });
  let data = {};
  try { data = await response.json(); } catch { /* empty response */ }
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}
function normalize(item) {
  return { id:item.id, title:item.title, type:item.content_type || item.type, paperType:item.paper_type || item.paperType || '', level:item.study_level || item.level,
    course:item.course, board:item.board_exam || item.board || '', topic:item.topic || '', subject:item.subject || '', chapter:item.chapter || item.topic || '', excerpt:item.excerpt || '', thumbnail:item.thumbnail_url || '', seo:item.seo_description || item.seo || '',
    body:item.body_html || item.body || '', status:item.status, createdAt:item.created_at, updatedAt:item.updated_at };
}

// Theme
$('themeBtn')?.addEventListener('click', () => {
  document.body.classList.toggle('dark');
  localStorage.setItem('mathslearn-theme', document.body.classList.contains('dark') ? 'dark' : 'light');
  toast(document.body.classList.contains('dark') ? 'Dark theme enabled' : 'Light theme enabled');
});
if (localStorage.getItem('mathslearn-theme') === 'dark') document.body.classList.add('dark');

// Student editor stays on the student's device.
document.querySelectorAll('[data-cmd]').forEach(btn => btn.addEventListener('click', () => {
  $('studentEditor').focus(); document.execCommand(btn.dataset.cmd, false, btn.dataset.val || null);
}));
document.querySelectorAll('[data-symbol]').forEach(btn => btn.addEventListener('click', () => {
  $('studentEditor').focus(); document.execCommand('insertText', false, btn.dataset.symbol);
}));
$('copyStudent')?.addEventListener('click', async () => {
  const text = $('studentEditor').innerText.trim(); if (!text) return toast('Write something first.');
  try { await navigator.clipboard.writeText(text); toast('Text copied.'); }
  catch { toast('Clipboard permission unavailable. Select and copy the text manually.'); }
});
$('clearStudent')?.addEventListener('click', () => { $('studentEditor').innerHTML = ''; toast('Editor cleared.'); });

// Admin session, authentication and D1 content management.
function setAdminUI(isAuthed, email = '') {
  authenticated = isAuthed;
  if (!$('adminLoginPanel')) return;
  $('adminLoginPanel').hidden = isAuthed;
  $('adminWorkspace').hidden = !isAuthed;
  $('adminSessionActions').hidden = !isAuthed;
  $('adminStatus').textContent = isAuthed ? 'Signed in' : 'Login required';
  $('adminStatus').classList.toggle('orange', !isAuthed);
  $('adminWelcome').textContent = isAuthed ? `Signed in as ${email}` : '';
  $('adminNotice').hidden = isAuthed;
}
async function checkSession() {
  try { const d = await api('/api/auth/me', { method:'GET', headers:{} }); setAdminUI(d.authenticated, d.email || ''); if (d.authenticated) await loadAdminItems(); }
  catch { setAdminUI(false); }
}
$('adminLoginForm')?.addEventListener('submit', async e => {
  e.preventDefault(); const message = $('loginMessage'); message.textContent = 'Signing in…';
  try {
    const d = await api('/api/auth/login', { method:'POST', body:JSON.stringify({email:value('adminEmail'),password:value('adminPassword')}) });
    $('adminPassword').value = ''; message.textContent = ''; setAdminUI(true, d.email); await loadAdminItems(); toast('Admin login successful.');
  } catch (err) { message.textContent = err.message; }
});
$('adminLogout')?.addEventListener('click', async () => {
  try { await api('/api/auth/logout', { method:'POST', body:'{}' }); } catch { /* local UI still closes */ }
  setAdminUI(false); items = []; renderAdminItems(); toast('Signed out.');
});

// Admin editor formatting.
document.querySelectorAll('[data-admin-tab]').forEach(btn => btn.addEventListener('click', () => adminTab(btn.dataset.adminTab)));
document.querySelector('[data-go-create]')?.addEventListener('click', () => { resetForm(); adminTab('create'); });
function adminTab(name) {
  if (!authenticated) return toast('Please sign in to access the Admin Studio.');
  document.querySelectorAll('.admin-pane').forEach(p => p.hidden = true);
  const target = $('admin-' + name); if (target) target.hidden = false;
  document.querySelectorAll('[data-admin-tab]').forEach(b => b.classList.toggle('active', b.dataset.adminTab === name));
}
document.querySelectorAll('[data-admin-cmd]').forEach(btn => btn.addEventListener('click', () => {
  $('adminEditor').focus(); document.execCommand(btn.dataset.adminCmd, false, btn.dataset.val || null);
}));
document.querySelectorAll('[data-admin-symbol]').forEach(btn => btn.addEventListener('click', () => {
  $('adminEditor').focus(); document.execCommand('insertText', false, btn.dataset.adminSymbol);
}));
function readForm() {
  return { id:editingId, title:value('contentTitle'), content_type:value('contentType'), paper_type:value('contentPaperType'), study_level:value('contentLevel'), course:value('contentCourse'),
    board_exam:value('contentBoard'), topic:value('contentTopic'), seo_description:value('contentSEO'), body_html:$('adminEditor').innerHTML, status:'draft' };
}
function resetForm() {
  editingId = null;
  ['contentTitle','contentTopic','contentSEO'].forEach(id => { if ($(id)) $(id).value = ''; });
  $('contentType').selectedIndex=0; $('contentPaperType').selectedIndex=0; $('contentLevel').selectedIndex=0; $('contentCourse').selectedIndex=0; $('contentBoard').selectedIndex=0; $('adminEditor').innerHTML='';
  $('contentPreview').hidden = true; $('publishContent').textContent='Publish online';
}
async function saveItem(status) {
  if (!authenticated) return toast('Please sign in first.');
  const item = readForm(); item.status = status;
  if (!item.title) { toast('Please enter a title first.'); $('contentTitle').focus(); return; }
  try {
    const result = await api(item.id ? `/api/content/${encodeURIComponent(item.id)}` : '/api/content', {
      method:item.id ? 'PUT' : 'POST', body:JSON.stringify(item)
    });
    const saved = normalize(result.item);
    const idx = items.findIndex(x => x.id === saved.id); if (idx >= 0) items[idx] = saved; else items.unshift(saved);
    await loadAdminItems(); await loadPublicContent();
    toast(status === 'published' ? 'Content published online.' : 'Draft saved to Cloudflare D1.');
    editingId = saved.id;
  } catch (err) { toast(err.message); }
}
$('saveDraft')?.addEventListener('click', () => saveItem('draft'));
$('publishContent')?.addEventListener('click', () => saveItem('published'));
$('previewContent')?.addEventListener('click', () => {
  const x = readForm(); if (!x.title) return toast('Please enter a title first.');
  const box = $('contentPreview'); box.hidden=false;
  box.innerHTML = `<h2>${safe(x.title)}</h2><p class="muted">${safe(x.study_level)} · ${safe(x.course)} ${x.board_exam ? ' · '+safe(x.board_exam):''} ${x.topic ? ' · '+safe(x.topic):''}</p><div class="article-body">${x.body_html}</div>`;
  if (window.renderMathInElement) window.renderMathInElement(box, {delimiters:[{left:'$$',right:'$$',display:true},{left:'\\[',right:'\\]',display:true},{left:'\\(',right:'\\)',display:false}], throwOnError:false});
  box.scrollIntoView({behavior:'smooth',block:'nearest'});
});
$('exportContent')?.addEventListener('click', () => {
  const x=readForm(); if(!x.title)return toast('Please enter a title first.');
  const doc='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="'+safe(x.seo_description)+'"><title>'+safe(x.title)+'</title><style>body{font:16px/1.8 system-ui;max-width:850px;margin:40px auto;padding:0 18px;color:#14264c}h1,h2{color:#155fe8}img{max-width:100%}</style></head><body><h1>'+safe(x.title)+'</h1><p>'+safe(x.study_level)+' · '+safe(x.course)+' · '+safe(x.board_exam)+' · '+safe(x.topic)+'</p>'+x.body_html+'</body></html>';
  const url=URL.createObjectURL(new Blob([doc],{type:'text/html'})); const a=document.createElement('a'); a.href=url; a.download=(x.title.toLowerCase().replace(/[^a-z0-9]+/g,'-')||'maths-content')+'.html'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); toast('HTML exported.');
});
async function loadAdminItems() {
  if (!authenticated) return;
  try { const d=await api('/api/content', {method:'GET',headers:{}}); items=(d.items||[]).map(normalize); renderAdminItems(); }
  catch(err) { toast(`Could not load admin content: ${err.message}`); }
}
function renderAdminItems() {
  $('publishedCount').textContent=items.filter(x=>x.status==='published').length;
  $('draftCount').textContent=items.filter(x=>x.status==='draft').length;
  const list=$('manageList');
  if(!items.length){list.innerHTML='<p class="muted">No content yet. Create a draft to begin.</p>';return;}
  list.innerHTML=items.map(x=>`<article><strong>${safe(x.title)}</strong><p class="muted">${safe(x.type)} · ${safe(x.level)} · ${safe(x.course)}${x.board?' · '+safe(x.board):''} · <b>${safe(x.status)}</b></p><button class="btn-secondary" data-edit-id="${safe(x.id)}">Edit</button><button class="btn-secondary" data-toggle-id="${safe(x.id)}">${x.status==='published'?'Unpublish':'Publish'}</button><button class="btn-secondary" data-delete-id="${safe(x.id)}">Delete</button></article>`).join('');
  list.querySelectorAll('[data-edit-id]').forEach(btn=>btn.addEventListener('click',()=>{
    const x=items.find(i=>i.id===btn.dataset.editId);if(!x)return;editingId=x.id;
    $('contentTitle').value=x.title;$('contentType').value=x.type;$('contentPaperType').value=x.paperType||'';$('contentLevel').value=x.level;$('contentCourse').value=x.course;$('contentBoard').value=x.board;$('contentTopic').value=x.topic;$('contentSEO').value=x.seo;$('adminEditor').innerHTML=x.body;$('publishContent').textContent=x.status==='published'?'Update published content':'Publish online';adminTab('create');$('contentTitle').focus();
  }));
  list.querySelectorAll('[data-toggle-id]').forEach(btn=>btn.addEventListener('click',async()=>{
    const x=items.find(i=>i.id===btn.dataset.toggleId);if(!x)return;
    try{await api(`/api/content/${encodeURIComponent(x.id)}`,{method:'PUT',body:JSON.stringify({...x,content_type:x.type,paper_type:x.paperType||'',study_level:x.level,board_exam:x.board,seo_description:x.seo,body_html:x.body,status:x.status==='published'?'draft':'published'})});await loadAdminItems();await loadPublicContent();toast('Content status updated.');}catch(e){toast(e.message);}
  }));
  list.querySelectorAll('[data-delete-id]').forEach(btn=>btn.addEventListener('click',async()=>{
    const x=items.find(i=>i.id===btn.dataset.deleteId);if(!x||!confirm(`Delete “${x.title}” permanently?`))return;
    try{await api(`/api/content/${encodeURIComponent(x.id)}`,{method:'DELETE'});items=items.filter(i=>i.id!==x.id);renderAdminItems();await loadPublicContent();toast('Content deleted from D1.');}catch(e){toast(e.message);}
  }));
}

// Public D1 catalogue and filters.
function autoExcerpt(x) {
  const raw=String(x.excerpt||x.seo_description||x.seo||'').trim();
  if(raw)return raw.slice(0,360);
  const plain=String(x.body_html||x.body||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  return (plain||'Open to read the full content.').slice(0,220);
}
function card(x) {
  const type=x.content_type||x.type||'Study Notes';
  const subject=x.subject||'Mathematics', chapter=x.chapter||x.topic||'';
  const image=x.thumbnail_url||x.thumbnail||'';
  const thumb=image?'<img class="content-thumb" src="'+safe(image)+'" alt="" loading="lazy" referrerpolicy="no-referrer">':'';
  return '<article class="content-card">'+thumb+'<span class="pill '+(type==='Question Paper'?'orange':'')+'">'+safe(type==='Question Paper'?(x.paper_type||x.paperType||'Question Paper'):type)+'</span><div class="formula">'+safe(chapter||subject)+'</div><strong>'+safe(x.title)+'</strong><p class="muted">'+safe(x.study_level||x.level)+' · '+safe(x.course)+(x.board_exam||x.board?' · '+safe(x.board_exam||x.board):'')+' · '+safe(subject)+(chapter?' · '+safe(chapter):'')+'</p><p class="muted">'+safe(autoExcerpt(x))+'</p><button class="btn-secondary" data-open-content="'+safe(x.id)+'">Read full content →</button></article>';
}
function filterRender() {
  const q='', noteLevel='',noteCourse=lower('selectedCourse'),noteBoard=lower('globalBoard'),noteSubject='',noteTopic='',paperLevel='',paperCourse=lower('selectedCourse'),paperBoard=lower('globalBoard'),paperSubject='',paperTopic='',paperType='',contentType=lower('globalContentType');
  const searchMatch=x=>!q||[x.title,x.study_level,x.level,x.course,x.board_exam,x.board,x.topic,x.subject,x.chapter,x.excerpt,x.seo_description,x.seo].join(' ').toLowerCase().includes(q);
  const notes=contentCache.filter(x=>{const type=(x.content_type||x.type||'Study Notes').toLowerCase();return type!=='question paper'&&(!contentType||type===contentType)&&(!noteLevel||(x.study_level||x.level).toLowerCase()===noteLevel)&&(!noteCourse||x.course.toLowerCase()===noteCourse)&&(!noteBoard||(x.board_exam||x.board||'').toLowerCase()===noteBoard)&&(!noteSubject||(x.subject||'mathematics').toLowerCase().includes(noteSubject))&&(!noteTopic||(x.chapter||x.topic||'').toLowerCase().includes(noteTopic))&&searchMatch(x)});
  const papers=contentCache.filter(x=>(x.content_type||x.type)==='Question Paper'&&(!paperLevel||(x.study_level||x.level).toLowerCase()===paperLevel)&&(!paperCourse||x.course.toLowerCase()===paperCourse)&&(!paperBoard||(x.board_exam||x.board||'').toLowerCase()===paperBoard)&&(!paperSubject||(x.subject||'mathematics').toLowerCase().includes(paperSubject))&&(!paperTopic||(x.chapter||x.topic||'').toLowerCase().includes(paperTopic))&&(!paperType||(x.paper_type||x.paperType||'').toLowerCase()===paperType)&&searchMatch(x));
  $('notesList').innerHTML=notes.length?notes.map(card).join(''):'<p class="muted">No published notes match these filters yet.</p>';
  $('papersList').innerHTML=papers.length?papers.map(card).join(''):'<p class="muted">No published question papers match these filters yet.</p>';
  // Render LaTeX in catalogue cards as well as in the full reader.
  if (window.renderMathInElement) {
    const mathOptions = {delimiters:[{left:'$$',right:'$$',display:true},{left:'\\[',right:'\\]',display:true},{left:'\\(',right:'\\)',display:false}], throwOnError:false};
    window.renderMathInElement($('notesList'), mathOptions);
    window.renderMathInElement($('papersList'), mathOptions);
  }
  document.querySelectorAll('[data-open-content]').forEach(btn=>btn.addEventListener('click',()=>openContent(btn.dataset.openContent)));
}
async function loadPublicContent() {
  try { const d=await api('/api/content?public=1', {method:'GET',headers:{}}); contentCache=d.items||[]; filterRender(); }
  catch(err) { $('notesList').innerHTML='<p class="muted">Live catalogue is not connected yet. Deploy the Cloudflare Pages Functions and configure D1 to enable it.</p>'; $('papersList').innerHTML='<p class="muted">Live catalogue is not connected yet. Deploy the Cloudflare Pages Functions and configure D1 to enable it.</p>'; }
}
async function openContent(id) {
  const x=contentCache.find(item=>item.id===id); if(!x)return;
  $('modalType').textContent=x.content_type||x.type;$('modalTitle').textContent=x.title;
  $('modalMeta').textContent=[x.study_level||x.level,x.course,x.board_exam||x.board,x.subject||'Mathematics',x.chapter||x.topic].filter(Boolean).join(' · ');
  $('modalBody').innerHTML=x.body_html||'<p>No article body has been added yet.</p>';
  if (window.renderMathInElement) window.renderMathInElement($('modalBody'), {delimiters:[{left:'$$',right:'$$',display:true},{left:'\\[',right:'\\]',display:true},{left:'\\(',right:'\\)',display:false}], throwOnError:false});
  $('contentModal').hidden=false;document.body.style.overflow='hidden';
}
function closeModal(){ $('contentModal').hidden=true;document.body.style.overflow=''; }
$('modalClose')?.addEventListener('click',closeModal);
$('readerFullscreen')?.addEventListener('click',async()=>{const target=$('contentModalCard');try{if(!document.fullscreenElement)await target.requestFullscreen();else await document.exitFullscreen();}catch{toast('Fullscreen is not supported in this browser.');}});
document.addEventListener('fullscreenchange',()=>{const b=$('readerFullscreen');if(b)b.textContent=document.fullscreenElement?'⤢ Exit fullscreen':'⛶ Fullscreen reading';});
$('contentModal')?.addEventListener('click',e=>{if(e.target===$('contentModal'))closeModal();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
['globalBoard','globalContentType'].forEach(id=>$(id)?.addEventListener('change',filterRender));
$('searchButton')?.addEventListener('click',()=>{filterRender();const q=value('searchInput')||value('noteTopic');$('searchMessage').textContent=q?`Showing published content matching “${q}”.`:'Showing all published content.';});
$('searchInput')?.addEventListener('keydown',e=>{if(e.key==='Enter'){$('searchButton').click();$('content-browser').scrollIntoView({behavior:'smooth'});}});

// Safe scientific calculator: tokenizer + recursive-descent parser (no eval).
function calculate(expression, variables = {}) {
  let src=String(expression).replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-').replace(/\s+/g,'');
  const tokens=src.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|(?:pi|sqrt|sin|cos|tan|log|ln|abs|exp|pow|x)|[(),+\-*/^]/ig);
  if(!tokens||tokens.join('')!==src)throw new Error('Expression has unsupported characters.');
  let i=0;const peek=()=>tokens[i];const take=()=>tokens[i++];
  function primary(){const t=take();if(t===undefined)throw new Error('Incomplete expression.');if(t==='+'||t==='-'){const v=primary();return t==='-'?-v:v;}if(t==='('){const v=add();if(take()!==')')throw new Error('Missing closing parenthesis.');return v;}if(/^\d/.test(t)||t[0]==='.')return Number(t);const name=t.toLowerCase();if(name==='pi')return Math.PI;if(name==='x')return Number(variables.x ?? 0);
    if(['sqrt','sin','cos','tan','log','ln','abs','exp','pow'].includes(name)){if(take()!=='(')throw new Error(`Expected ( after ${name}.`);const a=add();let b;if(name==='pow'){if(take()!==',')throw new Error('pow requires two arguments, e.g. pow(2,3).');b=add();}if(take()!==')')throw new Error('Missing closing parenthesis.');const funcs={sqrt:()=>Math.sqrt(a),sin:()=>Math.sin(a),cos:()=>Math.cos(a),tan:()=>Math.tan(a),log:()=>Math.log10(a),ln:()=>Math.log(a),abs:()=>Math.abs(a),exp:()=>Math.exp(a),pow:()=>Math.pow(a,b)};return funcs[name]();}throw new Error(`Unknown value: ${t}`);}
  function power(){let a=primary();if(peek()==='^'){take();a=Math.pow(a,power());}return a;}
  function mul(){let a=power();while(peek()==='*'||peek()==='/'){const op=take(),b=power();a=op==='*'?a*b:a/b;}return a;}
  function add(){let a=mul();while(peek()==='+'||peek()==='-'){const op=take(),b=mul();a=op==='+'?a+b:a-b;}return a;}
  const result=add();if(i<tokens.length)throw new Error(`Unexpected token: ${tokens[i]}`);if(!Number.isFinite(result))throw new Error('Result is not a finite real number.');return result;
}
$('calcRun')?.addEventListener('click',()=>{try{const n=calculate(value('calcInput'));$('calcResult').textContent=`Result: ${Number(n.toPrecision(12)).toString()}`;}catch(e){$('calcResult').textContent=e.message;}});
$('calcInput')?.addEventListener('keydown',e=>{if(e.key==='Enter')$('calcRun').click();});
$('calcClear')?.addEventListener('click',()=>{$('calcInput').value='';$('calcResult').textContent='Result appears here.';$('calcInput').focus();});
document.querySelectorAll('[data-calc]').forEach(btn=>btn.addEventListener('click',()=>{$('calcInput').value+=btn.dataset.calc;$('calcInput').focus();}));

// Start up. The frontend remains usable as a static preview, but live content needs Pages Functions + D1.
if ($('adminLoginPanel')) setAdminUI(false);
loadPublicContent();
if ($('adminLoginPanel')) checkSession();


// Additional interactive mathematics tools.
function openTool(name) {
  const titles={calculator:'Scientific Calculator',graph:'Graph Plotter',equation:'Equation Solver',calculus:'Derivative & Integral',matrix:'2×2 Matrix Calculator',statistics:'Statistics',units:'Unit Converter',trig:'Trigonometry'};
  $('toolWorkspace').hidden=false;
  document.querySelectorAll('.tool-pane').forEach(p=>p.hidden=true);
  const pane=$('tool-'+name); if(pane)pane.hidden=false;
  $('toolWorkspaceTitle').textContent=titles[name]||'Maths Tool';
  $('toolWorkspace').scrollIntoView({behavior:'smooth',block:'nearest'});
}
document.querySelectorAll('[data-tool-open]').forEach(b=>b.addEventListener('click',()=>openTool(b.dataset.toolOpen)));
$('toolWorkspaceClose')?.addEventListener('click',()=>{$('toolWorkspace').hidden=true;});
$('eqSolve')?.addEventListener('click',()=>{
  const a=Number(value('eqA')),b=Number(value('eqB')),c=Number(value('eqC'));
  if(![a,b,c].every(Number.isFinite)){ $('eqResult').textContent='Enter valid numeric coefficients.';return; }
  if(Math.abs(a)<1e-14){if(Math.abs(b)<1e-14){$('eqResult').textContent=Math.abs(c)<1e-14?'Every real number is a solution.':'No solution.';return;}$('eqResult').textContent=`Linear solution: x = ${(-c/b).toPrecision(10)}`;return;}
  const d=b*b-4*a*c;if(d<0){$('eqResult').textContent=`Complex roots: x = ${(-b/(2*a)).toPrecision(8)} ± ${(Math.sqrt(-d)/(2*a)).toPrecision(8)}i`;return;}
  const root=Math.sqrt(d);const x1=(-b+root)/(2*a),x2=(-b-root)/(2*a);$('eqResult').textContent=`Discriminant Δ = ${d}. Roots: x₁ = ${Number(x1.toPrecision(10))}, x₂ = ${Number(x2.toPrecision(10))}`;
});
function drawGraph(){
  const canvas=$('graphCanvas'),ctx=canvas.getContext('2d');if(!ctx)return;
  const xmin=Number(value('graphMin')),xmax=Number(value('graphMax')),expr=value('graphExpr');
  if(!expr||!Number.isFinite(xmin)||!Number.isFinite(xmax)||xmin>=xmax){$('graphResult').textContent='Enter a function and ensure minimum is below maximum.';return;}
  const W=canvas.width,H=canvas.height;ctx.clearRect(0,0,W,H);ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);
  const samples=[];let ymin=Infinity,ymax=-Infinity;
  for(let i=0;i<=W;i++){const x=xmin+(xmax-xmin)*i/W;let y=NaN;try{y=calculate(expr,{x});}catch{}if(Number.isFinite(y)&&Math.abs(y)<1e7){samples.push({x,y,i});ymin=Math.min(ymin,y);ymax=Math.max(ymax,y);}else samples.push({x,y:NaN,i});}
  if(!Number.isFinite(ymin)){ $('graphResult').textContent='Could not evaluate this function over the selected range.';return; }
  if(ymax-ymin<1e-8){ymin-=1;ymax+=1;}else{const pad=(ymax-ymin)*.08;ymin-=pad;ymax+=pad;}
  const px=x=>((x-xmin)/(xmax-xmin))*W,py=y=>H-((y-ymin)/(ymax-ymin))*H;
  ctx.strokeStyle='#e4e9f2';ctx.lineWidth=1;for(let i=0;i<=10;i++){const xx=i*W/10,yy=i*H/10;ctx.beginPath();ctx.moveTo(xx,0);ctx.lineTo(xx,H);ctx.stroke();ctx.beginPath();ctx.moveTo(0,yy);ctx.lineTo(W,yy);ctx.stroke();}
  ctx.strokeStyle='#8b97aa';ctx.lineWidth=1.5;if(ymin<=0&&ymax>=0){ctx.beginPath();ctx.moveTo(0,py(0));ctx.lineTo(W,py(0));ctx.stroke();}if(xmin<=0&&xmax>=0){ctx.beginPath();ctx.moveTo(px(0),0);ctx.lineTo(px(0),H);ctx.stroke();}
  ctx.strokeStyle='#2f70e8';ctx.lineWidth=2.5;ctx.beginPath();let started=false,prevY=null;for(const p of samples){if(!Number.isFinite(p.y)||Math.abs(p.y-(prevY??p.y))>(ymax-ymin)*.5){started=false;prevY=p.y;continue;}const xx=px(p.x),yy=py(p.y);if(!started){ctx.moveTo(xx,yy);started=true;}else ctx.lineTo(xx,yy);prevY=p.y;}ctx.stroke();
  $('graphResult').textContent=`Plotted y = ${expr}; x ∈ [${xmin}, ${xmax}], visible y-range ≈ [${ymin.toPrecision(4)}, ${ymax.toPrecision(4)}].`;
}
$('graphRun')?.addEventListener('click',drawGraph);
$('derivRun')?.addEventListener('click',()=>{try{const expr=value('calculusExpr'),x=Number(value('derivX')),h=Math.max(1e-5,Math.abs(x)*1e-5);const d=(calculate(expr,{x:x+h})-calculate(expr,{x:x-h}))/(2*h);$('calculusResult').textContent=`Numerical derivative estimate: f′(${x}) ≈ ${Number(d.toPrecision(10))}`;}catch(e){$('calculusResult').textContent=e.message;}});
$('integralRun')?.addEventListener('click',()=>{try{const expr=value('calculusExpr'),a=Number(value('integralA')),b=Number(value('integralB'));if(!Number.isFinite(a)||!Number.isFinite(b))throw new Error('Enter valid integration bounds.');const n=1000,h=(b-a)/n;let sum=calculate(expr,{x:a})+calculate(expr,{x:b});for(let i=1;i<n;i++)sum+=(i%2?4:2)*calculate(expr,{x:a+i*h});$('calculusResult').textContent=`Simpson-rule estimate: ∫[${a},${b}] f(x) dx ≈ ${Number((sum*h/3).toPrecision(10))} (1000 subintervals)`;}catch(e){$('calculusResult').textContent=e.message;}});
$('matrixRun')?.addEventListener('click',()=>{const ids=['m11','m12','m21','m22','n11','n12','n21','n22'],v=ids.map(id=>Number(value(id)));if(!v.every(Number.isFinite)){$('matrixResult').textContent='Enter all matrix values.';return;}const [a,b,c,d,e,f,g,h]=v;const det=a*d-b*c;const m=[a*e+b*g,a*f+b*h,c*e+d*g,c*f+d*h];$('matrixResult').textContent=`det(A) = ${det}. A × B = [[${m[0]}, ${m[1]}], [${m[2]}, ${m[3]}]].`;});
$('statsRun')?.addEventListener('click',()=>{const nums=value('statsInput').split(',').map(s=>Number(s.trim()));if(!nums.length||!nums.every(Number.isFinite)){$('statsResult').textContent='Enter comma-separated valid numbers.';return;}const sorted=[...nums].sort((a,b)=>a-b),n=nums.length,mean=nums.reduce((s,x)=>s+x,0)/n,median=n%2?sorted[(n-1)/2]:(sorted[n/2-1]+sorted[n/2])/2,variance=nums.reduce((s,x)=>s+(x-mean)**2,0)/n;const modeMap=new Map();nums.forEach(x=>modeMap.set(x,(modeMap.get(x)||0)+1));const maxFreq=Math.max(...modeMap.values()),modes=[...modeMap].filter(([,freq])=>freq===maxFreq).map(([x])=>x);$('statsResult').textContent=`n = ${n}; mean = ${mean}; median = ${median}; min = ${sorted[0]}; max = ${sorted[n-1]}; population SD = ${Math.sqrt(variance)}; mode(s) = ${maxFreq===1?'no repeated mode':modes.join(', ')}.`;});
$('unitRun')?.addEventListener('click',()=>{const n=Number(value('unitValue')),from=value('unitFrom'),to=value('unitTo');if(!Number.isFinite(n)){$('unitResult').textContent='Enter a valid number.';return;}const length={m:1,km:1000,cm:.01,mm:.001,mile:1609.344},mass={kg:1,g:.001,lb:.45359237};let out;if(from in length&&to in length)out=n*length[from]/length[to];else if(from in mass&&to in mass)out=n*mass[from]/mass[to];else if(['C','F','K'].includes(from)&&['C','F','K'].includes(to)){let c=from==='C'?n:from==='F'?(n-32)*5/9:n-273.15;out=to==='C'?c:to==='F'?c*9/5+32:c+273.15;}else{$('unitResult').textContent='Choose units from the same group: length, mass, or temperature.';return;}$('unitResult').textContent=`${n} ${from} = ${Number(out.toPrecision(12))} ${to}`;});
$('trigRun')?.addEventListener('click',()=>{const x=Number(value('trigAngle'));$('trigResult').textContent=`sin = ${Math.sin(x)}; cos = ${Math.cos(x)}; tan = ${Math.tan(x)}; angle is in radians.`;});


// Branded PDF export: renders the student-facing article and stamps every PDF page.
$('downloadPdf')?.addEventListener('click', async () => {
  const article = $('modalBody');
  const title = $('modalTitle')?.textContent?.trim() || 'MathsLearn Notes';
  if (!article || !article.textContent.trim()) return toast('There is no content to export.');
  if (!window.html2canvas || !window.jspdf?.jsPDF) return toast('PDF libraries did not load. Check your internet connection and try again.');
  const button = $('downloadPdf'); const original = button.textContent;
  button.disabled = true; button.textContent = 'Preparing PDF…';
  try {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:fixed;left:-10000px;top:0;width:760px;padding:38px 44px;background:#fff;color:#14264c;font:16px/1.7 Arial,sans-serif;z-index:-1;';
    wrapper.innerHTML = `<div style="border-bottom:2px solid #1765f5;padding-bottom:14px;margin-bottom:22px"><div style="font-size:13px;letter-spacing:2px;color:#1765f5;font-weight:bold">MATHSLEARN · EXPLORE · PRACTISE · MASTER</div><h1 style="font-size:27px;line-height:1.25;margin:14px 0">${safe(title)}</h1><div style="font-size:11px;color:#64748b">Study resource from mathslearn.online</div></div>`;
    const body = article.cloneNode(true);
    body.querySelectorAll('button,script,iframe').forEach(el=>el.remove());
    wrapper.appendChild(body);
    wrapper.insertAdjacentHTML('beforeend','<div style="border-top:1px solid #dbe5f5;margin-top:28px;padding-top:12px;font-size:11px;color:#64748b">For learning purposes · mathslearn.online</div>');
    document.body.appendChild(wrapper);
    if(window.renderMathInElement) window.renderMathInElement(wrapper,{delimiters:[{left:'$$',right:'$$',display:true},{left:'\\[',right:'\\]',display:true},{left:'\\(',right:'\\)',display:false}],throwOnError:false});
    const canvas = await window.html2canvas(wrapper,{scale:1.7,backgroundColor:'#ffffff',useCORS:true,logging:false});
    document.body.removeChild(wrapper);
    const {jsPDF}=window.jspdf; const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
    const pageW=210,pageH=297,margin=10,usableW=pageW-margin*2,usableH=pageH-margin*2;
    const pxPerMm=canvas.width/usableW, pageSlicePx=Math.floor(usableH*pxPerMm);
    let y=0,page=0;
    while(y<canvas.height){
      if(page>0) pdf.addPage();
      const sliceH=Math.min(pageSlicePx,canvas.height-y);
      const pageCanvas=document.createElement('canvas');pageCanvas.width=canvas.width;pageCanvas.height=sliceH;
      pageCanvas.getContext('2d').drawImage(canvas,0,y,canvas.width,sliceH,0,0,canvas.width,sliceH);
      const img=pageCanvas.toDataURL('image/jpeg',0.92);
      const renderedH=sliceH/pxPerMm;
      pdf.addImage(img,'JPEG',margin,margin,usableW,renderedH,undefined,'FAST');
      pdf.setTextColor(218,224,235);
      for(let yy=45;yy<pageH;yy+=70){pdf.text('mathslearn.online',105,yy,{angle:35,align:'center'});}
      pdf.setFontSize(8);pdf.setTextColor(90,105,130);pdf.text(`mathslearn.online  •  Page ${page+1}`,pageW/2,pageH-5,{align:'center'});
      y+=sliceH;page++;
    }
    pdf.save((title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'mathslearn-notes')+'.pdf');
    toast('Watermarked PDF downloaded.');
  } catch(err) { console.error(err); toast('PDF could not be created. Try again or check the article content.'); }
  finally { button.disabled=false;button.textContent=original; }
});

// Class-first homepage navigation: keep the catalogue filtered by the selected class and show one workspace at a time.
function setupClassFirstHome(){
 const courseState=document.createElement('input');courseState.type='hidden';courseState.id='selectedCourse';document.body.appendChild(courseState);
 const cards=[...document.querySelectorAll('.class-card')];
 const tabs=[...document.querySelectorAll('.content-tab')];
 const panels={notes:$('notes'),papers:$('papers'),'student-editor':$('student-editor')};
 function chooseCourse(course){
  cards.forEach(card=>card.classList.toggle('active',card.dataset.course===course));
  $('selectedCourse').value=course;
  filterRender();
 }
 function choosePanel(name){
  tabs.forEach(tab=>tab.classList.toggle('active',tab.dataset.panel===name));
  Object.entries(panels).forEach(([key,panel])=>{if(panel)panel.hidden=key!==name;});
 }
 cards.forEach(card=>card.addEventListener('click',()=>chooseCourse(card.dataset.course||'')));
 tabs.forEach(tab=>tab.addEventListener('click',()=>choosePanel(tab.dataset.panel)));
 $('globalBoard')?.addEventListener('change',filterRender);
 chooseCourse('');choosePanel('notes');
}
document.addEventListener('DOMContentLoaded',setupClassFirstHome);
