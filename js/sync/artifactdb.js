// 클라우드 동기화: claude.ai 아티팩트로 배포됐을 때 제공되는 공유 문서 저장소(db 기능).
// 다른 환경(일반 웹서버)에서는 window.claude가 없으므로 null을 돌려주고 다음 어댑터로 넘어간다.
// 문서 하나 = 방 하나: rooms/<코드>. 강사 폰만 쓰고 TV·보호자 페이지는 구독만 한다.

export async function createArtifactSync(code) {
  const claude = globalThis.window && window.claude;
  if (!claude || typeof claude.use !== 'function') return null;
  const db = await claude.use('db');
  if (!db) return null;

  const ref = db.doc(`rooms/${code}`);
  const listeners = new Set();
  let last = null;
  let chain = Promise.resolve();

  const unsub = ref.onSnapshot(
    (snap) => {
      const d = snap.exists ? snap.data() : null;
      if (!d) return;
      last = d;
      for (const fn of listeners) { try { fn(d); } catch (e) { console.error(e); } }
    },
    (err) => console.warn('[sync:artifact] 구독 종료', err && err.code),
  );

  return {
    kind: 'artifact',
    async get() {
      if (last) return last;
      const snap = await ref.get();
      return snap.exists ? snap.data() : null;
    },
    set(state) {
      // 문서당 한 번에 한 쓰기: 직렬로 묶는다.
      chain = chain.then(() => ref.set(state)).catch((e) => console.warn('[sync:artifact] 쓰기 실패', e && e.code));
      return chain;
    },
    subscribe(fn) {
      listeners.add(fn);
      if (last) queueMicrotask(() => { if (listeners.has(fn)) fn(last); });
      return () => listeners.delete(fn);
    },
    close() {
      listeners.clear();
      try { unsub(); } catch { /* 이미 끊김 */ }
    },
  };
}
