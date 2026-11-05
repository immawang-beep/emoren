// 단위 테스트: 같은 브라우저 안 동기화(js/sync/local.js)와 어댑터 고르기(js/sync/index.js).
// 브라우저 전역(window·localStorage·BroadcastChannel)을 가짜로 심은 뒤에 모듈을 불러온다. 실행: npm test
// Unit tests for the same-browser sync adapter and createSync(). Browser globals are faked before import.
import test from 'node:test';
import assert from 'node:assert/strict';

// ---------- 가짜 브라우저 전역 / fake browser globals ----------

// window: 'storage' 리스너만 기록한다 / records the 'storage' handlers only
const storageHandlers = new Set();
globalThis.window = {
  addEventListener(type, fn) { if (type === 'storage') storageHandlers.add(fn); },
  removeEventListener(type, fn) { if (type === 'storage') storageHandlers.delete(fn); },
};
const fireStorage = (key, newValue) => { for (const fn of [...storageHandlers]) fn({ key, newValue, oldValue: null }); };

// localStorage: 메모리 안 / in-memory
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(String(k)) ? store.get(String(k)) : null),
  setItem: (k, v) => { store.set(String(k), String(v)); },
  removeItem: (k) => { store.delete(String(k)); },
  clear: () => store.clear(),
  key: (i) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
};

// BroadcastChannel: 같은 이름의 다른 인스턴스에게만, 마이크로태스크로, 복제본을 전달한다
// fans a structured clone out to the other same-name instances, asynchronously via queueMicrotask
const channels = new Map();
class FakeBroadcastChannel {
  constructor(name) {
    this.name = name; this.onmessage = null; this.closed = false;
    if (!channels.has(name)) channels.set(name, new Set());
    channels.get(name).add(this);
  }
  postMessage(data) {
    if (this.closed) throw new Error('InvalidStateError: channel is closed');
    for (const other of channels.get(this.name)) {
      if (other === this) continue;
      const msg = structuredClone(data);
      queueMicrotask(() => { if (!other.closed && typeof other.onmessage === 'function') other.onmessage({ data: msg }); });
    }
  }
  close() { this.closed = true; channels.get(this.name)?.delete(this); }
}
globalThis.BroadcastChannel = FakeBroadcastChannel;
const channelsOf = (code) => channels.get(`emoren-classroom:${code}`) || new Set();

const { createLocalSync } = await import('../../js/sync/local.js');
const { createSync } = await import('../../js/sync/index.js');

// ---------- 도우미 / helpers ----------
const KEY = (code) => `emoren-classroom:room:${code}`;
const flush = () => new Promise((r) => setTimeout(r, 0));          // 마이크로태스크 전부 + 매크로태스크 한 번
const microtask = () => new Promise((r) => queueMicrotask(r));     // 마이크로태스크 한 바퀴만
const room = (code, rev = 1) => ({ code, rev, phase: 'waiting', updatedAt: 1000 + rev });
const collector = () => { const calls = []; const fn = (s) => calls.push(s); fn.calls = calls; return fn; };

// ---------- createLocalSync ----------

test("kind는 'local'이고, set()은 방 키에 JSON으로 저장하고 자기 구독자에게 바로 알린다", async () => {
  const sync = createLocalSync('SET1');
  assert.equal(sync.kind, 'local');
  assert.equal(await sync.get(), null, '아직 저장된 것이 없다');
  const fn = collector();
  sync.subscribe(fn);
  const state = room('SET1');
  await sync.set(state);
  assert.deepEqual(fn.calls, [state], '쓴 쪽의 구독자도 받는다');
  assert.deepEqual(JSON.parse(localStorage.getItem(KEY('SET1'))), state, 'emoren-classroom:room:<code> 아래 JSON');
  assert.deepEqual(await sync.get(), state);
  sync.close();
});

test('subscribe()는 저장된 값을 마이크로태스크로 한 번만 다시 보낸다(이미 해지한 쪽은 제외)', async () => {
  const state = room('SUB1');
  localStorage.setItem(KEY('SUB1'), JSON.stringify(state));
  const sync = createLocalSync('SUB1');
  const kept = collector();
  const gone = collector();
  sync.subscribe(kept);
  const unsubGone = sync.subscribe(gone);
  unsubGone();
  assert.equal(kept.calls.length, 0, '동기적으로는 부르지 않는다');
  await microtask();
  assert.deepEqual(kept.calls, [state], '마이크로태스크 뒤에 현재 값이 온다');
  assert.equal(gone.calls.length, 0, '다시 보내기 전에 해지한 쪽은 받지 않는다');
  await flush();
  assert.equal(kept.calls.length, 1, '딱 한 번만');
  sync.close();

  const empty = createLocalSync('SUB2');
  const fn = collector();
  empty.subscribe(fn);
  await flush();
  assert.equal(fn.calls.length, 0, '저장된 값이 없으면 다시 보내지 않는다');
  empty.close();
});

test('같은 코드의 다른 인스턴스는 BroadcastChannel로 상태를 받고, 다른 코드는 받지 않는다', async () => {
  const a = createLocalSync('BC01');
  const b = createLocalSync('BC01');
  const c = createLocalSync('BC02');
  assert.equal(channelsOf('BC01').size, 2, '채널 이름은 코드별: emoren-classroom:<code>');
  assert.equal(channelsOf('BC02').size, 1);
  const onB = collector();
  const onC = collector();
  b.subscribe(onB);
  c.subscribe(onC);

  const state = room('BC01');
  const pending = a.set(state);
  assert.equal(onB.calls.length, 0, '다른 탭에는 비동기로 간다');
  await pending;
  await flush();
  assert.deepEqual(onB.calls, [state]);
  assert.equal(onC.calls.length, 0, '다른 코드의 방은 받지 않는다');

  await a.set({ ...room('BC01', 2), code: 'ZZZZ' });
  await flush();
  assert.equal(onB.calls.length, 1, '코드가 다른 메시지는 무시한다');
  a.close(); b.close(); c.close();
});

test('storage 이벤트: 키와 newValue가 맞으면 알리고, 다른 키·깨진 JSON·삭제는 무시한다', async () => {
  const sync = createLocalSync('ST01');
  const fn = collector();
  sync.subscribe(fn);
  const state = room('ST01');
  fireStorage(KEY('ST01'), JSON.stringify(state));
  assert.deepEqual(fn.calls, [state]);
  fireStorage(KEY('OTHR'), JSON.stringify(room('OTHR')));
  assert.equal(fn.calls.length, 1, '다른 키');
  assert.doesNotThrow(() => fireStorage(KEY('ST01'), '{깨진 json'));
  assert.equal(fn.calls.length, 1, '깨진 JSON');
  fireStorage(KEY('ST01'), null);
  assert.equal(fn.calls.length, 1, '삭제(newValue null)');
  sync.close();
});

test('구독을 해지하면 더 받지 않는다', async () => {
  const a = createLocalSync('UN01');
  const b = createLocalSync('UN01');
  const fn = collector();
  const unsub = a.subscribe(fn);
  unsub();
  await a.set(room('UN01'));
  await b.set(room('UN01', 2));
  fireStorage(KEY('UN01'), JSON.stringify(room('UN01', 3)));
  await flush();
  assert.equal(fn.calls.length, 0);
  a.close(); b.close();
});

test('close()는 구독자를 비우고, storage 리스너를 떼고, 채널을 닫는다', async () => {
  const before = storageHandlers.size;
  const a = createLocalSync('CL01');
  assert.equal(storageHandlers.size, before + 1, 'storage 리스너를 하나 단다');
  const ch = [...channelsOf('CL01')][0];
  assert.ok(ch, '채널을 하나 연다');
  const fn = collector();
  a.subscribe(fn);

  a.close();
  assert.equal(storageHandlers.size, before, 'storage 리스너를 뗐다');
  assert.equal(ch.closed, true, '채널을 닫았다');
  assert.equal(channelsOf('CL01').size, 0);

  fireStorage(KEY('CL01'), JSON.stringify(room('CL01')));
  const b = createLocalSync('CL01');
  await b.set(room('CL01', 2));
  await flush();
  assert.equal(fn.calls.length, 0, '닫힌 뒤에는 어느 길로도 오지 않는다');
  b.close();
});

test('저장된 JSON이 깨져 있으면 get()은 null이고 subscribe()는 다시 보내지 않는다', async () => {
  localStorage.setItem(KEY('BAD1'), '{이건 json이 아님');
  const sync = createLocalSync('BAD1');
  assert.equal(await sync.get(), null);
  const fn = collector();
  sync.subscribe(fn);
  await flush();
  assert.equal(fn.calls.length, 0);
  sync.close();
});

test('localStorage.setItem이 던져도 set()은 던지지 않고 구독자와 다른 탭에는 전달한다', async (t) => {
  const a = createLocalSync('QU01');
  const b = createLocalSync('QU01');
  const onA = collector();
  const onB = collector();
  a.subscribe(onA);
  b.subscribe(onB);
  const warn = t.mock.method(console, 'warn', () => {});
  t.mock.method(localStorage, 'setItem', () => { throw new Error('QuotaExceededError'); });

  const state = room('QU01');
  await assert.doesNotReject(() => a.set(state));
  assert.deepEqual(onA.calls, [state]);
  await flush();
  assert.deepEqual(onB.calls, [state]);
  assert.equal(warn.mock.callCount(), 1, '저장 실패는 경고 한 줄로 남긴다');
  assert.equal(localStorage.getItem(KEY('QU01')), null, '저장은 안 됐다');
  a.close(); b.close();
});

test('구독자 하나가 던져도 나머지는 받는다', async (t) => {
  const sync = createLocalSync('ER01');
  const error = t.mock.method(console, 'error', () => {});
  sync.subscribe(() => { throw new Error('boom'); });
  const fn = collector();
  sync.subscribe(fn);
  const state = room('ER01');
  await sync.set(state);
  assert.deepEqual(fn.calls, [state]);
  assert.equal(error.mock.callCount(), 1);
  sync.close();
});

// ---------- createSync ----------

test("createSync: prefer 'local'이면 local 어댑터", async () => {
  const sync = await createSync('CS01', { prefer: 'local' });
  assert.equal(sync.kind, 'local');
  sync.close();
});

test("createSync: localStorage emoren.sync = 'local'이면 local 어댑터", async () => {
  localStorage.setItem('emoren.sync', 'local');
  try {
    const sync = await createSync('CS02');
    assert.equal(sync.kind, 'local');
    sync.close();
  } finally { localStorage.removeItem('emoren.sync'); }
});

test('createSync: window.claude도 Firebase 설정도 없으면 local로 내려온다', async (t) => {
  assert.equal(window.claude, undefined);
  assert.equal(globalThis.EMOREN_FIREBASE_CONFIG, undefined);
  const warn = t.mock.method(console, 'warn', () => {});
  const sync = await createSync('CS03');
  assert.equal(sync.kind, 'local');
  assert.equal(warn.mock.callCount(), 0, '없는 어댑터는 조용히(null로) 건너뛴다');
  sync.close();
});

test('createSync: 어댑터가 던지면 경고하고 다음으로 넘어간다', async (t) => {
  window.claude = { use: async () => { throw new Error('db 없음'); } };
  try {
    const warn = t.mock.method(console, 'warn', () => {});
    const sync = await createSync('CS04');
    assert.equal(sync.kind, 'local');
    assert.equal(warn.mock.callCount(), 1);
    sync.close();
  } finally { delete window.claude; }
});

test('createSync: 쓸 수 없는 강제 설정(없는 어댑터·모르는 이름)도 local로 끝난다', async () => {
  const forced = await createSync('CS05', { prefer: 'artifact' });
  assert.equal(forced.kind, 'local', "window.claude가 없으면 'artifact' 강제도 local");
  forced.close();
  const unknown = await createSync('CS06', { prefer: 'nope' });
  assert.equal(unknown.kind, 'local');
  unknown.close();
});
