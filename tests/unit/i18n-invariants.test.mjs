// 단위 테스트: i18n 불변식. 두 사전(js/locales/ko.js·en.js)의 품질 규칙과 "모든 화면 문자열은 t()를 거친다" 감시선.
// Invariants over the two dictionaries (placeholders, whitespace, forbidden words, key shape, duplicate keys,
// HTML-bearing keys, fallback order, setLang event) plus a source-text tripwire: Hangul inside a template literal in
// js/views/*.js or js/ui/*.js that is not inside a t()/tIn() call (or a comment) is a hard-coded UI string.
// 실행: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tIn, setLang, interpolate } from '../../js/i18n.js';
import ko from '../../js/locales/ko.js';
import en from '../../js/locales/en.js';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const DICTS = { ko, en };
const LOCALE_FILES = { ko: 'js/locales/ko.js', en: 'js/locales/en.js' };

// 값 안의 {var} 집합 / the set of {placeholders} in a value
const placeholders = (s) => new Set([...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
const sorted = (set) => [...set].sort();
const base = (k) => k.replace(/_one$/, '');
const allKeys = [...new Set([...Object.keys(ko), ...Object.keys(en)])].sort();

// 관찰 언어만 / observational language only (brief, hard constraint 3)
const FORBIDDEN_KO = ['진단', '검사', '치료', '판정', '위기', '장애'];
const FORBIDDEN_EN = [/diagnos/i, /therapy/i, /treatment/i, /assess/i, /screening/i, /disorder/i, /at[\s-]risk/i];
// 금지어를 글자로만 품은 무해한 낱말(분위기 ⊃ 위기) / benign words that merely contain a forbidden substring
const BENIGN_KO = ['분위기'];
function forbiddenIn(text) {
  let s = String(text);
  for (const b of BENIGN_KO) s = s.split(b).join(' ');
  return [
    ...FORBIDDEN_KO.filter((w) => s.includes(w)),
    ...FORBIDDEN_EN.filter((re) => re.test(s)).map((re) => re.source),
  ];
}

// esc() 없이 innerHTML에 들어가는 키 / the only keys the views inject into innerHTML without esc()
const HTML_KEYS = ['home.packs.hint', 'teacher.tvCheckDesc', 'teacher.total', 'home.teacher.newCode', 'home.teacher.newHint', 'parent.noneDesc'];

test('자리표시자 {var} 집합은 ko와 en에서 같다(_one은 기본 키와 비교: {n}만 뺄 수 있다)', () => {
  for (const k of allKeys) {
    if (k.endsWith('_one')) {
      // n === 1일 때만 쓰이므로 {n}은 빠져도 되지만, 다른 변수는 더하거나 뺄 수 없다
      const one = placeholders(en[k]);
      for (const lang of ['ko', 'en']) {
        const want = placeholders(DICTS[lang][base(k)]);
        for (const p of one) assert.ok(want.has(p), `${k}: {${p}} is not in base key ${base(k)} (${lang})`);
        for (const p of want) if (p !== 'n') assert.ok(one.has(p), `${k}: missing {${p}} from base key ${base(k)} (${lang})`);
      }
      continue;
    }
    assert.ok(Object.hasOwn(ko, k) && Object.hasOwn(en, k), `key missing in one language: ${k}`);
    assert.deepEqual(sorted(placeholders(ko[k])), sorted(placeholders(en[k])),
      `${k}: placeholders differ — ko ${JSON.stringify(ko[k])} / en ${JSON.stringify(en[k])}`);
  }
});

test('값: 문자열이고 비어 있지 않으며 앞뒤 공백·겹친 공백이 없다', () => {
  for (const [lang, d] of Object.entries(DICTS)) {
    for (const [k, v] of Object.entries(d)) {
      assert.equal(typeof v, 'string', `${lang} ${k}: not a string`);
      assert.notEqual(v.trim(), '', `${lang} ${k}: empty`);
      assert.equal(v, v.trim(), `${lang} ${k}: leading/trailing whitespace in ${JSON.stringify(v)}`);
      assert.ok(!/\s{2}/.test(v), `${lang} ${k}: doubled whitespace in ${JSON.stringify(v)}`);
    }
  }
});

test('관찰 언어만: 금지어가 키와 값 어디에도 없다', () => {
  for (const [lang, d] of Object.entries(DICTS)) {
    for (const [k, v] of Object.entries(d)) {
      const hits = forbiddenIn(`${k} ${v}`);
      assert.deepEqual(hits, [], `${lang} ${k}: forbidden word(s) ${hits.join(', ')} in ${JSON.stringify(v)}`);
    }
  }
  assert.deepEqual(forbiddenIn('반 전체 분위기만 적어요'), [], '분위기 is benign');
  assert.deepEqual(forbiddenIn('Children At Risk'), ['at[\\s-]risk'], 'case-insensitive');
  assert.deepEqual(forbiddenIn('마음 검사'), ['검사']);
});

test('_one 변형은 en에만 있고, 기본 키가 양쪽에 있으며 en 기본 값에 {n}이 있을 때만 허용된다', () => {
  for (const k of Object.keys(ko)) assert.ok(!k.endsWith('_one'), `ko has a _one key: ${k}`);
  for (const k of Object.keys(en).filter((x) => x.endsWith('_one'))) {
    const b = base(k);
    assert.ok(Object.hasOwn(en, b), `${k}: base key ${b} missing in en`);
    assert.ok(Object.hasOwn(ko, b), `${k}: base key ${b} missing in ko`);
    assert.ok(placeholders(en[b]).has('n'), `${k}: base key ${b} has no {n}, so vars.n === 1 can never select it`);
  }
});

test('키 모양: 소문자 그룹 + 점으로 이어진 이름 (/^[a-z]+(\\.[A-Za-z0-9_]+)+$/)', () => {
  for (const k of allKeys) assert.match(k, /^[a-z]+(\.[A-Za-z0-9_]+)+$/, `bad key shape: ${k}`);
});

test('사전 파일 본문에 같은 키가 두 번 없다(JS 객체 리터럴은 조용히 덮어쓴다)', () => {
  const KEY_LINE = /^[ \t]*(['"])([^'"\n]+)\1[ \t]*:/gm;
  for (const [lang, file] of Object.entries(LOCALE_FILES)) {
    const found = [...read(file).matchAll(KEY_LINE)].map((m) => m[2]);
    const seen = new Set();
    const dups = [];
    for (const k of found) { if (seen.has(k)) dups.push(k); seen.add(k); }
    assert.deepEqual(dups, [], `${file}: duplicate keys ${dups.join(', ')}`);
    // 정규식이 본 키 = 런타임이 본 키. 다르면 어떤 키가 정규식을 피해 가는 모양으로 적혔다는 뜻
    assert.deepEqual(sorted(seen), Object.keys(DICTS[lang]).sort(), `${file}: keys found by regex differ from the exported object`);
  }
});

test("'<'가 들어간 값은 HTML 허용 키뿐이다(다른 키는 esc()를 거치므로 HTML이 글자 그대로 보인다)", () => {
  for (const k of HTML_KEYS) assert.ok(Object.hasOwn(ko, k) && Object.hasOwn(en, k), `HTML key list is stale: ${k}`);
  for (const [lang, d] of Object.entries(DICTS)) {
    for (const [k, v] of Object.entries(d)) {
      if (!v.includes('<')) continue;
      assert.ok(HTML_KEYS.includes(base(k)), `${lang} ${k}: contains '<' but is not an HTML-bearing key: ${JSON.stringify(v)}`);
    }
  }
});

test('모르는 언어(fr)는 모든 키에서 en 값을 돌려주고, ko는 ko 값을 돌려준다', () => {
  for (const k of Object.keys(en)) assert.equal(tIn('fr', k), en[k], k);
  for (const k of Object.keys(ko)) assert.equal(tIn('ko', k), ko[k], k);
  assert.equal(tIn('fr', 'no.such.key'), 'no.such.key');
});

test('interpolate: 모르는 변수는 그대로 두고, 0·빈 문자열도 채운다', () => {
  assert.equal(interpolate('{a}-{b}', { a: 1 }), '1-{b}');
  assert.equal(interpolate('{n} min', { n: 0 }), '0 min');
  assert.equal(interpolate('[{s}]', { s: '' }), '[]');
  assert.equal(interpolate('{a}{a}', { a: 'x' }), 'xx');
  assert.equal(interpolate('{a}', {}), '{a}');
  assert.equal(interpolate('{a}', undefined), '{a}');
});

test("setLang: window가 있으면 'emoren:lang' 이벤트를 { lang, changed }와 함께 보낸다", () => {
  setLang('en', { persist: false });
  const events = [];
  const hadCustomEvent = typeof globalThis.CustomEvent === 'function';
  if (!hadCustomEvent) {
    globalThis.CustomEvent = class CustomEvent { constructor(type, init) { this.type = type; this.detail = init && init.detail; } };
  }
  globalThis.window = { dispatchEvent(ev) { events.push(ev); return true; } };
  try {
    assert.equal(setLang('ko', { persist: false }), 'ko');
    assert.equal(setLang('ko', { persist: false }), 'ko');
    assert.equal(setLang('xx', { persist: false }), 'en', 'unknown language falls back to en');
  } finally {
    delete globalThis.window;
    if (!hadCustomEvent) delete globalThis.CustomEvent;
  }
  assert.deepEqual(events.map((e) => [e.type, e.detail.lang, e.detail.changed]), [
    ['emoren:lang', 'ko', true],
    ['emoren:lang', 'ko', false],
    ['emoren:lang', 'en', true],
  ]);
  assert.equal(typeof globalThis.window, 'undefined', 'fake window removed');
});

// ---------- 감시선 / tripwire: every user-visible string goes through t() ----------

const HANGUL = /[ᄀ-ᇿ㄰-㆏ꥠ-꥿가-퟿]/;
const IDENT = /[A-Za-z0-9_$]/;
const REGEX_AFTER_WORD = new Set(['return', 'typeof', 'case', 'in', 'of', 'delete', 'void', 'throw', 'new', 'instanceof', 'yield', 'await', 'do', 'else']);

// 소스 텍스트를 한 번 훑으며 주석·따옴표 문자열·정규식·템플릿 리터럴·${} 중첩을 따라간다.
// 템플릿 리터럴 안(${} 속의 따옴표 문자열 포함)에 있으면서 t(...)/tIn(...) 호출 안이 아닌 한글의 줄 번호를 돌려준다.
// Comments are skipped as part of the same pass, so a Hangul comment never counts, wherever it sits.
function scanHangul(src) {
  const hits = new Set();
  const codeFrame = (expr) => ({ kind: 'code', expr, paren: 0, brace: 0, tcalls: [] });
  const frames = [codeFrame(false)];
  const insideT = () => frames.some((f) => f.kind === 'code' && f.tcalls.length > 0);
  const inTemplate = () => frames.some((f) => f.kind === 'tpl');
  const isSpace = (c) => /\s/.test(c);
  let line = 1;
  let lastSig = '';   // 마지막 의미 있는 글자 / last significant char (for the regex-literal heuristic)
  let lastWord = '';  // 바로 앞 식별자 / identifier just before the current char
  const n = src.length;
  let i = 0;
  const regexCanStart = () => {
    if (REGEX_AFTER_WORD.has(lastWord)) return true;
    if (lastSig === '') return true;
    return !(IDENT.test(lastSig) || lastSig === ')' || lastSig === ']' || lastSig === '\'' || lastSig === '"' || lastSig === '`');
  };
  while (i < n) {
    const ch = src[i];
    const f = frames[frames.length - 1];
    if (f.kind === 'tpl') {
      if (ch === '\\') { if (src[i + 1] === '\n') line++; i += 2; continue; }
      if (ch === '`') { frames.pop(); lastSig = '`'; lastWord = ''; i++; continue; }
      if (ch === '$' && src[i + 1] === '{') { frames.push(codeFrame(true)); i += 2; continue; }
      if (ch === '\n') line++;
      else if (HANGUL.test(ch) && !insideT()) hits.add(line);
      i++;
      continue;
    }
    if (ch === '\n') { line++; i++; continue; }
    if (ch === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (ch === '/' && src[i + 1] === '*') {
      const e = src.indexOf('*/', i + 2);
      const end = e < 0 ? n : e + 2;
      for (let j = i; j < end; j++) if (src[j] === '\n') line++;
      i = end;
      continue;
    }
    if (ch === '\'' || ch === '"') {
      let j = i + 1;
      while (j < n && src[j] !== ch && src[j] !== '\n') {
        if (src[j] === '\\') j++;
        else if (HANGUL.test(src[j]) && inTemplate() && !insideT()) hits.add(line);
        j++;
      }
      i = src[j] === ch ? j + 1 : j;
      lastSig = ch; lastWord = '';
      continue;
    }
    if (ch === '`') { frames.push({ kind: 'tpl' }); lastSig = '`'; lastWord = ''; i++; continue; }
    if (ch === '/' && regexCanStart()) {
      let j = i + 1;
      let cls = false;
      while (j < n && src[j] !== '\n') {
        const c = src[j];
        if (c === '\\') { j += 2; continue; }
        if (cls) { if (c === ']') cls = false; } else if (c === '[') cls = true; else if (c === '/') break;
        j++;
      }
      if (src[j] === '/') { j++; while (j < n && /[a-z]/.test(src[j])) j++; }
      i = j;
      lastSig = '/'; lastWord = '';
      continue;
    }
    if (ch === '(') { f.paren++; if (lastWord === 't' || lastWord === 'tIn') f.tcalls.push(f.paren); }
    else if (ch === ')') { if (f.tcalls.length && f.tcalls[f.tcalls.length - 1] === f.paren) f.tcalls.pop(); f.paren--; }
    else if (ch === '{') f.brace++;
    else if (ch === '}') {
      if (f.expr && f.brace === 0) { frames.pop(); lastSig = '}'; lastWord = ''; i++; continue; }
      f.brace--;
    }
    if (IDENT.test(ch)) lastWord += ch; else if (!isSpace(ch)) lastWord = '';
    if (!isSpace(ch)) lastSig = ch;
    i++;
  }
  return [...hits].sort((a, b) => a - b);
}

test('감시선 자체 점검: 주석·t() 인자·정규식·일반 문자열은 넘기고, 템플릿 안의 한글만 줄 번호로 잡는다', () => {
  const sample = [
    'const a = `<h1>안녕</h1>`;',                                    // 1 flagged
    "const b = `${esc(t('k', { label: '하나' }))}`;",                 // 2 ok: inside t()
    "const c = `${x ? '예' : t('k')}`;",                              // 3 flagged: quoted string nested in a template
    '// 주석 `한글`',                                                 // 4 ok: line comment
    '/* 블록 `한글` */ const d = 1;',                                 // 5 ok: block comment
    "const e = /한국어|'/i; const f = `한`;",                          // 6 flagged: regex with a quote must not swallow the template
    "const g = '조앤'; const g2 = \"힐링이\";",                        // 7 ok: plain strings are not template literals
    'const h = `',                                                    // 8
    '  줄 셋 /* 아직 템플릿 안 */',                                    // 9 flagged (the line of the Hangul, not of the backtick)
    '`;',                                                             // 10
    'const i = t(`한글 {n}`, { n: 1 });',                             // 11 ok: template is the t() argument
    "const j = `${tIn('en', 'k', { label: `하나` })}`;",               // 12 ok
    "const k = `${esc(t('k'))} 그리고`;",                              // 13 flagged: outside the t() call
    "const l = `${items.map((o) => `<b>${o.label} 개</b>`).join('')}`;", // 14 flagged: nested template in an arrow
    'const m = a / 2; const m2 = `${b / 2} 반`; // 나눗셈',             // 15 flagged (division is not a regex)
    "const o = `${tt('k')} 별칭`;",                                    // 16 flagged: tt is not t
    'const p = `escaped \\` 백틱`;',                                   // 17 flagged
    "const q = { t: 1, '키': `값` };",                                  // 18 flagged
  ].join('\n');
  assert.deepEqual(scanHangul(sample), [1, 3, 6, 9, 13, 14, 15, 16, 17, 18]);
  assert.deepEqual(scanHangul(''), []);
  assert.deepEqual(scanHangul("root.innerHTML = `<p>${esc(t('home.foot'))}</p>`;"), []);
});

test('감시선: js/views·js/ui의 템플릿 리터럴 안에 t()를 거치지 않은 한글이 없다(모든 화면 문자열은 t(key))', () => {
  const files = ['js/views', 'js/ui'].flatMap((dir) => fs.readdirSync(path.join(ROOT, dir))
    .filter((f) => f.endsWith('.js')).sort().map((f) => `${dir}/${f}`));
  assert.ok(files.length >= 6, `expected the view/ui modules, found ${files.length}`);
  const violations = [];
  for (const file of files) {
    const src = read(file);
    const lines = src.split('\n');
    for (const line of scanHangul(src)) violations.push(`${file}:${line}: ${lines[line - 1].trim()}`);
  }
  assert.deepEqual(violations, [], `hard-coded Hangul in a template literal — move it to js/locales and use t('key'):\n  ${violations.join('\n  ')}`);
});
