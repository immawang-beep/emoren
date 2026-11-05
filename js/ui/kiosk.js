// 키오스크 / kiosk mode for the classroom TV: 첫 탭 뒤에는 손댈 일이 없게.
// 화면 꺼짐 방지(wake lock), 3초 가만히 있으면 마우스 커서 숨김(.idle → cursor: none),
// 무대를 두 번 누르면 전체 화면으로 다시 들어간다. 지원하지 않는 브라우저에서는 조용히 넘어간다.
// After the first tap nothing else should need touching: keep the screen awake, hide the mouse cursor
// after 3 s idle, re-enter full screen on double-click. Every API is guarded; nothing throws.
//
//   const kiosk = createKiosk(stageEl);
//   kiosk.enter()     소리 켜기(전체 화면) 클릭 안에서 부른다 / call from the unlock click
//   kiosk.exit()      wake lock 해제, 커서 복구, 리스너 제거 / release, restore cursor, detach
//   kiosk.destroy()   exit() + 더는 쓰지 않음 / exit and never re-enter
export function createKiosk(el, { idleMs = 3000 } = {}) {
  const doc = typeof document !== 'undefined' ? document : null;
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  const on = (target, ev, fn) => { if (target && typeof target.addEventListener === 'function') target.addEventListener(ev, fn); };
  const off = (target, ev, fn) => { if (target && typeof target.removeEventListener === 'function') target.removeEventListener(ev, fn); };
  const cls = (name, add) => { try { if (el && el.classList) el.classList[add ? 'add' : 'remove'](name); } catch { /* 가짜 요소 / fake element */ } };

  let entered = false;
  let destroyed = false;
  let lock = null;
  let idleTimer = null;

  async function requestLock() {
    if (!entered || destroyed || lock || !nav || !nav.wakeLock || typeof nav.wakeLock.request !== 'function') return;
    if (doc && doc.visibilityState && doc.visibilityState !== 'visible') return;
    try {
      const l = await nav.wakeLock.request('screen');
      lock = l;
      on(l, 'release', () => { if (lock === l) lock = null; });
    } catch { lock = null; /* 절전 모드 등: 조용히 / battery saver etc.: stay quiet */ }
  }
  async function releaseLock() {
    const l = lock; lock = null;
    if (l && typeof l.release === 'function') { try { await l.release(); } catch { /* 이미 풀림 / already released */ } }
  }

  const armIdle = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => cls('idle', true), idleMs);
  };
  const onMove = () => { cls('idle', false); armIdle(); };
  const onVisible = () => { if (!doc || doc.visibilityState === 'visible') requestLock(); };
  const onDbl = () => {
    if (!doc || doc.fullscreenElement || !el || typeof el.requestFullscreen !== 'function') return;
    try { const p = el.requestFullscreen(); if (p && p.catch) p.catch(() => {}); } catch { /* 전체 화면 불가 / no full screen */ }
  };

  return {
    async enter() {
      if (entered || destroyed) return;
      entered = true;
      on(el, 'mousemove', onMove);
      on(el, 'pointerdown', onMove);
      on(el, 'dblclick', onDbl);
      on(doc, 'visibilitychange', onVisible);
      armIdle();
      await requestLock();
    },
    async exit() {
      if (!entered) return;
      entered = false;
      clearTimeout(idleTimer);
      cls('idle', false);
      off(el, 'mousemove', onMove);
      off(el, 'pointerdown', onMove);
      off(el, 'dblclick', onDbl);
      off(doc, 'visibilitychange', onVisible);
      await releaseLock();
    },
    async destroy() {
      destroyed = true;
      await this.exit();
    },
    get active() { return entered; },
    get awake() { return !!lock; },
  };
}
