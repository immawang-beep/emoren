// 단위 테스트: 남는 기록 패널(recordSummary·renderRecordPanel)과 상태 모양 지킴이(ROOM_SHAPE·checkRoom). 실행: npm test
// Unit tests for the what-is-stored panel and the state-shape guard (the room JSON may hold numbers, booleans,
// ids and timestamps only; the single free text is notes[].text).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { newRoom, stamp, actions, checkRoom, ROOM_SHAPE, PHASES, NOTE_MAX } from '../../js/store.js';
import { setLang } from '../../js/i18n.js';
import { recordSummary, renderRecordPanel, fmtWhen } from '../../js/ui/record.js';

const read = (f) => JSON.parse(fs.readFileSync(new URL(f, import.meta.url), 'utf8'));
const packs = { ko: read('../../packs/mind-weather.ko.json'), en: read('../../packs/mind-weather.en.json') };
const ALLOW = ['v', 'code', 'packId', 'lang', 'phase', 'stepIndex', 'tallies', 'confirmed', 'timer', 'speakSeq', 'startedAt', 'endedAt', 'notes', 'rev', 'updatedAt', 'book'];

// 집계 몇 번 + 메모 하나가 있는 진행 중인 방 / a live room with a few tallies and one note
function sampleRoom(pack, note = '비 카드가 많아서 몸놀이를 길게 했다') {
  let s = stamp(newRoom('RECD', pack));
  s = stamp(actions.start(s));
  s = stamp(actions.next(s, pack));
  for (const [id, n] of [['sunny', 3], ['cloudy', 2], ['rainy', 1]]) for (let i = 0; i < n; i++) s = stamp(actions.tally(s, 'weather', id, 1));
  s = stamp(actions.note(s, note));
  return s;
}

test('recordSummary: 선택 단계별 숫자·합계, 숫자로 만든 이야기, 메모 그대로', () => {
  const s = sampleRoom(packs.ko);
  const sum = recordSummary(packs.ko, s);
  assert.equal(sum.code, 'RECD');
  assert.equal(sum.packId, 'mind-weather');
  assert.equal(sum.lang, 'ko');
  assert.equal(sum.phase, 'live');
  assert.equal(typeof sum.startedAt, 'number');
  assert.equal(sum.endedAt, null);
  assert.equal(sum.book, null);
  assert.equal(sum.empty, false);
  assert.equal(sum.choices.length, 1);
  const c = sum.choices[0];
  assert.equal(c.stepId, 'weather');
  assert.equal(c.title, '오늘 내 마음 날씨');
  assert.equal(c.total, 6);
  assert.deepEqual(c.rows.map((r) => [r.id, r.n]), [['sunny', 3], ['cloudy', 2], ['rainy', 1], ['stormy', 0]]);
  for (const r of c.rows) assert.deepEqual(Object.keys(r).sort(), ['emoji', 'id', 'label', 'n'], '선택지의 다른 필드(color, hint)는 새지 않는다');
  assert.equal(c.rows[0].emoji, '☀️');
  assert.equal(c.rows[0].label, '해님');
  assert.match(sum.story, /해님 3명, 구름 2명, 비 1명/);
  assert.doesNotMatch(sum.story, /\{|\[\[/);
  assert.deepEqual(sum.notes, s.notes);
  assert.equal(sum.raw, s);
});

test('recordSummary: 새 방은 비어 있고, 끝난 방은 endedAt이 있고, 영어 팩은 영어 이야기', () => {
  const fresh = recordSummary(packs.ko, newRoom('RECD', packs.ko));
  assert.equal(fresh.empty, true);
  assert.equal(fresh.notes.length, 0);
  assert.equal(fresh.choices[0].total, 0);
  const done = recordSummary(packs.ko, actions.end(sampleRoom(packs.ko)));
  assert.equal(done.phase, 'done');
  assert.equal(typeof done.endedAt, 'number');
  assert.equal(recordSummary(packs.ko, actions.reset(sampleRoom(packs.ko), packs.ko)).empty, true, '지우면 다시 비어 있다');
  const en = recordSummary(packs.en, sampleRoom(packs.en, 'note'));
  assert.equal(en.empty, false);
  assert.match(en.story, /3 Sunny, 2 Cloudy, 1 Rainy/);
  assert.equal(recordSummary(null, null).choices.length, 0, '팩·상태가 없어도 던지지 않는다');
});

test('ROOM_SHAPE: 허용 목록은 newRoom의 키를 모두 담고, 고정되어 있다', () => {
  assert.deepEqual(Object.keys(ROOM_SHAPE), ALLOW);
  for (const k of Object.keys(newRoom('ABCD', packs.ko))) assert.ok(k in ROOM_SHAPE, k);
  assert.ok(Object.isFrozen(ROOM_SHAPE));
  assert.deepEqual(PHASES, ['waiting', 'live', 'paused', 'done']);
  assert.equal(NOTE_MAX, 300);
});

test('checkRoom: 두 팩으로 수업 한 회기를 끝까지 돌려도 모든 액션의 상태가 통과한다', () => {
  const used = new Set();
  for (const pack of [packs.ko, packs.en]) {
    let s = stamp(newRoom('RECD', pack));
    assert.deepEqual(checkRoom(s, pack), []);
    assert.deepEqual(checkRoom(s), [], 'pack 없이도 통과');
    const step = (name, fn) => {
      used.add(name);
      s = stamp(fn(s));
      assert.deepEqual(checkRoom(s, pack), [], `${pack.lang} ${name}`);
      assert.deepEqual(checkRoom(JSON.parse(JSON.stringify(s)), pack), [], `${pack.lang} ${name} (JSON 왕복)`);
    };
    step('start', (x) => actions.start(x));
    step('respeak', (x) => actions.respeak(x));
    step('next', (x) => actions.next(x, pack));
    step('tally', (x) => actions.tally(x, 'weather', 'sunny', 1));
    step('tally', (x) => actions.tally(x, 'weather', 'rainy', 1));
    step('tally', (x) => actions.tally(x, 'weather', 'rainy', -1));
    step('tally', (x) => actions.tally(x, 'weather', 'stormy', -1));
    step('confirm', (x) => actions.confirm(x, 'weather'));
    step('togglePause', (x) => actions.togglePause(x));
    step('togglePause', (x) => actions.togglePause(x));
    step('next', (x) => actions.next(x, pack));
    step('startTimer', (x) => actions.startTimer(x, 'move', 60));
    step('prev', (x) => actions.prev(x));
    step('next', (x) => actions.next(x, pack));
    step('note', (x) => actions.note(x, 'x'.repeat(400)));
    step('note', (x) => actions.note(x, '비 카드가 많았다 <b>&</b>'));
    while (s.phase !== 'done') step('next', (x) => actions.next(x, pack));
    step('end', (x) => actions.end(x));
    step('prev', (x) => actions.prev(x));
    step('reset', (x) => actions.reset(x, pack));
  }
  // 새 액션이 생기면 이 흐름에도 넣어 상태 모양을 같이 지킨다 / a new action must join this flow (and ROOM_SHAPE if it adds state)
  for (const k of Object.keys(actions)) assert.ok(used.has(k), `actions.${k}: tests/unit/record.test.mjs의 수업 흐름에 넣어 주세요 / add it to this lesson flow`);
});

test('checkRoom: 어긋난 상태를 짚는다 — 낯선 문자열, 긴 메모, 음수 집계, 이상한 phase, 모르는 키, 집계 속 문자열', () => {
  const pack = packs.ko;
  const s = sampleRoom(pack);
  const hit = (bad, re) => {
    const p = checkRoom(bad, pack);
    assert.ok(p.length, `잡아야 한다 / should flag: ${re}`);
    assert.ok(p.some((x) => re.test(x)), `${re} ∉ ${JSON.stringify(p)}`);
  };
  hit({ ...s, childName: 'x' }, /^childName: .*unknown key/);
  hit({ ...s, childName: 'x' }, /^childName: .*string outside/);
  hit({ ...s, notes: [{ t: Date.now(), text: 'x'.repeat(301) }] }, /^notes\[0\]\.text: .*300/);
  hit({ ...s, tallies: { weather: { sunny: -1 } } }, /^tallies\.weather\.sunny: .*non-negative integer/);
  hit({ ...s, tallies: { weather: { sunny: 1.5 } } }, /^tallies\.weather\.sunny: /);
  hit({ ...s, phase: 'testing' }, /^phase: /);
  hit({ ...s, extra: 1 }, /^extra: .*unknown key/);
  hit({ ...s, tallies: { weather: { sunny: 'Mina' } } }, /^tallies\.weather\.sunny: .*string outside/);
  hit({ ...s, tallies: { weather: { sunny: 1, name: 'Mina' } } }, /^tallies\.weather\.name: /);
  hit({ ...s, tallies: { weather: { sunny: 1 }, kid: { a: 1 } } }, /^tallies\.kid: .*step id/);
  hit({ ...s, confirmed: { weather: 'yes' } }, /^confirmed\.weather: .*boolean/);
  hit({ ...s, timer: { stepId: 'move', startedAt: Date.now(), seconds: 60, label: 'x' } }, /^timer\.label: /);
  hit({ ...s, timer: { stepId: 'nope', startedAt: Date.now(), seconds: 60 } }, /^timer\.stepId: /);
  hit({ ...s, notes: [{ t: Date.now(), text: 'ok', who: 'x' }] }, /^notes\[0\]\.who: /);
  hit({ ...s, notes: [{ t: 'today', text: 'ok' }] }, /^notes\[0\]\.t: /);
  hit({ ...s, book: { page: 1, startedAt: Date.now(), title: 'x' } }, /^book\.title: /);
  hit({ ...s, book: 'cover' }, /^book: /);
  hit({ ...s, code: 'ab' }, /^code: /);
  hit({ ...s, code: 'abcd' }, /^code: /);
  hit({ ...s, startedAt: 'now' }, /^startedAt: /);
  hit({ ...s, stepIndex: -1 }, /^stepIndex: /);
  const { tallies, ...missing } = s;
  assert.ok(tallies);
  hit(missing, /^tallies: .*missing/);
  assert.deepEqual(checkRoom(null), ['state: 객체가 아님 / not an object']);
  assert.deepEqual(checkRoom({ ...s, book: undefined }, pack), [], 'book이 undefined면 null처럼 본다');
  assert.deepEqual(checkRoom({ ...s, book: { page: 2, startedAt: Date.now() } }, pack), []);
  assert.doesNotThrow(() => checkRoom({ ...s, tallies: 'x', notes: 'y', timer: 5, confirmed: [] }, pack), '문제가 많아도 던지지 않는다');
  assert.ok(checkRoom({ ...s, tallies: 'x', notes: 'y', timer: 5, confirmed: [] }, pack).length >= 4);
});

test('renderRecordPanel: 템플릿 변수가 남지 않고, 메모의 <는 이스케이프되며, 원본 JSON은 상태 그대로', () => {
  setLang('ko');
  const s = sampleRoom(packs.ko, '<b>이름</b> 아님 & 끝');
  const html = renderRecordPanel(recordSummary(packs.ko, s), { syncLabel: '같은 브라우저 동기화', armed: false });
  assert.doesNotMatch(html, /\{\w+\}/);
  assert.ok(html.includes('&lt;b&gt;이름&lt;/b&gt; 아님 &amp; 끝'));
  assert.ok(!html.includes('<b>이름</b>'));
  assert.ok(html.includes('남는 기록'));
  assert.ok(html.includes('아이 이름·사진·목소리·개인 선택은 어디에도 없어요'));
  assert.ok(html.includes('☀️ 해님 <b>3</b>'));
  assert.ok(html.includes('모두 6명'));
  assert.ok(html.includes('해님 3명, 구름 2명, 비 1명'));
  assert.ok(html.includes('같은 브라우저 동기화') && html.includes('mind-weather · ko') && html.includes('RECD'));
  assert.ok(html.includes('data-act="erase"') && html.includes('모두 지우기') && !html.includes('정말 지울까요'));
  assert.doesNotMatch(html, /<details class="record" open>/);
  assert.ok(!html.includes('아직 아무것도 없어요'));
  // 원본 JSON: <pre> 안을 되돌려 파싱하면 상태 그대로, 키는 허용 목록 안 / the <pre> parses back to the state
  const pre = html.match(/<pre data-raw>([\s\S]*?)<\/pre>/)[1];
  const un = pre.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  const parsed = JSON.parse(un);
  assert.deepEqual(parsed, JSON.parse(JSON.stringify(s)));
  for (const k of Object.keys(parsed)) assert.ok(ALLOW.includes(k), k);
  // 무장·열림 / armed + open
  const armed = renderRecordPanel(recordSummary(packs.ko, s), { syncLabel: 'x', armed: true, open: true, rawOpen: true });
  assert.ok(armed.includes('정말 지울까요? 다시 누르면 지워져요'));
  assert.ok(armed.includes('rec-erase armed'));
  assert.match(armed, /<details class="record" open>/);
  assert.match(armed, /<details class="rec-raw" open>/);
  // 지운 직후: 비어 있음 + 알림 + 지우기 버튼 잠김 / just erased: empty, notice, erase disabled
  const erased = renderRecordPanel(recordSummary(packs.ko, newRoom('RECD', packs.ko)), { syncLabel: 'x', erased: true });
  assert.ok(erased.includes('아직 아무것도 없어요') && erased.includes('지웠어요') && erased.includes('disabled'));
  assert.ok(!erased.includes('반 전체 숫자'));
  assert.ok(erased.includes('mind-weather · ko'), '비어 있어도 팩·코드·동기화는 보인다');
  setLang('en');
  const en = renderRecordPanel(recordSummary(packs.en, sampleRoom(packs.en, 'note')), { syncLabel: 'Same-browser sync', armed: true });
  assert.ok(en.includes('What this room stores') && en.includes('Erase for real? Tap again') && en.includes('6 in all'));
  assert.doesNotMatch(en, /\{\w+\}/);
});

test('fmtWhen: 날짜와 시각, 없으면 "아직" / "not yet"', () => {
  setLang('ko');
  const ts = new Date(2026, 10, 5, 14, 3).getTime();
  assert.match(fmtWhen(ts, 'ko'), /^2026년 11월 5일 /);
  assert.match(fmtWhen(ts, 'en'), /^November 5, 2026 .*2:03/);
  assert.equal(fmtWhen(null), '아직');
  setLang('en');
  assert.equal(fmtWhen(0), 'not yet');
});
