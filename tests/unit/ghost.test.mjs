// 단위 테스트: 유령 선생님(js/demo/ghost.js). 계획은 순수 함수라 실제 팩 JSON으로 확인하고,
// 진행기는 가짜 폰 DOM으로 '계획 순서대로 누르고, 멈추면 더 누르지 않는다'를 확인한다. 실행: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planFor, scaleWaits, createGhost, SEL, WAIT, TAPS } from '../../js/demo/ghost.js';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const readPack = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'packs', f), 'utf8'));
const clicks = (plan) => plan.filter((p) => p.action === 'click').map((p) => p.selector);
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

// 가짜 강사 폰: 누른 선택자만 기록한다 / fake phone root that records clicked selectors
function fakePhone({ missing = [] } = {}) {
  const clicked = [];
  return {
    clicked,
    addEventListener() {}, removeEventListener() {},
    querySelector(sel) { return missing.includes(sel) ? null : { click() { clicked.push(sel); } }; },
  };
}

for (const file of ['mind-weather.ko.json', 'mind-weather.en.json']) {
  test(`${file}: 시작 → 단계마다 할 일 → 다음, 마지막 다음이 수업을 마친다`, () => {
    const pack = readPack(file);
    const plan = planFor(pack, { timerSec: 8 });
    assert.deepEqual(plan[0], { action: 'click', selector: SEL.start, step: null }, '처음은 수업 시작');
    assert.deepEqual(plan[1], { action: 'wait', ms: WAIT.start, step: null });
    for (const p of plan) assert.ok(p.action === 'click' ? typeof p.selector === 'string' : p.action === 'wait' && p.ms > 0, JSON.stringify(p));

    const sels = clicks(plan);
    assert.equal(sels.filter((s) => s === SEL.next).length, pack.steps.length, '단계마다 다음 한 번');
    assert.equal(sels.at(-1), SEL.next, '마지막 다음이 수업 마치기');

    // 선택 단계: 첫째 3, 둘째 2, 셋째 1, 넷째 0 → 확정
    const choice = pack.steps.find((s) => s.type === 'choice');
    const seg = plan.filter((p) => p.step === choice.id);
    const taps = clicks(seg).filter((s) => s.startsWith('[data-tally='));
    assert.deepEqual(taps, [
      ...Array(TAPS[0]).fill(SEL.tally(choice.options[0].id)),
      ...Array(TAPS[1]).fill(SEL.tally(choice.options[1].id)),
      ...Array(TAPS[2]).fill(SEL.tally(choice.options[2].id)),
    ]);
    assert.equal(clicks(seg).indexOf(SEL.confirm), taps.length, '집계 다음에 확정');
    assert.deepEqual(clicks(seg).slice(-2), [SEL.confirm, SEL.next]);
    assert.equal(seg.filter((p) => p.action === 'wait' && p.ms === WAIT.tap).length, taps.length, '탭 사이 350ms');

    // 몸놀이: 타이머 시작 → timerSec*1000 + 3000 기다림 → 다음
    const act = pack.steps.find((s) => s.type === 'activity');
    assert.deepEqual(plan.filter((p) => p.step === act.id), [
      { action: 'click', selector: SEL.timer, step: act.id },
      { action: 'wait', ms: 8 * 1000 + WAIT.activity, step: act.id },
      { action: 'click', selector: SEL.next, step: act.id },
    ]);

    // 단계 순서는 팩 순서 그대로, 단계별 항목은 이어져 있다
    const order = [...new Set(plan.map((p) => p.step).filter(Boolean))];
    assert.deepEqual(order, pack.steps.map((s) => s.id));
  });
}

test('book·모르는 유형은 기다렸다가 다음을 누른다', () => {
  const plan = planFor({ steps: [{ id: 'b', type: 'book', title: '책' }, { id: 'x', type: 'mystery' }] });
  assert.deepEqual(plan.slice(2), [
    { action: 'wait', ms: WAIT.book, step: 'b' }, { action: 'click', selector: SEL.next, step: 'b' },
    { action: 'wait', ms: WAIT.other, step: 'x' }, { action: 'click', selector: SEL.next, step: 'x' },
  ]);
  assert.deepEqual(planFor(null), [{ action: 'click', selector: SEL.start, step: null }, { action: 'wait', ms: WAIT.start, step: null }], '팩이 없어도 깨지지 않는다');
});

test('timerSec을 주지 않으면 팩의 timer_sec을 쓴다', () => {
  const plan = planFor({ steps: [{ id: 'm', type: 'activity', timer_sec: 60 }] });
  assert.equal(plan.find((p) => p.step === 'm' && p.action === 'wait').ms, 60 * 1000 + WAIT.activity);
});

test('scaleWaits(plan, 8)은 대기만 8로 나누고 클릭은 그대로 둔다(원본은 안 바꾼다)', () => {
  const plan = planFor(readPack('mind-weather.ko.json'), { timerSec: 8 });
  const fast = scaleWaits(plan, 8);
  assert.equal(fast.length, plan.length);
  fast.forEach((p, i) => {
    if (p.action === 'wait') assert.equal(p.ms, Math.ceil(plan[i].ms / 8));
    else assert.deepEqual(p, plan[i]);
  });
  assert.equal(plan[1].ms, WAIT.start, '원본 그대로');
  assert.equal(scaleWaits(plan, 0)[1].ms, WAIT.start, '0이나 음수 speed는 1로 본다');
  assert.equal(scaleWaits(plan, 'x')[1].ms, WAIT.start);
});

test('fromStep: 진행 중인 수업은 시작을 누르지 않고 그 단계부터, paused면 먼저 계속을 누른다', () => {
  const pack = readPack('mind-weather.en.json');
  const plan = planFor(pack, { timerSec: 8, fromStep: 2 });
  assert.equal(plan[0].selector, SEL.timer, '3번째 단계(몸놀이)부터');
  assert.ok(!clicks(plan).includes(SEL.start));
  assert.equal(clicks(plan).filter((s) => s === SEL.next).length, pack.steps.length - 2);
  const resumed = planFor(pack, { timerSec: 8, fromStep: 2, paused: true });
  assert.deepEqual(resumed[0], { action: 'click', selector: SEL.pause, step: 'move' });
  assert.deepEqual(resumed.slice(1), plan);
  assert.equal(planFor(pack, { fromStep: 99 })[0].step, 'bye', '범위를 넘으면 마지막 단계');
});

test('createGhost: 가짜 폰에서 계획 순서대로 누르고 running → done 상태를 알린다', async () => {
  const pack = readPack('mind-weather.ko.json');
  const phone = fakePhone();
  const statuses = [];
  const steps = [];
  const g = createGhost({ phoneRoot: phone, getPack: () => pack, speed: 100000, timerSec: 8, onStatus: (s, i) => { statuses.push(s); if (i.step) steps.push(i.step); } });
  assert.equal(g.speed, 100000);
  const ok = await g.run();
  assert.equal(ok, true);
  assert.deepEqual(phone.clicked, clicks(planFor(pack, { timerSec: 8 })));
  assert.equal(statuses[0], 'running');
  assert.equal(statuses.at(-1), 'done');
  assert.deepEqual([...new Set(steps)], [pack.title, ...pack.steps.map((s) => s.title)], '상태 줄에는 수업 이름 다음 단계 이름');
  assert.equal(g.running, false);
  g.destroy();
});

test('createGhost: stop()은 기다리던 타이머를 끊고 더는 누르지 않는다; 사람의 실제 탭도 멈춘다', async () => {
  const pack = readPack('mind-weather.ko.json');
  const phone = fakePhone();
  let trusted = null;
  phone.addEventListener = (type, fn, capture) => { assert.equal(type, 'click'); assert.equal(capture, true); trusted = fn; };
  const statuses = [];
  const g = createGhost({ phoneRoot: phone, getPack: async () => pack, speed: 1, onStatus: (s, i) => statuses.push([s, i.reason || i.step]) });
  const done = g.run();
  await tick();                                  // getPack 다음 첫 클릭(수업 시작)까지
  assert.equal(g.running, true);
  assert.deepEqual(phone.clicked, [SEL.start]);
  trusted({ isTrusted: false });                 // 유령 자신의 클릭은 무시
  assert.equal(g.running, true);
  trusted({ isTrusted: true });                  // 사람의 탭 → 멈춤
  assert.equal(g.running, false);
  assert.equal(await done, false, '6초 대기가 즉시 풀린다');
  await tick(30);
  assert.deepEqual(phone.clicked, [SEL.start], '멈춘 뒤에는 누르지 않는다');
  assert.deepEqual(statuses.at(-1), ['stopped', 'human']);
  assert.equal(g.stop(), false, '이미 멈췄으면 false');
  g.destroy();
});

test('createGhost: 화면이 계획과 다르면(버튼 없음) 멈추고 stopped/lost를 알린다; destroy 뒤에는 돌지 않는다', async () => {
  const pack = readPack('mind-weather.ko.json');
  const phone = fakePhone({ missing: [SEL.confirm] });
  const statuses = [];
  const g = createGhost({ phoneRoot: phone, getPack: () => pack, speed: 100000, onStatus: (s, i) => statuses.push([s, i.reason]) });
  assert.equal(await g.run(), false);
  assert.deepEqual(statuses.at(-1), ['stopped', 'lost']);
  assert.equal(phone.clicked.at(-1), SEL.tally('rainy'), '확정 버튼이 없는 자리에서 멈춘다');
  assert.ok(!phone.clicked.includes(SEL.confirm) && !phone.clicked.includes(SEL.timer), '다음 단계로 가지 않는다');
  g.destroy();
  assert.equal(await g.run(), false, 'destroy 뒤에는 false');
});
