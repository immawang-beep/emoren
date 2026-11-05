// 서비스워커: 네트워크 우선, 끊기면 캐시. 교실 와이파이가 흔들려도 화면은 뜬다.
const CACHE = 'emoren-classroom-v2';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css', 'assets/icon.svg',
  'js/app.js', 'js/util.js', 'js/store.js', 'js/pack.js', 'js/i18n.js', 'js/locales/ko.js', 'js/locales/en.js',
  'js/sync/index.js', 'js/sync/local.js', 'js/sync/artifactdb.js', 'js/sync/firebase.js',
  'js/ui/character.js', 'js/ui/speech.js',
  'js/views/home.js', 'js/views/teacher.js', 'js/views/tv.js', 'js/views/parent.js',
  'packs/index.json', 'packs/mind-weather.ko.json', 'packs/mind-weather.en.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }).catch(() => caches.match(req).then((m) => m || caches.match('index.html'))),
  );
});
