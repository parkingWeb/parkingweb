// Rellena con los datos de tu proyecto (Supabase > Project Settings > API)
const SB_URL='https://TU-PROYECTO.supabase.co', SB_KEY='TU_ANON_PUBLIC_KEY';

const sb=supabase.createClient(SB_URL,SB_KEY), app=document.getElementById('app');
const DAYS=['Lunes','Martes','Miércoles','Jueves','Viernes'];
const COLORS=['#2563eb','#f59e0b','#10b981','#ec4899','#8b5cf6','#06b6d4'];
let user,P,members=[],books=[],ws=monday(new Date());

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
function monday(d){d=new Date(d.getFullYear(),d.getMonth(),d.getDate());d.setDate(d.getDate()-((d.getDay()+6)%7));return d}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function toast(m){const t=document.getElementById('toast');t.textContent=m;t.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>t.style.display='none',3500)}
const $=id=>document.getElementById(id), val=id=>$(id).value.trim();

async function init(){
  const{data}=await sb.auth.getSession(); user=data.session?.user;
  sb.auth.onAuthStateChange((_,s)=>{const u=s?.user; if(u?.id!==user?.id){user=u;route()}});
  route();
}
function route(){
  if(!user) return viewAuth();
  const last=localStorage.getItem('parking'); last?viewParking(last):viewHome();
}

function viewAuth(){
  app.innerHTML=`<h1>🅿️ Parking compartido</h1><div class="card">
  <input id="em" type="email" placeholder="Email" autocomplete="email">
  <input id="pw" type="password" placeholder="Contraseña (mín. 6)" autocomplete="current-password">
  <button class="full" id="li">Entrar</button>
  <p class="mut" style="text-align:center">¿Sin cuenta? <button class="link" id="su">Crear cuenta</button></p></div>`;
  $('li').onclick=async()=>{const{error}=await sb.auth.signInWithPassword({email:val('em'),password:$('pw').value});if(error)toast('Email o contraseña incorrectos')};
  $('su').onclick=async()=>{const{data,error}=await sb.auth.signUp({email:val('em'),password:$('pw').value});
    if(error)return toast(error.message); if(!data.session)toast('Revisa tu email para confirmar la cuenta')};
}

async function viewHome(){
  localStorage.removeItem('parking');
  app.innerHTML=`<div class="row"><h1>Mis parkings</h1><button class="sec" id="out">Salir</button></div><div id="list" class="mut">Cargando…</div>
  <div class="card"><h2>➕ Crear parking</h2>
  <input id="cn" placeholder="Nombre (ej. Parking oficina)"><input id="cs" placeholder="Nº de plaza (opcional)">
  <input id="cu" placeholder="Tu nombre"><input id="cp" placeholder="Tu matrícula">
  <input id="cw" type="password" placeholder="Contraseña del parking"><button class="full" id="cr">Crear</button></div>
  <div class="card"><h2>🔑 Unirme a un parking</h2>
  <input id="jc" placeholder="Código del parking" autocapitalize="characters"><input id="jw" type="password" placeholder="Contraseña">
  <input id="ju" placeholder="Tu nombre"><input id="jp" placeholder="Tu matrícula"><button class="full" id="jn">Unirme</button></div>`;
  $('out').onclick=()=>sb.auth.signOut();
  const{data}=await sb.from('members').select('parking_id,parkings(name,code)');
  $('list').innerHTML=data?.length?data.map(m=>`<button class="sec full" style="margin-bottom:8px;text-align:left" data-p="${m.parking_id}">${esc(m.parkings.name)} <span class="mut">· ${esc(m.parkings.code)}</span></button>`).join(''):'Aún no estás en ningún parking.';
  $('list').onclick=e=>{const p=e.target.closest('[data-p]')?.dataset.p;if(p)viewParking(p)};
  $('cr').onclick=async()=>{const{data,error}=await sb.rpc('create_parking',{p_name:val('cn'),p_pass:$('cw').value,p_spot:val('cs'),p_user:val('cu'),p_plate:val('cp')});
    if(error)return toast(error.message); viewParking(data[0].id)};
  $('jn').onclick=async()=>{const{data,error}=await sb.rpc('join_parking',{p_code:val('jc'),p_pass:$('jw').value,p_user:val('ju'),p_plate:val('jp')});
    if(error)return toast(error.message); viewParking(data)};
}

async function viewParking(id){
  localStorage.setItem('parking',id);
  const[a,b]=await Promise.all([sb.from('parkings').select('id,code,name,spot,max_days').eq('id',id).single(),
    sb.from('members').select('user_id,name,plate').eq('parking_id',id)]);
  if(a.error||!a.data){return viewHome()} P=a.data; members=b.data||[]; ws=monday(new Date()); await loadWeek();
}
async function loadWeek(){
  const{data}=await sb.from('bookings').select('day,user_id').eq('parking_id',P.id).gte('day',iso(ws)).lte('day',iso(addDays(ws,6)));
  books=data||[]; draw();
}
function draw(){
  const col=uid=>COLORS[Math.max(0,members.findIndex(m=>m.user_id===uid))%COLORS.length];
  const mine=books.filter(x=>x.user_id===user.id).length, today=iso(new Date());
  const days=DAYS.map((n,i)=>{
    const d=addDays(ws,i),k=iso(d),bk=books.find(x=>x.day===k),m=bk&&members.find(x=>x.user_id===bk.user_id),past=k<today;
    let right=bk?(bk.user_id===user.id?`<button class="sec" data-d="${k}" data-r="1">Liberar</button>`
        :`<span class="tag" style="background:${col(bk.user_id)}">${esc(m?.name)}</span>`)
      :(past?'':`<span class="free">Libre</span><button data-d="${k}">Reservar</button>`);
    if(bk&&bk.user_id===user.id)right=`<span class="tag" style="background:${col(user.id)};margin-right:8px">Tú</span>`+right;
    return `<div class="day ${k===today?'today':''} ${past?'past':''}"><div><b>${n}</b><span class="mut">${d.getDate()}/${d.getMonth()+1}</span></div><div>${right}</div></div>`}).join('');
  const f=d=>d.getDate()+'/'+(d.getMonth()+1);
  app.innerHTML=`<div class="row"><button class="sec" id="bk">←</button><h1 style="margin:0">${esc(P.name)}</h1><span></span></div>
  <p class="mut">Código: <b>${esc(P.code)}</b>${P.spot?' · Plaza '+esc(P.spot):''}</p>
  <div class="card">${members.map(m=>`<div class="mem"><span class="dot" style="background:${col(m.user_id)}"></span><b>${esc(m.name)}</b><span class="mut">${esc(m.plate)}</span></div>`).join('')}</div>
  <div class="row" style="margin-bottom:10px"><button class="sec" id="pv">‹</button><div style="text-align:center"><b>${f(ws)} – ${f(addDays(ws,4))}</b><div class="mut">Tus días: ${mine}/${P.max_days}</div></div><button class="sec" id="nx">›</button></div>${days}`;
  $('bk').onclick=viewHome; $('pv').onclick=()=>{ws=addDays(ws,-7);loadWeek()}; $('nx').onclick=()=>{ws=addDays(ws,7);loadWeek()};
  app.querySelectorAll('[data-d]').forEach(b=>b.onclick=async()=>{
    const day=b.dataset.d, q=b.dataset.r?sb.from('bookings').delete().eq('parking_id',P.id).eq('day',day):sb.from('bookings').insert({parking_id:P.id,day});
    const{error}=await q; if(error)toast(error.code==='23505'?'Ese día ya está reservado':error.message); loadWeek()});
}
init();
