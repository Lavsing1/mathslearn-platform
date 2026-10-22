
'use strict';
(async function(){
  const $ml=(s)=>document.querySelector(s);
  const msg=(s)=>{const e=$ml('#mlAdminMsg');if(e)e.textContent=s;};
  try{
    const auth=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});
    const who=await auth.json().catch(()=>({}));
    if(!auth.ok||!who.authenticated){location.replace('/admin/');return;}
  }catch(e){location.replace('/admin/');return;}

  const bar=document.createElement('div');
  bar.id='mlAdminBar';
  bar.innerHTML='<span class="mlbrand">MathsLearn · Book Studio</span><a href="/admin/studio/manage-books.html" style="display:inline-block;border:1px solid #5c7195;background:#263d64;color:#fff;border-radius:8px;padding:8px 10px;text-decoration:none;font-weight:700">🗂️ Manage Books Library</a><button id="mlInsertImage">Insert image</button><button id="mlSaveBook" class="primary">Save draft to cloud</button><button id="mlPublishBook">Publish / Update</button><button id="mlHideBook">Hide / Unhide</button><button id="mlDeleteBook" class="danger">Delete cloud copy</button><button id="mlExportBook">Export backup</button><span id="mlAdminMsg">Checking admin session…</span>';
  document.body.prepend(bar);
  const dlg=$ml('#mlImageDialog');
  const currentBook=()=> (typeof BK!=='undefined'&&typeof BKC!=='undefined'&&BKC&&BK[BKC])?BK[BKC]:null;
  const currentLectures=()=>{const b=currentBook();return b?b.order.map(id=>db[id]).filter(Boolean).map(l=>JSON.parse(JSON.stringify(l))):[]};
  const key=b=>'mathslearn.book.status.'+b.id;
  const getStatus=b=>localStorage.getItem(key(b))||'draft';
  async function api(url,opts={}){
    const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...opts,headers:{'Content-Type':'application/json',...(opts.headers||{})}});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||('Request failed: '+r.status));
    return d;
  }
  async function save(status){
    const b=currentBook();
    if(!b){msg('Open a book first, then save.');return;}
    const payload={book:JSON.parse(JSON.stringify(b)),lectures:currentLectures(),status};
    msg('Saving to Cloudflare D1…');
    try{
      const oldId=localStorage.getItem('mathslearn.book.serverId.'+b.id);
      const url=oldId?'/api/books/'+encodeURIComponent(oldId):'/api/books';
      const d=await api(url,{method:oldId?'PUT':'POST',body:JSON.stringify(payload)});
      const serverId=d.book.id;
      localStorage.setItem('mathslearn.book.serverId.'+b.id,serverId);
      localStorage.setItem(key(b),d.book.status||status);
      msg((d.book.status||status)==='published'?'Published and available to students.':'Draft saved privately.');
    }catch(e){msg(e.message);}
  }
  async function setStatus(status){
    const b=currentBook();if(!b){msg('Open a book first.');return;}
    const id=localStorage.getItem('mathslearn.book.serverId.'+b.id);
    if(!id){msg('Save the book to cloud first.');return;}
    try{const d=await api('/api/books/'+encodeURIComponent(id),{method:'PUT',body:JSON.stringify({status})});localStorage.setItem(key(b),d.book.status);msg('Book status: '+d.book.status+'.');}
    catch(e){msg(e.message);}
  }
  $ml('#mlSaveBook').addEventListener('click',()=>save('draft'));
  $ml('#mlPublishBook').addEventListener('click',()=>save('published'));
  $ml('#mlHideBook').addEventListener('click',async()=>{
    const b=currentBook();if(!b){msg('Open a book first.');return;}
    const id=localStorage.getItem('mathslearn.book.serverId.'+b.id);
    if(!id){msg('Save the book to cloud first.');return;}
    const next=getStatus(b)==='hidden'?'published':'hidden';
    await setStatus(next);
  });
  $ml('#mlDeleteBook').addEventListener('click',async()=>{
    const b=currentBook();if(!b){msg('Open a book first.');return;}
    const id=localStorage.getItem('mathslearn.book.serverId.'+b.id);
    if(!id){msg('No cloud copy exists for this book.');return;}
    if(!confirm('Delete the cloud copy of "'+(b.title||'Untitled book')+'"? This cannot be undone. Keep a local copy by exporting a backup first.'))return;
    try{await api('/api/books/'+encodeURIComponent(id),{method:'DELETE'});localStorage.removeItem('mathslearn.book.serverId.'+b.id);localStorage.setItem(key(b),'draft');msg('Cloud copy deleted. Your local browser copy remains.');}
    catch(e){msg(e.message);}
  });
  $ml('#mlExportBook').addEventListener('click',()=>{
    const b=currentBook();if(!b){msg('Open a book first.');return;}
    const out={app:'MathsLearnBookBackup',version:1,book:b,lectures:currentLectures(),exportedAt:new Date().toISOString()};
    const blob=new Blob([JSON.stringify(out,null,2)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(b.title||'mathslearn-book').replace(/[\\/:*?"<>|]+/g,'_')+'.mathslearn-book.json';a.click();URL.revokeObjectURL(a.href);msg('Backup exported.');
  });
  $ml('#mlInsertImage').addEventListener('click',()=>{
    if(!currentBook()||!L){msg('Open a book and a chapter first.');return;}
    $ml('#mlImageFile').value='';$ml('#mlImageStatus').textContent='';dlg.style.display='flex';
  });
  $ml('#mlImageCancel').addEventListener('click',()=>dlg.style.display='none');
  $ml('#mlImageInsert').addEventListener('click',async()=>{
    const f=$ml('#mlImageFile').files[0];if(!f){$ml('#mlImageStatus').textContent='Choose an image first.';return;}
    if(!/^image\/(png|jpeg|webp)$/.test(f.type)){ $ml('#mlImageStatus').textContent='Use PNG, JPG or WebP.';return;}
    if(f.size>12*1024*1024){$ml('#mlImageStatus').textContent='Choose an image under 12 MB.';return;}
    try{
      $ml('#mlImageStatus').textContent='Optimizing image…';
      const img=new Image(),url=URL.createObjectURL(f);
      await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=url;});
      const scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));
      const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.naturalWidth*scale));c.height=Math.max(1,Math.round(img.naturalHeight*scale));
      c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);
      const data=c.toDataURL('image/jpeg',0.78);
      L.steps[cur].imageData=data;
      L.steps[cur].imageAlt=$ml('#mlImageAlt').value.trim();
      L.steps[cur].imageCaption=$ml('#mlImageCaption').value.trim();
      L.steps[cur].imageWidth=Number($ml('#mlImageWidth').value)||100;
      L.steps[cur].imageAlign=$ml('#mlImageAlign').value||'center';
      persist();renderPreview();
      dlg.style.display='none';msg('Image inserted in the current block. Save the book to cloud afterward.');
    }catch(e){$ml('#mlImageStatus').textContent='Could not read that image. Try another file.';}
  });
  msg('Signed in. Open a book to save/publish it.');
})();
