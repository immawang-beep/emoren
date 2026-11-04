// Firebase Realtime Database 동기화. config.js(커밋하지 않음)에 설정이 있을 때만 켜진다.
//   <script src="config.js"></script> 안에서
//   window.EMOREN_FIREBASE_CONFIG = { apiKey: ..., databaseURL: ..., projectId: ..., appId: ... }
// 운영 배포에서 쓰는 경로. 교실 TV와 강사 폰이 다른 네트워크에 있어도 함께 움직인다.
// 익명 로그인을 먼저 시도하므로 DB 규칙을 ".write": "auth != null" 로 둘 수 있다(README 참고).
// 아직 실제 프로젝트로 검증하지 않았다.

const SDK = 'https://www.gstatic.com/firebasejs/10.14.1';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`스크립트 로드 실패: ${src}`));
    document.head.appendChild(s);
  });
}

export async function createFirebaseSync(code) {
  const cfg = globalThis.EMOREN_FIREBASE_CONFIG;
  if (!cfg || !cfg.databaseURL) return null;
  await loadScript(`${SDK}/firebase-app-compat.js`);
  await loadScript(`${SDK}/firebase-database-compat.js`);
  const fb = globalThis.firebase;
  if (!fb) return null;
  const app = fb.apps && fb.apps.length ? fb.app() : fb.initializeApp(cfg);
  if (cfg.anonymousAuth !== false) {
    try {
      await loadScript(`${SDK}/firebase-auth-compat.js`);
      if (!fb.auth(app).currentUser) await fb.auth(app).signInAnonymously();
    } catch (e) { console.warn('[sync:firebase] 익명 로그인 실패(읽기 전용일 수 있음)', e); }
  }
  const ref = fb.database(app).ref(`rooms/${code}`);

  const listeners = new Set();
  let last = null;
  const handler = (snap) => {
    const d = snap.val();
    if (!d) return;
    last = d;
    for (const fn of listeners) { try { fn(d); } catch (e) { console.error(e); } }
  };
  ref.on('value', handler, (err) => console.warn('[sync:firebase] 구독 오류', err));

  return {
    kind: 'firebase',
    async get() {
      if (last) return last;
      const snap = await ref.get();
      return snap.exists() ? snap.val() : null;
    },
    async set(state) {
      try { await ref.set(state); } catch (e) { console.warn('[sync:firebase] 쓰기 실패', e); }
    },
    subscribe(fn) {
      listeners.add(fn);
      if (last) queueMicrotask(() => { if (listeners.has(fn)) fn(last); });
      return () => listeners.delete(fn);
    },
    close() {
      listeners.clear();
      ref.off('value', handler);
    },
  };
}
