// 같은 브라우저 안의 탭끼리 동기화: BroadcastChannel + localStorage.
// 한 PC에서 TV 탭과 강사 탭을 같이 띄워 시연할 때, 또는 네트워크가 없을 때 쓴다.

export function createLocalSync(code) {
  const key = `emoren-classroom:room:${code}`;
  const chName = `emoren-classroom:${code}`;
  const bc = 'BroadcastChannel' in globalThis ? new BroadcastChannel(chName) : null;
  const listeners = new Set();

  const read = () => {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; }
  };
  const emit = (state) => { for (const fn of listeners) { try { fn(state); } catch (e) { console.error(e); } } };

  if (bc) bc.onmessage = (ev) => { if (ev.data && ev.data.code === code) emit(ev.data); };
  const onStorage = (ev) => {
    if (ev.key !== key || !ev.newValue) return;
    try { emit(JSON.parse(ev.newValue)); } catch { /* 깨진 값은 무시 */ }
  };
  window.addEventListener('storage', onStorage);

  return {
    kind: 'local',
    async get() { return read(); },
    async set(state) {
      try { localStorage.setItem(key, JSON.stringify(state)); } catch (e) { console.warn('[sync:local] 저장 실패', e); }
      if (bc) bc.postMessage(state);
      emit(state);
    },
    subscribe(fn) {
      listeners.add(fn);
      const cur = read();
      if (cur) queueMicrotask(() => { if (listeners.has(fn)) fn(cur); });
      return () => listeners.delete(fn);
    },
    close() {
      listeners.clear();
      window.removeEventListener('storage', onStorage);
      if (bc) bc.close();
    },
  };
}
