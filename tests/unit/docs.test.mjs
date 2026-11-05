// 단위 테스트: 운영 문서(docs/BRAIN.md, docs/DEPLOY.md)와 Pages 워크플로우가 약속을 지키는지. 실행: npm test
// 한국어 본문 + 'English summary', 저장소 안 링크가 실제 파일을 가리키는지, 관찰 언어·이름 규칙,
// 그리고 문서가 말하는 사실(변수·기분·콘솔 줄·방 키·워크플로우 액션)이 코드와 어긋나지 않는지 — 문자열 확인만 한다.
// Docs lint: Korean first + English summary, relative links resolve, no forbidden words, no model/company names,
// and the facts the docs state (variables, moods, console lines, room keys, workflow actions) match the code.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { newRoom, actions, storyVars } from '../../js/store.js';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const DOCS = ['docs/BRAIN.md', 'docs/DEPLOY.md'];
const text = Object.fromEntries(DOCS.map((f) => [f, read(f)]));
const brain = text['docs/BRAIN.md'];
const deploy = text['docs/DEPLOY.md'];

// 관찰 언어: 아이를 가르는 말은 문서에 없다(금지를 설명할 때도) / never appear, not even to say they are banned
const FORBIDDEN_KO = ['진단', '검사', '치료', '판정', '평가', '위기', '장애', '문제 행동'];
const FORBIDDEN_EN = [/diagnos/i, /therap/i, /treatment/i, /assess/i, /screening/i, /disorder/i, /at[- ]risk/i, /detect/i];
// 모델 이름·회사 이름·금융 소재도 없다. 토큰은 조각으로 적어 이 파일이 저장소 전체 grep에 걸리지 않게 한다.
// Model names, company names and money themes: tokens are split so this lint never matches a repo-wide grep.
const hint = (a, b, flags = 'i') => new RegExp(a + b, flags);
const NAME_HINTS = [
  hint('\\bop', 'us\\b'), hint('\\bson', 'net\\b'), hint('\\bhai', 'ku\\b'), hint('\\bfa', 'ble\\b'),
  hint('\\bg', 'pt-?\\d'), hint('\\bgem', 'ini\\b'), hint('\\bll', 'ama\\b'), hint('claude-', '\\w'),
  hint('더', '멤버스', ''), hint('THE ', 'MEMBERS', ''),
  hint('코', '인'), hint('저', '금'), hint('금', '융'), hint('\\bco', 'ins?\\b'), hint('\\bmon', 'ey\\b'), hint('\\bsav', 'ings\\b'), hint('\\bfina', 'nc'),
];

test('두 문서가 있고, 한국어 본문으로 시작해 English summary로 끝난다', () => {
  for (const f of DOCS) {
    const t = text[f];
    const first = t.split('\n').find((l) => l.startsWith('# '));
    assert.ok(first && /[가-힣]/.test(first), `${f}: 첫 제목은 한국어로 시작한다`);
    const i = t.indexOf('\n## English summary');
    assert.ok(i > 0, `${f}: '## English summary' 제목이 있다`);
    assert.ok((t.slice(0, i).match(/[가-힣]/g) || []).length > 500, `${f}: 한국어 본문이 먼저, 충분히`);
    const summary = t.slice(i);
    assert.ok(!/\n## /.test(summary.slice(1)), `${f}: English summary가 마지막 절이다`);
    assert.ok(summary.length > 600, `${f}: 영어 요약이 요약답게 있다`);
  }
});

test('문서 안의 저장소 링크는 실제 파일을 가리킨다', () => {
  for (const f of DOCS) {
    const dir = path.dirname(path.join(ROOT, f));
    let n = 0;
    for (const m of text[f].matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = m[1];
      if (/^(https?:|mailto:|#)/.test(target)) continue;
      n++;
      assert.ok(fs.existsSync(path.resolve(dir, target.split('#')[0])), `${f}: 링크 대상이 없다 / missing link target: ${target}`);
    }
    assert.ok(n > 0, `${f}: 저장소 파일로 가는 링크가 하나는 있다`);
  }
});

test('관찰 언어: 금지어가 문서에 없다(ko·en)', () => {
  for (const f of DOCS) {
    for (const w of FORBIDDEN_KO) assert.ok(!text[f].includes(w), `${f}: 금지어 '${w}'`);
    for (const re of FORBIDDEN_EN) assert.doesNotMatch(text[f], re, `${f}: forbidden word ${re}`);
  }
});

test('모델 이름·회사 이름·금융 소재가 문서에 없다', () => {
  for (const f of DOCS) for (const re of NAME_HINTS) assert.doesNotMatch(text[f], re, `${f}: ${re}`);
});

test('BRAIN.md: 변수 목록이 storyVars가 만드는 모든 종류를 다루고, 기분 네 가지를 말한다', () => {
  const pack = JSON.parse(read('packs/mind-weather.ko.json'));
  const vars = storyVars(pack, newRoom('DEMO', pack));
  const optionIds = pack.steps.filter((s) => s.type === 'choice').flatMap((s) => s.options.map((o) => o.id));
  const kinds = new Set();
  for (const k of Object.keys(vars)) {
    if (k === 'class') kinds.add('{class}');
    else if (optionIds.includes(k)) kinds.add(`{${optionIds[0]}}`);
    else { const m = k.match(/_(\w+)$/); assert.ok(m, `알 수 없는 변수 꼴 / unexpected variable: ${k}`); kinds.add(`_${m[1]}`); }
  }
  assert.ok(kinds.size >= 5, [...kinds].join(' '));
  for (const kind of kinds) assert.ok(brain.includes(kind), `BRAIN.md에 변수 설명이 없다 / variable kind missing: ${kind}`);
  assert.ok(brain.includes('[[') && brain.includes('renderTemplate'), '조건문 문법 설명');
  const character = read('js/ui/character.js');
  for (const mood of ['idle', 'talk', 'happy', 'think']) {
    assert.ok(character.includes(mood), `character.js: ${mood}`);
    assert.match(brain, new RegExp(`\\b${mood}\\b`), `BRAIN.md: 기분 ${mood}`);
  }
  for (const ref of ['speakSeq', 'say()', 'storyVars', 'js/ui/speech.js', 'suggestLine', 'tools/packs-check.mjs']) assert.ok(brain.includes(ref), ref);
});

test('BRAIN.md의 예시(해님 3, 구름 2, 비 1)는 실제 storyVars 값과 같다(ko·en)', () => {
  for (const lang of ['ko', 'en']) {
    const pack = JSON.parse(read(`packs/mind-weather.${lang}.json`));
    let s = newRoom('DEMO', pack);
    for (const [id, n] of [['sunny', 3], ['cloudy', 2], ['rainy', 1]]) s = actions.tally(s, 'weather', id, n);
    const vars = storyVars(pack, s);
    assert.ok(brain.includes(vars.weather_list), `${lang}: ${vars.weather_list}`);
    assert.ok(brain.includes(vars.weather_lead), `${lang}: ${vars.weather_lead}`);
    assert.equal(vars.stormy, 0, '예시에서 천둥은 0이라 [[stormy: …]]가 빠진다');
  }
});

test('DEPLOY.md: 세 경로·검증 절차·만료·점검표가 있고, 인용한 코드 사실이 맞다', () => {
  for (const ref of ['pages.yml', 'build:artifact', 'dist/artifact.html', 'dist/artifact-files.json', 'config.js', 'auth != null',
    'EMOREN_FIREBASE_CONFIG', 'rooms/<code>', 'updatedAt', 'CACHE', 'SHELL', 'enablement: true', '7', 'localStorage']) {
    assert.ok(deploy.includes(ref), `DEPLOY.md: ${ref}`);
  }
  assert.match(deploy, /아직 실제 Firebase 프로젝트로 검증하지 않았다/, '미검증임을 밝힌다(ko)');
  assert.match(deploy, /has not yet been verified on a real project/, 'states it is unverified (en)');
  assert.match(deploy, /!data\.exists\(\) \|\| data\.child\('updatedAt'\)\.val\(\) > now - 7\*24\*3600\*1000/, '만료 규칙은 빈 경로 읽기를 허용한다');
  // 콘솔 줄은 실제 코드에 있는 그대로 / quoted console lines exist verbatim in the sync adapters
  const firebase = read('js/sync/firebase.js');
  const lines = [...deploy.matchAll(/`(\[sync:firebase\] [^`]+)`/g)].map((m) => m[1]);
  assert.ok(lines.length >= 3, '[sync:firebase] 줄을 셋 이상 안내한다');
  for (const l of lines) assert.ok(firebase.includes(l), `firebase.js에 없는 콘솔 줄 / console line not in code: ${l}`);
  assert.ok(read('js/sync/index.js').includes('사용 불가:') && deploy.includes('[sync] firebase 사용 불가'), '어댑터 건너뜀 줄');
  assert.ok(read('js/sync/local.js').includes('emoren-classroom:room:') && deploy.includes('emoren-classroom:room:<code>'), 'localStorage 키');
  assert.ok(read('js/sync/artifactdb.js').includes('rooms/${code}') && firebase.includes('rooms/${code}'), 'rooms/<code> 경로');
  // 검증 절차 9번: 방 JSON의 키를 빠짐없이 적는다 / the room keys listed in step 9 are the whole newRoom() shape
  const pack = JSON.parse(read('packs/mind-weather.ko.json'));
  for (const k of Object.keys(newRoom('DEMO', pack))) assert.ok(deploy.includes(`\`${k}\``), `DEPLOY.md 방 키 목록에 없다 / room key missing: ${k}`);
});

test('pages.yml: main 푸시·수동 실행, 네 액션, 권한, 동시성', () => {
  const y = read('.github/workflows/pages.yml');
  for (const s of ['on:', 'push:', 'branches: [main]', 'workflow_dispatch:', 'pages: write', 'id-token: write', 'contents: read',
    'group: pages', 'actions/checkout@v4', 'actions/configure-pages@v5', 'enablement: true', 'actions/upload-pages-artifact@v3', 'path: .',
    'actions/deploy-pages@v4']) {
    assert.ok(y.includes(s), `pages.yml: ${s}`);
  }
  assert.doesNotMatch(y, /\t/, 'YAML에는 탭이 없다');
  assert.ok(deploy.includes('workflows/pages.yml'), 'DEPLOY.md가 워크플로우를 설명한다');
});
