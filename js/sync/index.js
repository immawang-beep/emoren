// 동기화 어댑터 고르기.
// 모든 어댑터는 같은 모양이다: { kind, get(), set(state), subscribe(fn) -> unsubscribe, close() }
// 우선순위: 클라우드(아티팩트 db) → Firebase(설정이 있을 때) → 같은 브라우저(BroadcastChannel).
// localStorage 'emoren.sync' = 'local' | 'firebase' | 'artifact' 로 강제할 수 있다(테스트용).

import { createLocalSync } from './local.js';
import { createArtifactSync } from './artifactdb.js';
import { createFirebaseSync } from './firebase.js';
import { readLocal } from '../util.js';
import { sanitizeRoom } from '../store.js';

const FACTORIES = {
  artifact: createArtifactSync,
  firebase: createFirebaseSync,
  local: async (code) => createLocalSync(code),
};

// 읽는 쪽 울타리. 공유 어댑터(아티팩트 db·Firebase)에서는 코드를 아는 클라이언트라면 누구나 방 문서를 쓸 수 있다.
// 그래서 어댑터가 준 문서는 그대로 화면에 넘기지 않고 sanitizeRoom()으로 아는 키·맞는 타입만 남긴다
// (집계가 문자열이면 TV의 innerHTML에 그대로 들어갈 수 있다). set/close/kind는 그대로 통과한다.
// Read-side guard: on a shared adapter any client that knows the code can write the room document, so every
// document is passed through sanitizeRoom() before a view sees it. set/close/kind pass straight through.
function guarded(s) {
  return {
    kind: s.kind,
    async get() { return sanitizeRoom(await s.get()); },
    set(state) { return s.set(state); },
    subscribe(fn) { return s.subscribe((raw) => { const d = sanitizeRoom(raw); if (d) fn(d); }); },
    close() { return s.close(); },
  };
}

export async function createSync(code, { prefer } = {}) {
  const forced = prefer || readLocal('emoren.sync');
  const order = forced && Object.hasOwn(FACTORIES, forced) ? [forced] : ['artifact', 'firebase', 'local'];
  for (const kind of order) {
    try {
      const s = await FACTORIES[kind](code);
      if (s) return guarded(s);
    } catch (e) {
      console.warn(`[sync] ${kind} 사용 불가:`, e);
    }
  }
  return guarded(createLocalSync(code));
}
