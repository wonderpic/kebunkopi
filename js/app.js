// ═══════════════════════════════════════════════════════
// KOPIPLANPRO — app.js
// ═══════════════════════════════════════════════════════

// ── FIREBASE ──────────────────────────────────────────
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

// ── ASSETS ────────────────────────────────────────────
const LOGO_SRC = './assets/logo.png';
document.querySelectorAll('#logoSplash,#logoOwner').forEach(img => img.src = LOGO_SRC);

// ── STATE ─────────────────────────────────────────────
let bloks = [], doneMap = {}, currentUser = null, currentRole = null;
let farmerBlok = null, curFilter = 'semua', farmerFilter = 'semua';
let selBlokId = null, selStatusId = null;
let pendingDoneKey = null, pendingDoneOwnerId = null;
let weatherCache = {}; // {lat_lon: {data, timestamp}}
let farmerCoverUrl = null;
const fS = { varietas:'Arabika', pupuk:'Organik', cuaca:'Kemarau' };
const eS = { e_varietas:'Arabika', e_pupuk:'Organik', e_cuaca:'Kemarau' };

// ── UTILS ─────────────────────────────────────────────
function getZona(m){ m=parseInt(m); return m<700?'rendah':m<=1200?'menengah':'tinggi'; }
function getZL(z){
  if(z==='rendah')   return{icon:'🏔️',label:'Zona Rendah <700 mdpl',cls:'zr'};
  if(z==='menengah') return{icon:'🌿',label:'Zona Menengah 700–1.200 mdpl',cls:'zm'};
  return{icon:'❄️',label:'Zona Tinggi >1.200 mdpl',cls:'zt'};
}
function safeKey(s){ return s.replace(/[.#$\[\]|\/]/g,'_'); }
function addDays(ds,d){ const x=new Date(ds); x.setDate(x.getDate()+d); return x; }
function fmtDate(d){ return d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}); }
function fmtShort(d){ return d.toLocaleDateString('id-ID',{day:'2-digit',month:'short'}); }
function relDay(d){
  const t=new Date(); t.setHours(0,0,0,0);
  const diff=Math.round((d-t)/86400000);
  if(diff<0)return Math.abs(diff)+' hari lalu';
  if(diff===0)return 'Hari ini!'; if(diff===1)return 'Besok';
  return diff+' hari lagi';
}
function genKode(){ return Math.random().toString(36).substring(2,8).toUpperCase(); }
function showLoad(txt){
  document.getElementById('loadingOverlay').style.display='flex';
  document.getElementById('loadingText').textContent=txt||'Memuat...';
}
function hideLoad(){ document.getElementById('loadingOverlay').style.display='none'; }
function toast(msg){
  const t=document.getElementById('toast'); t.textContent=msg;
  t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2600);
}
function prevZona(v,id){
  const el=document.getElementById(id); if(!v){el.style.display='none';return;}
  const zl=getZL(getZona(v)); el.style.display='block';
  el.className='o-zprev '+zl.cls; el.textContent=zl.icon+' '+zl.label;
}

// ── WEATHER API ───────────────────────────────────────
// Open-Meteo: free, no API key, CORS enabled for browsers
// Geocoding: convert city name → lat/lon

const WMO_CODES = {
  0:'☀️ Cerah', 1:'🌤️ Sebagian Berawan', 2:'⛅ Berawan', 3:'☁️ Mendung',
  45:'🌫️ Berkabut', 48:'🌫️ Embun Beku',
  51:'🌦️ Gerimis Ringan', 53:'🌦️ Gerimis', 55:'🌧️ Gerimis Deras',
  61:'🌧️ Hujan Ringan', 63:'🌧️ Hujan Sedang', 65:'🌧️ Hujan Deras',
  71:'❄️ Salju Ringan', 80:'🌧️ Hujan Lokal', 81:'⛈️ Hujan Lebat', 82:'⛈️ Hujan Sangat Lebat',
  95:'⛈️ Badai Petir', 96:'⛈️ Badai+Hujan Es', 99:'⛈️ Badai Besar'
};

async function getCityCoords(cityName){
  try{
    const url=`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=id&format=json`;
    const res=await fetch(url);
    const data=await res.json();
    if(data.results&&data.results.length>0){
      return{lat:data.results[0].latitude, lon:data.results[0].longitude, name:data.results[0].name};
    }
  }catch(e){}
  return null;
}

async function getWeather(lat, lon){
  const key=`${lat.toFixed(2)}_${lon.toFixed(2)}`;
  const now=Date.now();
  // Cache for 1 hour
  if(weatherCache[key]&&now-weatherCache[key].timestamp<3600000){
    return weatherCache[key].data;
  }
  try{
    const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,uv_index&daily=precipitation_sum,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FJakarta&forecast_days=7`;
    const res=await fetch(url);
    const data=await res.json();
    const result={
      temp: Math.round(data.current.temperature_2m),
      humidity: data.current.relative_humidity_2m,
      precip: data.current.precipitation,
      code: data.current.weather_code,
      wind: data.current.wind_speed_10m,
      uv: data.current.uv_index,
      daily: {
        precipSum: data.daily.precipitation_sum,
        tempMax: data.daily.temperature_2m_max,
        tempMin: data.daily.temperature_2m_min,
        precipProb: data.daily.precipitation_probability_max
      },
      label: WMO_CODES[data.current.weather_code]||'🌡️ Data cuaca'
    };
    weatherCache[key]={data:result, timestamp:now};
    return result;
  }catch(e){ return null; }
}

function getWeatherRecommendations(weather, blok){
  if(!weather) return [];
  const recs=[];
  const mdpl=parseInt(blok.mdpl);
  const zona=getZona(mdpl);
  const precip=weather.precip||0;
  const precipNext3=weather.daily.precipSum.slice(0,3).reduce((a,b)=>a+(b||0),0);
  const humidity=weather.humidity||0;
  const temp=weather.temp||0;
  const isRaining=precip>2||precipNext3>10;
  const isDry=precipNext3<2&&temp>30;

  if(isRaining){
    recs.push({icon:'🌊',text:'Cuaca hujan — periksa saluran drainase hari ini',type:'warning'});
    recs.push({icon:'🌾',text:'Segera lakukan penyiangan gulma selagi tanah lembab',type:'action'});
    if(precip>10) recs.push({icon:'⚠️',text:'Hujan deras — tunda pemupukan minimal 2 hari',type:'danger'});
  }
  if(isDry){
    const siramInterval=zona==='rendah'?2:zona==='menengah'?3:5;
    recs.push({icon:'💧',text:`Kemarau panas — siram tiap ${siramInterval} hari, pagi sebelum jam 9`,type:'action'});
    if(temp>33) recs.push({icon:'🌡️',text:'Suhu tinggi — mulch untuk jaga kelembaban tanah',type:'warning'});
  }
  if(humidity>85){
    recs.push({icon:'🍂',text:'Kelembaban tinggi — waspada karat daun pada Arabika',type:'danger'});
  }
  if(weather.uv>8){
    recs.push({icon:'☀️',text:'UV tinggi — siram pagi hari untuk kurangi evaporasi',type:'info'});
  }
  // Wind
  if(weather.wind>30){
    recs.push({icon:'💨',text:'Angin kencang — tunda penyemprotan pupuk cair',type:'warning'});
  }
  return recs;
}

function renderWeatherBar(weather, blok, containerId){
  const el=document.getElementById(containerId);
  if(!el) return;
  if(!weather){
    el.innerHTML='<span class="weather-loading">⏳ Memuat data cuaca...</span>';
    return;
  }
  const recs=getWeatherRecommendations(weather,blok);
  const alertCount=recs.filter(r=>r.type==='danger'||r.type==='warning').length;
  el.innerHTML=`
    <span class="weather-icon">${weather.label.split(' ')[0]}</span>
    <div class="weather-info">
      <div class="weather-main">${weather.temp}°C · ${weather.label.split(' ').slice(1).join(' ')}</div>
      <div class="weather-detail">💧 ${weather.humidity}% · 🌬️ ${weather.wind} km/h · 🌧️ ${weather.precip}mm</div>
    </div>
    ${alertCount>0?`<span class="weather-alert">⚠️ ${alertCount} peringatan</span>`:'<span class="weather-alert" style="background:rgba(74,222,128,0.1);border-color:rgba(74,222,128,0.25);color:var(--owner-green);">✓ Kondisi baik</span>'}
  `;
}

async function loadWeatherForBlok(blok, barId, recId){
  const el=document.getElementById(barId);
  const recEl=document.getElementById(recId);
  if(!el) return;
  el.innerHTML='<span class="weather-loading">📡 Memuat cuaca '+blok.lokasi+'...</span>';

  const coords=await getCityCoords(blok.lokasi);
  if(!coords){
    el.innerHTML='<span class="weather-loading">📍 Lokasi tidak ditemukan</span>';
    return;
  }
  // Store coords in blok for future use
  blok._lat=coords.lat; blok._lon=coords.lon;

  const weather=await getWeather(coords.lat, coords.lon);
  renderWeatherBar(weather, blok, barId);

  // Render recommendations
  if(recEl&&weather){
    const recs=getWeatherRecommendations(weather,blok);
    if(recs.length===0){
      recEl.innerHTML='';
      return;
    }
    const colorMap={danger:'var(--owner-red)',warning:'var(--owner-amber)',action:'var(--owner-green)',info:'var(--owner-blue)'};
    recEl.innerHTML=`
      <div class="weather-rec-strip">
        <div class="weather-rec-title">🌤️ Rekomendasi Cuaca Hari Ini</div>
        ${recs.map(r=>`<div class="weather-rec-item">
          <span style="color:${colorMap[r.type]};flex-shrink:0">${r.icon}</span>
          <span>${r.text}</span>
        </div>`).join('')}
      </div>`;
  }
}

// ── EVENT LISTENERS ───────────────────────────────────
document.getElementById('btnOwner').addEventListener('click', loginOwner);
document.getElementById('btnFarmer').addEventListener('click', showKodeScreen);
document.getElementById('btnKodeBack').addEventListener('click', showModeSelector);
document.getElementById('btnMasukKode').addEventListener('click', masukKode);
document.getElementById('btnLogout').addEventListener('click', doLogout);
document.getElementById('btnFarmerLogout').addEventListener('click', doLogout);
document.getElementById('btnTambah').addEventListener('click', tambahBlok);
document.getElementById('btnSimpanEdit').addEventListener('click', simpanEdit);
document.getElementById('btnBatalEdit').addEventListener('click', closeEdit);
document.getElementById('editModal').addEventListener('click', e=>{ if(e.target===document.getElementById('editModal'))closeEdit(); });
document.getElementById('fotoModalClose').addEventListener('click', ()=>document.getElementById('fotoModalOv').classList.remove('open'));
document.getElementById('fotoPromptOv').addEventListener('click', e=>{ if(e.target===document.getElementById('fotoPromptOv'))document.getElementById('fotoPromptOv').classList.remove('open'); });
document.getElementById('btnCancelDone').addEventListener('click', ()=>document.getElementById('fotoPromptOv').classList.remove('open'));
document.getElementById('btnDoneOnly').addEventListener('click', farmerConfirmDoneOnly);
document.getElementById('btnDoneWithFoto').addEventListener('click', farmerConfirmDoneWithFoto);
document.getElementById('btnCloseCover').addEventListener('click', ()=>document.getElementById('coverModal').classList.remove('open'));
document.getElementById('btnShareCover').addEventListener('click', shareCover);
document.getElementById('btnFarmerUploadCover').addEventListener('click', ()=>document.getElementById('farmerCoverInput').click());
document.getElementById('farmerCoverInput').addEventListener('change', handleFarmerCoverUpload);

// Nav
document.querySelectorAll('.onb').forEach(btn=>{
  btn.addEventListener('click', ()=>switchTab(btn.dataset.tab));
});
// Owner filter
document.querySelectorAll('#tab-jadwal .o-fc').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    curFilter=btn.dataset.filter;
    document.querySelectorAll('#tab-jadwal .o-fc').forEach(c=>c.classList.remove('active'));
    btn.classList.add('active'); renderJadwal();
  });
});
// Farmer filter
document.querySelectorAll('#farmerFilt .f-fc').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    farmerFilter=btn.dataset.filter;
    document.querySelectorAll('#farmerFilt .f-fc').forEach(c=>c.classList.remove('active'));
    btn.classList.add('active'); renderFarmerJadwal();
  });
});
// Form toggles
document.querySelectorAll('.o-to').forEach(el=>{
  el.addEventListener('click', ()=>{
    const f=el.dataset.f, v=el.dataset.v;
    if(f.startsWith('e_')) eS[f]=v; else fS[f]=v;
    document.querySelectorAll('.o-to[data-f="'+f+'"]').forEach(o=>o.classList.remove('selected'));
    el.classList.add('selected');
  });
});
document.getElementById('f_mdpl').addEventListener('input', function(){ prevZona(this.value,'zonaP'); });
document.getElementById('e_mdpl').addEventListener('input', function(){ prevZona(this.value,'zonaPE'); });

// ── AUTH ──────────────────────────────────────────────
function loginOwner(){
  showLoad('Mengarahkan ke Google...');
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithRedirect(provider).catch(e=>{
    hideLoad();
    console.error('Redirect error:', e.code, e.message);
    toast('❌ '+e.message);
  });
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
  if(kode.length<4){ toast('Kode minimal 4 karakter'); return; }
  showLoad('Mencari kebun...');
  try{
    const snap=await db.ref('bloks').orderByChild('kode').equalTo(kode).once('value');
    if(!snap.exists()){ hideLoad(); document.getElementById('kodeError').style.display='block'; return; }
    const entries=snap.val(), blokId=Object.keys(entries)[0];
    const blok=entries[blokId]; blok.id=blokId;
    localStorage.setItem('farmer_blok_id',blokId);
    localStorage.setItem('farmer_kode',kode);
    hideLoad(); enterFarmerMode(blok);
  }catch(e){ hideLoad(); toast('❌ '+e.message); }
}
async function doLogout(){
  // Clear service worker cache to prevent stale state
  if('caches' in window){
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
  }
  if(currentRole==='owner'){
    await auth.signOut();
    location.href = location.href.split('?')[0]; // hard navigate
  } else {
    localStorage.removeItem('farmer_blok_id');
    localStorage.removeItem('farmer_kode');
    location.href = location.href.split('?')[0];
  }
}

// ── AUTH STATE ────────────────────────────────────────
let authResolved = false;

// Timeout fallback - max 8 seconds
setTimeout(()=>{
  if(!authResolved){
    authResolved = true;
    hideLoad();
    // Check farmer session
    const savedId=localStorage.getItem('farmer_blok_id');
    if(!savedId) document.getElementById('loginScreen').style.display='flex';
  }
}, 8000);

// Handle redirect result first (from signInWithRedirect)
auth.getRedirectResult().then(result=>{
  if(result && result.user){
    console.log('Redirect result: logged in as', result.user.email);
    // onAuthStateChanged will handle the rest
  }
}).catch(e=>{
  console.error('Redirect result error:', e.code, e.message);
  if(e.code && e.code !== 'auth/no-current-user'){
    hideLoad();
    toast('❌ Login gagal: '+e.message);
  }
});

auth.onAuthStateChanged(async user=>{
  console.log('onAuthStateChanged fired, user:', user ? user.email : 'null');

  // Always reset all views first
  document.getElementById('ownerApp').style.display='none';
  document.getElementById('farmerApp').style.display='none';

  if(user){
    // Owner logged in
    authResolved = true;
    currentUser=user; currentRole='owner';
    document.getElementById('loginScreen').style.display='none';
    document.getElementById('ownerName').textContent=user.displayName||user.email;
    if(user.photoURL){
      document.getElementById('ownerAvatar').innerHTML='<img src="'+user.photoURL+'" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
    } else {
      document.getElementById('ownerAvatar').textContent=(user.displayName||'U')[0].toUpperCase();
    }
    hideLoad();
    listenBloks();
    return;
  }

  // No logged in user — check farmer session
  const savedId=localStorage.getItem('farmer_blok_id');
  const savedKode=localStorage.getItem('farmer_kode');

  if(savedId && savedKode){
    showLoad('Memuat kebun...');
    try{
      const snap=await db.ref('bloks/'+savedId).once('value');
      if(snap.exists()){
        const b=snap.val(); b.id=savedId;
        authResolved=true; hideLoad(); enterFarmerMode(b); return;
      }
    }catch(e){ console.log('Farmer load error:', e); }
    localStorage.removeItem('farmer_blok_id');
    localStorage.removeItem('farmer_kode');
  }

  // Show login screen
  authResolved = true;
  hideLoad();
  document.getElementById('loginScreen').style.display='flex';
  document.getElementById('ownerApp').style.display='none';
  document.getElementById('farmerApp').style.display='none';
});

// ── FIREBASE LISTENERS ────────────────────────────────
function listenBloks(){
  db.ref('bloks').orderByChild('ownerId').equalTo(currentUser.uid).on('value',snap=>{
    bloks=[];
    if(snap.exists()) snap.forEach(c=>{ const b=c.val(); b.id=c.key; bloks.push(b); });
    listenDone();
    const tab=document.querySelector('.onb.active')?.dataset.tab||'kebun';
    if(tab==='kebun') renderKebun();
    else if(tab==='jadwal'){ buildPicker(); renderJadwal(); }
    else if(tab==='status'){ buildStatusPicker(); renderStatus(); }
    else renderKebun();
  });
}
function listenDone(){
  db.ref('done/'+currentUser.uid).on('value',snap=>{
    doneMap=snap.exists()?snap.val():{};
    const tab=document.querySelector('.onb.active')?.dataset.tab||'';
    if(tab==='jadwal') renderJadwal();
    else if(tab==='status') renderStatus();
    if(currentRole==='farmer') renderFarmerJadwal();
  });
}

// ── FARMER MODE ───────────────────────────────────────
function enterFarmerMode(blok){
  currentRole='farmer'; farmerBlok=blok;
  document.getElementById('loginScreen').style.display='none';
  document.getElementById('ownerApp').style.display='none';
  document.getElementById('farmerApp').style.cssText='display:flex;flex-direction:column;';
  document.getElementById('farmerKebunName').textContent=blok.nama;
  document.getElementById('farmerKebunLoc').textContent='📍 '+blok.lokasi+' · ⛰️ '+parseInt(blok.mdpl).toLocaleString('id-ID')+' mdpl';
  // Load cover photo
  loadFarmerCover(blok);
  const today=new Date();
  document.getElementById('farmerTodayDate').textContent=today.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  if(blok.ownerId){
    db.ref('done/'+blok.ownerId).on('value',snap=>{
      doneMap=snap.exists()?snap.val():{};
      renderFarmerJadwal();
    });
    // Load weather for farmer
    loadWeatherForFarmer(blok);
  }
  renderFarmerJadwal();
}

async function loadFarmerCover(blok){
  const imgEl=document.getElementById('farmerCoverImg');
  try{
    const snap=await db.ref('covers/'+blok.id).once('value');
    if(snap.exists()){
      imgEl.src=snap.val().data;
      imgEl.onload=()=>imgEl.classList.add('loaded');
      farmerCoverUrl=snap.val().data;
    }
  }catch(e){}
}

async function handleFarmerCoverUpload(e){
  const file=e.target.files[0]; if(!file||!farmerBlok) return;
  showLoad('Mengompress foto cover...');
  try{
    const compressed=await compressImage(file,800,600,0.75);
    await db.ref('covers/'+farmerBlok.id).set({data:compressed,updatedAt:Date.now()});
    const imgEl=document.getElementById('farmerCoverImg');
    imgEl.src=compressed; imgEl.classList.add('loaded');
    farmerCoverUrl=compressed;
    hideLoad(); toast('✅ Foto cover berhasil diperbarui!');
  }catch(err){ hideLoad(); toast('❌ '+err.message); }
}

async function loadWeatherForFarmer(blok){
  const wEl=document.getElementById('farmerWeatherCard');
  if(!wEl) return;
  const coords=await getCityCoords(blok.lokasi);
  if(!coords){ wEl.style.display='none'; return; }
  const weather=await getWeather(coords.lat, coords.lon);
  if(!weather){ wEl.style.display='none'; return; }
  const recs=getWeatherRecommendations(weather,blok);
  document.getElementById('farmerWeatherIcon').textContent=weather.label.split(' ')[0];
  document.getElementById('farmerWeatherMain').textContent=weather.temp+'°C · '+weather.label.split(' ').slice(1).join(' ');
  document.getElementById('farmerWeatherDetail').textContent='💧 '+weather.humidity+'% · 🌧️ '+weather.precip+'mm hari ini';
  const recEl=document.getElementById('farmerWeatherRec');
  if(recs.length>0){
    recEl.textContent=recs[0].icon+' '+recs[0].text;
    recEl.style.display='inline-block';
  } else {
    recEl.textContent='✓ Kondisi kebun baik hari ini';
    recEl.style.display='inline-block';
  }
}

function renderFarmerJadwal(){
  if(!farmerBlok) return;
  const tasks=generateTasks(farmerBlok);
  tasks.sort((a,b)=>a.targetDate-b.targetDate);
  const today=new Date(); today.setHours(0,0,0,0);
  const urgent=tasks.filter(t=>{ const d=Math.round((t.targetDate-today)/86400000); return(d>=0&&d<=3)||d<0; }).filter(t=>!t.done);
  const countEl=document.getElementById('farmerTodayCount');
  countEl.textContent=urgent.length>0?'⚠️ '+urgent.length+' tugas perlu dikerjakan':'✅ Semua tugas terkini sudah dikerjakan';
  countEl.style.color=urgent.length>0?'var(--farmer-amber)':'var(--farmer-green)';
  const filtered=farmerFilter==='semua'?tasks:tasks.filter(t=>t.type===farmerFilter);
  if(!filtered.length){
    document.getElementById('farmerJadwal').innerHTML='<div class="empty f-empty"><div class="ei">✅</div><p>Tidak ada tugas untuk filter ini.</p></div>';
    return;
  }
  document.getElementById('farmerJadwal').innerHTML=filtered.map(t=>{
    const od=t.targetDate<today&&!t.done;
    const diff=Math.round((t.targetDate-today)/86400000);
    const isUrgent=od||(diff>=0&&diff<=1);
    const isWarn=!isUrgent&&diff>=0&&diff<=3;
    return `<div class="f-si ftp-${t.type}${t.done?' done':''}${isUrgent&&!t.done?' urgent':''}${isWarn&&!t.done?' urgent-orange':''}">
      <button class="f-check${t.done?' checked':''}" data-key="${t.key}" data-owner="${farmerBlok.ownerId||''}" type="button">${t.done?'✓':''}</button>
      <div class="f-sic">${t.icon}</div>
      <div class="f-sb" id="fsb_${safeKey(t.key)}">
        <div class="f-st">${t.task}</div>
        <div class="f-sbl">ℹ️ ${t.znote}</div>
        ${t.done?'<div class="f-done-stamp">✅ Sudah dikerjakan</div>':''}
      </div>
      <div class="f-sd">
        <div class="f-sd-main${od?' f-overdue':''}">${fmtDate(t.targetDate)}</div>
        <div class="f-sd-rel${od?' f-overdue':''}">${relDay(t.targetDate)}</div>
      </div>
    </div>`;
  }).join('');
  // Bind check buttons
  document.querySelectorAll('#farmerJadwal .f-check').forEach(btn=>{
    btn.addEventListener('click',()=>farmerTapDone(btn.dataset.key,btn.dataset.owner));
  });
  // Load foto async
  if(farmerBlok.ownerId){
    filtered.forEach(t=>{
      const c=document.getElementById('fsb_'+safeKey(t.key));
      if(c) renderFotoBtn(t.key,farmerBlok.ownerId,c,t.done,'f-');
    });
  }
}

function farmerTapDone(key,ownerId){
  if(!key||!ownerId) return;
  const sk=safeKey(key);
  if(doneMap[sk]||doneMap[key]){
    db.ref('done/'+ownerId+'/'+sk).remove();
    db.ref('foto/'+ownerId+'/'+sk).remove();
    toast('↩️ Ditandai belum dikerjakan');
  } else {
    pendingDoneKey=key; pendingDoneOwnerId=ownerId;
    document.getElementById('fotoPromptOv').classList.add('open');
  }
}
async function farmerConfirmDoneOnly(){
  document.getElementById('fotoPromptOv').classList.remove('open');
  if(!pendingDoneKey||!pendingDoneOwnerId) return;
  await db.ref('done/'+pendingDoneOwnerId+'/'+safeKey(pendingDoneKey)).set(true);
  toast('✅ Tugas ditandai selesai!');
  pendingDoneKey=null; pendingDoneOwnerId=null;
}
async function farmerConfirmDoneWithFoto(){
  document.getElementById('fotoPromptOv').classList.remove('open');
  if(!pendingDoneKey||!pendingDoneOwnerId) return;
  const key=pendingDoneKey, ownerId=pendingDoneOwnerId;
  pendingDoneKey=null; pendingDoneOwnerId=null;
  await db.ref('done/'+ownerId+'/'+safeKey(key)).set(true);
  const input=document.createElement('input');
  input.type='file'; input.accept='image/*'; input.capture='environment';
  input.onchange=async(e)=>{
    const file=e.target.files[0]; if(!file) return;
    showLoad('Mengunggah foto...');
    try{
      await uploadFoto(key,ownerId,file,pct=>{ document.getElementById('loadingText').textContent='Mengunggah foto... '+pct+'%'; });
      hideLoad(); toast('📸 Foto bukti berhasil diunggah!');
      renderFarmerJadwal();
    }catch(err){ hideLoad(); toast('❌ '+err.message); }
  };
  input.click();
  toast('✅ Tugas ditandai selesai!');
}

// ── COVER PAGE ────────────────────────────────────────
function openCoverModal(blok){
  const modal=document.getElementById('coverModal');
  const tasks=generateTasks(blok);
  const done=tasks.filter(t=>t.done).length;
  const total=tasks.length;
  const pct=total?Math.round(done/total*100):0;
  const zona=getZona(blok.mdpl), z=getZL(zona);
  const today=new Date(); today.setHours(0,0,0,0);
  const overdue=tasks.filter(t=>t.targetDate<today&&!t.done).length;
  // Achievement badges
  const badges=[];
  if(pct>=90) badges.push('🏆 Kebun Bintang');
  else if(pct>=70) badges.push('⭐ Perawatan Aktif');
  else if(pct>=50) badges.push('🌱 Berkembang');
  if(overdue===0) badges.push('✅ Zero Terlambat');
  if(parseInt(blok.pohon)>=500) badges.push('🌳 Kebun Besar');
  badges.push(z.icon+' '+z.label.split(' ').slice(0,2).join(' '));
  // Ring
  const R=28,CX=34,CY=34,C=2*Math.PI*R;
  const filled=C*(pct/100);
  const ringColor=pct>=75?'#4ade80':pct>=50?'#fbbf24':'#f87171';
  // Cover photo
  const coverData=document.getElementById('farmerCoverImg').src||'';
  const hasCover=coverData&&coverData.length>100&&!coverData.includes('assets/');
  document.getElementById('coverCardPhoto').innerHTML=
    hasCover?`<img src="${coverData}" style="width:100%;height:100%;object-fit:cover;display:block;">`
    :`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;">
      <div style="font-size:40px;">☕</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.5);">Tap 📷 untuk tambah foto</div>
    </div>`;
  document.getElementById('coverCardName').textContent=blok.nama;
  document.getElementById('coverCardSub').textContent='📍 '+blok.lokasi+' · ⛰️ '+parseInt(blok.mdpl).toLocaleString('id-ID')+' mdpl';
  document.getElementById('coverStatsRow').innerHTML=
    `<div class="cover-stat"><div class="cover-stat-num">${parseInt(blok.pohon).toLocaleString('id-ID')}</div><div class="cover-stat-lbl">Pohon</div></div>`+
    `<div class="cover-stat"><div class="cover-stat-num">${done}</div><div class="cover-stat-lbl">Selesai</div></div>`+
    `<div class="cover-stat"><div class="cover-stat-num">${overdue===0?'✓':overdue}</div><div class="cover-stat-lbl">${overdue===0?'Tepat Waktu':'Terlambat'}</div></div>`;
  document.getElementById('coverProgressRing').innerHTML=
    `<svg width="68" height="68" viewBox="0 0 68 68">
      <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="6"/>
      <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${ringColor}" stroke-width="6"
        stroke-dasharray="${filled} ${C}" stroke-dashoffset="${C*0.25}" stroke-linecap="round"/>
      <text x="${CX}" y="${CY+5}" text-anchor="middle" font-size="14" font-weight="700" fill="${ringColor}">${pct}%</text>
    </svg>`;
  document.getElementById('coverProgressLabel').textContent='Progress Perawatan Kebun';
  document.getElementById('coverProgressPct').textContent=pct+'% Tugas Selesai';
  document.getElementById('coverBadges').innerHTML=badges.slice(0,4).map(b=>`<span class="cover-badge">${b}</span>`).join('');
  // Upload cover btn
  document.getElementById('coverUploadBtn').onclick=()=>{
    const inp=document.createElement('input');
    inp.type='file'; inp.accept='image/*';
    inp.onchange=async(e)=>{
      const file=e.target.files[0]; if(!file) return;
      showLoad('Memproses foto...');
      try{
        const compressed=await compressImage(file,800,600,0.78);
        await db.ref('covers/'+blok.id).set({data:compressed,updatedAt:Date.now()});
        // Update preview
        document.getElementById('coverCardPhoto').innerHTML=`<img src="${compressed}" style="width:100%;height:100%;object-fit:cover;display:block;">`;
        document.getElementById('farmerCoverImg').src=compressed;
        document.getElementById('farmerCoverImg').classList.add('loaded');
        farmerCoverUrl=compressed;
        hideLoad(); toast('✅ Foto cover diperbarui!');
      }catch(err){ hideLoad(); toast('❌ '+err.message); }
    };
    inp.click();
  };
  modal.classList.add('open');
}

function shareCover(){
  // Use Web Share API if available, otherwise instruct screenshot
  const shareData={
    title: 'Kebun Kopi Saya — KopiPlanPro',
    text: 'Pantau kebun kopi saya di Talaga Hangsa KopiPlanPro! 🌿☕',
    url: window.location.href
  };
  if(navigator.share){
    navigator.share(shareData).catch(()=>{});
  } else {
    toast('📸 Screenshot halaman ini untuk dishare ke medsos!');
  }
}

// ── GENERATE TASKS ────────────────────────────────────
function generateTasks(blok){
  const tasks=[], zona=getZona(blok.mdpl);
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
  const dp=[]; for(let d=60;d<=1825;d+=ip)dp.push(d);
  add(lp,dp,'pupuk',blok.pupuk==='Organik'?'🍃':'⚗️',zp);
  if(blok.varietas==='Arabika'){
    add('Pangkas Pembentukan Arabika',[365,540],'pangkas','✂️','Umur 1–2 thn');
    const hp=zona==='rendah'?900:zona==='menengah'?1095:1460;
    add('Pangkas Produksi',[hp+365,hp+730],'pangkas','✂️','Setelah panen pertama');
    add('Panen Perdana Arabika',[hp],'panen','☕',zona==='rendah'?'Panen ~2,5 thn':zona==='menengah'?'Panen ~3 thn':'Panen ~4 thn');
    add('Panen Arabika Berikutnya',[hp+365],'panen','☕','Panen tahunan');
  } else {
    add('Wiwilan Perdana Robusta',[180],'wiwilan','🌿','Bulan ke-6');
    add('Wiwilan Robusta Tahunan',[545,910],'wiwilan','🌿','Tahunan');
    const hr=zona==='rendah'?750:zona==='menengah'?900:1095;
    add('Panen Perdana Robusta',[hr],'panen','☕',zona==='rendah'?'Panen ~2 thn':zona==='menengah'?'Panen ~2,5 thn':'Panen ~3 thn');
    add('Panen Robusta Berikutnya',[hr+365],'panen','☕','Panen tahunan');
  }
  if(blok.cuaca==='Kemarau'){
    const is=zona==='rendah'?2:zona==='menengah'?3:5;
    const ds=[]; for(let d=is;d<=30;d+=is)ds.push(d);
    add('Penyiraman Rutin',ds,'siram','💧',`Tiap ${is} hr`);
  } else {
    add('Periksa Saluran Drainase',[7,14,21,28],'drainase','🌊','Tiap 7 hr');
  }
  add('Penyiangan Gulma',[14,28,42,56,70,84],'gulma','🌾','Tiap 14 hr');
  return tasks;
}

// ── OWNER: TOGGLE DONE ────────────────────────────────
async function toggleDone(key){
  if(!currentUser) return;
  const sk=safeKey(key);
  const ref=db.ref('done/'+currentUser.uid+'/'+sk);
  if(doneMap[sk]||doneMap[key]) await ref.remove();
  else await ref.set(true);
}

// ── OWNER NAV ─────────────────────────────────────────
function switchTab(tab){
  document.querySelectorAll('.otp').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.onb').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');
  document.querySelector('.onb[data-tab="'+tab+'"]').classList.add('active');
  if(tab==='kebun') renderKebun();
  else if(tab==='jadwal'){ buildPicker(); renderJadwal(); }
  else if(tab==='status'){ buildStatusPicker(); renderStatus(); }
}

// ── RENDER KEBUN ──────────────────────────────────────
function getAlerts(blok){
  const al=[], m=parseInt(blok.mdpl), zona=getZona(m), z=getZL(zona);
  if(blok.varietas==='Arabika'&&m<1000) al.push({t:'w',msg:'⚠️ Arabika <1.000 mdpl: risiko karat daun. (Puslitkoka 2010)'});
  if(blok.varietas==='Robusta'&&m>900)  al.push({t:'w',msg:'⚠️ Robusta >900 mdpl: di luar zona optimal. (BBPP Lembang)'});
  const hp=blok.varietas==='Arabika'?(zona==='rendah'?'~2,5 thn':zona==='menengah'?'~3 thn':'~4 thn'):(zona==='rendah'?'~2 thn':zona==='menengah'?'~2,5 thn':'~3 thn');
  const ip=zona==='rendah'?150:zona==='menengah'?180:210;
  al.push({t:'i',msg:z.icon+' '+z.label+' | Pupuk tiap '+ip+' hr | Panen '+hp});
  return al;
}

function renderKebun(){
  if(!bloks.length){
    document.getElementById('statsBar').innerHTML='<div class="o-sc"><div class="o-sn">0</div><div class="o-sl">Blok</div></div>'.repeat(4);
    document.getElementById('pohonBreakdown').innerHTML='';
    document.getElementById('kebunList').innerHTML='<div class="empty o-empty"><div class="ei">🌱</div><p>Belum ada blok kebun.<br>Tambahkan melalui tab <strong>Tambah Blok</strong>.</p></div>';
    return;
  }
  const ara=bloks.filter(b=>b.varietas==='Arabika').length;
  const rob=bloks.filter(b=>b.varietas==='Robusta').length;
  const phn=bloks.reduce((s,b)=>s+parseInt(b.pohon||0),0);
  document.getElementById('statsBar').innerHTML=
    `<div class="o-sc"><div class="o-sn">${bloks.length}</div><div class="o-sl">Blok</div></div>`+
    `<div class="o-sc"><div class="o-sn">${ara}</div><div class="o-sl">Arabika</div></div>`+
    `<div class="o-sc"><div class="o-sn">${rob}</div><div class="o-sl">Robusta</div></div>`+
    `<div class="o-sc"><div class="o-sn">${phn.toLocaleString('id-ID')}</div><div class="o-sl">Pohon</div></div>`;
  // Pohon breakdown
  const lMap={};
  bloks.forEach(b=>{ if(!lMap[b.lokasi])lMap[b.lokasi]={a:0,r:0}; if(b.varietas==='Arabika')lMap[b.lokasi].a+=parseInt(b.pohon||0); else lMap[b.lokasi].r+=parseInt(b.pohon||0); });
  let pb='<div style="font-size:9px;font-weight:600;color:var(--owner-text3);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:7px;">🌱 Pohon per Lokasi</div><div class="pohon-grid">';
  Object.keys(lMap).forEach(loc=>{const d=lMap[loc]; pb+=`<div class="pohon-card"><div class="pohon-loc">📍 ${loc}</div>${d.a?`<div class="pohon-row"><span style="color:#4ade80">🌿 Arabika</span><span class="pohon-num">${d.a.toLocaleString('id-ID')}</span></div>`:''} ${d.r?`<div class="pohon-row"><span style="color:#f87171">🌱 Robusta</span><span class="pohon-num">${d.r.toLocaleString('id-ID')}</span></div>`:''}<div style="border-top:1px solid var(--owner-border);margin-top:3px;padding-top:3px;"><div class="pohon-row"><span>Total</span><span class="pohon-num">${(d.a+d.r).toLocaleString('id-ID')}</span></div></div></div>`;});
  pb+='</div>';
  document.getElementById('pohonBreakdown').innerHTML=pb;
  const today=new Date(); today.setHours(0,0,0,0);
  document.getElementById('kebunList').innerHTML=bloks.map(blok=>{
    const al=getAlerts(blok), zona=getZona(blok.mdpl), z=getZL(zona);
    const tasks=generateTasks(blok);
    const done=tasks.filter(t=>t.done).length, total=tasks.length;
    const pct=total?Math.round(done/total*100):0;
    const overdue=tasks.filter(t=>t.targetDate<today&&!t.done).length;
    const col=pct>=75?'var(--owner-green)':pct>=40?'var(--owner-amber)':'var(--owner-red)';
    return `<div class="o-card">
      <div class="o-card-hdr">
        <div class="o-card-title">🏡 ${blok.nama}</div>
        <div class="o-cbtn">
          <button class="o-ebt" data-id="${blok.id}" type="button">✏️</button>
          <button class="o-dbt" data-id="${blok.id}" type="button">🗑️</button>
        </div>
      </div>
      <div class="zona-badge ${z.cls}">${z.icon} ${z.label}</div>
      <div id="wb_${blok.id}" style="margin-bottom:8px;display:flex;align-items:center;gap:10px;font-size:12px;color:var(--owner-text2);">
        <span class="weather-loading">📡 Memuat cuaca...</span>
      </div>
      <div id="wr_${blok.id}"></div>
      <div class="o-ci">
        <div class="o-ir"><span class="o-il">Lokasi</span><span class="o-iv">📍 ${blok.lokasi}</span></div>
        <div class="o-ir"><span class="o-il">Ketinggian</span><span class="o-iv">⛰️ ${parseInt(blok.mdpl).toLocaleString('id-ID')} mdpl</span></div>
        <div class="o-ir"><span class="o-il">Varietas</span><span class="o-badge b${blok.varietas.slice(0,1).toLowerCase()}">${blok.varietas}</span></div>
        <div class="o-ir"><span class="o-il">Pupuk</span><span class="o-badge b${blok.pupuk.slice(0,1).toLowerCase()}">${blok.pupuk}</span></div>
        <div class="o-ir"><span class="o-il">Cuaca</span><span class="o-badge b${blok.cuaca==='Kemarau'?'km':'h'}">${blok.cuaca}</span></div>
        <div class="o-ir"><span class="o-il">Tanam</span><span class="o-iv">${new Date(blok.tanggal).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})}</span></div>
        <div class="o-ir"><span class="o-il">Pohon</span><span class="o-iv">🌱 ${parseInt(blok.pohon).toLocaleString('id-ID')}</span></div>
        <div class="o-ir"><span class="o-il">Progress</span><span class="o-iv" style="color:${col}">${pct}% selesai</span></div>
      </div>
      ${overdue?`<div class="o-alert-r">⚠️ ${overdue} tugas terlambat di kebun ini</div>`:''}
      ${al.map(a=>`<div class="${a.t==='w'?'o-alert-w':'o-alert-i'}">${a.msg}</div>`).join('')}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
        <div class="kode-badge" data-kode="${blok.kode}">
          <span class="kode-badge-label">KODE PETANI</span>
          <span>${blok.kode}</span>
          <span style="font-size:9px;opacity:0.6;">📋</span>
        </div>
        <button class="cover-preview-btn" data-id="${blok.id}" type="button">🖼️ Cover Page</button>
      </div>
    </div>`;
  }).join('');
  // Bind buttons
  document.querySelectorAll('.o-ebt').forEach(btn=>btn.addEventListener('click',()=>openEdit(btn.dataset.id)));
  document.querySelectorAll('.o-dbt').forEach(btn=>btn.addEventListener('click',()=>hapusBlok(btn.dataset.id)));
  document.querySelectorAll('.kode-badge').forEach(btn=>btn.addEventListener('click',()=>{
    if(navigator.clipboard)navigator.clipboard.writeText(btn.dataset.kode);
    toast('📋 Kode "'+btn.dataset.kode+'" disalin!');
  }));
  document.querySelectorAll('.cover-preview-btn').forEach(btn=>btn.addEventListener('click',()=>{
    const blok=bloks.find(b=>b.id===btn.dataset.id);
    if(blok) openCoverModal(blok);
  }));
  // Load weather async per blok
  bloks.forEach(blok=>{
    loadWeatherForBlok(blok,'wb_'+blok.id,'wr_'+blok.id);
  });
}

// ── RENDER JADWAL (OWNER) ─────────────────────────────
function buildPicker(){
  const el=document.getElementById('kebunPicker');
  if(!bloks.length){ el.innerHTML='<div style="color:var(--owner-text3);font-size:12px;">Belum ada kebun.</div>'; return; }
  if(!selBlokId||!bloks.find(b=>b.id===selBlokId)) selBlokId=bloks[0].id;
  el.innerHTML=bloks.map(b=>`<button class="picker-chip${b.id===selBlokId?' active':''}" data-id="${b.id}" type="button">${b.nama}</button>`).join('');
  el.querySelectorAll('.picker-chip').forEach(btn=>btn.addEventListener('click',()=>{
    selBlokId=btn.dataset.id;
    el.querySelectorAll('.picker-chip').forEach(c=>c.classList.toggle('active',c.dataset.id===selBlokId));
    renderJadwal();
  }));
}
function renderJadwal(){
  if(!bloks.length){ document.getElementById('jadwalList').innerHTML='<div class="empty o-empty"><div class="ei">📅</div><p>Tambahkan blok kebun dulu.</p></div>'; return; }
  buildPicker();
  const blok=bloks.find(b=>b.id===selBlokId); if(!blok) return;
  // Load weather rec for this blok
  loadWeatherForBlok(blok,'jadwalWeatherBar','jadwalWeatherRec');
  let tasks=generateTasks(blok);
  tasks.sort((a,b)=>a.targetDate-b.targetDate);
  if(curFilter!=='semua') tasks=tasks.filter(t=>t.type===curFilter);
  if(!tasks.length){ document.getElementById('jadwalList').innerHTML='<div class="empty o-empty"><div class="ei">🔍</div><p>Tidak ada jadwal untuk filter ini.</p></div>'; return; }
  const today=new Date(); today.setHours(0,0,0,0);
  document.getElementById('jadwalList').innerHTML=tasks.map(t=>{
    const od=t.targetDate<today&&!t.done;
    return `<div class="o-si tp-${t.type}${t.done?' done':''}">
      <button class="o-check${t.done?' checked':''}" data-key="${t.key}" type="button">${t.done?'✓':''}</button>
      <div class="o-sic">${t.icon}</div>
      <div class="o-sb">
        <div class="o-st">${t.task}</div>
        <div class="o-sbl">ℹ️ ${t.znote}</div>
        ${t.done?`<div class="done-stamp">✅ Selesai</div><button class="o-foto-btn has-foto" data-key="${t.key}" data-owner="${currentUser.uid}" type="button">🖼️ Lihat Foto Bukti</button>`:''}
      </div>
      <div class="o-sd">
        <div class="o-sd-main${od?' o-overdue':''}">${fmtDate(t.targetDate)}</div>
        <div class="o-sd-rel${od?' o-overdue':''}">${relDay(t.targetDate)}</div>
      </div>
    </div>`;
  }).join('');
  document.querySelectorAll('#jadwalList .o-check').forEach(btn=>btn.addEventListener('click',()=>toggleDone(btn.dataset.key)));
  document.querySelectorAll('#jadwalList .o-foto-btn').forEach(btn=>btn.addEventListener('click',async()=>{
    btn.textContent='⏳ Memuat...';
    const snap=await db.ref('foto/'+btn.dataset.owner+'/'+safeKey(btn.dataset.key)).once('value');
    if(!snap.exists()){ btn.textContent='📷 Belum ada foto'; return; }
    const foto=snap.val();
    const d=new Date(foto.uploadedAt);
    const ts=d.toLocaleDateString('id-ID',{day:'2-digit',month:'short'})+' '+d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
    btn.textContent='🖼️ Lihat Foto Bukti';
    openFotoModal(foto.data,ts,btn.dataset.key,btn.dataset.owner);
  }));
}

// ── STATUS VISUAL ─────────────────────────────────────
function buildStatusPicker(){
  const el=document.getElementById('statusPicker');
  if(!bloks.length){ el.innerHTML=''; return; }
  if(!selStatusId||!bloks.find(b=>b.id===selStatusId)) selStatusId=bloks[0].id;
  el.innerHTML=bloks.map(b=>`<button class="bsel-chip${b.id===selStatusId?' active':''}" data-id="${b.id}" type="button">${b.nama}</button>`).join('');
  el.querySelectorAll('.bsel-chip').forEach(btn=>btn.addEventListener('click',()=>{
    selStatusId=btn.dataset.id;
    el.querySelectorAll('.bsel-chip').forEach(c=>c.classList.toggle('active',c.dataset.id===selStatusId));
    renderStatus();
  }));
}
function renderStatus(){
  const el=document.getElementById('statusVis');
  if(!bloks.length){ el.innerHTML='<div class="empty o-empty"><div class="ei">📊</div><p>Tambahkan blok kebun dulu.</p></div>'; return; }
  buildStatusPicker();
  const blok=bloks.find(b=>b.id===selStatusId); if(!blok){ el.innerHTML=''; return; }
  const tasks=generateTasks(blok); tasks.sort((a,b)=>a.targetDate-b.targetDate);
  const today=new Date(); today.setHours(0,0,0,0);
  const total=tasks.length, done=tasks.filter(t=>t.done).length;
  const overdue=tasks.filter(t=>t.targetDate<today&&!t.done).length;
  const dueSoon=tasks.filter(t=>{ const d=Math.round((t.targetDate-today)/86400000); return d>=0&&d<=7&&!t.done; }).length;
  const pct=total?Math.round(done/total*100):0;
  const zona=getZona(blok.mdpl), z=getZL(zona);
  let html=`<div class="o-card" style="margin-bottom:12px;">
    <div class="o-card-hdr"><div class="o-card-title">🏡 ${blok.nama}</div><div class="zona-badge ${z.cls}" style="margin:0;">${z.icon} ${z.label}</div></div>
    <div style="font-size:11.5px;color:var(--owner-text2);">📍 ${blok.lokasi} · ⛰️ ${parseInt(blok.mdpl).toLocaleString('id-ID')} mdpl</div>
  </div>`;
  // Donut
  const R=44,CX=54,CY=54,C_=2*Math.PI*R;
  const s1=done/total||0, s2=s1+(overdue/total||0);
  function arc(s,l,color){ return `<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${color}" stroke-width="12" stroke-dasharray="${l*C_} ${C_}" stroke-dashoffset="${C_*(1-s)}" stroke-linecap="butt"/>`; }
  html+=`<div class="o-vis-card"><div class="o-vis-title">📋 Ringkasan Tugas</div>
    <div class="o-donut-wrap">
      <svg width="108" height="108" viewBox="0 0 108 108">
        <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="12"/>
        ${arc(0,s1,'#4ade80')}${arc(s1,overdue/total||0,'#f87171')}${arc(s2,dueSoon/total||0,'#fbbf24')}
        <text x="${CX}" y="${CY+5}" text-anchor="middle" font-size="16" font-weight="700" fill="#4ade80">${pct}%</text>
        <text x="${CX}" y="${CY+18}" text-anchor="middle" font-size="8" fill="rgba(255,255,255,0.3)">selesai</text>
      </svg>
      <div class="o-legend">
        <div class="o-legend-item"><div class="o-legend-dot" style="background:#4ade80"></div>Selesai<span class="o-legend-val">${done}</span></div>
        <div class="o-legend-item"><div class="o-legend-dot" style="background:#f87171"></div>Terlambat<span class="o-legend-val">${overdue}</span></div>
        <div class="o-legend-item"><div class="o-legend-dot" style="background:#fbbf24"></div>7 Hari Ini<span class="o-legend-val">${dueSoon}</span></div>
        <div class="o-legend-item"><div class="o-legend-dot" style="background:rgba(255,255,255,0.1)"></div>Mendatang<span class="o-legend-val">${total-done-overdue-dueSoon}</span></div>
      </div>
    </div>
  </div>`;
  // Progress bars
  const types=[{t:'pupuk',l:'Pemupukan',i:'🍃'},{t:'siram',l:'Penyiraman',i:'💧'},{t:'gulma',l:'Gulma',i:'🌾'},{t:'pangkas',l:'Pemangkasan',i:'✂️'},{t:'panen',l:'Panen',i:'☕'},{t:'wiwilan',l:'Wiwilan',i:'🌱'},{t:'drainase',l:'Drainase',i:'🌊'}];
  html+=`<div class="o-vis-card"><div class="o-vis-title">📊 Progress per Jenis Tugas</div>`;
  types.forEach(tp=>{
    const tt=tasks.filter(t=>t.type===tp.t); if(!tt.length) return;
    const td=tt.filter(t=>t.done).length, pp=Math.round(td/tt.length*100);
    const col=pp>=75?'#4ade80':pp>=40?'#fbbf24':'#f87171';
    html+=`<div class="o-pb-wrap">
      <div class="o-pb-label"><span class="o-pb-name">${tp.i} ${tp.l}</span><span style="color:${col};font-weight:700;">${td}/${tt.length} (${pp}%)</span></div>
      <div class="o-pb-track"><div class="o-pb-fill" style="width:${pp}%;background:${col};"></div></div>
    </div>`;
  });
  html+=`</div>`;
  // Heatmap
  html+=`<div class="o-vis-card"><div class="o-vis-title">🗓️ Kalender Aktivitas (8 Minggu)</div>`;
  const days=['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
  html+=`<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:5px;">${days.map(d=>`<div style="font-size:7.5px;color:var(--owner-text3);text-align:center;">${d}</div>`).join('')}</div>`;
  html+=`<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;">`;
  const sd=new Date(today); sd.setDate(sd.getDate()-sd.getDay());
  for(let i=0;i<56;i++){
    const day=new Date(sd); day.setDate(day.getDate()+i);
    const ds=day.toISOString().split('T')[0];
    const cnt=tasks.filter(t=>t.targetDate.toISOString().split('T')[0]===ds).length;
    const isT=ds===today.toISOString().split('T')[0];
    const cl=cnt===0?'h0':cnt===1?'h1':cnt===2?'h2':cnt<=4?'h3':'h4';
    html+=`<div class="o-heat-cell ${cl}"${isT?' style="outline:1px solid #4ade80;outline-offset:1px;"':''}>${cnt>0?cnt:''}</div>`;
  }
  html+=`</div><div style="display:flex;align-items:center;gap:3px;justify-content:flex-end;margin-top:7px;font-size:8.5px;color:var(--owner-text3);">Sedikit ${['h0','h1','h2','h3','h4'].map(c=>`<div style="width:9px;height:9px;border-radius:2px;" class="${c}"></div>`).join('')} Banyak</div></div>`;
  // Timeline
  const od2=tasks.filter(t=>t.targetDate<today&&!t.done).slice(0,3);
  const up=tasks.filter(t=>t.targetDate>=today&&!t.done).slice(0,7);
  const combined=[...od2,...up].slice(0,10);
  html+=`<div class="o-vis-card"><div class="o-vis-title">⏰ Timeline Tugas Terdekat</div>`;
  if(!combined.length) html+=`<div style="text-align:center;color:var(--owner-text3);font-size:12.5px;padding:14px 0;">🎉 Semua tugas sudah selesai!</div>`;
  combined.forEach(t=>{
    const diff=Math.round((t.targetDate-today)/86400000);
    const isOD=diff<0, isT2=diff===0;
    const dotCls=t.done?'done-dot':isOD?'overdue-dot':isT2?'due-dot':'future-dot';
    const stCls=t.done?'st-done':isOD?'st-overdue':isT2?'st-due':'st-upcoming';
    const stTxt=t.done?'✅ Selesai':isOD?'⚠️ Terlambat '+Math.abs(diff)+' hr':isT2?'📌 Hari ini':'🕐 '+diff+' hari lagi';
    html+=`<div class="o-tl-item"><div class="o-tl-dot ${dotCls}">${t.icon}</div><div class="o-tl-body"><div class="o-tl-task">${t.task}</div><div class="o-tl-meta">${fmtDate(t.targetDate)}</div><span class="o-tl-status ${stCls}">${stTxt}</span></div></div>`;
  });
  html+=`</div>`;
  el.innerHTML=html;
}

// ── TAMBAH BLOK ───────────────────────────────────────
async function tambahBlok(){
  if(!currentUser) return;
  const nama=document.getElementById('f_nama').value.trim();
  const lokasi=document.getElementById('f_lokasi').value.trim();
  const mdpl=document.getElementById('f_mdpl').value;
  const tgl=document.getElementById('f_tgl').value;
  const pohon=document.getElementById('f_pohon').value;
  if(!nama||!lokasi||!mdpl||!tgl||!pohon){ toast('⚠️ Harap isi semua kolom!'); return; }
  showLoad('Menyimpan...');
  try{
    const kode=genKode();
    await db.ref('bloks').push({ nama,lokasi,mdpl,varietas:fS.varietas,pupuk:fS.pupuk,cuaca:fS.cuaca,tanggal:tgl,pohon,kode,ownerId:currentUser.uid,createdAt:Date.now() });
    hideLoad();
    ['f_nama','f_lokasi','f_mdpl','f_tgl','f_pohon'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('zonaP').style.display='none';
    fS.varietas='Arabika'; fS.pupuk='Organik'; fS.cuaca='Kemarau';
    document.querySelectorAll('.o-to[data-f]').forEach(o=>{ if(!o.dataset.f.startsWith('e_')) o.classList.toggle('selected',o.dataset.v===fS[o.dataset.f]); });
    toast('✅ Blok "'+nama+'" ditambahkan! Kode: '+kode);
    switchTab('kebun');
  }catch(e){ hideLoad(); toast('❌ '+e.message); }
}

// ── HAPUS & EDIT ──────────────────────────────────────
async function hapusBlok(id){
  if(!confirm('Hapus blok ini?')) return;
  showLoad('Menghapus...');
  try{
    await db.ref('bloks/'+id).remove();
    hideLoad(); toast('🗑️ Blok berhasil dihapus.');
  }catch(e){ hideLoad(); toast('❌ '+e.message); }
}
function openEdit(id){
  const b=bloks.find(x=>x.id===id); if(!b) return;
  document.getElementById('e_id').value=b.id;
  document.getElementById('e_nama').value=b.nama;
  document.getElementById('e_lokasi').value=b.lokasi;
  document.getElementById('e_mdpl').value=b.mdpl;
  document.getElementById('e_tgl').value=b.tanggal;
  document.getElementById('e_pohon').value=b.pohon;
  eS.e_varietas=b.varietas; eS.e_pupuk=b.pupuk; eS.e_cuaca=b.cuaca;
  ['e_varietas','e_pupuk','e_cuaca'].forEach(f=>{
    document.querySelectorAll('.o-to[data-f="'+f+'"]').forEach(o=>o.classList.toggle('selected',o.dataset.v===eS[f]));
  });
  prevZona(b.mdpl,'zonaPE');
  document.getElementById('editModal').classList.add('open');
  document.body.style.overflow='hidden';
}
function closeEdit(){ document.getElementById('editModal').classList.remove('open'); document.body.style.overflow=''; }
async function simpanEdit(){
  const id=document.getElementById('e_id').value;
  const nama=document.getElementById('e_nama').value.trim();
  const lokasi=document.getElementById('e_lokasi').value.trim();
  const mdpl=document.getElementById('e_mdpl').value;
  const tgl=document.getElementById('e_tgl').value;
  const pohon=document.getElementById('e_pohon').value;
  if(!nama||!lokasi||!mdpl||!tgl||!pohon){ toast('⚠️ Harap isi semua kolom!'); return; }
  showLoad('Menyimpan...');
  try{
    await db.ref('bloks/'+id).update({ nama,lokasi,mdpl,varietas:eS.e_varietas,pupuk:eS.e_pupuk,cuaca:eS.e_cuaca,tanggal:tgl,pohon });
    hideLoad(); closeEdit(); toast('✅ Blok diperbarui!');
  }catch(e){ hideLoad(); toast('❌ '+e.message); }
}

// ── FOTO ──────────────────────────────────────────────
function compressImage(file,maxW,maxH,q){
  return new Promise(res=>{
    const reader=new FileReader();
    reader.onload=e=>{
      const img=new Image();
      img.onload=()=>{
        const canvas=document.createElement('canvas');
        let w=img.width, h=img.height;
        if(w>maxW){ h=Math.round(h*maxW/w); w=maxW; }
        if(h>maxH){ w=Math.round(w*maxH/h); h=maxH; }
        canvas.width=w; canvas.height=h;
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
async function renderFotoBtn(key,ownerId,container,isDone,prefix='o-'){
  try{
    const snap=await db.ref('foto/'+ownerId+'/'+safeKey(key)).once('value');
    const existing=container.querySelector('.foto-area'); if(existing) existing.remove();
    const area=document.createElement('div'); area.className='foto-area';
    if(snap.exists()){
      const foto=snap.val();
      const d=new Date(foto.uploadedAt);
      const ts=d.toLocaleDateString('id-ID',{day:'2-digit',month:'short'})+' '+d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
      area.innerHTML=`<div style="display:flex;align-items:center;gap:8px;margin-top:5px;">
        <img class="${prefix}foto-thumb" src="${foto.data}" alt="Bukti" style="cursor:pointer;">
        <div style="font-size:9.5px;color:${prefix==='f-'?'var(--farmer-green)':'var(--owner-green)'};">✅ Foto tersimpan<br><span style="opacity:0.6;">${ts} · ${foto.sizeKB} KB</span></div>
      </div>`;
      area.querySelector('img').addEventListener('click',()=>openFotoModal(foto.data,ts,key,ownerId));
    } else if(!isDone){
      const btn=document.createElement('button');
      btn.className=prefix+'foto-btn'; btn.type='button';
      btn.textContent='📷 Ambil Foto Bukti Kerja';
      const prog=document.createElement('div'); prog.className='upload-progress';
      prog.innerHTML='<div class="upload-progress-bar"></div>';
      btn.addEventListener('click',()=>{
        const input=document.createElement('input');
        input.type='file'; input.accept='image/*'; input.capture='environment';
        input.onchange=async(e)=>{
          const file=e.target.files[0]; if(!file) return;
          prog.style.display='block'; btn.textContent='📤 Mengunggah...'; btn.disabled=true;
          try{
            await db.ref('done/'+ownerId+'/'+safeKey(key)).set(true);
            await uploadFoto(key,ownerId,file,pct=>{ prog.querySelector('.upload-progress-bar').style.width=pct+'%'; });
            prog.style.display='none'; toast('✅ Foto berhasil diunggah & tugas selesai!');
            if(currentRole==='farmer') renderFarmerJadwal(); else renderJadwal();
          }catch(err){ prog.style.display='none'; btn.disabled=false; btn.textContent='📷 Ambil Foto Bukti Kerja'; toast('❌ '+err.message); }
        };
        input.click();
      });
      area.appendChild(btn); area.appendChild(prog);
    }
    container.appendChild(area);
  }catch(e){ console.log('foto err',e); }
}
function openFotoModal(src,info,key,ownerId){
  document.getElementById('fotoModalImg').src=src;
  document.getElementById('fotoModalInfo').textContent='Diunggah: '+info;
  const del=document.getElementById('fotoModalDel');
  if(ownerId===currentUser?.uid){
    del.style.display='inline-block';
    del.onclick=async()=>{
      if(!confirm('Hapus foto ini?')) return;
      await db.ref('foto/'+ownerId+'/'+safeKey(key)).remove();
      document.getElementById('fotoModalOv').classList.remove('open');
      toast('🗑️ Foto dihapus.'); renderJadwal();
    };
  } else { del.style.display='none'; }
  document.getElementById('fotoModalOv').classList.add('open');
}

// ── INIT ──────────────────────────────────────────────
document.getElementById('f_tgl').value=new Date().toISOString().split('T')[0];

// Update Firebase rules reminder (in console)
console.log('%c KopiPlanPro v2.0 loaded', 'color:#4ade80;font-weight:bold;font-size:14px');
