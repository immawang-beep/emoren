// 단위 테스트: 수업팩 형식 문서(docs/PACK-FORMAT.md, 영어판 docs/PACK-FORMAT.en.md). 실행: npm test
// 영어판이 한국어 원문을 가리키고, 여섯 단계 유형과 packs:check를 설명하며, 관찰 언어 금칙어가 없는지 본다.
// Unit test: the pack-format docs. The English twin must link to the Korean original, cover every
// step type in js/pack.js plus `packs:check`, and contain none of the words the brief rules out.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STEP_TYPES } from '../../js/pack.js';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const KO = path.join(ROOT, 'docs/PACK-FORMAT.md');
const EN = path.join(ROOT, 'docs/PACK-FORMAT.en.md');

// 하드 제약 3(관찰 언어만)에서 금지한 말. 문서·화면 문구·팩 본문 어디에도 나오면 안 된다.
// The words hard constraint 3 (observational language only) forbids in any doc, UI string or pack text.
const FORBIDDEN = [
  /진단/, /검사/, /치료/, /판정/, /평가/, /위기/, /장애/, /문제 행동/,
  /diagnos/i, /therap/i, /treatment/i, /assess/i, /screening/i, /disorder/i, /at risk/i, /detect/i,
];

test('두 문서가 모두 있다 / both docs exist', () => {
  assert.ok(fs.existsSync(KO), 'docs/PACK-FORMAT.md');
  assert.ok(fs.existsSync(EN), 'docs/PACK-FORMAT.en.md');
});

test('영어판 첫 줄은 한국어 원문 링크 / en doc starts with a link to the Korean original', () => {
  const first = fs.readFileSync(EN, 'utf8').split('\n')[0];
  assert.match(first, /\]\(PACK-FORMAT\.md\)/, first);
});

test('영어판은 여섯 단계 유형을 전부 설명한다 / en doc covers every step type', () => {
  const en = fs.readFileSync(EN, 'utf8');
  assert.equal(STEP_TYPES.length, 6, 'js/pack.js STEP_TYPES');
  for (const type of STEP_TYPES) {
    assert.match(en, new RegExp(`^\\| \`${type}\` \\|`, 'm'), `step types table is missing a row for ${type}`);
  }
  for (const key of ['cover_line', 'back_line', 'one emoji stamp']) assert.ok(en.includes(key), `book section: ${key}`);
});

test('영어판은 packs:check를 설명한다 / en doc explains packs:check', () => {
  const en = fs.readFileSync(EN, 'utf8');
  assert.ok(en.includes('npm run packs:check'), 'npm run packs:check');
  assert.ok(en.includes('tools/packs-check.mjs'), 'tools/packs-check.mjs');
  for (const topic of ['index.json', '[[var:', 'option ids', 'observational-language lint']) assert.ok(en.includes(topic), topic);
});

test('영어판에 관찰 언어 금칙어가 없다 / en doc has no forbidden words', () => {
  const en = fs.readFileSync(EN, 'utf8');
  for (const re of FORBIDDEN) {
    const m = en.match(re);
    assert.equal(m, null, `forbidden word in docs/PACK-FORMAT.en.md: ${re} → "${m && m[0]}"`);
  }
});
