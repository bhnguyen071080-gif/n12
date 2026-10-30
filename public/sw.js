const CACHE="tv-eam-shell-v1";
const STATIC=["/offline.html","/icon.svg","/manifest.webmanifest"];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(STATIC)));self.skipWaiting();});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("tv-eam-shell-") && k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",event=>{
 const url=new URL(event.request.url);if(url.origin!==self.location.origin || event.request.method!=="GET")return;
 if(STATIC.includes(url.pathname)){event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));return;}
 if(event.request.mode==="navigate")event.respondWith(fetch(event.request).catch(()=>caches.match("/offline.html")));
 // No caching of API calls, authenticated pages, cookies or business records.
});
