// 단위 테스트: 키오스크(js/ui/kiosk.js)가 Node(document·wakeLock 없음)에서도 던지지 않는다. 실행: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { createKiosk } from '../../js/ui/kiosk.js';

const fakeEl = () => ({ addEventListener() {}, classList: { add() {}, remove() {} } });

test('createKiosk(가짜 요소)는 던지지 않고, enter()는 navigator.wakeLock 없이도 resolve 된다', async () => {
  const kiosk = createKiosk(fakeEl());
  assert.equal(kiosk.active, false);
  await assert.doesNotReject(() => kiosk.enter());
  assert.equal(kiosk.active, true);
  assert.equal(kiosk.awake, false, 'wake lock이 없으니 깨어 있음 표시는 false');
  await assert.doesNotReject(() => kiosk.enter(), '두 번 불러도 괜찮다');
  await assert.doesNotReject(() => kiosk.exit());
  assert.equal(kiosk.active, false);
  await assert.doesNotReject(() => kiosk.destroy());
  await kiosk.enter();
  assert.equal(kiosk.active, false, 'destroy 뒤에는 다시 들어가지 않는다');
});

test('3초 가만히 있으면 .idle을 붙이고, 움직이면 뗀다(가짜 요소·짧은 idleMs)', async () => {
  const classes = new Set();
  const handlers = {};
  const el = {
    addEventListener(ev, fn) { handlers[ev] = fn; },
    removeEventListener(ev) { delete handlers[ev]; },
    classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c) },
  };
  const kiosk = createKiosk(el, { idleMs: 20 });
  await kiosk.enter();
  assert.ok(handlers.mousemove && handlers.dblclick, '움직임·두 번 클릭 리스너');
  await new Promise((r) => setTimeout(r, 40));
  assert.ok(classes.has('idle'), '가만히 있으면 idle');
  handlers.mousemove();
  assert.ok(!classes.has('idle'), '움직이면 커서가 돌아온다');
  assert.doesNotThrow(() => handlers.dblclick(), 'document 없이도 두 번 클릭이 안전하다');
  await kiosk.destroy();
  assert.ok(!handlers.mousemove, 'destroy 뒤 리스너 제거');
});
