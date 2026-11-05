// 단위 테스트: 수업팩 불러오기(js/pack.js). 실행: npm test
// 가짜 globalThis.fetch가 실제 packs/ 폴더의 파일을 읽어 주고(없으면 404) 요청 기록을 남긴다. 스튜디오 초안은 가짜
// localStorage에 둔다. 모듈 상태(캐시, 색인 약속)는 js/pack.js를 ?case=<이름> 쿼리로 다시 불러와 사례마다 새로 시작한다.
// Unit tests for the pack loader. A fake globalThis.fetch serves files from the real packs/ directory (404 otherwise)
// and keeps a request log; a fake localStorage holds the studio draft. Module state (cache, index promise) is reset
// per case by importing js/pack.js with a cache-busting query (?case=<name>); js/i18n.js stays shared.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setLang } from '../../js/i18n.js';
import { packLangs, listPackChoices, pickPackLang, validatePack, STEP_TYPES } from '../../js/pack.js';

const PACKS_DIR = fileURLToPath(new URL('../../packs/', import.meta.url));
const read = (f) => JSON.parse(fs.readFileSync(path.join(PACKS_DIR, f), 'utf8'));
const indexFile = read('index.json');
const koFile = read('mind-weather.ko.json');

// ---- 가짜 fetch / fake fetch ---------------------------------------------------------------------------------
const log = [];                 // 요청한 url 전부, 순서대로 / every requested url, in order
const virtual = new Map();      // url → 본문: 실제 폴더보다 먼저 / url → body text, served before the real folder
const failOnce = new Map();     // url → 'notfound' | 'network': 다음 요청 한 번만 실패 / consumed by the next request

function serve(url) {
  const m = /^packs\/([a-z0-9.-]+\.json)$/i.exec(url);   // packs/<파일>.json 하나만, 폴더 밖은 없다 / one file in packs/ only
  if (!m) return null;
  if (virtual.has(url)) return virtual.get(url);
  try { return fs.readFileSync(path.join(PACKS_DIR, m[1]), 'utf8'); } catch { return null; }
}

globalThis.fetch = async (input) => {
  const url = typeof input === 'string' ? input : String((input && input.url) || input);
  log.push(url);
  const fail = failOnce.get(url);
  if (fail) {
    failOnce.delete(url);
    if (fail === 'network') throw new TypeError('Failed to fetch (fake network error)');
    return new Response('not found', { status: 404 });
  }
  const body = serve(url);
  if (body == null) return new Response('not found', { status: 404 });
  return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
};

const requests = (from = 0) => log.slice(from);
const count = (url, from = 0) => log.slice(from).filter((u) => u === url).length;

// ---- 가짜 localStorage / fake localStorage -------------------------------------------------------------------
const storage = new Map();
const fakeStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => { storage.set(k, String(v)); },
  removeItem: (k) => { storage.delete(k); },
  clear: () => storage.clear(),
};
globalThis.localStorage = fakeStorage;

// 새 모듈 인스턴스: 캐시와 색인 약속이 비어 있다 / fresh module instance with an empty cache and index promise
const fresh = (name) => import(`../../js/pack.js?case=${name}`);

test('loadPackIndex: 두 번(동시에도) 불러도 fetch는 한 번, 같은 객체를 돌려준다', async () => {
  const { loadPackIndex } = await fresh('index-cache');
  const from = log.length;
  const [a, b] = await Promise.all([loadPackIndex(), loadPackIndex()]);
  const c = await loadPackIndex();
  assert.equal(a, b);
  assert.equal(a, c);
  assert.deepEqual(requests(from), ['packs/index.json']);
  assert.equal(a.packs[0].id, 'mind-weather');
  assert.deepEqual(Object.keys(a.packs[0].langs), ['ko', 'en']);
});

test('loadPackIndex: 실패는 캐시하지 않고 다음 호출에서 다시 받아 본다', async () => {
  const { loadPackIndex } = await fresh('index-retry');
  const from = log.length;
  try {
    failOnce.set('packs/index.json', 'notfound');
    await assert.rejects(loadPackIndex(), /index\.json을 찾을 수 없어요 \/ packs\/index\.json not found/);
    failOnce.set('packs/index.json', 'network');
    await assert.rejects(loadPackIndex(), TypeError);
    const idx = await loadPackIndex();
    assert.equal(idx.packs.length, indexFile.packs.length);
    assert.equal(await loadPackIndex(), idx, '성공한 뒤에는 캐시');
    assert.equal(count('packs/index.json', from), 3, '404, 네트워크 오류, 성공');
  } finally { failOnce.clear(); }   // 중간에 실패해도 다음 사례로 번지지 않게 / a failure here must not leak into the next case
});

test('loadPackIndex: langs가 없는 항목은 빈 객체로, packs가 없으면 빈 목록으로 고른다', async () => {
  virtual.set('packs/index.json', JSON.stringify({ packs: [{ id: 'bare' }] }));
  try {
    const m1 = await fresh('index-bare');
    const idx = await m1.loadPackIndex();
    assert.deepEqual(idx.packs, [{ id: 'bare', langs: {} }]);
    assert.deepEqual(m1.listPackChoices(idx), []);
    assert.equal(m1.pickPackLang(idx.packs[0], 'ko'), null);
    virtual.set('packs/index.json', '{}');
    const m2 = await fresh('index-empty');
    assert.deepEqual((await m2.loadPackIndex()).packs, []);
  } finally { virtual.delete('packs/index.json'); }
});

test('packLangs: 색인에 적힌 순서대로, 없으면 빈 배열', () => {
  assert.deepEqual(packLangs(indexFile.packs[0]), ['ko', 'en']);
  assert.deepEqual(packLangs({ langs: { en: {}, ko: {} } }), ['en', 'ko'], '순서는 색인을 따른다');
  assert.deepEqual(packLangs({ id: 'x' }), []);
  assert.deepEqual(packLangs(null), []);
  assert.deepEqual(packLangs(undefined), []);
});

test('listPackChoices: 팩 × 언어 평면 목록(id, lang, title)이 팩 파일과 맞는다', async () => {
  const m = await fresh('choices');
  const choices = m.listPackChoices(await m.loadPackIndex());
  assert.deepEqual(choices.map((c) => `${c.id}.${c.lang}`), ['mind-weather.ko', 'mind-weather.en']);
  for (const c of choices) {
    assert.equal(typeof c.id, 'string', 'id');
    assert.equal(typeof c.lang, 'string', 'lang');
    assert.equal(typeof c.title, 'string', 'title');
    assert.ok(c.title.length > 0);
    const p = await m.loadPack(c.id, c.lang);
    assert.equal(p.id, c.id);
    assert.equal(p.lang, c.lang);
    assert.equal(p.title, c.title, '색인의 제목은 팩 파일의 제목');
    assert.equal(p.minutes, c.minutes);
  }
  assert.ok(choices.some((c) => c.id === m.DEFAULT_PACK), 'DEFAULT_PACK은 색인에 있다');
  assert.deepEqual(listPackChoices(null), []);
  assert.deepEqual(listPackChoices({}), []);
  assert.deepEqual(listPackChoices({ packs: [{ id: 'x', langs: { fr: null } }] }), [{ id: 'x', lang: 'fr' }], '언어 정보가 비어도 id·lang은 있다');
});

test('pickPackLang: 원하는 언어 → UI 언어(setLang) → 색인의 첫 번째', () => {
  const entry = { id: 'x', langs: { ko: {}, en: {} } };
  setLang('en');
  assert.equal(pickPackLang(entry, 'ko'), 'ko', '원하는 언어가 있으면 그 언어');
  assert.equal(pickPackLang(entry, 'ko-KR'), 'ko', '지역 코드는 짧은 코드로');
  assert.equal(pickPackLang(entry, 'KO'), 'ko', '대문자도');
  assert.equal(pickPackLang(entry, 'fr'), 'en', '없으면 UI 언어');
  assert.equal(pickPackLang(entry), 'en', 'want 없이도 UI 언어');
  setLang('ko');
  assert.equal(pickPackLang(entry, 'fr'), 'ko');
  assert.equal(pickPackLang(entry), 'ko');
  const foreign = { langs: { fr: {}, de: {} } };
  assert.equal(pickPackLang(foreign, 'es'), 'fr', 'UI 언어도 없으면 첫 번째');
  assert.equal(pickPackLang(foreign, 'de'), 'de');
  assert.equal(pickPackLang(foreign), 'fr');
  assert.equal(pickPackLang(null, 'ko'), null);
  assert.equal(pickPackLang({}, 'ko'), null);
  assert.equal(pickPackLang({ langs: {} }, 'ko'), null);
});

test("loadPack('mind-weather', 'ko'): 바로 맞추면 fetch 한 번, 색인은 안 보고, 두 번째는 캐시", async () => {
  const { loadPack } = await fresh('direct');
  const from = log.length;
  const p = await loadPack('mind-weather', 'ko');
  assert.equal(p.id, 'mind-weather');
  assert.equal(p.lang, 'ko');
  assert.equal(p.title, koFile.title);
  assert.deepEqual(requests(from), ['packs/mind-weather.ko.json']);
  assert.equal(await loadPack('mind-weather', 'ko'), p, '같은 객체(캐시)');
  assert.deepEqual(requests(from), ['packs/mind-weather.ko.json'], '두 번째 호출은 fetch 없음');
  const en = await loadPack('mind-weather', 'en');
  assert.equal(en.lang, 'en');
  assert.notEqual(en, p);
  assert.equal(count('packs/index.json', from), 0, '직접 맞추면 색인이 필요 없다');
});

test("loadPack('mind-weather', 'fr'): 없는 언어는 색인의 첫 언어로 대신하고, 요청한 키로도 캐시한다", async () => {
  setLang('ko');   // UI 언어 = 색인의 첫 언어 / UI language is also the first one in index.json
  const { loadPack } = await fresh('fallback');
  const from = log.length;
  const p = await loadPack('mind-weather', 'fr');
  assert.equal(p.lang, 'ko', 'index.json에 적힌 첫 번째 언어');
  assert.equal(p.id, 'mind-weather');
  assert.deepEqual(requests(from), ['packs/mind-weather.fr.json', 'packs/index.json', 'packs/mind-weather.ko.json']);
  assert.equal(await loadPack('mind-weather', 'fr'), p, '같은 객체');
  assert.equal(log.length - from, 3, '두 번째 호출은 fetch 없음(요청한 키 mind-weather.fr로 캐시)');
  assert.equal(await loadPack('mind-weather', 'ko'), p, '대신한 언어의 키로도 같은 객체');
  assert.equal(log.length - from, 3);
});

test("loadPack: 대신할 언어는 UI 언어를 먼저 본다(setLang('en') → en), lang 없이 불러도 UI 언어", async () => {
  setLang('en');
  const { loadPack } = await fresh('fallback-ui');
  const from = log.length;
  const p = await loadPack('mind-weather', 'fr');
  assert.equal(p.lang, 'en');
  assert.deepEqual(requests(from), ['packs/mind-weather.fr.json', 'packs/index.json', 'packs/mind-weather.en.json']);
  assert.equal(await loadPack('mind-weather'), p, 'lang 없이 부르면 UI 언어, 이미 캐시');
  assert.equal(log.length - from, 3);
});

test("loadPack('nope'): 두 언어로 id를 말하며 거절한다", async () => {
  setLang('ko');
  const { loadPack } = await fresh('nope');
  const from = log.length;
  await assert.rejects(loadPack('nope'), (e) => {
    assert.match(e.message, /수업팩 'nope'\(ko\)을\(를\) 찾을 수 없어요/);
    assert.match(e.message, /lesson pack 'nope' \(ko\) not found/);
    return true;
  });
  assert.deepEqual(requests(from), ['packs/index.json', 'packs/nope.ko.json']);
  await assert.rejects(loadPack('nope', 'en'), /수업팩 'nope'\(en\).* \/ lesson pack 'nope' \(en\) not found/);
  assert.deepEqual(requests(from).slice(2), ['packs/nope.en.json'], '색인은 캐시, 직접 시도만 한 번 더');
});

test("형식 오류 팩: '형식 오류'로 거절하고, 캐시하지도 다른 언어로 대신하지도 않는다", async () => {
  setLang('ko');
  virtual.set('packs/broken.ko.json', JSON.stringify({ id: 'broken', lang: 'ko', steps: [{ id: 'a', type: 'dance' }] }));
  try {
    const { loadPack } = await fresh('broken');
    const from = log.length;
    await assert.rejects(loadPack('broken', 'ko'), /수업팩 형식 오류 \/ pack format error: .*title 없음.*알 수 없는 단계 유형.*a \(dance\)/);
    await assert.rejects(loadPack('broken', 'ko'), /형식 오류/);
    assert.equal(count('packs/broken.ko.json', from), 2, '캐시하지 않으니 다시 받아 본다');
    assert.equal(count('packs/index.json', from), 0, '형식 오류는 다른 언어로 대신하지 않는다');
    await assert.rejects(loadPack('broken'), /형식 오류/, 'lang 없이(UI 언어로) 불러도 같은 오류');
    // 파일을 고치면 다음 호출은 바로 통과 / once the file is fixed the next load succeeds
    virtual.set('packs/broken.ko.json', JSON.stringify({ id: 'broken', lang: 'ko', title: '고침', steps: [{ id: 'a', type: 'talk', lines: ['안녕'] }] }));
    assert.equal((await loadPack('broken', 'ko')).title, '고침');
    assert.equal(count('packs/broken.ko.json', from), 4);
  } finally { virtual.delete('packs/broken.ko.json'); }
});

test("loadPack('MIND-weather'): id는 소문자·[a-z0-9-]만 남기고, 요청은 packs/ 안에서만 한다", async () => {
  setLang('ko');
  const { loadPack } = await fresh('sanitise');
  const from = log.length;
  const p = await loadPack('MIND-weather');
  assert.equal(p.id, 'mind-weather');
  assert.ok(requests(from).includes('packs/mind-weather.ko.json'));
  assert.ok(!requests(from).some((u) => /MIND/.test(u)), '대문자 id로는 요청하지 않는다');
  const n = log.length;
  assert.equal(await loadPack(' Mind-Weather ', 'KO'), p, '공백은 지우고 언어도 소문자로: 같은 캐시 항목');
  assert.equal(log.length, n, 'fetch 없음');
  await assert.rejects(loadPack('../../etc/passwd', 'ko'), /수업팩 'etcpasswd'\(ko\)/);
  assert.deepEqual(requests(n), ['packs/etcpasswd.ko.json']);
});

test('studio-draft: localStorage의 초안을 id만 바꿔 돌려주고, fetch는 하지 않는다', async () => {
  const { loadPack, STUDIO_DRAFT_ID, STUDIO_DRAFT_KEY } = await fresh('draft');
  assert.equal(STUDIO_DRAFT_ID, 'studio-draft');
  assert.equal(STUDIO_DRAFT_KEY, 'emoren.studio.draft');
  const draft = { ...koFile, id: 'my-draft', title: '초안' };
  localStorage.setItem(STUDIO_DRAFT_KEY, JSON.stringify(draft));
  const from = log.length;
  const p = await loadPack(STUDIO_DRAFT_ID, 'ko');
  assert.equal(p.id, 'studio-draft', 'id는 studio-draft로 고정');
  assert.equal(p.title, '초안');
  assert.equal(p.lang, 'ko');
  assert.equal(p.steps.length, koFile.steps.length);
  assert.deepEqual(requests(from), [], '초안은 네트워크를 쓰지 않는다');
  // 초안을 고치면 다음 호출에 바로 보인다(캐시 없음) / edits show on the next load (no cache)
  localStorage.setItem(STUDIO_DRAFT_KEY, JSON.stringify({ ...draft, title: '초안 2' }));
  assert.equal((await loadPack(STUDIO_DRAFT_ID, 'ko')).title, '초안 2');
  assert.equal((await loadPack(STUDIO_DRAFT_ID)).id, 'studio-draft', 'lang 없이도');
  assert.ok(!requests(from).some((u) => u.includes('studio-draft')), 'studio-draft 파일을 받으러 가지 않는다');
});

test('studio-draft: 초안이 없거나 잘못되면 조용히 "찾을 수 없어요"로 거절한다', async () => {
  const { loadPack, STUDIO_DRAFT_ID, STUDIO_DRAFT_KEY } = await fresh('draft-bad');
  const warns = [];
  const origWarn = console.warn;
  console.warn = (...a) => { warns.push(a); };
  try {
    localStorage.removeItem(STUDIO_DRAFT_KEY);
    const from = log.length;
    const notFound = /수업팩 'studio-draft'\(ko\)을\(를\) 찾을 수 없어요 \/ lesson pack 'studio-draft' \(ko\) not found/;
    await assert.rejects(loadPack(STUDIO_DRAFT_ID, 'ko'), notFound);
    assert.equal(warns.length, 0, '초안이 없는 건 경고할 일이 아니다');
    localStorage.setItem(STUDIO_DRAFT_KEY, '{not json');
    await assert.rejects(loadPack(STUDIO_DRAFT_ID, 'ko'), notFound);
    assert.equal(warns.length, 1);
    assert.equal(warns[0][0], '[pack] studio draft');
    assert.ok(warns[0][1] instanceof SyntaxError);
    localStorage.setItem(STUDIO_DRAFT_KEY, JSON.stringify({ id: 'd', lang: 'ko', title: 'd', steps: [] }));
    await assert.rejects(loadPack(STUDIO_DRAFT_ID, 'ko'), notFound);
    assert.equal(warns.length, 2);
    assert.match(String(warns[1][1] && warns[1][1].message), /steps 비어 있음/);
    assert.ok(!requests(from).some((u) => u.includes('studio-draft')), 'studio-draft 파일을 받으러 가지 않는다');
    // 저장소가 막혀 있거나(사생활 모드) 아예 없어도 / storage that throws (private mode) or no storage at all
    globalThis.localStorage = { getItem() { throw new Error('blocked'); } };
    await assert.rejects(loadPack(STUDIO_DRAFT_ID, 'ko'), notFound);
    delete globalThis.localStorage;
    await assert.rejects(loadPack(STUDIO_DRAFT_ID, 'ko'), notFound);
  } finally {
    console.warn = origWarn;
    globalThis.localStorage = fakeStorage;
  }
});

test('validatePack: 여섯 가지 단계 유형의 최소 형태를 모두 받아들이고, 꼭 필요한 키가 빠지면 그 단계를 말한다', () => {
  assert.deepEqual(STEP_TYPES, ['talk', 'choice', 'activity', 'story', 'book', 'closing']);
  const minimal = {
    talk: { id: 'talk', type: 'talk', lines: ['안녕, 친구들!'] },
    choice: { id: 'choice', type: 'choice', prompt: '지금 내 마음은?', options: [{ id: 'a', label: '해님' }, { id: 'b', label: '구름' }] },
    activity: { id: 'activity', type: 'activity', timer_sec: 30 },
    story: { id: 'story', type: 'story', template: '오늘 우리 반에는 {choice_list}.' },
    book: { id: 'book', type: 'book', title: '오늘 우리 반 책' },
    closing: { id: 'closing', type: 'closing', lines: ['함께해 줘서 고마워.'] },
  };
  const base = { id: 'x', lang: 'ko', title: 'x' };
  assert.equal(validatePack({ ...base, steps: Object.values(minimal) }), true, '여섯 유형이 한 팩에');
  for (const type of STEP_TYPES) assert.equal(validatePack({ ...base, steps: [minimal[type]] }), true, type);
  const required = { talk: 'lines', choice: 'prompt', activity: 'timer_sec', story: 'template', book: 'title', closing: 'lines' };
  for (const [type, key] of Object.entries(required)) {
    const broken = { ...minimal[type] };
    delete broken[key];
    assert.throws(() => validatePack({ ...base, steps: [broken] }), new RegExp(`형식 오류.*${key}.*: ${type}`), `${type} without ${key}`);
  }
  assert.throws(() => validatePack({ ...base, steps: [{ ...minimal.talk, lines: [] }] }), /missing lines: talk/);
  assert.throws(() => validatePack({ ...base, steps: [{ ...minimal.activity, timer_sec: 0 }] }), /timer_sec required: activity/);
  assert.throws(() => validatePack({ ...base, steps: [{ ...minimal.choice, options: [{ id: 'a', label: 'A' }] }] }), /needs 2\+ options: choice/);
  assert.throws(() => validatePack({ ...base, steps: [{ ...minimal.choice, options: [{ id: 'a', label: 'A' }, { id: 'b' }] }] }), /option missing id\/label: choice/);
  assert.throws(() => validatePack({ ...base, steps: [{ ...minimal.choice, options: [{ id: 'a', label: 'A' }, { id: 'a', label: 'B' }] }] }), /duplicate option id: choice\/a/);
  assert.throws(() => validatePack({ ...base, steps: [minimal.talk, { ...minimal.closing, id: 'talk' }] }), /duplicate step id: talk/);
  assert.throws(() => validatePack({ ...base, steps: [{ type: 'talk', lines: ['x'] }] }), /missing step id/);
  assert.throws(() => validatePack({ ...base, steps: [{ id: 'd', type: 'dance' }] }), /unknown step type: d \(dance\)/);
});

test('validatePack: book 단계는 제목이 필요하고 한 팩에 하나, 표지 문구는 문자열(없어도 됨)', () => {
  const base = { id: 'x', lang: 'ko', title: 'x' };
  const talk = { id: 't', type: 'talk', lines: ['안녕'] };
  const book = (extra) => ({ id: 'book', type: 'book', title: '오늘 우리 반 책', ...extra });
  assert.equal(validatePack({ ...base, steps: [talk, book()] }), true);
  assert.equal(validatePack({ ...base, steps: [talk, book({ cover_line: '앞', back_line: '뒤' })] }), true);
  assert.equal(validatePack({ ...base, steps: [talk, book({ cover_line: null, back_line: undefined })] }), true, 'null/undefined는 없는 것과 같다');
  assert.throws(() => validatePack({ ...base, steps: [talk, { id: 'book', type: 'book' }] }), /title 없음 \/ missing title: book/);
  assert.throws(() => validatePack({ ...base, steps: [talk, book({ title: '' })] }), /missing title: book/);
  assert.throws(() => validatePack({ ...base, steps: [book(), book({ id: 'book2' })] }), /book 단계는 하나만 \/ only one book step: book2/);
  assert.throws(() => validatePack({ ...base, steps: [talk, book({ cover_line: 3 })] }), /cover_line는 문자열 \/ cover_line must be a string: book/);
  assert.throws(() => validatePack({ ...base, steps: [talk, book({ back_line: ['뒤'] })] }), /back_line must be a string: book/);
  for (const f of ['mind-weather.ko.json', 'mind-weather.en.json']) {
    assert.equal(read(f).steps.filter((s) => s.type === 'book').length, 1, `${f}: book 단계는 하나`);
  }
});

test('validatePack: 팩 전체의 문제를 한 번에 모아 말하고, lang 형식을 본다', () => {
  assert.throws(() => validatePack(null), /수업팩이 JSON 객체가 아니에요 \/ pack is not a JSON object/);
  assert.throws(() => validatePack('{}'), /not a JSON object/);
  assert.throws(() => validatePack({}), (e) => {
    for (const part of ['missing id', 'missing lang', 'missing title', 'steps empty']) assert.match(e.message, new RegExp(part));
    return true;
  });
  const steps = [{ id: 'a', type: 'talk', lines: ['hi'] }];
  for (const lang of ['ko', 'en', 'pt-BR', 'kor']) assert.equal(validatePack({ id: 'x', title: 'x', lang, steps }), true, lang);
  for (const lang of ['', 'K', 'korean', 'ko_KR', 7]) assert.throws(() => validatePack({ id: 'x', title: 'x', lang, steps }), /lang 없음/, String(lang));
});

test('가짜 fetch 기록: 모든 요청은 packs/ 안의 json 파일 하나였다', () => {
  assert.ok(log.length > 10);
  for (const u of log) assert.match(u, /^packs\/(index|[a-z0-9-]+\.[a-z]{2,3})\.json$/);
});
