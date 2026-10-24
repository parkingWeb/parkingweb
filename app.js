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

let authMode='in';
const av=(n,c,cl='')=>`<span class="av ${cl}" style="background:${c}">${esc(((n||'?').trim()[0]||'?').toUpperCase())}</span>`;
const skel=()=>'<div class="skel"></div><div class="skel"></div>';
async function busy(btn,fn){btn.disabled=true;try{await fn()}finally{btn.disabled=false}}

function viewAuth(){
  const up=authMode==='up';
  app.innerHTML=`<div class="fade auth"><div class="logo">🅿️</div><h1>Parking compartido</h1>
  <p class="sub">Reserva tu plaza y rota con tus compañeros sin coincidir.</p>
  <div class="tabs"><button data-m="in" class="${up?'':'on'}">Entrar</button><button data-m="up" class="${up?'on':''}">Crear cuenta</button></div>
  <div class="card"><label>Email</label><input id="em" type="email" placeholder="tu@email.com" autocomplete="email">
  <label>Contraseña</label><input id="pw" type="password" placeholder="Mínimo 6 caracteres" autocomplete="${up?'new-password':'current-password'}">
  <button class="full" id="go">${up?'Crear mi cuenta':'Entrar'}</button></div></div>`;
  app.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{authMode=b.dataset.m;viewAuth()});
  const creds=()=>{const email=val('em'),password=$('pw').value;
    if(!/^\S+@\S+\.\S+$/.test(email)){toast('Escribe un email válido');return null}
    if(password.length<6){toast('La contraseña debe tener al menos 6 caracteres');return null}
    return{email,password}};
  $('pw').onkeydown=e=>{if(e.key==='Enter')$('go').click()};
  $('go').onclick=()=>{const c=creds();if(!c)return;busy($('go'),async()=>{
    if(up){const{data,error}=await sb.auth.signUp(c);if(error)toast(error.message);else if(!data.session)toast('Revisa tu email para confirmar la cuenta')}
    else{const{error}=await sb.auth.signInWithPassword(c);if(error)toast('Email o contraseña incorrectos')}})};
}

async function viewHome(){
  localStorage.removeItem('parking'); moving=null;
  app.innerHTML=`<div class="fade"><div class="top"><div class="row" style="justify-content:flex-start;gap:12px">${av(user.email,'#4f46e5','lg')}<div style="min-width:0"><h1>Mis parkings</h1><div class="mut sm" style="overflow:hidden;text-overflow:ellipsis">${esc(user.email)}</div></div></div>
  <div class="acts">${isAdmin?'<button class="sec ic" id="adm" title="Administración">🛡️</button>':''}<button class="sec ic" id="out" title="Salir">⎋</button></div></div>
  <div id="list">${skel()}</div>
  <details class="card acc" id="dj"><summary>🔑 Unirme a un parking</summary><div>
    <input id="jc" placeholder="Código del parking (ej. A7K2QX)" autocapitalize="characters"><input id="jw" type="password" placeholder="Contraseña del parking">
    <input id="ju" placeholder="Tu nombre"><input id="jp" placeholder="Tu matrícula"><button class="full" id="jn" style="margin-bottom:12px">Unirme</button></div></details>
  <details class="card acc"><summary>➕ Crear un parking nuevo</summary><div>
    <input id="cn" placeholder="Nombre (ej. Parking oficina)"><input id="cs" placeholder="Nº de plaza (opcional)">
    <input id="cu" placeholder="Tu nombre"><input id="cp" placeholder="Tu matrícula"><input id="cw" type="password" placeholder="Contraseña del parking">
    <button class="full" id="cr" style="margin-bottom:12px">Crear parking</button></div></details></div>`;
  $('out').onclick=()=>sb.auth.signOut(); if(isAdmin)$('adm').onclick=viewAdmin;
  const{data,error}=await sb.from('members').select('parking_id,parkings(name,code)').eq('user_id',user.id); if(error)toast(error.message);
  $('list').innerHTML=data?.length?data.map(m=>`<button class="pk" data-p="${m.parking_id}"><span class="pico">🅿️</span><span><b>${esc(m.parkings.name)}</b><small>Código ${esc(m.parkings.code)}</small></span><span class="chev">›</span></button>`).join('')
    :'<div class="empty"><div>🚗</div><b>Aún no tienes parkings</b>Únete con un código o crea uno nuevo.</div>';
  if(!data?.length)$('dj').open=true;
  $('list').onclick=e=>{const p=e.target.closest('[data-p]')?.dataset.p;if(p)viewParking(p)};
  $('cr').onclick=()=>busy($('cr'),async()=>{const{data,error}=await sb.rpc('create_parking',{p_name:val('cn'),p_pass:$('cw').value,p_spot:val('cs'),p_user:val('cu'),p_plate:val('cp')});
    if(error)return toast(error.message); viewParking(data[0].id)});
  $('jn').onclick=()=>busy($('jn'),async()=>{const{data,error}=await sb.rpc('join_parking',{p_code:val('jc'),p_pass:$('jw').value,p_user:val('ju'),p_plate:val('jp')});
    if(error)return toast(error.message); viewParking(data)});
}

async function viewParking(id){
  localStorage.setItem('parking',id);
  app.innerHTML='<div class="skel" style="height:190px;border-radius:24px"></div>'+skel()+skel();
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
  const mine=books.filter(x=>x.user_id===user.id).length, today=iso(new Date()), cw=currentWeek();
  const dots=Array.from({length:P.max_days},(_,i)=>`<i class="${i<mine?'on':''}"></i>`).join('');
  const days=DAYS.map((n,i)=>{
    const d=addDays(ws,i),k=iso(d),bk=books.find(x=>x.day===k),m=bk&&members.find(x=>x.user_id===bk.user_id),past=k<today,me=bk&&bk.user_id===user.id;
    let st,act='';
    if(!bk){st=`<span class="n free">${past?'Sin reserva':'Libre'}</span>`;if(!past)act=moving?`<button data-to="${k}">Mover aquí</button>`:`<button data-d="${k}">Reservar</button>`}
    else if(me){st=`${av(m?.name,col(user.id))}<span class="n">Tu reserva</span>`;if(!past)act=`<button class="sec" data-m="${k}">${moving===k?'Eligiendo…':'Cambiar'}</button><button class="sec" data-r="${k}">Liberar</button>`}
    else st=`${av(m?.name,col(bk.user_id))}<span class="n">${esc(m?.name)}</span>`;
    return `<div class="day ${k===today?'today':''} ${past?'past':''} ${me?'mine':''}"><div class="dt"><small>${n.slice(0,3)}</small><b>${d.getDate()}</b><i>${d.toLocaleDateString('es-ES',{month:'short'})}</i></div>
      <div class="st">${st}${k===today?'<em class="hoy">Hoy</em>':''}</div><div class="act">${act}</div></div>`}).join('');
  const f=d=>d.getDate()+'/'+(d.getMonth()+1), r=Math.round((ws-cw)/6048e5);
  const lbl={0:'Esta semana',1:'Próxima semana','-1':'Semana pasada'}[r]||'';
  const banner=moving?`<div class="banner row"><span>Elige el nuevo día para tu reserva del <b>${moving.split('-').reverse().slice(0,2).join('/')}</b></span><button class="sec" id="cm">Cancelar</button></div>`:'';
  app.innerHTML=`<div class="hero"><div class="row"><button class="ghost ic" id="bk">‹</button><div class="chips">${P.spot?`<span class="chip">Plaza ${esc(P.spot)}</span>`:''}<button class="chip" id="cp" title="Copiar código">${esc(P.code)} ⧉</button></div></div>
    <h1>${esc(P.name)}</h1><div class="people">${members.map(m=>`<div class="pp">${av(m.name,col(m.user_id))}<div><b>${esc(m.name)}${m.user_id===user.id?' (tú)':''}</b><span class="plate">${esc(m.plate||'—')}</span></div></div>`).join('')}</div></div>
    ${banner}<div class="wk"><button class="sec ic" id="pv">‹</button><div><b>${f(ws)} – ${f(addDays(ws,4))}</b><small>${lbl}</small></div><button class="sec ic" id="nx">›</button></div>
    <div class="use"><span>Tus días</span><div class="dots">${dots}</div><b>${mine}/${P.max_days}</b></div>${days}`;
  $('bk').onclick=()=>isAdmin&&!members.some(m=>m.user_id===user.id)?viewAdmin():viewHome();
  $('cp').onclick=()=>{navigator.clipboard?.writeText(P.code);toast('Código copiado. Recuerda pasar también la contraseña.')};
  $('pv').onclick=()=>{ws=addDays(ws,-7);loadWeek()}; $('nx').onclick=()=>{ws=addDays(ws,7);loadWeek()};
  if(moving)$('cm').onclick=()=>{moving=null;draw()};
  app.querySelectorAll('button[data-d],button[data-r],button[data-m],button[data-to]').forEach(b=>b.onclick=async()=>{
    const s=b.dataset; let q;
    if(s.m){moving=moving===s.m?null:s.m;return draw()}
    b.disabled=true;
    if(s.d)q=sb.from('bookings').insert({parking_id:P.id,day:s.d});
    if(s.r)q=sb.from('bookings').delete().eq('parking_id',P.id).eq('day',s.r);
    if(s.to)q=sb.from('bookings').update({day:s.to}).eq('parking_id',P.id).eq('day',moving);
    const{error}=await q; moving=null;
    toast(error?(error.code==='23505'?'Ese día ya está reservado':error.message):s.d?'Día reservado ✅':s.r?'Reserva liberada':'Reserva cambiada ✅'); loadWeek()});
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
