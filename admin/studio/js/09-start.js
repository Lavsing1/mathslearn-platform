'use strict';
/* ====================================================================
   START: keyboard shortcuts and app start-up (always loaded last)
   ==================================================================== */
/* ---------- keyboard ---------- */
document.addEventListener('keydown',e=>{
  if(!$('#modal').classList.contains('hidden')){if(e.key==='Escape')closeModal();return}
  if(P.on){
    const k=e.key;
    if([' ','ArrowRight','Enter','PageDown'].includes(k)){e.preventDefault();pnext()}
    else if(['ArrowLeft','Backspace','PageUp'].includes(k)){e.preventDefault();pback()}
    else if(k==='ArrowDown'||k==='ArrowUp'){e.preventDefault();const s=$('#stream');if(s)s.scrollBy({top:k==='ArrowDown'?140:-140,behavior:'smooth'})}
    else if('12345'.includes(k)&&k.length===1){PN.tool=['p1','p2','p3','ink','hl'][+k-1];pUI()}else if(k==='l'||k==='L'){PN.tool='laser';pUI()}else if(k==='z'||k==='Z'){PN.strokes.pop();pdraw()}else if(k==='n'||k==='N'){togNote()}else if(k==='o'||k==='O'){acts.pout()}else if(k==='e'||k==='E'){PN.tool='era';pUI()}else if(k==='0'){PN.tool=null;pUI()}else if(k==='Delete'){PN.strokes=[];pdraw()}
    else if(k==='f'||k==='F')fs();
    else if(k==='+'||k==='=')font(2);
    else if(k==='-'||k==='_')font(-2);
    else if(k==='Escape'&&!document.fullscreenElement)pexit();
    return;
  }
  if(!L||$('#editor').classList.contains('hidden'))return;
  const c=e.ctrlKey||e.metaKey,k=e.key.toLowerCase();
  if(c&&['b','i','u'].includes(k)&&document.activeElement&&document.activeElement.id==='ct'){e.preventDefault();fmtApply(k==='b'?'**':k)}
  else if(e.key==='Escape'&&D.poly){D.poly=null;dgRefresh()}
  else if(e.key==='Delete'&&D.sel&&!/INPUT|TEXTAREA|SELECT/.test((document.activeElement||{}).tagName||'')){e.preventDefault();dgDelSel()}
  else if(c&&k==='z'){e.preventDefault();e.shiftKey?acts.redo():acts.undo()}
  else if(c&&k==='y'){e.preventDefault();acts.redo()}
  else if(c&&k==='s'){e.preventDefault();flush()}
  else if(c&&e.key==='Enter'){e.preventDefault();acts.add()}
  else if(e.altKey&&e.key==='ArrowUp'){e.preventDefault();acts.up()}
  else if(e.altKey&&e.key==='ArrowDown'){e.preventDefault();acts.down()}
});
addEventListener('beforeunload',()=>flush());
document.addEventListener('visibilitychange',()=>{if(document.hidden)flush()});

/* ---------- start ---------- */
if(!Object.keys(db).length){const s=sample();db[s.id]=s;LS.set(K_DB,db)}
loadCssText();
renderHome();
fsInit().catch(()=>{});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#pdfv').hidden)acts.pdfclose()});
window.__mls={get L(){return L},acts,get QZ(){return QZ},sfx:SFX};
