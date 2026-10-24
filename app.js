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
  sb.auth.onAuthStateChange((_,s)=>{const u=s?.user; if(u?.id!==user?.id){user=u;if(!u){sb.removeAllChannels();notifCh=chatCh=null;unread=0;P=null}route()}});
  route();
}
async function route(){
  if(!user) return viewAuth();
  const{data}=await sb.from('admins').select('user_id').maybeSingle(); isAdmin=!!data; await refreshUnread(); listen();
  const last=localStorage.getItem('parking'); last&&!localStorage.getItem('joinCode')?viewParking(last):viewHome();
}

let authMode='in';
const av=(n,c,cl='')=>`<span class="av ${cl}" style="background:${c}">${esc(((n||'?').trim()[0]||'?').toUpperCase())}</span>`;
const skel=()=>'<div class="skel"></div><div class="skel"></div>';
async function busy(btn,fn){btn.disabled=true;try{await fn()}finally{btn.disabled=false}}

const pwf=(id,ph,ac)=>`<div class="pw"><input id="${id}" type="password" placeholder="${ph}" autocomplete="${ac}"><button type="button" class="eye" data-eye="${id}" aria-label="Ver contraseña">👁️</button></div>`;
app.addEventListener('click',e=>{const b=e.target.closest('[data-eye]');if(!b)return;const i=document.getElementById(b.dataset.eye),show=i.type==='password';i.type=show?'text':'password';b.textContent=show?'🙈':'👁️';b.setAttribute('aria-label',show?'Ocultar contraseña':'Ver contraseña')});

function viewAuth(){
  const up=authMode==='up';
  app.innerHTML=`<div class="fade auth"><div class="logo">🅿️</div><h1>Parking compartido</h1>
  <p class="sub">Reserva tu plaza y rota con tus compañeros sin coincidir.</p>
  <div class="tabs"><button data-m="in" class="${up?'':'on'}">Entrar</button><button data-m="up" class="${up?'on':''}">Crear cuenta</button></div>
  <div class="card"><label>Email</label><input id="em" type="email" placeholder="tu@email.com" autocomplete="email">
  ${up?'<label>Repite el email</label><input id="em2" type="email" placeholder="Repite tu email" autocomplete="off">':''}
  <label>Contraseña</label>${pwf('pw','Mínimo 6 caracteres',up?'new-password':'current-password')}
  ${up?'<label>Repite la contraseña</label>'+pwf('pw2','Repite tu contraseña','new-password'):''}
  <button class="full" id="go">${up?'Crear mi cuenta':'Entrar'}</button></div></div>`;
  app.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{authMode=b.dataset.m;viewAuth()});
  const creds=()=>{const email=val('em'),password=$('pw').value;
    if(!/^\S+@\S+\.\S+$/.test(email)){toast('Escribe un email válido');return null}
    if(password.length<6){toast('La contraseña debe tener al menos 6 caracteres');return null}
    if(up&&email.toLowerCase()!==val('em2').toLowerCase()){toast('Los dos emails no coinciden');return null}
    if(up&&password!==$('pw2').value){toast('Las contraseñas no coinciden');return null}
    return{email,password}};
  $(up?'pw2':'pw').onkeydown=e=>{if(e.key==='Enter')$('go').click()};
  $('go').onclick=()=>{const c=creds();if(!c)return;busy($('go'),async()=>{
    if(up){const{data,error}=await sb.auth.signUp(c);if(error)toast(error.message);else if(!data.session)toast('Revisa tu email para confirmar la cuenta')}
    else{const{error}=await sb.auth.signInWithPassword(c);if(error)toast('Email o contraseña incorrectos')}})};
}

async function viewHome(){
  localStorage.removeItem('parking'); moving=null; leaveChat();
  app.innerHTML=`<div class="fade"><div class="top"><div class="row" style="justify-content:flex-start;gap:12px">${av(user.email,'#4f46e5','lg')}<div style="min-width:0"><h1>Mis parkings</h1><div class="mut sm" style="overflow:hidden;text-overflow:ellipsis">${esc(user.email)}</div></div></div>
  <div class="acts">${isAdmin?'<button class="sec ic" id="adm" title="Administración">🛡️</button>':''}<button class="sec out" id="out">🚪 Salir</button></div></div>
  <div id="list">${skel()}</div>
  <details class="card acc" id="dj"><summary>🔑 Unirme a un parking</summary><div>
    <input id="jc" placeholder="Código del parking (ej. A7K2QX)" autocapitalize="characters">${pwf('jw','Contraseña del parking','off')}
    <input id="ju" placeholder="Tu nombre"><input id="jp" placeholder="Tu matrícula"><button class="full" id="jn" style="margin-bottom:12px">Unirme</button></div></details>
  <details class="card acc"><summary>➕ Crear un parking nuevo</summary><div>
    <input id="cn" placeholder="Nombre (ej. Parking oficina)"><input id="cs" placeholder="Nº de plaza (opcional)">
    <input id="cu" placeholder="Tu nombre"><input id="cp" placeholder="Tu matrícula">${pwf('cw','Contraseña del parking','new-password')}
    <button class="full" id="cr" style="margin-bottom:12px">Crear parking</button></div></details></div>`+nav('home'); bindNav();
  $('out').onclick=()=>sb.auth.signOut(); if(isAdmin)$('adm').onclick=viewAdmin;
  const{data,error}=await sb.from('members').select('parking_id,parkings(name,code)').eq('user_id',user.id); if(error)toast(error.message);
  let hoy=()=>'';
  if(data?.length&&![0,6].includes(new Date().getDay())){const ids=data.map(m=>m.parking_id),[mm,bt]=await Promise.all([sb.from('members').select('parking_id,user_id,name').in('parking_id',ids),sb.from('bookings').select('parking_id,user_id').in('parking_id',ids).eq('day',iso(new Date()))]);
    hoy=pid=>{const b=bt.data?.find(x=>x.parking_id===pid);return ' · '+(!b?'Hoy libre':b.user_id===user.id?'Hoy: tú':'Hoy: '+esc(mm.data?.find(x=>x.parking_id===pid&&x.user_id===b.user_id)?.name||''))}}
  $('list').innerHTML=data?.length?data.map(m=>`<button class="pk" data-p="${m.parking_id}"><span class="pico">🅿️</span><span><b>${esc(m.parkings.name)}</b><small>Código ${esc(m.parkings.code)}${hoy(m.parking_id)}</small></span><span class="chev">›</span></button>`).join('')
    :'<div class="empty"><div>🚗</div><b>Aún no tienes parkings</b>Únete con un código o crea uno nuevo.</div>';
  if(!data?.length)$('dj').open=true;
  const jcode=localStorage.getItem('joinCode'); if(jcode){$('jc').value=jcode;$('dj').open=true;$('jw').focus()}
  $('list').onclick=e=>{const p=e.target.closest('[data-p]')?.dataset.p;if(p)viewParking(p)};
  $('cr').onclick=()=>busy($('cr'),async()=>{const{data,error}=await sb.rpc('create_parking',{p_name:val('cn'),p_pass:$('cw').value,p_spot:val('cs'),p_user:val('cu'),p_plate:val('cp')});
    if(error)return toast(error.message); viewParking(data[0].id)});
  $('jn').onclick=()=>busy($('jn'),async()=>{const{data,error}=await sb.rpc('join_parking',{p_code:val('jc'),p_pass:$('jw').value,p_user:val('ju'),p_plate:val('jp')});
    if(error)return toast(error.message); localStorage.removeItem('joinCode'); viewParking(data)});
}

async function viewParking(id){
  localStorage.setItem('parking',id); leaveChat();
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
    if(!bk){st=`<span class="n free">${past?'Sin reserva':'Disponible'}</span>`;if(!past)act=moving?`<button data-to="${k}">Mover aquí</button>`:`<button data-d="${k}">Reservar</button>`}
    else if(me){st=`${av(m?.name,col(user.id))}<span class="n"><small>Reservado por</small><b>${esc(m?.name)} (tú)</b></span>`;if(!past)act=`<button class="sec" data-m="${k}">${moving===k?'Eligiendo…':'Cambiar'}</button><button class="sec" data-r="${k}">Liberar</button>`}
    else st=`${av(m?.name,col(bk.user_id))}<span class="n"><small>Reservado por</small><b>${esc(m?.name)}</b></span>`;
    return `<div class="day ${k===today?'today':''} ${past?'past':''} ${me?'mine':''}"><div class="dt"><small>${n.slice(0,3)}</small><b>${d.getDate()}</b><i>${d.toLocaleDateString('es-ES',{month:'short'})}</i></div>
      <div class="st">${st}${k===today?'<em class="hoy">Hoy</em>':''}</div><div class="act">${act}</div></div>`}).join('');
  const f=d=>d.getDate()+'/'+(d.getMonth()+1), r=Math.round((ws-cw)/6048e5);
  const lbl={0:'Esta semana',1:'Próxima semana','-1':'Semana pasada'}[r]||'';
  const banner=moving?`<div class="banner row"><span>Elige el nuevo día para tu reserva del <b>${moving.split('-').reverse().slice(0,2).join('/')}</b></span><button class="sec" id="cm">Cancelar</button></div>`:'';
  app.innerHTML=`<div class="hero"><div class="row"><button class="ghost ic" id="bk">‹</button><div class="chips">${P.spot?`<span class="chip">Plaza ${esc(P.spot)}</span>`:''}<button class="chip" id="sh">📤 Compartir</button><button class="chip" id="cp" title="Copiar código">${esc(P.code)} ⧉</button></div></div>
    <h1>${esc(P.name)}</h1><div class="people">${members.map(m=>`<div class="pp">${av(m.name,col(m.user_id))}<div><b>${esc(m.name)}${m.user_id===user.id?' (tú)':''}</b><span class="plate">${esc(m.plate||'—')}</span></div></div>`).join('')}</div></div>
    <div class="tabs" style="margin:14px 0 0"><button class="on">📅 Calendario</button><button id="tch">💬 Chat</button></div>
    ${banner}<div class="wk"><button class="sec ic" id="pv">‹</button><div><b>${f(ws)} – ${f(addDays(ws,4))}</b><small>${lbl}</small></div><button class="sec ic" id="nx">›</button></div>
    <div class="use"><span>Tus días</span><div class="dots">${dots}</div><b>${mine}/${P.max_days}</b></div>${days}${members.some(m=>m.user_id===user.id)?'<button class="link" id="lv" style="display:block;margin:18px auto 0;color:#dc2626">Salir de este parking</button>':''}`+nav('home');
  $('bk').onclick=()=>isAdmin&&!members.some(m=>m.user_id===user.id)?viewAdmin():viewHome();
  $('cp').onclick=()=>{navigator.clipboard?.writeText(P.code);toast('Código copiado. Recuerda pasar también la contraseña.')};
  $('pv').onclick=()=>{ws=addDays(ws,-7);loadWeek()}; $('nx').onclick=()=>{ws=addDays(ws,7);loadWeek()};
  $('sh').onclick=async()=>{const url=location.origin+location.pathname+'?codigo='+P.code,text=`Únete a mi parking "${P.name}" 🅿️\nAbre: ${url}\nCódigo: ${P.code}\n(La contraseña te la paso aparte)`;
    if(navigator.share){try{await navigator.share({text})}catch{}}else window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank')};
  if($('lv'))$('lv').onclick=async()=>{if(!confirm('¿Salir de "'+P.name+'"? Se borrarán tus reservas futuras y dejarás de ver este parking.'))return;
    await sb.from('bookings').delete().eq('parking_id',P.id).eq('user_id',user.id).gte('day',iso(new Date()));
    const{error}=await sb.from('members').delete().eq('parking_id',P.id).eq('user_id',user.id);
    if(error)return toast(error.message);toast('Has salido del parking');viewHome()};
  $('tch').onclick=viewChat; bindNav();
  if(moving)$('cm').onclick=()=>{moving=null;draw()};
  app.querySelectorAll('button[data-d],button[data-r],button[data-m],button[data-to]').forEach(b=>b.onclick=async()=>{
    const s=b.dataset; let q;
    if(s.m){moving=moving===s.m?null:s.m;return draw()}
    if(s.r&&!confirm('¿Liberar tu reserva del '+s.r.split('-').reverse().slice(0,2).join('/')+'?'))return;
    b.disabled=true;
    if(s.d)q=sb.from('bookings').insert({parking_id:P.id,day:s.d});
    if(s.r)q=sb.from('bookings').delete().eq('parking_id',P.id).eq('day',s.r);
    if(s.to)q=sb.from('bookings').update({day:s.to}).eq('parking_id',P.id).eq('day',moving);
    const{error}=await q; moving=null;
    toast(error?(error.code==='23505'?'Ese día ya está reservado':error.message):s.d?'Día reservado ✅':s.r?'Reserva liberada':'Reserva cambiada ✅'); loadWeek()});
}

let unread=0,notifCh=null,chatCh=null,msgs=[];
const setBadge=()=>document.querySelectorAll('.bdg').forEach(e=>{e.textContent=unread>9?'9+':unread;e.hidden=!unread});
const ago=t=>{const s=(Date.now()-new Date(t))/1000;return s<60?'ahora':s<3600?Math.floor(s/60)+' min':s<86400?Math.floor(s/3600)+' h':new Date(t).toLocaleDateString('es-ES',{day:'numeric',month:'short'})};
function nav(a){return `<nav class="bar"><button data-go="home" class="${a==='home'?'on':''}"><span>🅿️</span>Parkings</button><button data-go="notif" class="${a==='notif'?'on':''}"><span>🔔</span>Avisos<em class="bdg" ${unread?'':'hidden'}>${unread>9?'9+':unread}</em></button></nav>`}
function bindNav(){app.querySelectorAll('.bar button').forEach(b=>b.onclick=()=>b.dataset.go==='home'?viewHome():viewNotifs())}
function leaveChat(){if(chatCh){sb.removeChannel(chatCh);chatCh=null}}
async function refreshUnread(){const{count}=await sb.from('notifications').select('id',{count:'exact',head:true}).eq('seen',false);unread=count||0;setBadge()}
function listen(){
  if(notifCh)return;
  notifCh=sb.channel('notif-'+user.id).on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:'user_id=eq.'+user.id},p=>{
    const n=p.new;
    if(chatCh&&n.kind==='mensaje'&&P&&n.parking_id===P.id){sb.from('notifications').update({seen:true}).eq('id',n.id);return}
    unread++;setBadge();toast('🔔 '+n.msg);
    if(document.getElementById('nl'))viewNotifs();
    else if(P&&n.parking_id===P.id&&n.kind==='reserva'&&document.querySelector('.day'))loadWeek();
  }).subscribe();
}

async function viewNotifs(){
  leaveChat(); localStorage.removeItem('parking');
  app.innerHTML=`<div class="fade"><div class="top"><h1>Avisos</h1><button class="sec" id="nc">Borrar todos</button></div><div id="ob"></div><div id="nl">${skel()}</div></div>`+nav('notif'); bindNav();
  const cut=new Date(Date.now()-30*864e5).toISOString();
  const[{data,error},{count:old}]=await Promise.all([sb.from('notifications').select('id,parking_id,kind,msg,seen,created_at').order('created_at',{ascending:false}).limit(50),
    sb.from('notifications').select('id',{count:'exact',head:true}).lt('created_at',cut)]);
  if(error)return toast(error.message);
  if(old)$('ob').innerHTML=`<div class="banner row"><span>Tienes <b>${old}</b> aviso${old>1?'s':''} de hace más de 30 días.</span><button id="bo">Borrar antiguos</button></div>`;
  $('nl').innerHTML=data.length?data.map(n=>`<button class="nt ${n.seen?'':'new'}" data-p="${n.parking_id}" data-k="${n.kind}"><span class="pico">${n.kind==='mensaje'?'💬':'🅿️'}</span><span style="flex:1;min-width:0"><b>${esc(n.msg)}</b><small>${ago(n.created_at)}</small></span></button>`).join('')
    :'<div class="empty"><div>🔔</div><b>Sin avisos todavía</b>Aquí verás cuándo tus compañeros reservan, cambian un día o te escriben.</div>';
  $('nl').onclick=async e=>{const b=e.target.closest('[data-p]');if(!b||b.dataset.p==='null')return;await viewParking(b.dataset.p);if(b.dataset.k==='mensaje')viewChat()};
  if(old)$('bo').onclick=async()=>{if(!confirm('¿Seguro que quieres borrar '+old+' aviso'+(old>1?'s':'')+' de hace más de 30 días?'))return;
    const{error}=await sb.from('notifications').delete().lt('created_at',cut);if(error)return toast(error.message);toast('Avisos antiguos borrados');viewNotifs()};
  $('nc').onclick=async()=>{if(!data.length)return toast('No hay avisos que borrar');if(!confirm('¿Seguro que quieres borrar todos tus avisos?'))return;
    const{error}=await sb.from('notifications').delete().gte('id',0);if(error)return toast(error.message);viewNotifs()};
  if(data.some(n=>!n.seen))await sb.from('notifications').update({seen:true}).eq('seen',false);
  unread=0;setBadge();
}

async function viewChat(){
  leaveChat();
  const{data,error}=await sb.from('messages').select('id,user_id,body,created_at').eq('parking_id',P.id).order('created_at',{ascending:false}).limit(100);
  if(error)return toast(error.message); msgs=data.reverse();
  app.innerHTML=`<div class="fade"><div class="top"><button class="sec ic" id="bk">‹</button><h1 style="font-size:20px;flex:1;text-align:center">${esc(P.name)}</h1><span style="width:42px"></span></div>
  <div class="tabs"><button id="tcal">📅 Calendario</button><button class="on">💬 Chat</button></div>
  <div class="chat" id="cb"></div><div class="cin"><input id="ci" placeholder="Escribe un mensaje…" maxlength="500" autocomplete="off"><button class="ic" id="cs">➤</button></div></div>`+nav('home'); bindNav();
  paintMsgs();
  $('bk').onclick=viewHome; $('tcal').onclick=()=>{leaveChat();draw()};
  const send=async()=>{const body=val('ci');if(!body)return;$('ci').value='';
    const{data,error}=await sb.from('messages').insert({parking_id:P.id,body}).select('id,user_id,body,created_at').single();
    if(error){toast(error.message);$('ci').value=body;return} addMsg(data)};
  $('cs').onclick=send; $('ci').onkeydown=e=>{if(e.key==='Enter')send()};
  chatCh=sb.channel('chat-'+P.id).on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:'parking_id=eq.'+P.id},p=>addMsg(p.new)).subscribe();
  await sb.from('notifications').update({seen:true}).eq('parking_id',P.id).eq('kind','mensaje').eq('seen',false); refreshUnread();
}
function addMsg(m){if(msgs.some(x=>x.id===m.id))return;msgs.push(m);paintMsgs()}
function paintMsgs(){
  const b=$('cb'); if(!b)return; let last='';
  b.innerHTML=msgs.length?msgs.map(m=>{
    const me=m.user_id===user.id,mem=members.find(x=>x.user_id===m.user_id),d=new Date(m.created_at),day=d.toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'});
    const sep=day!==last?`<div class="dsep">${day}</div>`:''; last=day;
    return sep+`<div class="msg ${me?'me':''}">${me?'':`<small>${esc(mem?.name||'Admin')}</small>`}<div class="bub">${esc(m.body)}</div><small>${d.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}</small></div>`}).join('')
    :'<div class="empty"><div>💬</div><b>Aún no hay mensajes</b>Escribe el primero para tu compañero.</div>';
  b.scrollTop=b.scrollHeight;
}

async function viewAdmin(){
  localStorage.removeItem('parking'); leaveChat();
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
{const c=new URLSearchParams(location.search).get('codigo');if(c){localStorage.setItem('joinCode',c.toUpperCase().slice(0,12));history.replaceState(null,'',location.pathname)}}
init();
