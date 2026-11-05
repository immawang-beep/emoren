// 단위 테스트: 수업팩 점검 도구(tools/packs-check.mjs)와 새 수업팩 2종(친구 마음 알아맞히기 · 마음 신호등)의 글쓰기 규칙. 실행: npm test
// Unit tests for the pack checker and the writing rules of the two new bilingual packs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runChecks, lintString, isPurpleish, templateVars, compareTwins, checkTemplates, PACK_FILE } from '../../tools/packs-check.mjs';
import { newRoom, actions, storyVars, renderTemplate } from '../../js/store.js';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const PACKS = path.join(ROOT, 'packs');
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const files = fs.readdirSync(PACKS).filter((f) => PACK_FILE.test(f)).sort();
const all = files.map((f) => readJson(path.join(PACKS, f)));
const NEW_IDS = ['feeling-guess', 'traffic-light'];
const fresh = all.filter((p) => NEW_IDS.includes(p.id));
const get = (id, lang) => all.find((p) => p.id === id && p.lang === lang);

// packs/를 임시 폴더(os.tmpdir())에 복사해 손본 뒤 검사한다 / copy packs/ into a temp root, mutate, run the checks
function checkMutated(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emoren-packs-'));
  fs.mkdirSync(path.join(dir, 'packs'));
  for (const f of fs.readdirSync(PACKS)) if (f.endsWith('.json')) fs.copyFileSync(path.join(PACKS, f), path.join(dir, 'packs', f));
  const edit = (file, fn) => {
    const p = path.join(dir, 'packs', file);
    const j = readJson(p);
    fs.writeFileSync(p, JSON.stringify(fn(j) || j));
  };
  try { mutate(edit, dir); return runChecks(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const tally = (pack, counts) => {
  const step = pack.steps.find((s) => s.type === 'choice');
  let s = newRoom('TEST', pack);
  for (const [id, n] of Object.entries(counts)) s = actions.tally(s, step.id, id, n);
  return { step, vars: storyVars(pack, s) };
};

test('packs:check — 저장소의 수업팩은 모두 통과한다', () => {
  const r = runChecks(ROOT);
  assert.deepEqual(r.problems, []);
  assert.equal(r.ok, true);
  assert.equal(r.report.length, files.length);
  assert.ok(r.report.length >= 6, '팩 3개 × 2언어');
  assert.ok(r.report.includes('✓ feeling-guess.ko  6 steps'), r.report.join('\n'));
  assert.ok(r.report.includes('✓ traffic-light.en  6 steps'));
  for (const line of r.report) assert.match(line, /^✓ /);
});

test('packs:check — 언어판의 선택지 id가 다르면 실패한다', () => {
  const r = checkMutated((edit) => edit('traffic-light.en.json', (p) => { p.steps.find((s) => s.id === 'signal').options[2].id = 'talk'; }));
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((m) => /^traffic-light\.en\.json: signal: .*option ids differ from ko: \[stop, breathe, talk\] vs \[stop, breathe, say\]/.test(m)), r.problems.join('\n'));
  assert.ok(r.problems.some((m) => /^traffic-light\.en\.json: signal\.on_confirm: .*\{say\}/.test(m)), '이름이 바뀐 선택지를 쓰던 템플릿도 함께 잡힌다');
  assert.ok(r.report.some((l) => /^✗ traffic-light\.en  6 steps  \(\d+\)$/.test(l)), r.report.join('\n'));
  assert.ok(r.report.includes('✓ traffic-light.ko  6 steps'), 'ko 쪽은 그대로 통과');
  const r2 = checkMutated((edit) => edit('feeling-guess.en.json', (p) => { p.steps.splice(2, 1); }));
  assert.ok(r2.problems.some((m) => /steps differ from ko/.test(m)), r2.problems.join('\n'));
  const r3 = checkMutated((edit) => edit('feeling-guess.en.json', (p) => { p.steps.find((s) => s.id === 'mimic').timer_sec = 60; p.home.tips.pop(); }));
  assert.ok(r3.problems.some((m) => /timer_sec differs/.test(m)) && r3.problems.some((m) => /home tips differs/.test(m)), r3.problems.join('\n'));
});

test('packs:check — 템플릿에 모르는 변수가 있으면 실패한다', () => {
  const r = checkMutated((edit) => edit('feeling-guess.ko.json', (p) => { p.steps.find((s) => s.type === 'story').template += ' {nobody}'; }));
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((m) => /feeling-guess\.ko\.json: story\.template: .*unknown template variable: \{nobody\}/.test(m)), r.problems.join('\n'));
  const r2 = checkMutated((edit) => edit('traffic-light.en.json', (p) => { p.steps.find((s) => s.type === 'choice').on_confirm += ' [[weather_lead: never]]'; }));
  assert.ok(r2.problems.some((m) => /signal\.on_confirm: .*\{weather_lead\}/.test(m)), r2.problems.join('\n'));
  assert.deepEqual(templateVars('{a} and [[b: {c}]]'), ['a', 'c', 'b']);
  for (const p of all) assert.deepEqual(checkTemplates(p), [], `${p.id}.${p.lang}`);
});

test('packs:check — 관찰 언어가 아닌 낱말, 보라색, 연락처는 실패한다', () => {
  const r = checkMutated((edit) => {
    edit('feeling-guess.ko.json', (p) => { p.steps[0].lines.push('오늘은 마음 검사를 해 볼까?'); });
    edit('feeling-guess.en.json', (p) => { p.home.tips[0] = 'We assess each child at home.'; });
    edit('traffic-light.ko.json', (p) => { p.steps.find((s) => s.type === 'choice').options[0].color = '#8E44AD'; });
    edit('traffic-light.en.json', (p) => { p.home.note = 'Questions? write to someone@example.org or call 010-1234-5678'; });
  });
  assert.equal(r.ok, false);
  const text = r.problems.join('\n');
  assert.match(text, /feeling-guess\.ko\.json: steps\[0\]\.lines\[4\]: .*'검사'/);
  assert.match(text, /feeling-guess\.en\.json: home\.tips\[0\]: .*'assess'/);
  assert.match(text, /traffic-light\.ko\.json: signal\/stop: .*purple-ish.*#8E44AD/);
  assert.match(text, /traffic-light\.en\.json: home\.note: .*contact data/);
  assert.deepEqual(lintString('교실 분위기가 포근해요'), [], "'분위기'는 '위기'가 아니다");
  assert.equal(lintString('위기 신호').length, 1);
  assert.equal(lintString('No screening here').length, 1);
  assert.equal(lintString('at risk').length, 1);
  assert.deepEqual(lintString('4 weather cards per child, 60 seconds'), []);
  assert.equal(isPurpleish('#8E44AD'), true);
  assert.equal(isPurpleish('#7C3AED'), true);
  assert.equal(isPurpleish('#FF6B9D'), false, '핑크 토큰은 통과');
  assert.equal(isPurpleish('#16B364'), false);
  assert.equal(isPurpleish('#E5484D'), false);
  assert.equal(isPurpleish('#F5B800'), false);
  assert.equal(isPurpleish('#4A5A7A'), false, '천둥 회청색은 통과');
});

test('packs:check — index.json이 디스크와 다르면 실패한다', () => {
  const r = checkMutated((edit) => edit('index.json', (idx) => { idx.packs.find((p) => p.id === 'traffic-light').langs.en.title = 'Traffic Lights'; }));
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((m) => /index\.json: traffic-light\.en .*title differs.*'Traffic Lights' vs 'Feelings Traffic Light'/.test(m)), r.problems.join('\n'));
  const r2 = checkMutated((edit) => edit('index.json', (idx) => { delete idx.packs.find((p) => p.id === 'feeling-guess').langs.en; }));
  assert.ok(r2.problems.some((m) => /index\.json: 'feeling-guess'.*languages differ from disk: index \[ko\] vs files \[en, ko\]/.test(m)), r2.problems.join('\n'));
  const r3 = checkMutated((edit) => edit('index.json', (idx) => { idx.packs.push({ id: 'ghost', langs: { ko: { title: 'x', domain: 'x', age: 'x', minutes: 1 } } }); }));
  assert.ok(r3.problems.some((m) => /index\.json: 'ghost'.*no packs\/ghost/.test(m)), r3.problems.join('\n'));
  const r4 = checkMutated((edit) => edit('mind-weather.ko.json', (p) => { p.lang = 'en'; }));
  assert.ok(r4.problems.some((m) => /mind-weather\.ko\.json: lang 'en'.*file name 'ko'/.test(m)), r4.problems.join('\n'));
});

test('친구 마음 알아맞히기: 확정·이야기 템플릿이 표본 집계로 깔끔하게 렌더된다', () => {
  const ko = get('feeling-guess', 'ko');
  const en = get('feeling-guess', 'en');
  let { step, vars } = tally(ko, { happy: 3, sad: 2, angry: 1 });
  let confirm = renderTemplate(step.on_confirm, vars);
  assert.match(confirm, /^기쁨 3명, 슬픔 2명, 화남 1명이 손을 들었구나\. 기쁨이라고 본 친구가 제일 많았네\./);
  assert.match(confirm, /슬픈 얼굴을 알아본 친구들, 고마워/);
  assert.doesNotMatch(confirm, /무서운 마음/, 'scared가 0이면 그 문장은 빠진다');
  assert.doesNotMatch(confirm, /\{|\[\[/);
  let story = renderTemplate(ko.steps.find((s) => s.type === 'story').template, vars);
  assert.match(story, /손을 든 친구는 기쁨 3명, 슬픔 2명, 화남 1명\. 기쁨이라고 본 친구가 제일 많았어요\./);
  assert.doesNotMatch(story, /\{|\[\[/);
  const empty = renderTemplate(ko.steps.find((s) => s.type === 'story').template, storyVars(ko, newRoom('X', ko)));
  assert.match(empty, /손을 든 친구는 아직 없었어요\. 친구 얼굴에도/);
  ({ step, vars } = tally(en, { happy: 3, sad: 2, angry: 1 }));
  confirm = renderTemplate(step.on_confirm, vars);
  assert.match(confirm, /^You noticed 3 Happy, 2 Sad, 1 Angry\. Most of you saw Happy\. Thank you for noticing a sad face\./);
  assert.doesNotMatch(confirm, /scared feeling/);
  story = renderTemplate(en.steps.find((s) => s.type === 'story').template, vars);
  assert.match(story, /Here is what we noticed: 3 Happy, 2 Sad, 1 Angry\. Most friends saw Happy\./);
  assert.doesNotMatch(story, /\{|\[\[/);
  assert.match(renderTemplate(en.steps.find((s) => s.type === 'story').template, storyVars(en, newRoom('X', en))), /noticed: a quiet face\. Our friends/);
});

test('마음 신호등: 확정·이야기 템플릿이 표본 집계로 깔끔하게 렌더된다', () => {
  const ko = get('traffic-light', 'ko');
  const en = get('traffic-light', 'en');
  let { step, vars } = tally(ko, { stop: 2, breathe: 3, say: 1 });
  let confirm = renderTemplate(step.on_confirm, vars);
  assert.match(confirm, /^멈추기 2명, 숨쉬기 3명, 말하기 1명이 신호를 골랐구나\. 숨쉬기를 고른 친구가 제일 많았네\./);
  assert.match(confirm, /어떤 신호든 내가 고르는 거야/);
  assert.doesNotMatch(confirm, /\{|\[\[/);
  let story = renderTemplate(ko.steps.find((s) => s.type === 'story').template, vars);
  assert.match(story, /우리 반이 고른 신호는 멈추기 2명, 숨쉬기 3명, 말하기 1명\. 제일 많이 고른 신호는 숨쉬기였어요\./);
  assert.doesNotMatch(story, /\{|\[\[/);
  ({ vars } = tally(ko, { say: 2 }));
  story = renderTemplate(ko.steps.find((s) => s.type === 'story').template, vars);
  assert.match(story, /말하기를 고른 친구는/);
  assert.doesNotMatch(story, /멈추기를 고른 친구는|숨쉬기를 고른 친구는/);
  assert.match(renderTemplate(ko.steps.find((s) => s.type === 'story').template, storyVars(ko, newRoom('X', ko))), /고른 신호는 아직 없었어요\. 어떤 신호든/);
  ({ step, vars } = tally(en, { stop: 2, breathe: 3, say: 1 }));
  confirm = renderTemplate(step.on_confirm, vars);
  assert.match(confirm, /^You chose 2 Stop, 3 Breathe, 1 Say\. Most of you chose Breathe\./);
  assert.doesNotMatch(confirm, /\{|\[\[/);
  story = renderTemplate(en.steps.find((s) => s.type === 'story').template, vars);
  assert.match(story, /The lights our class chose: 2 Stop, 3 Breathe, 1 Say\. Breathe was chosen most of all\./);
  assert.doesNotMatch(story, /\{|\[\[/);
  assert.match(renderTemplate(en.steps.find((s) => s.type === 'story').template, storyVars(en, newRoom('X', en))), /chose: no light yet\. Whatever/);
});

test('새 수업팩 2종의 뼈대: 6단계(hello → 선택 → 활동 → story → book → bye), 선택지·타이머·집 안내', () => {
  assert.equal(fresh.length, 4, 'feeling-guess, traffic-light × ko, en');
  const shape = { 'feeling-guess': ['hello', 'guess', 'mimic', 'story', 'book', 'bye'], 'traffic-light': ['hello', 'signal', 'breathe', 'story', 'book', 'bye'] };
  const opts = { 'feeling-guess': ['happy', 'sad', 'angry', 'scared'], 'traffic-light': ['stop', 'breathe', 'say'] };
  const timers = { 'feeling-guess': 45, 'traffic-light': 30 };
  for (const p of fresh) {
    const tag = `${p.id}.${p.lang}`;
    assert.deepEqual(p.steps.map((s) => s.id), shape[p.id], tag);
    assert.deepEqual(p.steps.map((s) => s.type), ['talk', 'choice', 'activity', 'story', 'book', 'closing'], tag);
    const choice = p.steps[1];
    assert.deepEqual(choice.options.map((o) => o.id), opts[p.id], tag);
    assert.equal(p.steps[2].timer_sec, timers[p.id], tag);
    assert.equal(p.steps[2].moves.length, 4, tag);
    assert.ok(p.steps[2].done_line, tag);
    assert.equal(p.home.tips.length, 3, tag);
    assert.ok(p.home.note && p.home.title, tag);
    assert.ok(p.goal && p.materials.length >= 3 && p.outro.length, tag);
    assert.equal(p.character.name, p.lang === 'ko' ? '조앤' : 'Joanne', tag);
    assert.equal(p.character.color, '#FF6B9D', tag);
    assert.equal(p.minutes, 15, tag);
    for (const k of ['cover_line', 'back_line']) assert.equal(typeof p.steps[4][k], 'string', `${tag} book.${k}`);
    if (p.lang === 'en') {
      assert.equal(p.list_item, '{n} {label}', tag);
      assert.ok(p.list_empty && p.class_name, tag);
      for (const o of choice.options) assert.match(o.label, /^[A-Z][a-z]+$/, `${tag}: 영어 선택지는 한 단어`);
    } else {
      for (const o of choice.options) assert.ok(o.label.length >= 2 && o.label.length <= 3, `${tag}: 한국어 선택지는 2~3글자 (${o.label})`);
    }
  }
  const tl = get('traffic-light', 'ko').steps[1].options;
  assert.deepEqual(tl.map((o) => o.emoji), ['🔴', '🟡', '🟢']);
  assert.deepEqual(tl.map((o) => o.color), ['#E5484D', '#F5B800', '#16B364']);
  assert.deepEqual(get('feeling-guess', 'en').steps[1].options.map((o) => o.emoji), ['😊', '😢', '😠', '😨']);
  for (const id of NEW_IDS) assert.deepEqual(compareTwins(get(id, 'ko'), get(id, 'en')), [], id);
});

test('글쓰기 규칙: 모든 단계에 title·cue, 모든 선택지에 emoji·label, talk/closing은 4줄 이하, 한국어 한 줄은 짧게', () => {
  for (const p of all) {
    const tag = `${p.id}.${p.lang}`;
    for (const s of p.steps) {
      assert.ok(s.title, `${tag}/${s.id}: title`);
      assert.ok(s.cue, `${tag}/${s.id}: cue`);
      for (const o of s.options || []) assert.ok(o.emoji && o.label, `${tag}/${s.id}/${o.id}: emoji+label`);
      if (s.type === 'talk' || s.type === 'closing') assert.ok(s.lines.length <= 4, `${tag}/${s.id}: ${s.lines.length}줄`);
    }
  }
  // 한 줄은 한 호흡(열다섯 글자 안팎). 문장 부호까지 넉넉히 30자 / soft rule, asserted at 30 for the new packs
  for (const p of fresh.filter((x) => x.lang === 'ko')) {
    for (const s of p.steps) for (const l of s.lines || []) assert.ok(l.length <= 30, `${p.id}/${s.id}: ${l.length}자 — ${l}`);
  }
  // 평가하는 말 대신 고마움 / thank instead of grading
  for (const p of fresh) {
    const text = JSON.stringify(p.steps);
    assert.doesNotMatch(text, /맞혔|틀렸|잘했|wrong|correct answer|good job/i, `${p.id}.${p.lang}`);
    assert.match(text, p.lang === 'ko' ? /고마워/ : /Thank you/, `${p.id}.${p.lang}`);
  }
});
