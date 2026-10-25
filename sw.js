// Service worker: red primero (siempre la última versión) y copia local si no hay conexión
const V='pk-v1', SHELL=['./','index.html','styles.css','app.js','manual.html','manifest.json','icon-192.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=='GET')return;
  if(u.origin!==location.origin&&u.hostname!=='cdn.jsdelivr.net')return; // Supabase no se toca
  e.respondWith(fetch(r).then(res=>{if(res.ok||res.type==='opaque'){const c=res.clone();caches.open(V).then(x=>x.put(r,c))}return res})
    .catch(()=>caches.match(r).then(m=>m||caches.match('index.html'))));
});
