/* Injected workspace controls for MathsLearn Lecture Studio. */
(function(){
  'use strict';
  const editor=document.getElementById('editor');
  if(!editor)return;
  function addControls(){
    const top=editor.querySelector('.top');
    if(!top||top.querySelector('[data-ws-fullscreen]'))return;
    const btn=document.createElement('button');
    btn.type='button';btn.className='btn ws-fullscreen-btn';btn.dataset.wsFullscreen='1';
    btn.textContent=editor.classList.contains('workspace-fullscreen')?'Exit full screen':'Full screen';
    btn.title='Use the full browser window for editing (Esc to exit)';
    const preview=document.createElement('button');
    preview.type='button';preview.className='btn ws-preview-toggle';preview.textContent='Show preview';
    preview.addEventListener('click',()=>{
      editor.classList.toggle('ws-preview-hidden');
      preview.textContent=editor.classList.contains('ws-preview-hidden')?'Show preview':'Hide preview';
    });
    btn.addEventListener('click',async()=>{
      if(!editor.classList.contains('workspace-fullscreen')){
        editor.classList.add('workspace-fullscreen');
        btn.textContent='Exit full screen';
        try{if(!document.fullscreenElement&&editor.requestFullscreen)await editor.requestFullscreen();}catch(_){}
      }else{
        editor.classList.remove('workspace-fullscreen');
        btn.textContent='Full screen';
        try{if(document.fullscreenElement)await document.exitFullscreen();}catch(_){}
      }
    });
    top.append(btn,preview);
  }
  const observer=new MutationObserver(addControls);
  observer.observe(editor,{childList:true,subtree:true});
  addControls();
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&editor.classList.contains('workspace-fullscreen')){
      editor.classList.remove('workspace-fullscreen');
      const b=editor.querySelector('[data-ws-fullscreen]');if(b)b.textContent='Full screen';
    }
  });
  document.addEventListener('fullscreenchange',()=>{
    if(!document.fullscreenElement&&editor.classList.contains('workspace-fullscreen')){
      editor.classList.remove('workspace-fullscreen');
      const b=editor.querySelector('[data-ws-fullscreen]');if(b)b.textContent='Full screen';
    }
  });
})();
