// 퍼즈 테스트: 시드를 고정한 난수(mulberry32)로 js/store.js 리듀서에 무작위 동작 시퀀스를 넣고 매 단계마다 불변식을 확인한다.
// 수업팩 ko·en 각각 300개 시퀀스(길이 40). 실패하면 시드·팩·단계·동작 기록을 함께 출력하므로 그대로 다시 돌릴 수 있다.
// Fuzz test: a seeded PRNG (mulberry32) drives 300 random action sequences (length 40) through the store reducers
// for both mind-weather packs (ko, en); invariants are checked after every step. On failure the seed, pack, step and
// the action trace are printed, so the run can be replayed:
//   FUZZ_SEED=1042 node --test tests/unit/store-fuzz.test.mjs
// 실행 / run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { newRoom, stamp, actions, currentStep, renderTemplate, storyVars, summaryOf } from '../../js/store.js';

const read = (f) => JSON.parse(fs.readFileSync(new URL(f, import.meta.url), 'utf8'));
const PACKS = [read('../../packs/mind-weather.ko.json'), read('../../packs/mind-weather.en.json')];

const RUNS = 300;
const LEN = 40;
const ONLY_SEED = process.env.FUZZ_SEED ? Number(process.env.FUZZ_SEED) : null;
const PHASES = ['waiting', 'live', 'paused', 'done'];
// 상태 안에서 문자열이 있어도 되는 자리. 그 밖의 자유 문자열은 아동 데이터가 될 수 있어 금지(브리프 7번).
// The only places a string may live in room state; any other string leaf is a bug (brief, constraint 7).
const STRING_PATHS = new Set(['code', 'packId', 'lang', 'phase', 'timer.stepId', 'notes[].text']);
const NOTE_MAX = 300;

// mulberry32: 32비트 시드 하나로 재현되는 [0, 1) 난수 / reproducible [0, 1) numbers from one 32-bit seed
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const int = (rnd, n) => Math.floor(rnd() * n);
const pick = (rnd, arr) => arr[int(rnd, arr.length)];

// 메모 입력: 빈 값, 공백만, 400자, 300자 경계 근처, 공백·줄바꿈·괄호·이모지가 섞인 무작위 단어열
// note input: empty, whitespace only, 400 chars, around the 300-char edge, random words with spaces/newlines/braces/emoji
const WORDS = ['오늘', '우리 반', '비', '해님', 'sunny', 'quiet', '{weather_list}', '[[x:', '<b>', '  ', '\n', '\t', '😀', '.'];
function randomNote(rnd) {
  const r = rnd();
  if (r < 0.08) return pick(rnd, ['', ' ', '   ', '\n\t ', null, undefined]);
  if (r < 0.16) return 'x'.repeat(400);
  if (r < 0.26) return ' '.repeat(int(rnd, 4)) + 'a'.repeat(NOTE_MAX - 3 + int(rnd, 8)) + ' '.repeat(int(rnd, 4));
  let s = '';
  for (let i = int(rnd, 70); i > 0; i--) s += pick(rnd, WORDS) + (rnd() < 0.5 ? ' ' : '');
  return s;
}

// 동작 생성기: 이름 → [인자...]. tally는 ±1, tallyNeg는 직전 선택지에 -1을 거듭 눌러 0 아래로 내려가려 한다(음수 스팸).
// action generators: name → args. tally is ±1; tallyNeg spams -1 on the last tallied option to push it below zero.
const makeGenerators = (pack) => {
  const stepIds = pack.steps.map((s) => s.id);
  const options = pack.steps.find((s) => s.type === 'choice').options.map((o) => o.id);
  let last = [stepIds[1], options[0]];
  return {
    start: () => [],
    next: () => [pack],
    prev: () => [],
    tally: (rnd) => { last = [pick(rnd, stepIds), pick(rnd, options)]; return [...last, rnd() < 0.4 ? -1 : 1]; },
    tallyNeg: () => [...last, -1],
    confirm: (rnd) => [pick(rnd, stepIds)],
    startTimer: (rnd) => [pick(rnd, stepIds), pick(rnd, [10, 60, 90])],
    togglePause: () => [],
    respeak: () => [],
    end: () => [],
    note: (rnd) => [randomNote(rnd)],
    reset: () => [pack],
  };
};
// 뽑힐 비율: 집계가 실제 수업에서 가장 잦으므로 더 자주 / tally is the most common real action, so it is drawn more often
const MENU = ['start', 'next', 'next', 'prev', 'tally', 'tally', 'tally', 'tallyNeg', 'tallyNeg', 'confirm', 'startTimer',
  'togglePause', 'togglePause', 'respeak', 'end', 'note', 'note', 'reset'];
const ACTION_NAMES = Object.keys(actions);

// 상태의 모든 잎(leaf)을 걷는다: 숫자(유한)·불리언·null은 어디든, 문자열은 STRING_PATHS에만. book은 null 또는 숫자 객체.
// walk every leaf: finite numbers, booleans and null anywhere; strings only at STRING_PATHS; book is null or numbers.
function walkLeaves(value, path, msg) {
  if (value === null) return;
  if (Array.isArray(value)) { for (const v of value) walkLeaves(v, path + '[]', msg); return; }
  if (typeof value === 'object') {
    assert.equal(Object.getPrototypeOf(value), Object.prototype, msg(`plain object expected at ${path || '<root>'}`));
    for (const [k, v] of Object.entries(value)) {
      const p = path ? `${path}.${k}` : k;
      if (p === 'book') {
        assert.ok(v == null || (typeof v === 'object' && !Array.isArray(v) && Object.values(v).every((n) => Number.isFinite(n))),
          msg('book must be null or an object of numbers'));
        continue;
      }
      walkLeaves(v, p, msg);
    }
    return;
  }
  if (typeof value === 'number') { assert.ok(Number.isFinite(value), msg(`non-finite number at ${path}`)); return; }
  if (typeof value === 'boolean') return;
  if (typeof value === 'string') { assert.ok(STRING_PATHS.has(path), msg(`unexpected string leaf at ${path}: ${JSON.stringify(value).slice(0, 60)}`)); return; }
  assert.fail(msg(`unexpected ${typeof value} at ${path}`));
}

// 한 단계 뒤의 불변식. 반환값은 직렬화 결과(다음 단계에서 "입력이 변하지 않았나"를 볼 때 다시 쓴다).
// invariants after one step; returns the JSON snapshot (reused by the next step's "input not mutated" check).
function checkInvariants(pack, s, raw, prev, prevJson, name, msg, seen) {
  const last = pack.steps.length - 1;
  // 1. phase
  assert.ok(PHASES.includes(s.phase), msg(`phase=${s.phase}`));
  // 2. stepIndex ∈ [0, steps.length-1], 정수
  assert.ok(Number.isInteger(s.stepIndex) && s.stepIndex >= 0 && s.stepIndex <= last, msg(`stepIndex=${s.stepIndex}`));
  // 3. 모든 집계는 0 이상의 정수
  for (const [sid, t] of Object.entries(s.tallies)) {
    for (const [oid, n] of Object.entries(t)) {
      assert.ok(Number.isInteger(n) && n >= 0, msg(`tally ${sid}/${oid}=${n}`));
      if (n === 0 && name === 'tallyNeg') seen.clamped = true;
    }
  }
  // 4. speakSeq는 reset 말고는 줄지 않는다
  if (name === 'reset') assert.equal(s.speakSeq, 0, msg('speakSeq after reset'));
  else assert.ok(Number.isInteger(s.speakSeq) && s.speakSeq >= prev.speakSeq, msg(`speakSeq ${prev.speakSeq} → ${s.speakSeq}`));
  // 5. rev는 stamp마다 정확히 1 커진다(reset 뒤에는 0에서 다시)
  assert.equal(s.rev, raw.rev + 1, msg('stamp adds exactly 1 to rev'));
  if (name === 'reset') assert.equal(s.rev, 1, msg('rev after reset + stamp'));
  else assert.ok(s.rev > prev.rev, msg(`rev ${prev.rev} → ${s.rev}`));
  // 6. JSON 왕복이 같다(undefined·함수·NaN·Date 없음)
  const json = JSON.stringify(s);
  assert.deepEqual(JSON.parse(json), s, msg('state must survive JSON round-trip'));
  // 7. 메모: 300자 이하, 앞뒤 공백 없음, 빈 메모 없음
  for (const n of s.notes) {
    assert.ok(typeof n.text === 'string' && n.text.length > 0 && n.text.length <= NOTE_MAX, msg(`note length ${n.text && n.text.length}`));
    assert.equal(n.text, n.text.trim(), msg('note must be trimmed'));
    assert.ok(n.text.isWellFormed(), msg('note must not contain a split emoji (lone surrogate)'));
    assert.ok(Number.isInteger(n.t), msg('note timestamp'));
    if (n.text.length === NOTE_MAX) seen.cut = true;
  }
  // 8. currentStep은 던지지 않고 팩의 단계를 돌려준다
  const step = currentStep(pack, s);
  assert.ok(pack.steps.includes(step), msg('currentStep returns a pack step'));
  // 9. 이야기 변수 + 템플릿: {변수}나 [[조건]]이 남지 않는다 (story.template, choice.on_confirm)
  const vars = storyVars(pack, s);
  for (const st of pack.steps) {
    for (const tpl of [st.template, st.on_confirm]) {
      if (!tpl) continue;
      const out = renderTemplate(tpl, vars);
      assert.ok(out.length > 0 && !/[{}]|\[\[|\]\]/.test(out), msg(`template of ${st.id} left a placeholder: ${out}`));
    }
  }
  // 10. summaryOf: 행 수 = 첫 선택 단계의 선택지 수, 비율 0..100
  const choice = pack.steps.find((x) => x.type === 'choice');
  const sum = summaryOf(pack, s);
  assert.equal(sum.rows.length, choice.options.length, msg('summary rows = option count'));
  for (const r of sum.rows) assert.ok(Number.isInteger(r.n) && r.n >= 0 && r.pct >= 0 && r.pct <= 100, msg(`summary row ${r.id}`));
  // 11. 문자열 잎은 정해진 자리에만(아동 데이터 금지), 나머지는 숫자·불리언·null
  walkLeaves(s, '', msg);
  // 12. confirmed 값은 true뿐, timer는 null 또는 { stepId(팩 단계), startedAt, seconds }
  for (const [sid, v] of Object.entries(s.confirmed)) assert.equal(v, true, msg(`confirmed.${sid}`));
  if (s.timer !== null) {
    assert.deepEqual(Object.keys(s.timer).sort(), ['seconds', 'startedAt', 'stepId'], msg('timer shape'));
    assert.ok(pack.steps.some((x) => x.id === s.timer.stepId), msg('timer.stepId is a pack step'));
    assert.ok(Number.isInteger(s.timer.startedAt) && Number.isFinite(s.timer.seconds), msg('timer numbers'));
  }
  // 13. 리듀서는 입력 상태를 바꾸지 않는다(순수 함수)
  assert.equal(JSON.stringify(prev), prevJson, msg(`${name} mutated its input state`));
  return json;
}

function fuzzOne(pack, seed, seen) {
  const rnd = mulberry32(seed);
  const gen = makeGenerators(pack);
  const trace = [];
  let s = stamp(newRoom('FUZZ', pack));
  let prevJson = JSON.stringify(s);
  for (let i = 0; i < LEN; i++) {
    const kind = pick(rnd, MENU);
    const name = kind === 'tallyNeg' ? 'tally' : kind;
    const args = gen[kind](rnd);
    trace.push(`${name}(${args.filter((a) => a !== pack).map((a) => JSON.stringify(a)).join(', ').slice(0, 40)})`);
    const ctx = `[fuzz seed=${seed} pack=${pack.lang} step=${i} action=${kind}]`;
    const msg = (what) => `${ctx} ${what}`;
    try {
      const prev = s;
      const raw = actions[name](prev, ...args);
      s = stamp(raw);
      prevJson = checkInvariants(pack, s, raw, prev, prevJson, kind, msg, seen);
    } catch (e) {
      console.error(`${ctx} failed. replay: FUZZ_SEED=${seed} node --test tests/unit/store-fuzz.test.mjs\n  trace: ${trace.join(' → ')}`);
      throw new Error(e.message.startsWith(ctx) ? e.message : `${ctx} ${e.message}`, { cause: e });
    }
    seen.actions.add(name);
    seen.phases.add(s.phase);
    seen.maxStep = Math.max(seen.maxStep, s.stepIndex);
  }
}

test('mulberry32: 같은 시드는 같은 수열, 다른 시드는 다른 수열', () => {
  const a = mulberry32(42); const b = mulberry32(42); const c = mulberry32(43);
  const seqA = Array.from({ length: 8 }, () => a());
  assert.deepEqual(seqA, Array.from({ length: 8 }, () => b()));
  assert.notDeepEqual(seqA, Array.from({ length: 8 }, () => c()));
  assert.ok(seqA.every((x) => x >= 0 && x < 1));
});

for (const [p, pack] of PACKS.entries()) {
  test(`퍼즈: ${pack.lang} 팩에 무작위 동작 ${RUNS}×${LEN}을 넣어도 상태 불변식이 지켜진다`, () => {
    const seen = { actions: new Set(), phases: new Set(), maxStep: 0, clamped: false, cut: false };
    const base = p * 1000;   // ko: 1..300, en: 1001..1300
    const seeds = ONLY_SEED !== null ? [ONLY_SEED] : Array.from({ length: RUNS }, (_, i) => base + i + 1);
    for (const seed of seeds) fuzzOne(pack, seed, seen);
    if (ONLY_SEED !== null) return;
    // 퍼즈가 실제로 모든 동작·국면·마지막 단계·0 고정·300자 자르기를 건드렸는지(빈 테스트 방지)
    // the fuzz really exercised every action, every phase, the last step, the zero clamp and the 300-char cut
    assert.deepEqual([...seen.actions].sort(), [...ACTION_NAMES].sort(), 'every store action was exercised');
    assert.deepEqual([...seen.phases].sort(), [...PHASES].sort(), 'every phase was reached');
    assert.equal(seen.maxStep, pack.steps.length - 1, 'the last step was reached');
    assert.ok(seen.clamped && seen.cut, 'negative spam hit the zero clamp and a long note was cut to 300');
  });
}
