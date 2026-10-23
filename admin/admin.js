const $=id=>document.getElementById(id);
let isAuthed=false, currentId=null, records=[];
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(msg){const t=$('toast');if(!t)return;t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2800);}
async function api(path,opts={}){const r=await fetch(path,{credentials:'same-origin',...opts,headers:{'Content-Type':'application/json',...(opts.headers||{})}});let d={};try{d=await r.json()}catch{}if(!r.ok)throw Error(d.error||`Request failed (${r.status})`);return d;}
function renderMath(el){if(window.renderMathInElement)window.renderMathInElement(el,{delimiters:[{left:'$$',right:'$$',display:true},{left:'\\[',right:'\\]',display:true},{left:'\\(',right:'\\)',display:false}],throwOnError:false});}
function setSession(on,email=''){isAuthed=on;$('loginCard').hidden=on;$('workspace').hidden=!on;$('sessionActions').hidden=!on;$('whoami').textContent=email?`Signed in: ${email}`:'';}
async function check(){try{const d=await api('/api/auth/me',{method:'GET'});setSession(!!d.authenticated,d.email||'');if(d.authenticated){await loadRecords();restoreUiState();}}catch{setSession(false)}}
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();$('loginMessage').textContent='Signing in…';try{const d=await api('/api/auth/login',{method:'POST',body:JSON.stringify({email:$('email').value.trim(),password:$('password').value})});$('password').value='';$('loginMessage').textContent='';setSession(true,d.email||$('email').value.trim());await loadRecords();restoreUiState();toast('Login successful.')}catch(err){$('loginMessage').textContent=err.message;}});
$('logoutBtn').addEventListener('click',async()=>{try{await api('/api/auth/logout',{method:'POST',body:'{}'})}catch{}setSession(false);records=[];toast('Signed out.');});
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.admin-pane').forEach(x=>x.hidden=true);$('pane-'+b.dataset.tab).hidden=false;if(b.dataset.tab==='manage')loadRecords()}));
document.querySelectorAll('[data-cmd]').forEach(b=>b.addEventListener('click',()=>{ $('editor').focus();document.execCommand(b.dataset.cmd,false,b.dataset.val||null);}));

// Insert a real HTML table without changing the existing formatting or math tools.
$('insertTableBtn')?.addEventListener('click',()=>{
  const rowsInput=window.prompt('How many rows? (1–12)','3');
  if(rowsInput===null)return;
  const colsInput=window.prompt('How many columns? (1–8)','2');
  if(colsInput===null)return;
  const rows=Math.max(1,Math.min(12,parseInt(rowsInput,10)||1));
  const cols=Math.max(1,Math.min(8,parseInt(colsInput,10)||1));
  let table='<table><tbody>';
  for(let r=0;r<rows;r++){
    table+='<tr>';
    for(let c=0;c<cols;c++){
      const tag=r===0?'th':'td';
      table+='<'+tag+'><br></'+tag+'>';
    }
    table+='</tr>';
  }
  table+='</tbody></table><p><br></p>';
  $('editor').focus();
  document.execCommand('insertHTML',false,table);
  refreshLivePreview();
});
$('textColor')?.addEventListener('input',e=>{ $('editor').focus();document.execCommand('styleWithCSS',false,true);document.execCommand('foreColor',false,e.target.value);});
$('highlightColor')?.addEventListener('input',e=>{ $('editor').focus();document.execCommand('styleWithCSS',false,true);document.execCommand('hiliteColor',false,e.target.value);});
$('textSize')?.addEventListener('change',e=>{ $('editor').focus();document.execCommand('fontSize',false,e.target.value);});
document.querySelectorAll('[data-insert]').forEach(b=>b.addEventListener('click',()=>{ $('editor').focus();document.execCommand('insertText',false,b.dataset.insert);}));
function formData(status){return {id:currentId,title:$('title').value.trim(),content_type:$('type').value,paper_type:$('paperType').value,study_level:$('level').value,course:$('course').value,board_exam:$('board').value,topic:$('topic').value.trim(),subject:$('subject').value.trim(),chapter:$('chapter').value.trim(),excerpt:$('excerpt').value.trim(),thumbnail_url:$('thumbnail').value.trim(),seo_description:$('description').value.trim(),body_html:$('editor').innerHTML,status};}
function resetForm(){currentId=null;['title','topic','subject','chapter','excerpt','thumbnail','description'].forEach(id=>$(id).value='');$('type').selectedIndex=0;$('level').selectedIndex=0;$('course').selectedIndex=0;$('board').selectedIndex=0;$('paperType').selectedIndex=0;$('editor').innerHTML='';$('preview').hidden=true;$('livePreview').innerHTML='';$('metadataPanel').hidden=false;$('writingStudio').hidden=true;$('previewMeta').textContent='';$('formHeading').textContent='Create content';$('publishBtn').textContent='Publish to students';$('writeMessage').textContent='';$('contentWorkflow').hidden=true;$('categoryPicker').hidden=false;$('selectedKind').textContent='';}
let autoSaveTimer=null,autoSaveBusy=false,autoSaveQueued=false;
function setAutoSaveStatus(message){const el=$('autoSaveStatus');if(el)el.textContent=message;}
async function save(status,quiet=false){
  if(!isAuthed)return;
  const item=formData(status);
  if(!item.title){if(!quiet)$('writeMessage').textContent='Please add a title.';setAutoSaveStatus('Add a title to enable auto-save.');return;}
  try{
    const d=await api(item.id?`/api/content/${encodeURIComponent(item.id)}`:'/api/content',{method:item.id?'PUT':'POST',body:JSON.stringify(item)});
    currentId=d.item.id;
    await loadRecords();
    if(status==='published'){
      $('writeMessage').textContent='Published. Students can now see this content.';
      setAutoSaveStatus('Published successfully');
      toast($('writeMessage').textContent);
    }else{
      if(!quiet){$('writeMessage').textContent='Draft saved privately.';toast($('writeMessage').textContent);}
      setAutoSaveStatus('Draft saved automatically · '+new Date().toLocaleTimeString());
    }
  }catch(err){
    setAutoSaveStatus('Auto-save failed — '+err.message);
    if(!quiet)$('writeMessage').textContent=err.message;
  }
}
function scheduleAutoSave(){
  if(!isAuthed)return;
  clearTimeout(autoSaveTimer);
  setAutoSaveStatus('Unsaved changes…');
  autoSaveTimer=setTimeout(async()=>{
    if(autoSaveBusy){autoSaveQueued=true;return;}
    // Never silently change an already-published item into a draft or publish edits automatically.
    const existing=records.find(x=>x.id===currentId);
    if(existing&&existing.status==='published'){
      setAutoSaveStatus('Published item: use “Update published content” to save changes.');
      return;
    }
    autoSaveBusy=true;
    await save('draft',true);
    autoSaveBusy=false;
    if(autoSaveQueued){autoSaveQueued=false;scheduleAutoSave();}
  },1800);
}
$('saveDraft').addEventListener('click',()=>save('draft'));$('publishBtn').addEventListener('click',()=>save('published'));$('clearBtn').addEventListener('click',()=>{clearTimeout(autoSaveTimer);resetForm();setAutoSaveStatus('');});
function refreshLivePreview(){if(!$('livePreview'))return;const f=formData('draft');$('previewMeta').textContent=[f.study_level,f.course,f.board_exam,f.subject,f.topic,f.chapter].filter(Boolean).join(' · ');$('livePreview').innerHTML=(f.title?`<h2>${safe(f.title)}</h2>`:'')+(f.body_html||'<p class="muted">Your formatted content preview will appear here as you type.</p>');renderMath($('livePreview'));}
$('editor').addEventListener('input',()=>{refreshLivePreview();scheduleAutoSave();});
['title','type','level','course','board','subject','topic','chapter','excerpt','thumbnail','paperType','description'].forEach(id=>$(id)?.addEventListener('input',()=>{refreshLivePreview();scheduleAutoSave();}));
['type','level','course','board','paperType'].forEach(id=>$(id)?.addEventListener('change',scheduleAutoSave));
function setPreviewVisible(visible){
  const studio=$('writingStudio'), panel=document.querySelector('#writingStudio .preview-column'), toggle=$('togglePreviewBtn');
  if(!studio||!panel)return;
  studio.classList.toggle('preview-visible',visible);
  // Inline display makes the toggle reliable even if cached or conflicting CSS is present.
  panel.style.display=visible?'block':'none';
  if(toggle){toggle.textContent=visible?'🙈 Hide preview':'👁️ Show preview below';toggle.setAttribute('aria-expanded',String(visible));}
  if(visible){refreshLivePreview();panel.hidden=false;}
}
$('togglePreviewBtn')?.addEventListener('click',()=>setPreviewVisible(!($('writingStudio')?.classList.contains('preview-visible'))));
$('previewBtn').addEventListener('click',()=>{setPreviewVisible(true);refreshLivePreview();requestAnimationFrame(()=>document.querySelector('#writingStudio .preview-column')?.scrollIntoView({behavior:'smooth',block:'start'}));});
async function loadRecords(){if(!isAuthed)return;try{const d=await api('/api/content',{method:'GET'});records=d.items||[];renderRecords()}catch(err){$('contentList').textContent='Could not load content: '+err.message}}
function renderRecords(){const el=$('contentList');if(!records.length){el.innerHTML='<p class="muted">No content yet. Create a draft to begin.</p>';return;}el.innerHTML=records.map(x=>`<article><strong>${safe(x.title)}</strong><p class="muted">${safe(x.content_type)}<br>${safe(x.study_level)} · ${safe(x.course)}${x.board_exam?' · '+safe(x.board_exam):''}${x.subject?' · '+safe(x.subject):''}${x.topic?' · '+safe(x.topic):''}</p><p><b>Status:</b> ${safe(x.status)}</p><div class="manage-actions"><button class="btn-secondary" data-edit="${safe(x.id)}">Edit</button><button class="btn-secondary" data-toggle="${safe(x.id)}">${x.status==='published'?'Unpublish':'Publish'}</button><button class="btn-secondary" data-delete="${safe(x.id)}">Delete</button></div></article>`).join('');
el.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>{const x=records.find(v=>v.id===b.dataset.edit);if(!x)return;currentId=x.id;$('title').value=x.title;$('type').value=x.content_type;$('paperType').value=x.paper_type||'';$('level').value=x.study_level;$('course').value=x.course;$('board').value=x.board_exam||'';$('topic').value=x.topic||'';$('subject').value=x.subject||'';$('chapter').value=x.chapter||'';$('excerpt').value=x.excerpt||'';$('thumbnail').value=x.thumbnail_url||'';$('description').value=x.seo_description||'';$('editor').innerHTML=x.body_html||'';$('categoryPicker').hidden=true;$('contentWorkflow').hidden=false;$('metadataPanel').hidden=true;$('writingStudio').hidden=false;$('selectedKind').textContent=x.content_type;$('formHeading').textContent='Edit '+x.content_type;$('publishBtn').textContent=x.status==='published'?'Update published content':'Publish to students';document.querySelector('[data-tab="write"]').click();refreshLivePreview();}));
el.querySelectorAll('[data-toggle]').forEach(b=>b.addEventListener('click',async()=>{const x=records.find(v=>v.id===b.dataset.toggle);if(!x)return;try{await api(`/api/content/${encodeURIComponent(x.id)}`,{method:'PUT',body:JSON.stringify({...x,status:x.status==='published'?'draft':'published'})});await loadRecords();toast('Publishing status updated.')}catch(e){toast(e.message)}}));
el.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',async()=>{const x=records.find(v=>v.id===b.dataset.delete);if(!x||!confirm(`Delete "${x.title}" permanently?`))return;try{await api(`/api/content/${encodeURIComponent(x.id)}`,{method:'DELETE'});await loadRecords();toast('Content deleted.')}catch(e){toast(e.message)}}));}
document.querySelectorAll('[data-kind]').forEach(b=>b.addEventListener('click',()=>{const kind=b.dataset.kind;$('type').value=kind;$('categoryPicker').hidden=true;$('contentWorkflow').hidden=false;$('metadataPanel').hidden=false;$('writingStudio').hidden=true;$('selectedKind').textContent=kind;$('formHeading').textContent='Create '+kind;window.scrollTo({top:0,behavior:'smooth'});}));
$('backToCategories')?.addEventListener('click',()=>{if($('title').value.trim()||$('editor').innerText.trim()){if(!confirm('Go back to content types? Your unsaved text stays in the form until you choose New / clear.'))return;}$('contentWorkflow').hidden=true;$('categoryPicker').hidden=false;$('metadataPanel').hidden=false;$('writingStudio').hidden=true;window.scrollTo({top:0,behavior:'smooth'});});
$('continueToStudio')?.addEventListener('click',()=>{if(!$('title').value.trim()){$('writeMessage').textContent='Please enter a content title first.';$('title').focus();return;}$('metadataPanel').hidden=true;$('writingStudio').hidden=false;refreshLivePreview();window.scrollTo({top:0,behavior:'smooth'});$('editor').focus();});
$('type')?.addEventListener('change',()=>{$('selectedKind').textContent=$('type').value;$('formHeading').textContent=(currentId?'Edit ':'Create ')+$('type').value;refreshLivePreview();});
check();


// Keep the admin workspace and in-progress editor content when the page is refreshed.
const UI_STATE_KEY='mathslearn_admin_workspace_v1';
function saveUiState(){
  if(!isAuthed)return;
  try{
    const ids=['title','type','paperType','level','course','board','subject','topic','chapter','excerpt','thumbnail','description'];
    const fields={};
    ids.forEach(id=>{if($(id))fields[id]=$(id).value;});
    const activeTab=document.querySelector('[data-tab].active')?.dataset.tab||'write';
    const state={
      fields, editorHtml:$('editor')?.innerHTML||'', currentId,
      activeTab, categoryPickerHidden:$('categoryPicker')?.hidden,
      contentWorkflowHidden:$('contentWorkflow')?.hidden,
      metadataPanelHidden:$('metadataPanel')?.hidden,
      writingStudioHidden:$('writingStudio')?.hidden,
      scrollY:window.scrollY
    };
    sessionStorage.setItem(UI_STATE_KEY,JSON.stringify(state));
  }catch(e){}
}
function restoreUiState(){
  try{
    const raw=sessionStorage.getItem(UI_STATE_KEY);
    if(!raw)return;
    const state=JSON.parse(raw);
    if(!state||!state.fields)return;
    Object.entries(state.fields).forEach(([id,value])=>{if($(id)&&value!==undefined)$(id).value=value;});
    if(typeof state.editorHtml==='string')$('editor').innerHTML=state.editorHtml;
    currentId=state.currentId||null;
    if($('categoryPicker'))$('categoryPicker').hidden=!!state.categoryPickerHidden;
    if($('contentWorkflow'))$('contentWorkflow').hidden=!!state.contentWorkflowHidden;
    if($('metadataPanel'))$('metadataPanel').hidden=!!state.metadataPanelHidden;
    if($('writingStudio'))$('writingStudio').hidden=!!state.writingStudioHidden;
    if(currentId){
      const item=records.find(x=>x.id===currentId);
      if(item){
        $('selectedKind').textContent=$('type').value;
        $('formHeading').textContent='Edit '+$('type').value;
        $('publishBtn').textContent=item.status==='published'?'Update published content':'Publish to students';
      }
    }
    const tab=state.activeTab||'write';
    document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
    document.querySelectorAll('.admin-pane').forEach(p=>p.hidden=true);
    if($('pane-'+tab))$('pane-'+tab).hidden=false;
    refreshLivePreview();
    requestAnimationFrame(()=>window.scrollTo(0,Math.max(0,Number(state.scrollY)||0)));
  }catch(e){}
}
document.addEventListener('input',saveUiState);
document.addEventListener('change',saveUiState);
document.addEventListener('click',e=>{
  if(e.target.closest('[data-tab],[data-kind],#continueToStudio,#backToCategories,#fullscreenEditor,[data-edit]')) {
    setTimeout(saveUiState,0);
  }
});
window.addEventListener('pagehide',saveUiState);
window.addEventListener('scroll',()=>{if(isAuthed)saveUiState();},{passive:true});


$('fullscreenEditor')?.addEventListener('click',()=>{const studio=$('writingStudio');const active=!studio.classList.contains('is-fullscreen');studio.classList.toggle('is-fullscreen',active);$('fullscreenEditor').textContent=active?'⤢ Exit full screen':'⛶ Full screen';$('fullscreenEditor').setAttribute('aria-pressed',String(active));document.body.style.overflow=active?'hidden':'';});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('writingStudio')?.classList.contains('is-fullscreen')){$('writingStudio').classList.remove('is-fullscreen');$('fullscreenEditor').textContent='⛶ Full screen';$('fullscreenEditor').setAttribute('aria-pressed','false');document.body.style.overflow='';}});
