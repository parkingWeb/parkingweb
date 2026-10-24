// Rellena con los datos de tu proyecto (Supabase > Project Settings > API)
const SB_URL='https://eipiwstjopuhixegyojm.supabase.co', SB_KEY='sb_publishable_qDgX0Aik6ugXMLrV3RfKbQ_T0J54A7d';

const sb=supabase.createClient(SB_URL,SB_KEY), app=document.getElementById('app');
const DAYS=['Lunes','Martes','Miércoles','Jueves','Viernes'];
const COLORS=['#2563eb','#f59e0b','#10b981','#ec4899','#8b5cf6','#06b6d4'];
let user,P,members=[],books=[],ws=currentWeek(),moving=null,isAdmin=false;

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
function monday(d){d=new Date(d.getFullYear(),d.getMonth(),d.getDate());d.setDate(d.getDate()-((d.getDay()+6)%7));return d}
function currentWeek(){const t=new Date(),w=t.getDay();return monday(w===0||w===6?addDays(t,2):t)}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function toast(m){const t=document.getElementById('toast');t.textContent=m;t.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>t.style.display='none',3500)}
const $=id=>document.getElementById(id), val=id=>$(id).value.trim();

async function init(){
  const{data}=await sb.auth.getSession(); user=data.session?.user;
  sb.auth.onAuthStateChange((_,s)=>{const u=s?.user; if(u?.id!==user?.id){user=u;route()}});
  route();
}
async function route(){
  if(!user) return viewAuth();
  const{data}=await sb.from('admins').select('user_id').maybeSingle(); isAdmin=!!data;
  const last=localStorage.getItem('parking'); last?viewParking(last):viewHome();
}

function viewAuth(){
  app.innerHTML=`<h1>🅿️ Parking compartido</h1><div class="card">
  <input id="em" type="email" placeholder="Email" autocomplete="email">
  <input id="pw" type="password" placeholder="Contraseña (mín. 6)" autocomplete="current-password">
  <button class="full" id="li">Entrar</button>
  <p class="mut" style="text-align:center">¿Sin cuenta? <button class="link" id="su">Crear cuenta</button></p></div>`;
  const creds=()=>{const email=val('em'),password=$('pw').value;
    if(!/^\S+@\S+\.\S+$/.test(email)){toast('Escribe un email válido');return null}
    if(password.length<6){toast('La contraseña debe tener al menos 6 caracteres');return null}
    return{email,password}};
  $('li').onclick=async()=>{const c=creds();if(!c)return;const{error}=await sb.auth.signInWithPassword(c);if(error)toast('Email o contraseña incorrectos')};
  $('su').onclick=async()=>{const c=creds();if(!c)return;const{data,error}=await sb.auth.signUp(c);
    if(error)return toast(error.message); if(!data.session)toast('Revisa tu email para confirmar la cuenta')};
}

async function viewHome(){
  localStorage.removeItem('parking'); moving=null;
  app.innerHTML=`<div class="row"><h1>Mis parkings</h1><div>${isAdmin?'<button class="sec" id="adm">Admin</button> ':''}<button class="sec" id="out">Salir</button></div></div><div id="list" class="mut">Cargando…</div>
  <div class="card"><h2>➕ Crear parking</h2>
  <input id="cn" placeholder="Nombre (ej. Parking oficina)"><input id="cs" placeholder="Nº de plaza (opcional)">
  <input id="cu" placeholder="Tu nombre"><input id="cp" placeholder="Tu matrícula">
  <input id="cw" type="password" placeholder="Contraseña del parking"><button class="full" id="cr">Crear</button></div>
  <div class="card"><h2>🔑 Unirme a un parking</h2>
  <input id="jc" placeholder="Código del parking (6 caracteres, ej. A7K2QX)" autocapitalize="characters"><input id="jw" type="password" placeholder="Contraseña">
  <input id="ju" placeholder="Tu nombre"><input id="jp" placeholder="Tu matrícula"><button class="full" id="jn">Unirme</button></div>`;
  $('out').onclick=()=>sb.auth.signOut(); if(isAdmin)$('adm').onclick=viewAdmin;
  const{data,error}=await sb.from('members').select('parking_id,parkings(name,code)').eq('user_id',user.id); if(error)toast(error.message);
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
  if(a.error||!a.data){toast(a.error?.message||'No tienes acceso a este parking');return viewHome()} P=a.data; members=b.data||[]; ws=currentWeek(); await loadWeek();
}
async function loadWeek(){
  const{data,error}=await sb.from('bookings').select('day,user_id').eq('parking_id',P.id).gte('day',iso(ws)).lte('day',iso(addDays(ws,6)));
  if(error)toast(error.message); books=data||[]; draw();
}
function draw(){
  const col=uid=>COLORS[Math.max(0,members.findIndex(m=>m.user_id===uid))%COLORS.length];
  const mine=books.filter(x=>x.user_id===user.id).length, today=iso(new Date());
  const days=DAYS.map((n,i)=>{
    const d=addDays(ws,i),k=iso(d),bk=books.find(x=>x.day===k),m=bk&&members.find(x=>x.user_id===bk.user_id),past=k<today;
    let right='';
    if(!bk) right=past?'':(moving?`<button data-to="${k}">Mover aquí</button>`:`<span class="free">Libre</span><button data-d="${k}">Reservar</button>`);
    else if(bk.user_id===user.id) right=`<span class="tag" style="background:${col(user.id)};margin-right:8px">Tú</span>`+(past?'':`<button class="sec" data-m="${k}">${moving===k?'Eligiendo…':'Cambiar'}</button> <button class="sec" data-r="${k}">Liberar</button>`);
    else right=`<span class="tag" style="background:${col(bk.user_id)}">${esc(m?.name)}</span>`;
    return `<div class="day ${k===today?'today':''} ${past?'past':''}"><div><b>${n}</b><span class="mut">${d.getDate()}/${d.getMonth()+1}</span></div><div>${right}</div></div>`}).join('');
  const f=d=>d.getDate()+'/'+(d.getMonth()+1);
  const banner=moving?`<div class="card row"><span>Elige el nuevo día para tu reserva del ${moving.split('-').reverse().slice(0,2).join('/')}</span><button class="sec" id="cm">Cancelar</button></div>`:'';
  app.innerHTML=`<div class="row"><button class="sec" id="bk">←</button><h1 style="margin:0">${esc(P.name)}</h1><span></span></div>
  <p class="mut">Código: <b>${esc(P.code)}</b>${P.spot?' · Plaza '+esc(P.spot):''}</p>
  <div class="card">${members.map(m=>`<div class="mem"><span class="dot" style="background:${col(m.user_id)}"></span><b>${esc(m.name)}</b><span class="mut">${esc(m.plate)}</span></div>`).join('')}</div>
  ${banner}<div class="row" style="margin-bottom:10px"><button class="sec" id="pv">‹</button><div style="text-align:center"><b>${f(ws)} – ${f(addDays(ws,4))}</b><div class="mut">Tus días: ${mine}/${P.max_days}</div></div><button class="sec" id="nx">›</button></div>${days}`;
  $('bk').onclick=()=>isAdmin&&!members.some(m=>m.user_id===user.id)?viewAdmin():viewHome(); $('pv').onclick=()=>{ws=addDays(ws,-7);loadWeek()}; $('nx').onclick=()=>{ws=addDays(ws,7);loadWeek()};
  if(moving)$('cm').onclick=()=>{moving=null;draw()};
  app.querySelectorAll('button[data-d],button[data-r],button[data-m],button[data-to]').forEach(b=>b.onclick=async()=>{
    const s=b.dataset; let q;
    if(s.m){moving=moving===s.m?null:s.m;return draw()}
    if(s.d)q=sb.from('bookings').insert({parking_id:P.id,day:s.d});
    if(s.r)q=sb.from('bookings').delete().eq('parking_id',P.id).eq('day',s.r);
    if(s.to)q=sb.from('bookings').update({day:s.to}).eq('parking_id',P.id).eq('day',moving);
    const{error}=await q; moving=null;
    if(error)toast(error.code==='23505'?'Ese día ya está reservado':error.message); loadWeek()});
}

async function viewAdmin(){
  localStorage.removeItem('parking');
  app.innerHTML=`<div class="row"><button class="sec" id="bk">←</button><h1 style="margin:0">Administración</h1><span></span></div><div id="ad" class="mut" style="margin-top:12px">Cargando…</div>`;
  $('bk').onclick=viewHome;
  const[p,m,b,u]=await Promise.all([sb.from('parkings').select('id,code,name,spot,max_days').order('name'),
    sb.from('members').select('parking_id,user_id,name,plate'),
    sb.from('bookings').select('parking_id,day,user_id').gte('day',iso(new Date())).order('day'),sb.rpc('admin_users')]);
  const bad=[p,m,b,u].find(r=>r.error); if(bad){toast(bad.error.message);return}
  const em=Object.fromEntries(u.data.map(x=>[x.id,x.email])), fd=d=>d.slice(0,10).split('-').reverse().join('/');
  $('ad').innerHTML=`<h2>Parkings (${p.data.length})</h2>`+p.data.map(k=>{
    const mm=m.data.filter(x=>x.parking_id===k.id), bb=b.data.filter(x=>x.parking_id===k.id);
    return `<div class="card"><div class="row"><b>${esc(k.name)}</b><span class="mut">${esc(k.code)}</span></div>
    <p class="mut">Plaza ${esc(k.spot||'-')} · ${k.max_days} días/semana</p>
    ${mm.map(x=>`<div class="mem" style="flex-wrap:wrap"><b>${esc(x.name)}</b><span class="mut">${esc(x.plate)} · ${esc(em[x.user_id])}</span>
      <button class="sec" data-a="editm" data-p="${k.id}" data-u="${x.user_id}">✏️</button><button class="sec" data-a="delm" data-p="${k.id}" data-u="${x.user_id}">✕</button></div>`).join('')}
    <p class="mut">Próximas reservas:</p>${bb.length?bb.map(x=>`<div class="mem"><span>${fd(x.day)}</span><span class="mut">${esc(mm.find(y=>y.user_id===x.user_id)?.name)}</span><button class="sec" data-a="delb" data-p="${k.id}" data-d="${x.day}">✕</button></div>`).join(''):'<p class="mut">Ninguna</p>'}
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"><button class="sec" data-a="open" data-p="${k.id}">Abrir</button><button class="sec" data-a="editp" data-p="${k.id}">Editar</button><button class="sec" data-a="passp" data-p="${k.id}">Contraseña</button><button class="sec" data-a="delp" data-p="${k.id}">Eliminar</button></div></div>`}).join('')
   +`<h2>Usuarios (${u.data.length})</h2><div class="card">`+u.data.map(x=>`<div class="mem"><div style="flex:1"><b>${esc(x.email)}</b><div class="mut">${x.n_parkings} parking(s) · alta ${fd(x.created_at)}</div></div>${x.id===user.id?'':`<button class="sec" data-a="delu" data-u="${x.id}">✕</button>`}</div>`).join('')+'</div>';
  $('ad').onclick=async e=>{
    const bt=e.target.closest('[data-a]'); if(!bt)return;
    const{a,p:pid,u:uid,d}=bt.dataset, K=p.data.find(x=>x.id===pid), M=m.data.find(x=>x.parking_id===pid&&x.user_id===uid); let r;
    if(a==='open')return viewParking(pid);
    if(a==='editp'){const name=prompt('Nombre',K.name);if(name===null)return;const spot=prompt('Plaza',K.spot||'');if(spot===null)return;const mx=prompt('Días máx. por semana',K.max_days);if(mx===null)return;
      r=await sb.from('parkings').update({name:name.trim()||K.name,spot,max_days:parseInt(mx)||K.max_days}).eq('id',pid)}
    else if(a==='passp'){const pw=prompt('Nueva contraseña del parking (mín. 4)');if(!pw)return;r=await sb.rpc('admin_set_parking_pass',{p_id:pid,p_pass:pw})}
    else if(a==='delp'){if(!confirm('¿Eliminar "'+K.name+'" con todas sus reservas?'))return;r=await sb.from('parkings').delete().eq('id',pid)}
    else if(a==='editm'){const name=prompt('Nombre',M.name);if(name===null)return;const plate=prompt('Matrícula',M.plate||'');if(plate===null)return;
      r=await sb.from('members').update({name:name.trim()||M.name,plate:plate.toUpperCase()}).eq('parking_id',pid).eq('user_id',uid)}
    else if(a==='delm'){if(!confirm('¿Quitar a este usuario del parking?'))return;await sb.from('bookings').delete().eq('parking_id',pid).eq('user_id',uid);r=await sb.from('members').delete().eq('parking_id',pid).eq('user_id',uid)}
    else if(a==='delb')r=await sb.from('bookings').delete().eq('parking_id',pid).eq('day',d);
    else if(a==='delu'){if(!confirm('¿Eliminar este usuario y todos sus datos?'))return;r=await sb.rpc('admin_delete_user',{p_id:uid})}
    if(r?.error)toast(r.error.message); viewAdmin()};
}
init();
