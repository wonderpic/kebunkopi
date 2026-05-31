// ═══════════════════════════════════════════════
// FIREBASE INIT
// ═══════════════════════════════════════════════
const firebaseConfig = {
  apiKey: "AIzaSyBgnaxTGuZrghX95cDEWqP-oJkDHVYbEp4",
  authDomain: "kopiplanpro.firebaseapp.com",
  databaseURL: "https://kopiplanpro-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "kopiplanpro",
  storageBucket: "kopiplanpro.firebasestorage.app",
  messagingSenderId: "365158367888",
  appId: "1:365158367888:web:2c6f27819fdf8b87330e15"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.database();

// ═══════════════════════════════════════════════
// ASSETS — injected once
// ═══════════════════════════════════════════════
const LOGO_SRC = './assets/logo.png';
document.querySelectorAll('#logoSplash,#logoOwner,#logoFarmer').forEach(img=>img.src=LOGO_SRC);

// ═══════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════
let bloks=[], doneMap={}, currentUser=null, currentRole=null;
let farmerBlok=null, curFilter='semua', farmerFilter='semua';
let selBlokId=null, selStatusId=null, pendingDoneKey=null, pendingDoneOwnerId=null;
const fS={varietas:'Arabika',pupuk:'Organik',cuaca:'Kemarau'};
const eS={e_varietas:'Arabika',e_pupuk:'Organik',e_cuaca:'Kemarau'};

// ═══════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════
function getZona(m){m=parseInt(m);return m<700?'rendah':m<=1200?'menengah':'tinggi';}
function getZL(z){
  if(z==='rendah')   return{icon:'🏔️',label:'Zona Rendah <700 mdpl',cls:'zr'};
  if(z==='menengah') return{icon:'🌿',label:'Zona Menengah 700–1.200 mdpl',cls:'zm'};
  return{icon:'❄️',label:'Zona Tinggi >1.200 mdpl',cls:'zt'};
}
function safeKey(s){return s.replace(/[.#$\[\]|\/]/g,'_');}
function addDays(ds,d){const x=new Date(ds);x.setDate(x.getDate()+d);return x;}
function fmtDate(d){return d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});}
function fmtShort(d){return d.toLocaleDateString('id-ID',{day:'2-digit',month:'short'});}
function relDay(d){
  const t=new Date();t.setHours(0,0,0,0);
  const diff=Math.round((d-t)/86400000);
  if(diff<0)return Math.abs(diff)+' hari lalu';
  if(diff===0)return 'Hari ini!';if(diff===1)return 'Besok';
  return diff+' hari lagi';
}
function genKode(){return Math.random().toString(36).substring(2,8).toUpperCase();}
function showLoad(txt){
  document.getElementById('loadingOverlay').style.display='flex';
  document.getElementById('loadingText').textContent=txt||'Memuat...';
}
function hideLoad(){document.getElementById('loadingOverlay').style.display='none';}
function toast(msg){
  const t=document.getElementById('toast');t.textContent=msg;
  t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600);
}
function prevZona(v,id){
  const el=document.getElementById(id);if(!v){el.style.display='none';return;}
  const zl=getZL(getZona(v));el.style.display='block';el.className='zprev '+zl.cls;el.textContent=zl.icon+' '+zl.label;
}

// ═══════════════════════════════════════════════
// EVENT LISTENERS (no inline onclick)
// ═══════════════════════════════════════════════
document.getElementById('btnOwner').addEventListener('click', loginOwner);
document.getElementById('btnFarmer').addEventListener('click', showKodeScreen);
document.getElementById('btnKodeBack').addEventListener('click', showModeSelector);
document.getElementById('btnMasukKode').addEventListener('click', masukKode);
document.getElementById('btnLogout').addEventListener('click', doLogout);
document.getElementById('btnFarmerLogout').addEventListener('click', doLogout);
document.getElementById('btnTambah').addEventListener('click', tambahBlok);
document.getElementById('btnSimpanEdit').addEventListener('click', simpanEdit);
document.getElementById('btnBatalEdit').addEventListener('click', closeEdit);
document.getElementById('editModal').addEventListener('click', e=>{if(e.target===document.getElementById('editModal'))closeEdit();});
document.getElementById('fotoModalClose').addEventListener('click', ()=>document.getElementById('fotoModalOv').classList.remove('open'));
document.getElementById('fotoPromptOv').addEventListener('click', e=>{if(e.target===document.getElementById('fotoPromptOv'))document.getElementById('fotoPromptOv').classList.remove('open');});
document.getElementById('btnCancelDone').addEventListener('click', ()=>document.getElementById('fotoPromptOv').classList.remove('open'));
document.getElementById('btnDoneOnly').addEventListener('click', farmerConfirmDoneOnly);
document.getElementById('btnDoneWithFoto').addEventListener('click', farmerConfirmDoneWithFoto);

// Nav tabs
document.querySelectorAll('.nb').forEach(btn=>{
  btn.addEventListener('click', ()=>switchTab(btn.dataset.tab));
});

// Filter buttons owner
document.querySelectorAll('#tab-jadwal .fc').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    curFilter=btn.dataset.filter;
    document.querySelectorAll('#tab-jadwal .fc').forEach(c=>c.classList.remove('active'));
    btn.classList.add('active');
    renderJadwal();
  });
});

// Filter buttons farmer
document.querySelectorAll('#farmerFilt .fc').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    farmerFilter=btn.dataset.filter;
    document.querySelectorAll('#farmerFilt .fc').forEach(c=>c.classList.remove('active'));
    btn.classList.add('active');
    renderFarmerJadwal();
  });
});

// Toggle form inputs
document.querySelectorAll('.to').forEach(el=>{
  el.addEventListener('click', ()=>{
    const f=el.dataset.f, v=el.dataset.v;
    if(f.startsWith('e_')) eS[f]=v; else fS[f]=v;
    document.querySelectorAll('.to[data-f="'+f+'"]').forEach(o=>o.classList.remove('selected'));
    el.classList.add('selected');
  });
});

// mdpl preview
document.getElementById('f_mdpl').addEventListener('input', function(){prevZona(this.value,'zonaP');});
document.getElementById('e_mdpl').addEventListener('input', function(){prevZona(this.value,'zonaPE');});

// ═══════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════
function loginOwner(){
  showLoad('Menghubungkan ke Google...');
  const provider=new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider)
    .then(()=>hideLoad())
    .catch(e=>{hideLoad();toast('❌ '+e.message);});
}
function showKodeScreen(){
  document.getElementById('modeSelector').style.display='none';
  document.getElementById('kodeScreen').classList.add('show');
}
function showModeSelector(){
  document.getElementById('modeSelector').style.display='block';
  document.getElementById('kodeScreen').classList.remove('show');
  document.getElementById('kodeError').style.display='none';
  document.getElementById('kodeInput').value='';
}
async function masukKode(){
  const kode=document.getElementById('kodeInput').value.trim().toUpperCase();
  if(kode.length<4){toast('Kode minimal 4 karakter');return;}
  showLoad('Mencari kebun...');
  try{
    const snap=await db.ref('bloks').orderByChild('kode').equalTo(kode).once('value');
    if(!snap.exists()){
      hideLoad();document.getElementById('kodeError').style.display='block';return;
    }
    const entries=snap.val(), blokId=Object.keys(entries)[0];
    const blok=entries[blokId];blok.id=blokId;
    localStorage.setItem('farmer_blok_id',blokId);
    localStorage.setItem('farmer_kode',kode);
    hideLoad();enterFarmerMode(blok);
  }catch(e){hideLoad();toast('❌ '+e.message);}
}
function doLogout(){
  if(currentRole==='owner'){auth.signOut();}
  else{localStorage.removeItem('farmer_blok_id');localStorage.removeItem('farmer_kode');location.reload();}
}

// ═══════════════════════════════════════════════
// AUTH STATE
// ═══════════════════════════════════════════════
// Timeout fallback
setTimeout(()=>{
  if(document.getElementById('loadingOverlay').style.display==='flex'){
    hideLoad();
  }
},5000);

auth.onAuthStateChanged(async user=>{
  const savedId=localStorage.getItem('farmer_blok_id');
  const savedKode=localStorage.getItem('farmer_kode');
  if(!user && savedId && savedKode){
    showLoad('Memuat kebun...');
    try{
      const snap=await db.ref('bloks/'+savedId).once('value');
      if(snap.exists()){const b=snap.val();b.id=savedId;hideLoad();enterFarmerMode(b);return;}
    }catch(e){}
    localStorage.removeItem('farmer_blok_id');localStorage.removeItem('farmer_kode');
    hideLoad();
  } else if(user){
    currentUser=user;currentRole='owner';
    document.getElementById('loginScreen').style.display='none';
    document.getElementById('ownerApp').style.cssText='display:flex;flex-direction:column;';
    document.getElementById('ownerName').textContent=user.displayName||user.email;
    hideLoad();listenBloks();
  } else {
    hideLoad();
    document.getElementById('loginScreen').style.display='flex';
  }
});

// ═══════════════════════════════════════════════
// FIREBASE LISTENERS
// ═══════════════════════════════════════════════
function listenBloks(){
  db.ref('bloks').orderByChild('ownerId').equalTo(currentUser.uid).on('value',snap=>{
    bloks=[];
    if(snap.exists())snap.forEach(c=>{const b=c.val();b.id=c.key;bloks.push(b);});
    listenDone();
    const activeTab=document.querySelector('.nb.active');
    const tab=activeTab?activeTab.dataset.tab:'kebun';
    if(tab==='kebun')renderKebun();
    else if(tab==='jadwal'){buildPicker();renderJadwal();}
    else if(tab==='status'){buildStatusPicker();renderStatus();}
    else renderKebun();
  });
}
function listenDone(){
  db.ref('done/'+currentUser.uid).on('value',snap=>{
    doneMap=snap.exists()?snap.val():{};
    const activeTab=document.querySelector('.nb.active');
    const tab=activeTab?activeTab.dataset.tab:'';
    if(tab==='jadwal')renderJadwal();
    else if(tab==='status')renderStatus();
    if(currentRole==='farmer')renderFarmerJadwal();
  });
}

// ═══════════════════════════════════════════════
// FARMER MODE
// ═══════════════════════════════════════════════
function enterFarmerMode(blok){
  currentRole='farmer';farmerBlok=blok;
  document.getElementById('loginScreen').style.display='none';
  document.getElementById('ownerApp').style.display='none';
  document.getElementById('farmerApp').style.cssText='display:flex;flex-direction:column;';
  document.getElementById('farmerKebunName').textContent='🏡 '+blok.nama;
  document.getElementById('farmerKebunLoc').textContent='📍 '+blok.lokasi+' · ⛰️ '+parseInt(blok.mdpl).toLocaleString('id-ID')+' mdpl';
  const today=new Date();
  document.getElementById('farmerTodayDate').textContent=today.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  if(blok.ownerId){
    db.ref('done/'+blok.ownerId).on('value',snap=>{
      doneMap=snap.exists()?snap.val():{};
      renderFarmerJadwal();
    });
  }
  renderFarmerJadwal();
}

function renderFarmerJadwal(){
  if(!farmerBlok)return;
  const tasks=generateTasks(farmerBlok);
  tasks.sort((a,b)=>a.targetDate-b.targetDate);
  const today=new Date();today.setHours(0,0,0,0);
  const urgent=tasks.filter(t=>{const d=Math.round((t.targetDate-today)/86400000);return(d>=0&&d<=3)||d<0;}).filter(t=>!t.done);
  document.getElementById('farmerTodayCount').textContent=
    urgent.length>0?'⚠️ '+urgent.length+' tugas perlu dikerjakan':'✅ Tidak ada tugas mendesak';
  const filtered=farmerFilter==='semua'?tasks:tasks.filter(t=>t.type===farmerFilter);
  if(!filtered.length){
    document.getElementById('farmerJadwal').innerHTML='<div class="empty"><div class="ei">✅</div><p>Tidak ada tugas untuk filter ini.</p></div>';
    return;
  }
  document.getElementById('farmerJadwal').innerHTML=filtered.map(t=>{
    const od=t.targetDate<today&&!t.done;
    const diff=Math.round((t.targetDate-today)/86400000);
    const urgent=(diff>=0&&diff<=3)||od;
    return '<div class="si tp-'+t.type+(t.done?' done':'')+'" style="'+(urgent&&!t.done?'border:1.5px solid '+(od?'#e53935':'#fb8c00')+';':'')+'">'+
      '<button class="check-btn'+(t.done?' checked':'')+'" data-key="'+t.key+'" data-owner="'+(farmerBlok.ownerId||'')+'" type="button">'+
      (t.done?'✓':'')+'</button>'+
      '<div class="sic">'+t.icon+'</div>'+
      '<div class="sb2" id="fsb_'+safeKey(t.key)+'">'+
      '<div class="st">'+t.task+'</div>'+
      '<div class="sbl">ℹ️ '+t.znote+'</div>'+
      (t.done?'<div class="done-stamp">✅ Sudah dikerjakan</div>':'')+
      '</div>'+
      '<div class="sd">'+
      '<div class="sd-main'+(od?' overdue':'')+'">'+fmtDate(t.targetDate)+'</div>'+
      '<div class="sd-rel'+(od?' overdue':'')+'">'+relDay(t.targetDate)+'</div>'+
      '</div></div>';
  }).join('');

  // Bind check buttons
  document.querySelectorAll('#farmerJadwal .check-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>farmerTapDone(btn.dataset.key, btn.dataset.owner));
  });

  // Load foto async
  if(farmerBlok.ownerId){
    filtered.forEach(t=>{
      const container=document.getElementById('fsb_'+safeKey(t.key));
      if(container)renderFotoBtn(t.key, farmerBlok.ownerId, container, t.done);
    });
  }
}

function farmerTapDone(key, ownerId){
  if(!key||!ownerId)return;
  const sk=safeKey(key);
  if(doneMap[sk]||doneMap[key]){
    // Undo
    db.ref('done/'+ownerId+'/'+sk).remove();
    db.ref('foto/'+ownerId+'/'+sk).remove();
    toast('↩️ Ditandai belum dikerjakan');
  } else {
    pendingDoneKey=key;pendingDoneOwnerId=ownerId;
    document.getElementById('fotoPromptOv').classList.add('open');
  }
}

async function farmerConfirmDoneOnly(){
  document.getElementById('fotoPromptOv').classList.remove('open');
  if(!pendingDoneKey||!pendingDoneOwnerId)return;
  await db.ref('done/'+pendingDoneOwnerId+'/'+safeKey(pendingDoneKey)).set(true);
  toast('✅ Tugas ditandai selesai!');
  pendingDoneKey=null;pendingDoneOwnerId=null;
}

async function farmerConfirmDoneWithFoto(){
  document.getElementById('fotoPromptOv').classList.remove('open');
  if(!pendingDoneKey||!pendingDoneOwnerId)return;
  const key=pendingDoneKey, ownerId=pendingDoneOwnerId;
  pendingDoneKey=null;pendingDoneOwnerId=null;
  // Mark done first
  await db.ref('done/'+ownerId+'/'+safeKey(key)).set(true);
  // Open camera
  const input=document.createElement('input');
  input.type='file';input.accept='image/*';input.capture='environment';
  input.onchange=async(e)=>{
    const file=e.target.files[0];if(!file)return;
    showLoad('Mengompress foto...');
    try{
      await uploadFoto(key,ownerId,file,pct=>{
        document.getElementById('loadingText').textContent='Mengunggah foto... '+pct+'%';
      });
      hideLoad();toast('📸 Foto bukti berhasil diunggah!');
      renderFarmerJadwal();
    }catch(err){hideLoad();toast('❌ '+err.message);}
  };
  input.click();
  toast('✅ Tugas ditandai selesai!');
}

// ═══════════════════════════════════════════════
// FOTO FUNCTIONS
// ═══════════════════════════════════════════════
function compressImage(file,maxW,maxH,q){
  return new Promise(res=>{
    const reader=new FileReader();
    reader.onload=e=>{
      const img=new Image();
      img.onload=()=>{
        const canvas=document.createElement('canvas');
        let w=img.width,h=img.height;
        if(w>maxW){h=Math.round(h*maxW/w);w=maxW;}
        if(h>maxH){w=Math.round(w*maxH/h);h=maxH;}
        canvas.width=w;canvas.height=h;
        canvas.getContext('2d').drawImage(img,0,0,w,h);
        res(canvas.toDataURL('image/jpeg',q));
      };
      img.src=e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
async function uploadFoto(key,ownerId,file,onProgress){
  onProgress&&onProgress(20);
  let compressed=await compressImage(file,800,800,0.65);
  onProgress&&onProgress(70);
  if(compressed.length*0.75/1024>400) compressed=await compressImage(file,600,600,0.5);
  onProgress&&onProgress(90);
  const sizeKB=Math.round(compressed.length*0.75/1024);
  await db.ref('foto/'+ownerId+'/'+safeKey(key)).set({data:compressed,uploadedAt:Date.now(),sizeKB});
  onProgress&&onProgress(100);
}
async function renderFotoBtn(key,ownerId,container,isDone){
  try{
    const snap=await db.ref('foto/'+ownerId+'/'+safeKey(key)).once('value');
    const existing=container.querySelector('.foto-area');
    if(existing)existing.remove();
    const area=document.createElement('div');area.className='foto-area';
    if(snap.exists()){
      const foto=snap.val();
      const d=new Date(foto.uploadedAt);
      const ts=d.toLocaleDateString('id-ID',{day:'2-digit',month:'short'})+' '+d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
      area.innerHTML='<div style="display:flex;align-items:center;gap:8px;margin-top:5px;">'+
        '<img class="foto-thumb" src="'+foto.data+'" alt="Bukti">'+
        '<div style="font-size:9.5px;color:#388e3c;">✅ Foto tersimpan<br><span style="color:var(--muted);">'+ts+' · '+foto.sizeKB+' KB</span></div></div>';
      area.querySelector('.foto-thumb').addEventListener('click',()=>openFotoModal(foto.data,ts,key,ownerId));
    } else if(!isDone){
      const btn=document.createElement('button');
      btn.className='foto-btn';btn.type='button';btn.textContent='📷 Ambil Foto Bukti Kerja';
      const prog=document.createElement('div');prog.className='upload-progress';
      prog.innerHTML='<div class="upload-progress-bar"></div>';
      btn.addEventListener('click',()=>{
        const input=document.createElement('input');
        input.type='file';input.accept='image/*';input.capture='environment';
        input.onchange=async(e)=>{
          const file=e.target.files[0];if(!file)return;
          prog.style.display='block';btn.textContent='📤 Mengunggah...';btn.disabled=true;
          try{
            // Mark done first
            await db.ref('done/'+ownerId+'/'+safeKey(key)).set(true);
            await uploadFoto(key,ownerId,file,pct=>{prog.querySelector('.upload-progress-bar').style.width=pct+'%';});
            prog.style.display='none';toast('✅ Foto berhasil diunggah & tugas selesai!');
            renderFarmerJadwal();
          }catch(err){prog.style.display='none';btn.disabled=false;btn.textContent='📷 Ambil Foto Bukti Kerja';toast('❌ '+err.message);}
        };
        input.click();
      });
      area.appendChild(btn);area.appendChild(prog);
    }
    container.appendChild(area);
  }catch(e){console.log('foto err',e);}
}
function openFotoModal(src,info,key,ownerId){
  document.getElementById('fotoModalImg').src=src;
  document.getElementById('fotoModalInfo').textContent='Diunggah: '+info;
  const del=document.getElementById('fotoModalDel');
  if(ownerId===currentUser?.uid){
    del.style.display='inline-block';
    del.onclick=async()=>{
      if(!confirm('Hapus foto ini?'))return;
      await db.ref('foto/'+ownerId+'/'+safeKey(key)).remove();
      document.getElementById('fotoModalOv').classList.remove('open');
      toast('🗑️ Foto dihapus.');
      renderJadwal();
    };
  } else {del.style.display='none';}
  document.getElementById('fotoModalOv').classList.add('open');
}

// ═══════════════════════════════════════════════
// GENERATE TASKS
// ═══════════════════════════════════════════════
function generateTasks(blok){
  const tasks=[],zona=getZona(blok.mdpl);
  const add=(label,days,type,icon,zn)=>{
    days.forEach(d=>{
      const td=addDays(blok.tanggal,d);
      const rawKey=blok.id+'|'+label+'|'+td.toISOString().split('T')[0];
      const sk=safeKey(rawKey);
      tasks.push({key:rawKey,sk,blokId:blok.id,blokNama:blok.nama,lokasi:blok.lokasi,
        task:label,targetDate:td,type,icon,zona,znote:zn||'',done:!!(doneMap[sk]||doneMap[rawKey])});
    });
  };
  const ip=zona==='rendah'?150:zona==='menengah'?180:210;
  const lp=blok.pupuk==='Organik'?'Pemupukan Organik (10–20 kg/pohon)':'Pemupukan Anorganik (Urea+SP36+KCl)';
  const zp=zona==='rendah'?'Interval 150 hr':zona==='menengah'?'Interval 180 hr':'Interval 210 hr';
  const dp=[];for(let d=60;d<=1825;d+=ip)dp.push(d);
  add(lp,dp,'pupuk',blok.pupuk==='Organik'?'🍃':'⚗️',zp);
  if(blok.varietas==='Arabika'){
    add('Pangkas Pembentukan Arabika',[365,540],'pangkas','✂️','Umur 1–2 thn');
    const hp=zona==='rendah'?900:zona==='menengah'?1095:1460;
    add('Pangkas Produksi',[hp+365,hp+730],'pangkas','✂️','Setelah panen pertama');
    const zpa=zona==='rendah'?'Panen ~2,5 thn':zona==='menengah'?'Panen ~3 thn':'Panen ~4 thn';
    add('Panen Perdana Arabika',[hp],'panen','☕',zpa);
    add('Panen Arabika Berikutnya',[hp+365],'panen','☕',zpa);
  }else{
    add('Wiwilan Perdana Robusta',[180],'wiwilan','🌿','Bulan ke-6');
    add('Wiwilan Robusta Tahunan',[545,910],'wiwilan','🌿','Tahunan');
    const hr=zona==='rendah'?750:zona==='menengah'?900:1095;
    const zpr=zona==='rendah'?'Panen ~2 thn':zona==='menengah'?'Panen ~2,5 thn':'Panen ~3 thn';
    add('Panen Perdana Robusta',[hr],'panen','☕',zpr);
    add('Panen Robusta Berikutnya',[hr+365],'panen','☕',zpr);
  }
  if(blok.cuaca==='Kemarau'){
    const is=zona==='rendah'?2:zona==='menengah'?3:5;
    const zs=zona==='rendah'?'Tiap 2 hr':zona==='menengah'?'Tiap 3 hr':'Tiap 5 hr';
    const ds=[];for(let d=is;d<=30;d+=is)ds.push(d);
    add('Penyiraman Rutin',ds,'siram','💧',zs);
  }else{
    add('Periksa Saluran Drainase',[7,14,21,28],'drainase','🌊','Tiap 7 hr');
  }
  add('Penyiangan Gulma',[14,28,42,56,70,84],'gulma','🌾','Tiap 14 hr');
  return tasks;
}

// ═══════════════════════════════════════════════
// OWNER: TOGGLE DONE
// ═══════════════════════════════════════════════
async function toggleDone(key){
  if(!currentUser)return;
  const sk=safeKey(key);
  const ref=db.ref('done/'+currentUser.uid+'/'+sk);
  if(doneMap[sk]||doneMap[key]) await ref.remove();
  else await ref.set(true);
}

// ═══════════════════════════════════════════════
// OWNER NAV
// ═══════════════════════════════════════════════
function switchTab(tab){
  document.querySelectorAll('.tp').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nb').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');
  document.querySelector('.nb[data-tab="'+tab+'"]').classList.add('active');
  if(tab==='kebun')renderKebun();
  else if(tab==='jadwal'){buildPicker();renderJadwal();}
  else if(tab==='status'){buildStatusPicker();renderStatus();}
}

// ═══════════════════════════════════════════════
// RENDER KEBUN
// ═══════════════════════════════════════════════
function getAlerts(blok){
  const al=[],m=parseInt(blok.mdpl),zona=getZona(m),z=getZL(zona);
  if(blok.varietas==='Arabika'&&m<1000) al.push({t:'w',msg:'⚠️ Arabika <1.000 mdpl: risiko karat daun. (Puslitkoka 2010)'});
  if(blok.varietas==='Robusta'&&m>900)  al.push({t:'w',msg:'⚠️ Robusta >900 mdpl: di luar zona optimal. (BBPP Lembang)'});
  const hp=blok.varietas==='Arabika'?(zona==='rendah'?'~2,5 thn':zona==='menengah'?'~3 thn':'~4 thn'):(zona==='rendah'?'~2 thn':zona==='menengah'?'~2,5 thn':'~3 thn');
  const ip=zona==='rendah'?150:zona==='menengah'?180:210;
  al.push({t:'i',msg:z.icon+' '+z.label+' | Pupuk tiap '+ip+' hr | Panen '+hp});
  return al;
}
function renderKebun(){
  if(!bloks.length){
    document.getElementById('statsBar').innerHTML='<div class="sc"><div class="sn">0</div><div class="sl">Blok</div></div><div class="sc"><div class="sn">0</div><div class="sl">Arabika</div></div><div class="sc"><div class="sn">0</div><div class="sl">Robusta</div></div><div class="sc"><div class="sn">0</div><div class="sl">Pohon</div></div>';
    document.getElementById('pohonBreakdown').innerHTML='';
    document.getElementById('kebunList').innerHTML='<div class="empty"><div class="ei">🌱</div><p>Belum ada blok kebun.<br>Tambahkan melalui tab <strong>Tambah Blok</strong>!</p></div>';
    return;
  }
  const ara=bloks.filter(b=>b.varietas==='Arabika').length;
  const rob=bloks.filter(b=>b.varietas==='Robusta').length;
  const phn=bloks.reduce((s,b)=>s+parseInt(b.pohon||0),0);
  document.getElementById('statsBar').innerHTML=
    '<div class="sc"><div class="sn">'+bloks.length+'</div><div class="sl">Blok</div></div>'+
    '<div class="sc"><div class="sn">'+ara+'</div><div class="sl">Arabika</div></div>'+
    '<div class="sc"><div class="sn">'+rob+'</div><div class="sl">Robusta</div></div>'+
    '<div class="sc"><div class="sn">'+phn.toLocaleString('id-ID')+'</div><div class="sl">Pohon</div></div>';
  const lMap={};
  bloks.forEach(b=>{if(!lMap[b.lokasi])lMap[b.lokasi]={a:0,r:0};if(b.varietas==='Arabika')lMap[b.lokasi].a+=parseInt(b.pohon||0);else lMap[b.lokasi].r+=parseInt(b.pohon||0);});
  let pb='<div style="font-size:9.5px;font-weight:700;color:rgba(255,255,255,0.78);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:6px;">🌱 Rincian Pohon per Lokasi</div><div class="pohon-grid">';
  Object.keys(lMap).forEach(loc=>{const d=lMap[loc];pb+='<div class="pohon-card"><div class="pohon-loc">📍 '+loc+'</div>'+(d.a?'<div class="pohon-row"><span style="color:#a5d6a7;">🌿 Arabika</span><span class="pohon-num">'+d.a.toLocaleString('id-ID')+'</span></div>':'')+(d.r?'<div class="pohon-row"><span style="color:#ffab91;">🌱 Robusta</span><span class="pohon-num">'+d.r.toLocaleString('id-ID')+'</span></div>':'')+'<div style="border-top:1px solid rgba(255,255,255,0.18);margin-top:3px;padding-top:3px;"><div class="pohon-row"><span style="color:rgba(255,255,255,0.65);">Total</span><span class="pohon-num">'+(d.a+d.r).toLocaleString('id-ID')+'</span></div></div></div>';});
  pb+='</div>';
  document.getElementById('pohonBreakdown').innerHTML=pb;
  const today=new Date();today.setHours(0,0,0,0);
  document.getElementById('kebunList').innerHTML=bloks.map(blok=>{
    const al=getAlerts(blok),zona=getZona(blok.mdpl),z=getZL(zona);
    const tasks=generateTasks(blok);
    const done=tasks.filter(t=>t.done).length,total=tasks.length;
    const pct=total?Math.round(done/total*100):0;
    const overdue=tasks.filter(t=>t.targetDate<today&&!t.done).length;
    const col=pct>=75?'#388e3c':pct>=40?'#fb8c00':'#e53935';
    return '<div class="card">'+
      '<div class="ch"><div class="ct">🏡 '+blok.nama+'</div>'+
      '<div class="cbtn"><button class="ebt" data-id="'+blok.id+'" type="button">✏️</button>'+
      '<button class="dbt" data-id="'+blok.id+'" type="button">🗑️</button></div></div>'+
      '<div class="zona-badge '+z.cls+'">'+z.icon+' '+z.label+'</div>'+
      '<div class="ci">'+
      '<div class="ir"><span class="il">Lokasi</span><span class="iv">📍 '+blok.lokasi+'</span></div>'+
      '<div class="ir"><span class="il">Ketinggian</span><span class="iv">⛰️ '+parseInt(blok.mdpl).toLocaleString('id-ID')+' mdpl</span></div>'+
      '<div class="ir"><span class="il">Varietas</span><span class="badge b'+blok.varietas.slice(0,1).toLowerCase()+'">'+blok.varietas+'</span></div>'+
      '<div class="ir"><span class="il">Pupuk</span><span class="badge b'+blok.pupuk.slice(0,1).toLowerCase()+'">'+blok.pupuk+'</span></div>'+
      '<div class="ir"><span class="il">Cuaca</span><span class="badge b'+(blok.cuaca==='Kemarau'?'km':'h')+'">'+blok.cuaca+'</span></div>'+
      '<div class="ir"><span class="il">Tanam</span><span class="iv">'+new Date(blok.tanggal).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})+'</span></div>'+
      '<div class="ir"><span class="il">Pohon</span><span class="iv">🌱 '+parseInt(blok.pohon).toLocaleString('id-ID')+'</span></div>'+
      '<div class="ir"><span class="il">Progress</span><span class="iv" style="color:'+col+'">'+pct+'% selesai</span></div>'+
      '</div>'+
      (overdue?'<div class="alert-w">⚠️ '+overdue+' tugas terlambat</div>':'')+
      al.map(a=>'<div class="'+(a.t==='w'?'alert-w':'alert-i')+'">'+a.msg+'</div>').join('')+
      '<div class="kode-badge" data-kode="'+blok.kode+'">'+
      '<span class="kode-badge-label">KODE PETANI</span>'+
      '<span>'+blok.kode+'</span>'+
      '<span style="font-size:9px;opacity:0.7;">📋</span></div></div>';
  }).join('');

  // Bind edit/delete/kode buttons
  document.querySelectorAll('.ebt').forEach(btn=>btn.addEventListener('click',()=>openEdit(btn.dataset.id)));
  document.querySelectorAll('.dbt').forEach(btn=>btn.addEventListener('click',()=>hapusBlok(btn.dataset.id)));
  document.querySelectorAll('.kode-badge').forEach(btn=>btn.addEventListener('click',()=>{
    if(navigator.clipboard)navigator.clipboard.writeText(btn.dataset.kode);
    toast('📋 Kode "'+btn.dataset.kode+'" disalin!');
  }));
}

// ═══════════════════════════════════════════════
// RENDER JADWAL (OWNER)
// ═══════════════════════════════════════════════
function buildPicker(){
  const el=document.getElementById('kebunPicker');
  if(!bloks.length){el.innerHTML='<div style="color:rgba(255,255,255,0.6);font-size:12px;">Belum ada kebun.</div>';return;}
  if(!selBlokId||!bloks.find(b=>b.id===selBlokId))selBlokId=bloks[0].id;
  el.innerHTML=bloks.map(b=>'<button class="picker-chip'+(b.id===selBlokId?' active':'')+'" data-id="'+b.id+'" type="button">'+b.nama+'</button>').join('');
  el.querySelectorAll('.picker-chip').forEach(btn=>btn.addEventListener('click',()=>{
    selBlokId=btn.dataset.id;
    el.querySelectorAll('.picker-chip').forEach(c=>c.classList.toggle('active',c.dataset.id===selBlokId));
    renderJadwal();
  }));
}
function renderJadwal(){
  if(!bloks.length){document.getElementById('jadwalList').innerHTML='<div class="empty"><div class="ei">📅</div><p>Tambahkan blok kebun dulu.</p></div>';return;}
  buildPicker();
  const blok=bloks.find(b=>b.id===selBlokId);if(!blok)return;
  let tasks=generateTasks(blok);
  tasks.sort((a,b)=>a.targetDate-b.targetDate);
  if(curFilter!=='semua')tasks=tasks.filter(t=>t.type===curFilter);
  if(!tasks.length){document.getElementById('jadwalList').innerHTML='<div class="empty"><div class="ei">🔍</div><p>Tidak ada jadwal untuk filter ini.</p></div>';return;}
  const today=new Date();today.setHours(0,0,0,0);
  document.getElementById('jadwalList').innerHTML=tasks.map(t=>{
    const od=t.targetDate<today&&!t.done;
    return '<div class="si tp-'+t.type+(t.done?' done':'')+'">'+
      '<button class="check-btn'+(t.done?' checked':'')+'" data-key="'+t.key+'" type="button">'+(t.done?'✓':'')+'</button>'+
      '<div class="sic">'+t.icon+'</div>'+
      '<div class="sb2">'+
      '<div class="st">'+t.task+'</div><div class="sbl">ℹ️ '+t.znote+'</div>'+
      (t.done?'<div class="done-stamp">✅ Sudah dikerjakan</div><button class="foto-btn has-foto" data-key="'+t.key+'" data-owner="'+currentUser.uid+'" type="button">🖼️ Lihat Foto Bukti</button>':'')+
      '</div>'+
      '<div class="sd"><div class="sd-main'+(od?' overdue':'')+'">'+fmtDate(t.targetDate)+'</div>'+
      '<div class="sd-rel'+(od?' overdue':'')+'">'+relDay(t.targetDate)+'</div></div></div>';
  }).join('');

  document.querySelectorAll('#jadwalList .check-btn').forEach(btn=>
    btn.addEventListener('click',()=>toggleDone(btn.dataset.key)));
  document.querySelectorAll('#jadwalList .foto-btn').forEach(btn=>
    btn.addEventListener('click',async()=>{
      btn.textContent='⏳ Memuat...';
      const snap=await db.ref('foto/'+btn.dataset.owner+'/'+safeKey(btn.dataset.key)).once('value');
      if(!snap.exists()){btn.textContent='📷 Belum ada foto';return;}
      const foto=snap.val();
      const d=new Date(foto.uploadedAt);
      const ts=d.toLocaleDateString('id-ID',{day:'2-digit',month:'short'})+' '+d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
      btn.textContent='🖼️ Lihat Foto Bukti';
      openFotoModal(foto.data,ts,btn.dataset.key,btn.dataset.owner);
    }));
}

// ═══════════════════════════════════════════════
// STATUS VISUAL
// ═══════════════════════════════════════════════
function buildStatusPicker(){
  const el=document.getElementById('statusPicker');
  if(!bloks.length){el.innerHTML='';return;}
  if(!selStatusId||!bloks.find(b=>b.id===selStatusId))selStatusId=bloks[0].id;
  el.innerHTML=bloks.map(b=>'<button class="bsel-chip'+(b.id===selStatusId?' active':'')+'" data-id="'+b.id+'" type="button">'+b.nama+'</button>').join('');
  el.querySelectorAll('.bsel-chip').forEach(btn=>btn.addEventListener('click',()=>{
    selStatusId=btn.dataset.id;
    el.querySelectorAll('.bsel-chip').forEach(c=>c.classList.toggle('active',c.dataset.id===selStatusId));
    renderStatus();
  }));
}
function renderStatus(){
  const el=document.getElementById('statusVis');
  if(!bloks.length){el.innerHTML='<div class="empty"><div class="ei">📊</div><p>Tambahkan blok kebun dulu.</p></div>';return;}
  buildStatusPicker();
  const blok=bloks.find(b=>b.id===selStatusId);if(!blok){el.innerHTML='';return;}
  const tasks=generateTasks(blok);tasks.sort((a,b)=>a.targetDate-b.targetDate);
  const today=new Date();today.setHours(0,0,0,0);
  const total=tasks.length,done=tasks.filter(t=>t.done).length;
  const overdue=tasks.filter(t=>t.targetDate<today&&!t.done).length;
  const dueSoon=tasks.filter(t=>{const d=Math.round((t.targetDate-today)/86400000);return d>=0&&d<=7&&!t.done;}).length;
  const pct=total?Math.round(done/total*100):0;
  const zona=getZona(blok.mdpl),z=getZL(zona);
  let html='<div class="card" style="margin-bottom:10px;"><div class="ch"><div class="ct">🏡 '+blok.nama+'</div><div class="zona-badge '+z.cls+'" style="margin:0;">'+z.icon+' '+z.label+'</div></div><div style="display:flex;gap:12px;font-size:11.5px;color:var(--muted);margin-top:3px;"><span>📍 '+blok.lokasi+'</span><span>⛰️ '+parseInt(blok.mdpl).toLocaleString('id-ID')+' mdpl</span></div></div>';
  // Donut
  const R=44,CX=54,CY=54,C=2*Math.PI*R;
  const s1=done/total||0,s2=s1+(overdue/total||0);
  function arc(s,l,color){return '<circle cx="'+CX+'" cy="'+CY+'" r="'+R+'" fill="none" stroke="'+color+'" stroke-width="14" stroke-dasharray="'+(l*C)+' '+C+'" stroke-dashoffset="'+(C*(1-s))+'" stroke-linecap="butt"/>';}
  html+='<div class="donut-card"><div class="vcardtitle">📋 Ringkasan Tugas</div><div class="donut-wrap"><svg width="108" height="108" viewBox="0 0 108 108"><circle cx="'+CX+'" cy="'+CY+'" r="'+R+'" fill="none" stroke="#f0f0f0" stroke-width="14"/>'+arc(0,s1,'#388e3c')+arc(s1,overdue/total||0,'#e53935')+arc(s2,dueSoon/total||0,'#fb8c00')+'<text x="'+CX+'" y="'+(CY+5)+'" text-anchor="middle" font-size="16" font-weight="700" fill="#1b5e20">'+pct+'%</text><text x="'+CX+'" y="'+(CY+18)+'" text-anchor="middle" font-size="8" fill="#888">selesai</text></svg><div class="donut-legend"><div class="legend-item"><div class="legend-dot" style="background:#388e3c"></div>Selesai<span class="legend-val">'+done+'</span></div><div class="legend-item"><div class="legend-dot" style="background:#e53935"></div>Terlambat<span class="legend-val">'+overdue+'</span></div><div class="legend-item"><div class="legend-dot" style="background:#fb8c00"></div>7 Hari Ini<span class="legend-val">'+dueSoon+'</span></div><div class="legend-item"><div class="legend-dot" style="background:#e0e0e0"></div>Mendatang<span class="legend-val">'+(total-done-overdue-dueSoon)+'</span></div></div></div></div>';
  // Progress bars
  const types=[{t:'pupuk',l:'Pemupukan',i:'🌿'},{t:'siram',l:'Penyiraman',i:'💧'},{t:'gulma',l:'Gulma',i:'🌾'},{t:'pangkas',l:'Pemangkasan',i:'✂️'},{t:'panen',l:'Panen',i:'☕'},{t:'wiwilan',l:'Wiwilan',i:'🌱'},{t:'drainase',l:'Drainase',i:'🌊'}];
  html+='<div class="ring-card"><div class="vcardtitle">📊 Progress per Jenis Tugas</div>';
  types.forEach(tp=>{
    const tt=tasks.filter(t=>t.type===tp.t);if(!tt.length)return;
    const td=tt.filter(t=>t.done).length,pp=Math.round(td/tt.length*100);
    const col=pp>=75?'#388e3c':pp>=40?'#fb8c00':'#e53935';
    html+='<div class="pb-wrap"><div class="pb-label"><span class="pb-name">'+tp.i+' '+tp.l+'</span><span class="pb-pct" style="color:'+col+'">'+td+'/'+tt.length+' ('+pp+'%)</span></div><div class="pb-track"><div class="pb-fill" style="width:'+pp+'%;background:'+col+';"></div></div></div>';
  });
  html+='</div>';
  // Heatmap
  html+='<div class="heat-card"><div class="vcardtitle">🗓️ Kalender Aktivitas (8 Minggu)</div>';
  const days=['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
  html+='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:4px;">';
  days.forEach(d=>html+='<div style="font-size:7.5px;color:var(--muted);text-align:center;">'+d+'</div>');
  html+='</div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;">';
  const sd=new Date(today);sd.setDate(sd.getDate()-sd.getDay());
  for(let i=0;i<56;i++){
    const day=new Date(sd);day.setDate(day.getDate()+i);
    const ds=day.toISOString().split('T')[0];
    const cnt=tasks.filter(t=>t.targetDate.toISOString().split('T')[0]===ds).length;
    const isT=ds===today.toISOString().split('T')[0];
    const cl=cnt===0?'h0':cnt===1?'h1':cnt===2?'h2':cnt<=4?'h3':'h4';
    html+='<div class="heat-cell '+cl+'"'+(isT?' style="outline:2px solid #1b5e20;outline-offset:1px;"':'')+'>'+( cnt>0?cnt:'')+' </div>';
  }
  html+='</div><div style="display:flex;align-items:center;gap:3px;justify-content:flex-end;margin-top:6px;font-size:9px;color:var(--muted);">Sedikit ';
  ['h0','h1','h2','h3','h4'].forEach(c=>html+='<div style="width:9px;height:9px;border-radius:2px;" class="'+c+'"></div>');
  html+=' Banyak</div></div>';
  // Timeline
  const od2=tasks.filter(t=>t.targetDate<today&&!t.done).slice(0,3);
  const up=tasks.filter(t=>t.targetDate>=today&&!t.done).slice(0,7);
  const combined=[...od2,...up].slice(0,10);
  html+='<div class="tl-card"><div class="vcardtitle">⏰ Timeline Tugas Terdekat</div>';
  if(!combined.length)html+='<div style="text-align:center;color:var(--muted);font-size:12.5px;padding:14px 0;">🎉 Semua tugas sudah selesai!</div>';
  combined.forEach(t=>{
    const diff=Math.round((t.targetDate-today)/86400000);
    const isOD=diff<0,isT2=diff===0;
    const dotCls=t.done?'done-dot':isOD?'overdue-dot':isT2?'due-dot':'future-dot';
    const stCls=t.done?'st-done':isOD?'st-overdue':isT2?'st-due':'st-upcoming';
    const stTxt=t.done?'✅ Selesai':isOD?'⚠️ Terlambat '+Math.abs(diff)+' hr':isT2?'📌 Hari ini':'🕐 '+diff+' hari lagi';
    html+='<div class="tl-item"><div class="tl-dot '+dotCls+'">'+t.icon+'</div><div class="tl-body"><div class="tl-task">'+t.task+'</div><div class="tl-meta">'+fmtDate(t.targetDate)+'</div><span class="tl-status '+stCls+'">'+stTxt+'</span></div></div>';
  });
  html+='</div>';
  el.innerHTML=html;
}

// ═══════════════════════════════════════════════
// TAMBAH BLOK
// ═══════════════════════════════════════════════
async function tambahBlok(){
  if(!currentUser)return;
  const nama=document.getElementById('f_nama').value.trim();
  const lokasi=document.getElementById('f_lokasi').value.trim();
  const mdpl=document.getElementById('f_mdpl').value;
  const tgl=document.getElementById('f_tgl').value;
  const pohon=document.getElementById('f_pohon').value;
  if(!nama||!lokasi||!mdpl||!tgl||!pohon){toast('⚠️ Harap isi semua kolom!');return;}
  showLoad('Menyimpan...');
  try{
    const kode=genKode();
    await db.ref('bloks').push({nama,lokasi,mdpl,varietas:fS.varietas,pupuk:fS.pupuk,cuaca:fS.cuaca,tanggal:tgl,pohon,kode,ownerId:currentUser.uid,createdAt:Date.now()});
    hideLoad();
    ['f_nama','f_lokasi','f_mdpl','f_tgl','f_pohon'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('zonaP').style.display='none';
    fS.varietas='Arabika';fS.pupuk='Organik';fS.cuaca='Kemarau';
    document.querySelectorAll('.to[data-f]').forEach(o=>{if(!o.dataset.f.startsWith('e_'))o.classList.toggle('selected',o.dataset.v===fS[o.dataset.f]);});
    toast('✅ Blok "'+nama+'" ditambahkan! Kode: '+kode);
    switchTab('kebun');
  }catch(e){hideLoad();toast('❌ '+e.message);}
}

// ═══════════════════════════════════════════════
// HAPUS & EDIT
// ═══════════════════════════════════════════════
async function hapusBlok(id){
  if(!confirm('Hapus blok ini?'))return;
  showLoad('Menghapus...');
  try{
    await db.ref('bloks/'+id).remove();
    if(selBlokId===id)selBlokId=bloks[0]?.id||null;
    if(selStatusId===id)selStatusId=bloks[0]?.id||null;
    hideLoad();toast('🗑️ Blok berhasil dihapus.');
  }catch(e){hideLoad();toast('❌ '+e.message);}
}
function openEdit(id){
  const b=bloks.find(x=>x.id===id);if(!b)return;
  document.getElementById('e_id').value=b.id;
  document.getElementById('e_nama').value=b.nama;
  document.getElementById('e_lokasi').value=b.lokasi;
  document.getElementById('e_mdpl').value=b.mdpl;
  document.getElementById('e_tgl').value=b.tanggal;
  document.getElementById('e_pohon').value=b.pohon;
  eS.e_varietas=b.varietas;eS.e_pupuk=b.pupuk;eS.e_cuaca=b.cuaca;
  ['e_varietas','e_pupuk','e_cuaca'].forEach(f=>{
    document.querySelectorAll('.to[data-f="'+f+'"]').forEach(o=>o.classList.toggle('selected',o.dataset.v===eS[f]));
  });
  prevZona(b.mdpl,'zonaPE');
  document.getElementById('editModal').classList.add('open');
  document.body.style.overflow='hidden';
}
function closeEdit(){document.getElementById('editModal').classList.remove('open');document.body.style.overflow='';}
async function simpanEdit(){
  const id=document.getElementById('e_id').value;
  const nama=document.getElementById('e_nama').value.trim();
  const lokasi=document.getElementById('e_lokasi').value.trim();
  const mdpl=document.getElementById('e_mdpl').value;
  const tgl=document.getElementById('e_tgl').value;
  const pohon=document.getElementById('e_pohon').value;
  if(!nama||!lokasi||!mdpl||!tgl||!pohon){toast('⚠️ Harap isi semua kolom!');return;}
  showLoad('Menyimpan...');
  try{
    await db.ref('bloks/'+id).update({nama,lokasi,mdpl,varietas:eS.e_varietas,pupuk:eS.e_pupuk,cuaca:eS.e_cuaca,tanggal:tgl,pohon});
    hideLoad();closeEdit();toast('✅ Blok diperbarui!');
  }catch(e){hideLoad();toast('❌ '+e.message);}
}

// Init
document.getElementById('f_tgl').value=new Date().toISOString().split('T')[0];