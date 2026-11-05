// 단위 테스트: 원격 동기화 어댑터(아티팩트 db, Firebase)를 가짜 객체로 검사한다. 실행: npm test
// Unit tests for the remote sync adapters (js/sync/artifactdb.js, js/sync/firebase.js) using fakes
// for window.claude, document and the Firebase compat SDK. Globals are restored after every test.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createArtifactSync } from '../../js/sync/artifactdb.js';
import { createFirebaseSync } from '../../js/sync/firebase.js';

// ---------- 공통 도우미 / helpers ----------

const ADAPTER_KEYS = ['close', 'get', 'kind', 'set', 'subscribe'];
const GLOBAL_KEYS = ['window', 'document', 'firebase', 'EMOREN_FIREBASE_CONFIG'];
const BASELINE = Object.fromEntries(GLOBAL_KEYS.map((k) => [k, k in globalThis]));

// 매크로태스크 한 번 = 쌓인 마이크로태스크 모두 비움 / one macrotask drains every pending microtask
const flush = () => new Promise((r) => setTimeout(r, 0));

// 전역을 잠시 바꾸고 끝나면(실패해도) 원래대로 돌린다 / swap globals, restore in finally
async function withGlobals(overrides, fn) {
  const saved = Object.keys(overrides).map((k) => [k, Object.prototype.hasOwnProperty.call(globalThis, k), globalThis[k]]);
  Object.assign(globalThis, overrides);
  try {
    return await fn();
  } finally {
    for (const [k, had, v] of saved) {
      if (had) globalThis[k] = v; else delete globalThis[k];
    }
  }
}

afterEach(() => {
  for (const k of GLOBAL_KEYS) assert.equal(k in globalThis, BASELINE[k], `전역 ${k}이(가) 테스트 뒤에 남아 있음`);
});

// 가짜 아티팩트 db: doc(path) → { get, set, onSnapshot } / fake artifact db
function fakeArtifactDb({ doc = null, manual = false, failWhen = () => false, unsubThrows = false } = {}) {
  const log = [];
  const pending = [];
  const calls = { use: [], doc: [], get: 0, unsub: 0 };
  let next = null;
  let onError = null;
  const ref = {
    async get() { calls.get++; return { exists: doc != null, data: () => doc }; },
    set(state) {
      log.push(`set:${state.v}`);
      return new Promise((resolve, reject) => {
        const ok = () => { log.push(`ok:${state.v}`); resolve(); };
        const fail = () => { log.push(`fail:${state.v}`); reject(Object.assign(new Error('denied'), { code: 'permission-denied' })); };
        if (manual) pending.push({ state, resolve: ok, reject: fail });
        else setTimeout(failWhen(state) ? fail : ok, 0);
      });
    },
    onSnapshot(n, e) {
      next = n; onError = e;
      return () => { calls.unsub++; if (unsubThrows) throw new Error('already closed'); };
    },
  };
  const db = { doc(path) { calls.doc.push(path); return ref; } };
  const claude = { use: async (name) => { calls.use.push(name); return name === 'db' ? db : null; } };
  return {
    claude, ref, log, pending, calls,
    hasSnapshot: () => typeof next === 'function',
    emit: (d) => next({ exists: d != null, data: () => d }),
    error: (e) => onError(e),
  };
}

// 가짜 document: 스크립트 태그를 붙이면 비동기로 onload(또는 onerror) / fake document for loadScript
function fakeDocument({ failWhen = () => false } = {}) {
  const loaded = [];
  const document = {
    querySelector: () => null,
    createElement: (tagName) => ({ tagName, src: '', async: false, onload: null, onerror: null }),
    head: {
      appendChild(el) {
        loaded.push(el.src.split('/').pop());
        queueMicrotask(() => { const h = failWhen(el.src) ? el.onerror : el.onload; if (h) h(); });
        return el;
      },
    },
  };
  return { document, loaded };
}

// 가짜 Firebase compat SDK / fake firebase global
function fakeFirebase({ currentUser = null, signInError = null, setError = null, doc = null, apps = [] } = {}) {
  const calls = { initializeApp: [], app: 0, auth: [], signIn: 0, on: [], off: [], get: 0, set: [], path: [] };
  let valueHandler = null;
  let valueError = null;
  const auth = {
    currentUser,
    async signInAnonymously() {
      calls.signIn++;
      if (signInError) throw signInError;
      auth.currentUser = { uid: 'anon', isAnonymous: true };
      return { user: auth.currentUser };
    },
  };
  const ref = {
    on(ev, handler, onErr) { calls.on.push(ev); if (ev === 'value') { valueHandler = handler; valueError = onErr; } },
    off(ev, handler) { calls.off.push({ ev, sameHandler: handler === valueHandler }); },
    async get() { calls.get++; return { exists: () => doc != null, val: () => doc }; },
    async set(state) { calls.set.push(state); if (setError) throw setError; },
  };
  const app = { name: '[DEFAULT]' };
  const firebase = {
    apps,
    initializeApp(cfg) { calls.initializeApp.push(cfg); apps.push(app); return app; },
    app() { calls.app++; return app; },
    auth(a) { calls.auth.push(a); return auth; },
    database(a) { assert.equal(a, app); return { ref(path) { calls.path.push(path); return ref; } }; },
  };
  return {
    firebase, ref, auth, calls,
    hasHandler: () => typeof valueHandler === 'function',
    emit: (d) => valueHandler({ val: () => d }),
    error: (e) => valueError(e),
  };
}

const CFG = { apiKey: 'k', databaseURL: 'https://example.invalid', projectId: 'p', appId: 'a' };

function firebaseEnv(opts = {}, cfg = CFG) {
  const fd = fakeDocument(opts.document);
  const ff = fakeFirebase(opts.firebase);
  return { fd, ff, globals: { EMOREN_FIREBASE_CONFIG: cfg, document: fd.document, firebase: ff.firebase } };
}

// ---------- 아티팩트 db / artifact db ----------

test('artifact: window.claude가 없으면(또는 db 기능이 없으면) null', async () => {
  await withGlobals({ window: undefined }, async () => assert.equal(await createArtifactSync('R1'), null));
  await withGlobals({ window: {} }, async () => assert.equal(await createArtifactSync('R1'), null));
  await withGlobals({ window: { claude: { use: 'nope' } } }, async () => assert.equal(await createArtifactSync('R1'), null));
  await withGlobals({ window: { claude: { use: async () => null } } }, async () => assert.equal(await createArtifactSync('R1'), null));
});

test('artifact: kind는 artifact, rooms/<코드> 문서를 바로 구독한다', async () => {
  const f = fakeArtifactDb();
  await withGlobals({ window: { claude: f.claude } }, async () => {
    const s = await createArtifactSync('R1');
    assert.equal(s.kind, 'artifact');
    assert.deepEqual(Object.keys(s).sort(), ADAPTER_KEYS);
    assert.deepEqual(f.calls.use, ['db']);
    assert.deepEqual(f.calls.doc, ['rooms/R1']);
    assert.equal(f.hasSnapshot(), true);
  });
});

test('artifact: 스냅샷 전 get()은 ref.get()으로 읽는다', async () => {
  const f = fakeArtifactDb({ doc: { v: 7 } });
  await withGlobals({ window: { claude: f.claude } }, async () => {
    const s = await createArtifactSync('R1');
    assert.deepEqual(await s.get(), { v: 7 });
    assert.deepEqual(await s.get(), { v: 7 });
    assert.equal(f.calls.get, 2);
  });
  const empty = fakeArtifactDb();
  await withGlobals({ window: { claude: empty.claude } }, async () => {
    const s = await createArtifactSync('R1');
    assert.equal(await s.get(), null);
    assert.equal(empty.calls.get, 1);
  });
});

test('artifact: 스냅샷 뒤 get()은 캐시를 돌려주고 빈 스냅샷은 무시한다', async () => {
  const f = fakeArtifactDb({ doc: { v: 0 } });
  await withGlobals({ window: { claude: f.claude } }, async () => {
    const s = await createArtifactSync('R1');
    f.emit({ v: 1 });
    assert.deepEqual(await s.get(), { v: 1 });
    f.emit({ v: 2 });
    assert.deepEqual(await s.get(), { v: 2 });
    f.emit(null);
    assert.deepEqual(await s.get(), { v: 2 });
    assert.equal(f.calls.get, 0);
  });
});

test('artifact: set()은 직렬이다 — 두 번째 쓰기는 첫 번째가 끝난 뒤 시작한다', async () => {
  const f = fakeArtifactDb({ manual: true });
  await withGlobals({ window: { claude: f.claude } }, async () => {
    const s = await createArtifactSync('R1');
    const p1 = s.set({ v: 1 });
    const p2 = s.set({ v: 2 });
    await flush();
    assert.deepEqual(f.log, ['set:1']);
    f.pending[0].resolve();
    await flush();
    assert.deepEqual(f.log, ['set:1', 'ok:1', 'set:2']);
    f.pending[1].resolve();
    await Promise.all([p1, p2]);
    assert.deepEqual(f.log, ['set:1', 'ok:1', 'set:2', 'ok:2']);
  });
});

test('artifact: 거부된 set()은 경고만 남기고 다음 쓰기를 막지 않는다', async (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  const f = fakeArtifactDb({ failWhen: (st) => st.v === 2 });
  await withGlobals({ window: { claude: f.claude } }, async () => {
    const s = await createArtifactSync('R1');
    const p1 = s.set({ v: 1 });
    const p2 = s.set({ v: 2 });
    const p3 = s.set({ v: 3 });
    await assert.doesNotReject(p2);
    await Promise.all([p1, p2, p3]);
    assert.deepEqual(f.log, ['set:1', 'ok:1', 'set:2', 'fail:2', 'set:3', 'ok:3']);
    assert.equal(warn.mock.callCount(), 1);
    assert.match(String(warn.mock.calls[0].arguments[0]), /쓰기 실패/);
    assert.equal(warn.mock.calls[0].arguments[1], 'permission-denied');
  });
});

test('artifact: subscribe는 마지막 스냅샷을 마이크로태스크로 재생하고 해지하면 멈춘다', async () => {
  const f = fakeArtifactDb();
  await withGlobals({ window: { claude: f.claude } }, async () => {
    const s = await createArtifactSync('R1');
    const none = [];
    s.subscribe((d) => none.push(d));
    await flush();
    assert.deepEqual(none, []);
    f.emit({ v: 1 });
    assert.deepEqual(none, [{ v: 1 }]);
    const got = [];
    const off = s.subscribe((d) => got.push(d));
    assert.deepEqual(got, []);
    await flush();
    assert.deepEqual(got, [{ v: 1 }]);
    f.emit({ v: 2 });
    assert.deepEqual(got, [{ v: 1 }, { v: 2 }]);
    off();
    f.emit({ v: 3 });
    assert.deepEqual(got, [{ v: 1 }, { v: 2 }]);
    const quick = [];
    s.subscribe((d) => quick.push(d))();
    await flush();
    assert.deepEqual(quick, []);
  });
});

test('artifact: 리스너 예외는 격리되고 구독 오류는 경고만 남긴다', async (t) => {
  const error = t.mock.method(console, 'error', () => {});
  const warn = t.mock.method(console, 'warn', () => {});
  const f = fakeArtifactDb();
  await withGlobals({ window: { claude: f.claude } }, async () => {
    const s = await createArtifactSync('R1');
    s.subscribe(() => { throw new Error('boom'); });
    const got = [];
    s.subscribe((d) => got.push(d));
    f.emit({ v: 1 });
    assert.deepEqual(got, [{ v: 1 }]);
    assert.equal(error.mock.callCount(), 1);
    f.error({ code: 'permission-denied' });
    assert.equal(warn.mock.callCount(), 1);
    assert.match(String(warn.mock.calls[0].arguments[0]), /구독 종료/);
    assert.equal(warn.mock.calls[0].arguments[1], 'permission-denied');
  });
});

test('artifact: close()는 구독을 끊고 리스너를 비운다', async () => {
  const f = fakeArtifactDb();
  await withGlobals({ window: { claude: f.claude } }, async () => {
    const s = await createArtifactSync('R1');
    const got = [];
    s.subscribe((d) => got.push(d));
    s.close();
    assert.equal(f.calls.unsub, 1);
    f.emit({ v: 1 });
    assert.deepEqual(got, []);
  });
  const g = fakeArtifactDb({ unsubThrows: true });
  await withGlobals({ window: { claude: g.claude } }, async () => {
    const s = await createArtifactSync('R1');
    assert.doesNotThrow(() => s.close());
    assert.equal(g.calls.unsub, 1);
  });
});

// ---------- Firebase ----------

test('firebase: EMOREN_FIREBASE_CONFIG가 없거나 databaseURL이 없으면 null (document도 건드리지 않음)', async () => {
  assert.equal(await createFirebaseSync('R1'), null);
  await withGlobals({ EMOREN_FIREBASE_CONFIG: { apiKey: 'k' } }, async () => assert.equal(await createFirebaseSync('R1'), null));
});

test('firebase: kind는 firebase, SDK 세 개를 순서대로 싣고 익명 로그인을 시도한다', async () => {
  const { fd, ff, globals } = firebaseEnv();
  await withGlobals(globals, async () => {
    const s = await createFirebaseSync('R1');
    assert.equal(s.kind, 'firebase');
    assert.deepEqual(Object.keys(s).sort(), ADAPTER_KEYS);
    assert.deepEqual(fd.loaded, ['firebase-app-compat.js', 'firebase-database-compat.js', 'firebase-auth-compat.js']);
    assert.deepEqual(ff.calls.initializeApp, [CFG]);
    assert.equal(ff.calls.app, 0);
    assert.equal(ff.calls.signIn, 1);
    assert.ok(ff.auth.currentUser);
    assert.deepEqual(ff.calls.path, ['rooms/R1']);
    assert.deepEqual(ff.calls.on, ['value']);
    assert.equal(ff.hasHandler(), true);
  });
});

test('firebase: anonymousAuth: false면 auth SDK도 싣지 않고 로그인도 건너뛴다', async () => {
  const { fd, ff, globals } = firebaseEnv({}, { ...CFG, anonymousAuth: false });
  await withGlobals(globals, async () => {
    const s = await createFirebaseSync('R1');
    assert.equal(s.kind, 'firebase');
    assert.deepEqual(fd.loaded, ['firebase-app-compat.js', 'firebase-database-compat.js']);
    assert.equal(ff.calls.signIn, 0);
    assert.equal(ff.calls.auth.length, 0);
  });
});

test('firebase: 이미 로그인돼 있으면 다시 로그인하지 않는다', async () => {
  const { ff, globals } = firebaseEnv({ firebase: { currentUser: { uid: 'u1' } } });
  await withGlobals(globals, async () => {
    const s = await createFirebaseSync('R1');
    assert.equal(s.kind, 'firebase');
    assert.equal(ff.calls.signIn, 0);
    assert.equal(ff.calls.auth.length, 1);
  });
});

test('firebase: 로그인 실패나 auth 스크립트 실패는 경고만 남기고 어댑터는 만들어진다', async (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  const a = firebaseEnv({ firebase: { signInError: new Error('auth/network') } });
  await withGlobals(a.globals, async () => {
    const s = await createFirebaseSync('R1');
    assert.equal(s.kind, 'firebase');
    assert.equal(a.ff.calls.signIn, 1);
  });
  const b = firebaseEnv({ document: { failWhen: (src) => /auth/.test(src) } });
  await withGlobals(b.globals, async () => {
    const s = await createFirebaseSync('R1');
    assert.equal(s.kind, 'firebase');
    assert.equal(b.ff.calls.signIn, 0);
  });
  assert.equal(warn.mock.callCount(), 2);
  for (const c of warn.mock.calls) assert.match(String(c.arguments[0]), /익명 로그인 실패/);
});

test('firebase: 필수 SDK 로드 실패는 던지고(상위에서 다음 어댑터로), firebase 전역이 없으면 null', async () => {
  const a = firebaseEnv({ document: { failWhen: (src) => /database/.test(src) } });
  await withGlobals(a.globals, async () => {
    await assert.rejects(createFirebaseSync('R1'), /스크립트 로드 실패/);
    assert.deepEqual(a.ff.calls.initializeApp, []);
  });
  const b = firebaseEnv();
  await withGlobals({ ...b.globals, firebase: undefined }, async () => assert.equal(await createFirebaseSync('R1'), null));
});

test('firebase: 앱이 이미 초기화돼 있으면 initializeApp 대신 app()을 쓴다', async () => {
  const { ff, globals } = firebaseEnv({ firebase: { apps: [{ name: 'existing' }] } });
  await withGlobals(globals, async () => {
    const s = await createFirebaseSync('R1');
    assert.equal(s.kind, 'firebase');
    assert.equal(ff.calls.app, 1);
    assert.deepEqual(ff.calls.initializeApp, []);
  });
});

test('firebase: value 핸들러는 구독자에게 전달하고 마지막 값을 캐시한다', async () => {
  const { ff, globals } = firebaseEnv({ firebase: { doc: { v: 0 } } });
  await withGlobals(globals, async () => {
    const s = await createFirebaseSync('R1');
    assert.deepEqual(await s.get(), { v: 0 });
    assert.equal(ff.calls.get, 1);
    const got = [];
    s.subscribe((d) => got.push(d));
    ff.emit({ v: 1 });
    assert.deepEqual(got, [{ v: 1 }]);
    assert.deepEqual(await s.get(), { v: 1 });
    assert.equal(ff.calls.get, 1);
    ff.emit(null);
    assert.deepEqual(got, [{ v: 1 }]);
    assert.deepEqual(await s.get(), { v: 1 });
    const late = [];
    const off = s.subscribe((d) => late.push(d));
    assert.deepEqual(late, []);
    await flush();
    assert.deepEqual(late, [{ v: 1 }]);
    off();
    ff.emit({ v: 2 });
    assert.deepEqual(late, [{ v: 1 }]);
    assert.deepEqual(got, [{ v: 1 }, { v: 2 }]);
  });
  const empty = firebaseEnv();
  await withGlobals(empty.globals, async () => {
    const s = await createFirebaseSync('R1');
    assert.equal(await s.get(), null);
    assert.equal(empty.ff.calls.get, 1);
  });
});

test('firebase: set()은 ref.set에 넘기고 실패하면 경고만 남긴다', async (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  const ok = firebaseEnv();
  await withGlobals(ok.globals, async () => {
    const s = await createFirebaseSync('R1');
    await s.set({ v: 1 });
    assert.deepEqual(ok.ff.calls.set, [{ v: 1 }]);
  });
  assert.equal(warn.mock.callCount(), 0);
  const bad = firebaseEnv({ firebase: { setError: new Error('PERMISSION_DENIED') } });
  await withGlobals(bad.globals, async () => {
    const s = await createFirebaseSync('R1');
    await assert.doesNotReject(s.set({ v: 2 }));
    assert.deepEqual(bad.ff.calls.set, [{ v: 2 }]);
  });
  assert.equal(warn.mock.callCount(), 1);
  assert.match(String(warn.mock.calls[0].arguments[0]), /쓰기 실패/);
  assert.equal(warn.mock.calls[0].arguments[1].message, 'PERMISSION_DENIED');
});

test('firebase: close()는 같은 핸들러로 off(value)를 부르고 리스너를 비운다', async (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  const { ff, globals } = firebaseEnv();
  await withGlobals(globals, async () => {
    const s = await createFirebaseSync('R1');
    const got = [];
    s.subscribe((d) => got.push(d));
    ff.error(new Error('permission_denied'));
    assert.equal(warn.mock.callCount(), 1);
    assert.match(String(warn.mock.calls[0].arguments[0]), /구독 오류/);
    s.close();
    assert.deepEqual(ff.calls.off, [{ ev: 'value', sameHandler: true }]);
    ff.emit({ v: 1 });
    assert.deepEqual(got, []);
  });
});
