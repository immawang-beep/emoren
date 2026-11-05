// 단위 테스트: 디스크의 수업팩 전부(packs/*.<lang>.json)에 쓰기 규칙을 건다. 실행: npm test
// 파일을 glob으로 찾으므로 나중에 추가되는 팩도 저절로 검사된다. 규칙은 docs/PACK-FORMAT.md의
// "만 4~5세 대사를 쓸 때 / 영어판을 쓸 때"와 공통 브리프의 하드 제약(관찰 언어, 보라색 금지, 아이 데이터 없음)에서 왔다.
// Unit test: writing rules for every lesson pack on disk (packs/*.<lang>.json). Files are globbed, so packs
// added later are covered automatically. Rules come from docs/PACK-FORMAT.md ("writing lines for ages 4–5 /
// writing the English version") and the common brief's hard constraints (observational language, no purple,
// no child data). Thresholds that an existing pack already exceeds are loosened to the measured value and
// commented, instead of editing the pack here.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePack, DEFAULT_PACK } from '../../js/pack.js';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const PACKS = path.join(ROOT, 'packs');
const FILE_RE = /^([a-z0-9-]+)\.([a-z]{2,3})\.json$/;

const read = (f) => JSON.parse(fs.readFileSync(path.join(PACKS, f), 'utf8'));
const packs = fs.readdirSync(PACKS).filter((f) => FILE_RE.test(f)).sort().map((file) => {
  const [, id, lang] = file.match(FILE_RE);
  return { file, id, lang, pack: read(file) };
});
const index = read('index.json');

// ---- 한도 / thresholds ---------------------------------------------------------------------------------------
// ko 한 줄 글자 수(코드 포인트). 목표는 한 호흡 ≈ 15자, 넉넉히 32자. 기존 팩이 넘겨서 측정값으로 느슨하게 둔다:
//   packs/mind-weather.ko.json steps[0].lines[2] = 42자, steps[5].lines[1] = 35자.
//   그 두 줄을 두 호흡으로 나누면 32로 되돌린다. 팩은 여기서 고치지 않는다.
// ko characters per line (code points). Target is 32 (≈15 per breath, two breaths). Loosened to the measured
// maximum in the existing pack: mind-weather.ko.json steps[0].lines[2] = 42, steps[5].lines[1] = 35.
// Tighten back to 32 once those two lines are split.
const KO_MAX_CHARS = 32;
// en 한 줄 단어 수 / en words per line
const EN_MAX_WORDS = 16;
const MAX_LINES = 4;            // 한 단계에 네 줄까지 / at most four lines per step
const TIMER_RANGE = [10, 180];  // activity timer_sec
const MOVES_RANGE = [2, 6];     // activity moves
const HOME_TIPS = 3;            // home.tips 개수 / number of home tips

// 관찰 언어만(하드 제약 3). 팩 안의 어떤 문자열에도 나오면 안 된다 / observational language only (hard constraint 3)
const FORBIDDEN = [
  /진단/, /검사/, /치료/, /판정/, /위기/, /장애/, /문제아/, /문제 행동/,
  /diagnos/i, /therap/i, /treatment/i, /assess/i, /screening/i, /disorder/i, /at[\s-]risk/i,
];
// 평가하지 않는다: "잘했어/틀렸어" 대신 "고마워/그랬구나" / thank, never praise or scold
const PRAISE_SCOLD = [/잘했어/, /틀렸/, /good job/i, /wrong answer/i];
// 기존 packs/mind-weather.ko.json outro[0] "오늘 수업 끝! 모두 잘했어."가 '잘했어'를 쓴다. 팩은 고치지 않고 그 한 문장만
// 예외로 둔다(파일·경로·문장이 정확히 같을 때만). 문장을 고치면 이 예외도 지운다. 새로 쓰는 문장은 모두 걸린다.
// The existing ko outro uses '잘했어'. Rather than editing the pack here, that exact sentence (same file, path and
// text) is the only exception; remove it when the line is rewritten. Every new line is still checked.
const KNOWN_PRAISE = new Set();
const DIGIT_RUN = /\d{9,}/;     // 전화번호 같은 숫자 열 / phone-number-like digit runs
const AT_SIGN = /@/;            // 이메일·멘션 / e-mail addresses and mentions
const OPTION_ID = /^[a-z][a-z0-9_-]*$/;
const HEX = /^#[0-9a-f]{6}$/i;
const NON_ASCII = /[^\x00-\x7f]/;

// ---- 도우미 / helpers -----------------------------------------------------------------------------------------
const chars = (s) => [...s].length;
const words = (s) => s.trim().split(/\s+/).filter(Boolean).length;
const str = (v) => typeof v === 'string' && v.trim().length > 0;
const isPurplish = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return r - g > 60 && b - g > 60;
};

// 팩 안의 모든 문자열을 [경로, 값]으로 / every string in the pack as [json path, value]
function strings(value, at = '', out = []) {
  if (typeof value === 'string') out.push([at, value]);
  else if (Array.isArray(value)) value.forEach((v, i) => strings(v, `${at}[${i}]`, out));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) strings(v, at ? `${at}.${k}` : k, out);
  return out;
}

// 캐릭터가 그대로 읽는 짧은 줄: lines, done_line, cover_line, back_line, outro. (prompt/on_confirm/template은 템플릿이라 제외)
// Lines the character speaks verbatim. prompt/on_confirm/template are templates and are not length-checked.
function characterLines(pack) {
  const out = [];
  (pack.steps || []).forEach((s, i) => {
    (Array.isArray(s.lines) ? s.lines : []).forEach((l, j) => out.push([`steps[${i}].lines[${j}]`, l]));
    for (const k of ['done_line', 'cover_line', 'back_line']) if (typeof s[k] === 'string') out.push([`steps[${i}].${k}`, s[k]]);
  });
  (Array.isArray(pack.outro) ? pack.outro : []).forEach((l, i) => out.push([`outro[${i}]`, l]));
  return out;
}

// ---- 전체 / the set ----------------------------------------------------------------------------------------------
test('packs/: 기본 팩이 ko·en 두 언어로 있다 / the default pack ships in ko and en', () => {
  for (const lang of ['ko', 'en']) assert.ok(packs.some((p) => p.id === DEFAULT_PACK && p.lang === lang), `packs/${DEFAULT_PACK}.${lang}.json`);
});

// ---- 파일마다 / per file ----------------------------------------------------------------------------------------
for (const { file, id, lang, pack } of packs) {
  const where = (at) => `packs/${file} ${at}`;

  test(`${file}: validatePack 통과 / passes validatePack`, () => {
    assert.equal(validatePack(pack), true);
  });

  test(`${file}: id·lang이 파일 이름과 같다 / id and lang match the filename`, () => {
    assert.equal(pack.id, id, where('id'));
    assert.equal(pack.lang, lang, where('lang'));
    for (const k of ['title', 'goal']) assert.ok(str(pack[k]), where(k));
    assert.ok(pack.character && str(pack.character.name), where('character.name'));
  });

  test(`${file}: 모든 단계에 id, type, title, cue / every step has id, type, title, cue`, () => {
    pack.steps.forEach((s, i) => {
      for (const k of ['id', 'type', 'title', 'cue']) assert.ok(str(s[k]), where(`steps[${i}].${k} (${s.id || '?'})`));
    });
  });

  test(`${file}: talk·closing은 1~${MAX_LINES}줄, 다른 단계도 ${MAX_LINES}줄까지 / talk and closing have 1–${MAX_LINES} lines, no step has more`, () => {
    pack.steps.forEach((s, i) => {
      const at = where(`steps[${i}].lines (${s.id})`);
      if (s.type === 'talk' || s.type === 'closing') {
        assert.ok(Array.isArray(s.lines) && s.lines.length >= 1, `${at}: needs 1+ lines`);
      }
      if (s.lines != null) {
        assert.ok(Array.isArray(s.lines), `${at}: must be an array`);
        assert.ok(s.lines.length <= MAX_LINES, `${at}: ${s.lines.length} lines > ${MAX_LINES}`);
        s.lines.forEach((l, j) => assert.ok(str(l), `${at}[${j}]: empty line`));
      }
    });
  });

  test(`${file}: 캐릭터 대사는 한 호흡 / character lines are one breath (${lang === 'ko' ? `≤ ${KO_MAX_CHARS} chars` : `≤ ${EN_MAX_WORDS} words`})`, () => {
    for (const [at, line] of characterLines(pack)) {
      assert.ok(str(line), `${where(at)}: empty`);
      if (lang === 'ko') assert.ok(chars(line) <= KO_MAX_CHARS, `${where(at)}: ${chars(line)}자 > ${KO_MAX_CHARS}자 — "${line}"`);
      else assert.ok(words(line) <= EN_MAX_WORDS, `${where(at)}: ${words(line)} words > ${EN_MAX_WORDS} — "${line}"`);
    }
  });

  test(`${file}: choice 선택지(2개 이상, id·label·emoji·color·hint) / choice options`, () => {
    for (const s of pack.steps.filter((x) => x.type === 'choice')) {
      const at = (o, k) => where(`steps.${s.id}.options.${o.id || '?'}.${k}`);
      assert.ok(str(s.prompt), where(`steps.${s.id}.prompt`));
      assert.ok(str(s.on_confirm), where(`steps.${s.id}.on_confirm`));
      assert.ok(Array.isArray(s.options) && s.options.length >= 2, where(`steps.${s.id}.options: needs 2+`));
      for (const o of s.options) {
        assert.match(String(o.id), OPTION_ID, at(o, 'id'));
        assert.ok(str(o.label), at(o, 'label'));
        assert.ok(str(o.emoji) && NON_ASCII.test(o.emoji), `${at(o, 'emoji')}: "${o.emoji}" is not an emoji`);
        assert.match(String(o.color), HEX, at(o, 'color'));
        assert.ok(!isPurplish(o.color), `${at(o, 'color')}: ${o.color} is purple-ish (red and blue both exceed green by > 60)`);
        assert.ok(str(o.hint), at(o, 'hint'));
      }
    }
  });

  test(`${file}: 어떤 color도 보라색이 아니다 / no color anywhere is purple-ish`, () => {
    const colors = strings(pack).filter(([at]) => /(^|\.)color$/.test(at));
    assert.ok(colors.length >= 1, where('character.color'));
    for (const [at, hex] of colors) {
      assert.match(hex, HEX, where(at));
      assert.ok(!isPurplish(hex), `${where(at)}: ${hex} is purple-ish`);
    }
  });

  test(`${file}: activity(timer_sec ${TIMER_RANGE.join('–')}, moves ${MOVES_RANGE.join('–')}, done_line) / activity steps`, () => {
    for (const s of pack.steps.filter((x) => x.type === 'activity')) {
      const at = (k) => where(`steps.${s.id}.${k}`);
      assert.ok(Number.isInteger(s.timer_sec) && s.timer_sec >= TIMER_RANGE[0] && s.timer_sec <= TIMER_RANGE[1], `${at('timer_sec')}: ${s.timer_sec}`);
      assert.ok(Array.isArray(s.moves) && s.moves.length >= MOVES_RANGE[0] && s.moves.length <= MOVES_RANGE[1], `${at('moves')}: ${s.moves && s.moves.length}`);
      s.moves.forEach((m, i) => {
        assert.ok(str(m.emoji) && NON_ASCII.test(m.emoji), `${at(`moves[${i}].emoji`)}: "${m.emoji}"`);
        assert.ok(str(m.text), at(`moves[${i}].text`));
      });
      assert.ok(str(s.done_line), at('done_line'));
    }
  });

  test(`${file}: story에 template / story steps have a template`, () => {
    for (const s of pack.steps.filter((x) => x.type === 'story')) assert.ok(str(s.template), where(`steps.${s.id}.template`));
  });

  test(`${file}: home.tips ${HOME_TIPS}개, home.note / home has ${HOME_TIPS} tips and a note`, () => {
    assert.ok(pack.home && typeof pack.home === 'object', where('home'));
    assert.ok(str(pack.home.title), where('home.title'));
    assert.ok(Array.isArray(pack.home.tips) && pack.home.tips.length === HOME_TIPS, `${where('home.tips')}: ${pack.home.tips && pack.home.tips.length} tips, expected ${HOME_TIPS}`);
    pack.home.tips.forEach((tip, i) => assert.ok(str(tip), where(`home.tips[${i}]`)));
    assert.ok(str(pack.home.note), where('home.note'));
  });

  test(`${file}: outro는 비지 않은 배열 / outro is a non-empty array`, () => {
    assert.ok(Array.isArray(pack.outro) && pack.outro.length >= 1, where('outro'));
    pack.outro.forEach((l, i) => assert.ok(str(l), where(`outro[${i}]`)));
  });

  test(`${file}: 관찰 언어 금칙어 없음 / no forbidden words anywhere`, () => {
    for (const [at, s] of strings(pack)) {
      for (const re of FORBIDDEN) {
        const m = s.match(re);
        assert.equal(m, null, `${where(at)}: forbidden word ${re} → "${m && m[0]}" in "${s}"`);
      }
    }
  });

  test(`${file}: 칭찬·꾸중 말 없음 / no praise or scold words`, () => {
    for (const [at, s] of strings(pack)) {
      if (KNOWN_PRAISE.has(`${file} ${at} ${s}`)) continue;
      for (const re of PRAISE_SCOLD) {
        const m = s.match(re);
        assert.equal(m, null, `${where(at)}: ${re} → "${m && m[0]}" in "${s}" (thank instead: 고마워 / Thank you for telling me)`);
      }
    }
  });

  test(`${file}: 긴 숫자 열·@ 없음 / no 9+ digit runs or @ anywhere`, () => {
    for (const [at, s] of strings(pack)) {
      assert.doesNotMatch(s, DIGIT_RUN, `${where(at)}: "${s}"`);
      assert.doesNotMatch(s, AT_SIGN, `${where(at)}: "${s}"`);
    }
  });

  if (lang === 'en') {
    test(`${file}: 선택지 이름은 한 단어 / option labels are single words`, () => {
      for (const s of pack.steps.filter((x) => x.type === 'choice')) {
        for (const o of s.options) assert.match(o.label, /^\S+$/, `${where(`steps.${s.id}.options.${o.id}.label`)}: "${o.label}"`);
      }
    });
  }
}

// ---- 언어판끼리 / across languages of one pack id ------------------------------------------------------------
const byId = new Map();
for (const p of packs) byId.set(p.id, [...(byId.get(p.id) || []), p]);

for (const [id, versions] of byId) {
  if (versions.length < 2) continue;
  const [base, ...rest] = versions;

  test(`${id}: 언어판끼리 단계 id·유형·순서가 같다 / step ids, types and order match across languages`, () => {
    const shape = (v) => v.pack.steps.map((s) => `${s.id}:${s.type}`);
    for (const v of rest) assert.deepEqual(shape(v), shape(base), `${v.file} vs ${base.file}`);
  });

  test(`${id}: 언어판끼리 선택지 id가 같다 / option ids match across languages`, () => {
    const opts = (v) => v.pack.steps.filter((s) => s.type === 'choice').map((s) => [s.id, s.options.map((o) => o.id)]);
    for (const v of rest) assert.deepEqual(opts(v), opts(base), `${v.file} vs ${base.file}`);
  });
}

// ---- 색인 / packs/index.json ----------------------------------------------------------------------------------
test('packs/index.json: 디스크의 모든 (id, lang)이 같은 제목으로 적혀 있다 / lists every pack file with the same title', () => {
  for (const { file, id, lang, pack } of packs) {
    const entry = (index.packs || []).find((p) => p.id === id);
    assert.ok(entry, `packs/${file}: index.json has no entry with id '${id}'`);
    const meta = entry.langs && entry.langs[lang];
    assert.ok(meta, `packs/${file}: index.json entry '${id}' has no lang '${lang}'`);
    assert.equal(meta.title, pack.title, `packs/${file}: title differs from index.json`);
    for (const k of ['domain', 'age', 'minutes']) if (pack[k] != null) assert.equal(meta[k], pack[k], `packs/${file}: ${k} differs from index.json`);
  }
});

test('packs/index.json: 적힌 (id, lang)마다 파일이 있다 / every listed (id, lang) has a file on disk', () => {
  for (const entry of index.packs || []) {
    assert.match(String(entry.id), /^[a-z0-9-]+$/, `index.json id '${entry.id}'`);
    for (const lang of Object.keys(entry.langs || {})) {
      assert.ok(packs.some((p) => p.id === entry.id && p.lang === lang), `packs/${entry.id}.${lang}.json is listed in index.json but missing on disk`);
    }
  }
});
