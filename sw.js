// 서비스워커: 네트워크 우선, 끊기면 캐시. 교실 와이파이가 흔들려도 화면은 뜬다.
const CACHE = 'emoren-classroom-v3';
const SHELL = [
  // 한 줄에 파일 하나, 알파벳 순 / one file per line, sorted (tests/unit/shell.test.mjs가 검사)
  './',
  'index.html',
  'assets/icon.svg',
  'css/app.css',
  'js/app.js',
  'js/clock.js',
  'js/demo/ghost.js',
  'js/i18n.js',
  'js/locales/en.js',
  'js/locales/ko.js',
  'js/pack.js',
  'js/route.js',
  'js/store.js',
  'js/sync/artifactdb.js',
  'js/sync/firebase.js',
  'js/sync/index.js',
  'js/sync/local.js',
  'js/ui/character.js',
  'js/ui/speech.js',
  'js/util.js',
  'js/views/demo.js',
  'js/views/home.js',
  'js/views/parent.js',
  'js/views/studio.js',
  'js/views/teacher.js',
  'js/views/tv.js',
  'manifest.webmanifest',
  'packs/index.json',
  'packs/mind-weather.en.json',
  'packs/mind-weather.ko.json',
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
