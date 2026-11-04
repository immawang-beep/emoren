// 단위 테스트: 상태 리듀서, 이야기 템플릿, 수업팩 형식 검사. 실행: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { newRoom, stamp, actions, currentStep, renderTemplate, storyVars, summaryOf, tallyFor } from '../../js/store.js';
import { validatePack } from '../../js/pack.js';

const pack = JSON.parse(fs.readFileSync(new URL('../../packs/mind-weather.json', import.meta.url), 'utf8'));

test('수업팩 형식 검사: 기본 팩은 통과한다', () => {
  assert.equal(validatePack(pack), true);
});

test('수업팩 형식 검사: 잘못된 팩은 이유를 말한다', () => {
  assert.throws(() => validatePack({ id: 'x', title: 'x', steps: [{ id: 'a', type: 'choice' }] }), /prompt 없음/);
  assert.throws(() => validatePack({ id: 'x', title: 'x', steps: [{ id: 'a', type: 'dance' }] }), /알 수 없는 단계 유형/);
  assert.throws(() => validatePack({ id: 'x', title: 'x', steps: [{ id: 'a', type: 'talk', lines: ['안녕'] }, { id: 'a', type: 'talk', lines: ['또'] }] }), /중복/);
  assert.throws(() => validatePack({ id: 'x', title: 'x', steps: [{ id: 'a', type: 'activity' }] }), /timer_sec/);
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
