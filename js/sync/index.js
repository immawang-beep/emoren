// 동기화 어댑터 고르기.
// 모든 어댑터는 같은 모양이다: { kind, get(), set(state), subscribe(fn) -> unsubscribe, close() }
// 우선순위: 클라우드(아티팩트 db) → Firebase(설정이 있을 때) → 같은 브라우저(BroadcastChannel).
// localStorage 'emoren.sync' = 'local' | 'firebase' | 'artifact' 로 강제할 수 있다(테스트용).

import { createLocalSync } from './local.js';
import { createArtifactSync } from './artifactdb.js';
import { createFirebaseSync } from './firebase.js';
import { readLocal } from '../util.js';

const FACTORIES = {
  artifact: createArtifactSync,
  firebase: createFirebaseSync,
  local: async (code) => createLocalSync(code),
};

export async function createSync(code, { prefer } = {}) {
  const forced = prefer || readLocal('emoren.sync');
  const order = forced && FACTORIES[forced] ? [forced] : ['artifact', 'firebase', 'local'];
  for (const kind of order) {
    try {
      const s = await FACTORIES[kind](code);
      if (s) return s;
    } catch (e) {
      console.warn(`[sync] ${kind} 사용 불가:`, e);
    }
  }
  return createLocalSync(code);
}
