// 단위 테스트: 상태 리듀서, 이야기 템플릿, 수업팩 형식 검사. 실행: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { newRoom, stamp, actions, currentStep, renderTemplate, storyVars, summaryOf, tallyFor, packText } from '../../js/store.js';
import { validatePack } from '../../js/pack.js';

const read = (f) => JSON.parse(fs.readFileSync(new URL(f, import.meta.url), 'utf8'));
const pack = read('../../packs/mind-weather.ko.json');
const packEn = read('../../packs/mind-weather.en.json');
const index = read('../../packs/index.json');

test('수업팩 형식 검사: 기본 팩(ko, en)은 통과한다', () => {
  assert.equal(validatePack(pack), true);
  assert.equal(validatePack(packEn), true);
  assert.equal(pack.lang, 'ko');
  assert.equal(packEn.lang, 'en');
});

test('언어별 팩은 같은 단계·선택지 id와 구조를 가진다', () => {
  assert.equal(packEn.id, pack.id);
  assert.deepEqual(packEn.steps.map((s) => [s.id, s.type]), pack.steps.map((s) => [s.id, s.type]));
  const opts = (p) => p.steps.find((s) => s.type === 'choice').options.map((o) => o.id);
  assert.deepEqual(opts(packEn), opts(pack));
  assert.equal(packEn.title, 'Mood Weather');
  assert.deepEqual(Object.keys(index.packs[0].langs), ['ko', 'en']);
  assert.equal(index.packs[0].langs.ko.title, pack.title);
  assert.equal(index.packs[0].langs.en.title, packEn.title);
});

test('수업팩 형식 검사: 잘못된 팩은 이유를 말한다', () => {
  const base = { id: 'x', lang: 'ko', title: 'x' };
  assert.throws(() => validatePack({ ...base, steps: [{ id: 'a', type: 'choice' }] }), /prompt 없음/);
  assert.throws(() => validatePack({ ...base, steps: [{ id: 'a', type: 'dance' }] }), /알 수 없는 단계 유형/);
  assert.throws(() => validatePack({ ...base, steps: [{ id: 'a', type: 'talk', lines: ['안녕'] }, { id: 'a', type: 'talk', lines: ['또'] }] }), /중복/);
  assert.throws(() => validatePack({ ...base, steps: [{ id: 'a', type: 'activity' }] }), /timer_sec/);
  assert.throws(() => validatePack({ id: 'x', title: 'x', steps: [{ id: 'a', type: 'talk', lines: ['hi'] }] }), /lang 없음/);
});

test('방 상태에 수업팩 언어가 들어간다', () => {
  assert.equal(newRoom('DEMO', pack).lang, 'ko');
  assert.equal(newRoom('DEMO', packEn).lang, 'en');
});

test('수업 흐름: 대기 → 시작 → 단계 → 끝', () => {
  let s = newRoom('DEMO', pack);
  assert.equal(s.phase, 'waiting');
  s = actions.start(s);
  assert.equal(s.phase, 'live');
  assert.equal(s.stepIndex, 0);
  for (let i = 0; i < pack.steps.length - 1; i++) s = actions.next(s, pack);
  assert.equal(s.stepIndex, pack.steps.length - 1);
  assert.equal(currentStep(pack, s).type, 'closing');
  s = actions.next(s, pack);
  assert.equal(s.phase, 'done');
  assert.ok(s.endedAt);
  s = actions.prev(s);
  assert.equal(s.phase, 'live');
});

test('집계는 0 아래로 내려가지 않고, 확정은 speakSeq를 올린다', () => {
  let s = actions.start(newRoom('DEMO', pack));
  s = actions.tally(s, 'weather', 'sunny', -1);
  assert.equal(tallyFor(s, 'weather').sunny, 0);
  s = actions.tally(s, 'weather', 'sunny', 1);
  s = actions.tally(s, 'weather', 'sunny', 1);
  assert.equal(tallyFor(s, 'weather').sunny, 2);
  const before = s.speakSeq;
  s = actions.confirm(s, 'weather');
  assert.equal(s.confirmed.weather, true);
  assert.equal(s.speakSeq, before + 1);
});

test('stamp는 rev와 updatedAt을 올린다', () => {
  const a = stamp(newRoom('DEMO', pack));
  const b = stamp(a);
  assert.equal(b.rev, a.rev + 1);
  assert.ok(b.updatedAt >= a.updatedAt);
});

test('이야기 템플릿: 목록·최다·조건문', () => {
  let s = newRoom('DEMO', pack);
  s = actions.tally(s, 'weather', 'sunny', 1);
  s = actions.tally(s, 'weather', 'sunny', 1);
  s = actions.tally(s, 'weather', 'rainy', 1);
  const vars = storyVars(pack, s);
  assert.equal(vars.sunny, 2);
  assert.equal(vars.weather_total, 3);
  assert.equal(vars.weather_list, '해님 2명, 비 1명');
  assert.equal(vars.weather_lead, '해님');
  const out = renderTemplate('A {weather_list}. [[rainy: 비!]] [[stormy: 천둥!]] 끝', vars);
  assert.equal(out, 'A 해님 2명, 비 1명. 비! 끝');
  const story = pack.steps.find((x) => x.type === 'story');
  const text = renderTemplate(story.template, vars);
  assert.match(text, /해님 2명, 비 1명/);
  assert.match(text, /해님이 제일 많았지요/);
  assert.doesNotMatch(text, /\{|\[\[/);
});

test('집계가 비어 있으면 조용한 하늘', () => {
  const vars = storyVars(pack, newRoom('DEMO', pack));
  assert.equal(vars.weather_list, '조용한 하늘');
  assert.equal(vars.weather_lead, '');
  assert.equal(renderTemplate('[[weather_lead: 보임]] 끝', vars), '끝');
});

test('영어 팩: list_item / list_empty / class_name 으로 이야기를 만든다', () => {
  let s = newRoom('ENGL', packEn);
  assert.equal(storyVars(packEn, s).weather_list, 'a quiet sky');
  assert.equal(storyVars(packEn, s).class, 'our class');
  s = actions.tally(s, 'weather', 'sunny', 1);
  s = actions.tally(s, 'weather', 'sunny', 1);
  s = actions.tally(s, 'weather', 'sunny', 1);
  s = actions.tally(s, 'weather', 'cloudy', 1);
  s = actions.tally(s, 'weather', 'cloudy', 1);
  s = actions.tally(s, 'weather', 'rainy', 1);
  const vars = storyVars(packEn, s);
  assert.equal(vars.weather_list, '3 Sunny, 2 Cloudy, 1 Rainy');
  assert.equal(vars.weather_lead, 'Sunny');
  const story = packEn.steps.find((x) => x.type === 'story');
  const text = renderTemplate(story.template, vars);
  assert.match(text, /^Today the sky over our class had 3 Sunny, 2 Cloudy, 1 Rainy\. Sunny was the biggest of all\./);
  assert.doesNotMatch(text, /\{|\[\[/);
  const confirm = renderTemplate(packEn.steps[1].on_confirm, vars);
  assert.match(confirm, /Rainy friends/);
  assert.doesNotMatch(confirm, /Stormy friends/);
});

test('팩 문구 기본값: 팩 언어를 따르고, 팩에 적힌 값이 우선한다', () => {
  assert.equal(packText({ lang: 'ko', steps: [] }, 'list_item'), '{label} {n}명');
  assert.equal(packText({ lang: 'en', steps: [] }, 'list_item'), '{n} {label}');
  assert.equal(packText({ lang: 'fr', steps: [] }, 'class_name'), 'our class', '모르는 언어는 영어 기본값');
  assert.equal(packText({ steps: [] }, 'class_name'), '우리 반', 'lang이 없으면 한국어(이전 팩 호환)');
  const custom = { lang: 'en', steps: pack.steps, list_item: '{label}×{n}', list_empty: 'nobody yet', class_name: 'the Sunflower room' };
  let s = actions.tally(newRoom('X', custom), 'weather', 'rainy', 2);
  const vars = storyVars(custom, s);
  assert.equal(vars.weather_list, '비×2');
  assert.equal(vars.class, 'the Sunflower room');
  assert.equal(storyVars(custom, newRoom('X', custom)).weather_list, 'nobody yet');
});

test('일시정지 토글과 타이머, 메모', () => {
  let s = actions.start(newRoom('DEMO', pack));
  s = actions.togglePause(s);
  assert.equal(s.phase, 'paused');
  s = actions.togglePause(s);
  assert.equal(s.phase, 'live');
  s = actions.startTimer(s, 'move', 60);
  assert.equal(s.timer.seconds, 60);
  s = actions.next(s, pack);
  assert.equal(s.timer, null, '단계가 바뀌면 타이머는 사라진다');
  s = actions.note(s, '   ');
  assert.equal(s.notes.length, 0);
  s = actions.note(s, 'x'.repeat(400));
  assert.equal(s.notes.length, 1);
  assert.equal(s.notes[0].text.length, 300);
});

test('요약은 첫 선택 단계를 기준으로 비율을 낸다', () => {
  let s = newRoom('DEMO', pack);
  s = actions.tally(s, 'weather', 'cloudy', 1);
  s = actions.tally(s, 'weather', 'cloudy', 1);
  s = actions.tally(s, 'weather', 'stormy', 1);
  const sum = summaryOf(pack, s);
  assert.equal(sum.total, 3);
  assert.equal(sum.rows.find((r) => r.id === 'cloudy').pct, 100);
  assert.equal(sum.rows.find((r) => r.id === 'stormy').pct, 50);
  assert.equal(sum.rows.find((r) => r.id === 'sunny').pct, 0);
});

test('reset은 같은 코드로 새 방을 만든다', () => {
  let s = stamp(actions.start(newRoom('DEMO', pack)));
  s = actions.reset(s, pack);
  assert.equal(s.phase, 'waiting');
  assert.equal(s.code, 'DEMO');
  assert.equal(s.rev, 0);
});

test('book 단계: 형식 검사(제목 필수, 한 팩에 하나, 표지 문구는 문자열)', () => {
  const base = { id: 'x', lang: 'ko', title: 'x' };
  const talk = { id: 'a', type: 'talk', lines: ['안녕'] };
  assert.equal(validatePack({ ...base, steps: [talk, { id: 'book', type: 'book', title: '책', cover_line: '앞', back_line: '뒤' }] }), true);
  assert.equal(validatePack({ ...base, steps: [talk, { id: 'book', type: 'book', title: '책' }] }), true, '표지 문구는 선택');
  assert.throws(() => validatePack({ ...base, steps: [{ id: 'book', type: 'book' }] }), /title/);
  assert.throws(() => validatePack({ ...base, steps: [{ id: 'b1', type: 'book', title: '1' }, { id: 'b2', type: 'book', title: '2' }] }), /하나만/);
  assert.throws(() => validatePack({ ...base, steps: [{ id: 'book', type: 'book', title: '책', cover_line: 3 }] }), /cover_line/);
  for (const p of [pack, packEn]) {
    const i = p.steps.findIndex((s) => s.type === 'book');
    assert.ok(i > 0, `${p.lang}: book 단계가 있다`);
    assert.equal(p.steps[i + 1].type, 'closing', `${p.lang}: book은 마무리 바로 앞`);
  }
});
