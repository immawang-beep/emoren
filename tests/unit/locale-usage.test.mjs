// 단위 테스트: 소스의 t('key') 호출과 사전(js/locales/{ko,en}.js)이 서로 맞는지 정적으로 검사한다. 실행: npm test
// Static check: every literal key passed to t()/tt()/tIn() exists in BOTH dictionaries, no dictionary key is
// clearly dead, and one file never passes the same key with different placeholder names.
//
//  - 검사 대상 / scanned: js/**/*.js (사전 파일 js/locales/*는 제외). 줄 전체가 // 주석인 줄은 건너뛴다.
//  - 리터럴 키 / literal keys: t('k') · t("k") · t(`k`) · tt('k') · tIn(<식>, 'k'), 공백·줄바꿈 무관.
//    뒤에 + 가 오면(t('a.' + x)) 접두사로 본다 / a trailing + makes it a prefix, not a key.
//  - 계산 키 / computed keys: t(`studio.type.${x}`) 같은 템플릿은 접두사(studio.type.)로 보고 그 아래 키는 모두 쓰인 것으로 친다.
//  - 죽은 키 / dead keys: 어떤 t() 리터럴로도 쓰이지 않고, 계산 접두사 아래도 아니고, 허용 목록(sync.*, 기본 키가 쓰이는
//    _one 변형)도 아닌 키. 소스 어딘가에 따옴표로 감싼 키 문자열이 있으면(조회 표 등) 죽은 키로 치지 않고 메시지에만 적는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ko from '../../js/locales/ko.js';
import en from '../../js/locales/en.js';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const DICT = { ko, en };
const KEYS = [...new Set([...Object.keys(ko), ...Object.keys(en)])].sort();
// 동적으로 읽혀서 리터럴이 없어도 되는 접두사 / prefixes read dynamically (SYNC_LABEL getters etc.)
const ALLOW_PREFIXES = ['sync.'];

const walk = (dir) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })
  .flatMap((d) => (d.isDirectory() ? walk(`${dir}/${d.name}`) : [`${dir}/${d.name}`]));
const FILES = walk('js').filter((f) => f.endsWith('.js') && !f.startsWith('js/locales/')).sort();
const SOURCES = new Map(FILES.map((f) => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')]));

// 줄 전체 주석만 지운다(줄 번호 유지) / blank out whole-line // comments, keeping line numbers
const stripComments = (src) => src.replace(/^[ \t]*\/\/.*$/gm, '');

// t('k') / tt("k") / t(`k`) — 1: 따옴표, 2: 키, 3: 뒤따르는 토큰(+ , ))
// (?<![\w$.]) 덕분에 split(… .t(… $t(… 는 걸리지 않는다 / lookbehind keeps split(, .t(, $t( out
const RE_T = /(?<![\w$.])tt?\s*\(\s*(['"`])((?:(?!\1)[^\\\n]|\\.)*)\1\s*([+,)])/g;
// tIn(<식>, 'k') — 첫 인자는 따옴표 문자열·한 겹 괄호·그 밖의 글자 / first arg: quoted string, one paren level, or plain chars
const RE_TIN = /(?<![\w$.])tIn\s*\(\s*(?:'[^'\n]*'|"[^"\n]*"|\([^()\n]*\)|[^,()'"`\n])+?,\s*(['"`])((?:(?!\1)[^\\\n]|\\.)*)\1\s*([+,)])/g;
// 두 번째 인자가 납작한 객체 리터럴이면(lastIndex에서 sticky) / flat object literal as 2nd arg, matched at lastIndex
const RE_VARS = /\s*\{([^{}]*)\}\s*\)/y;
// 첫 인자가 문자열이 아닌 호출(보고만 한다; function t(key) 정의는 제외) / first arg is not a string (reported only)
const RE_DYN = /(?<![\w$.])(?<!function\s+)tt?\s*\(\s*(?!['"`])([^()\n]*?)\s*[,)]/g;

// 납작한 객체 리터럴 본문에서 속성 이름을 뽑는다 / property names of a flat object literal; null = cannot tell statically
function varNames(body) {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of body) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
  }
  parts.push(cur);
  const names = [];
  for (const p of parts) {
    const s = p.trim();
    if (!s) continue;
    const m = /^([A-Za-z_$][\w$]*)\s*(?::|$)/.exec(s); // `n: x` 또는 단축 `n` / `n: x` or shorthand `n`
    if (!m) return null; // ...spread, [computed], 'quoted' → 알 수 없음
    names.push(m[1]);
  }
  return names.sort();
}

function scan() {
  const calls = []; // { file, at, key, vars } — vars: string[] | undefined(없음) | null(알 수 없음)
  const prefixes = new Map(); // 계산 키 접두사 → 첫 위치 / computed-key prefix → first location
  const dynamic = []; // 정적으로 알 수 없는 호출 / calls whose key is not a literal
  for (const [file, raw] of SOURCES) {
    const src = stripComments(raw);
    const lineOf = (i) => src.slice(0, i).split('\n').length;
    for (const re of [RE_T, RE_TIN]) {
      re.lastIndex = 0;
      for (let m; (m = re.exec(src));) {
        const [, quote, body, next] = m;
        const at = `${file}:${lineOf(m.index)}`;
        const tpl = quote === '`' && body.includes('${');
        if (tpl || next === '+') {
          const prefix = tpl ? body.slice(0, body.indexOf('${')) : body;
          if (prefix) { if (!prefixes.has(prefix)) prefixes.set(prefix, at); } else dynamic.push(`${at} (${body || '+'})`);
          continue;
        }
        let vars;
        if (next === ',') {
          RE_VARS.lastIndex = re.lastIndex;
          const v = RE_VARS.exec(src);
          vars = v ? varNames(v[1]) : null;
        }
        calls.push({ file, at, key: body, vars });
      }
    }
    RE_DYN.lastIndex = 0;
    for (let m; (m = RE_DYN.exec(src));) dynamic.push(`${file}:${lineOf(m.index)} t(${m[1].trim()})`);
  }
  return { calls, prefixes, dynamic };
}

const { calls, prefixes, dynamic } = scan();
const literal = new Map(); // key → Set(위치) / key → locations
for (const c of calls) {
  if (!literal.has(c.key)) literal.set(c.key, new Set());
  literal.get(c.key).add(c.at);
}

// 어떤 키가 t() 리터럴 없이도 살아 있는 이유 / why a key without a direct t() literal is still alive; null = dead
function aliveReason(key) {
  if (ALLOW_PREFIXES.some((p) => key.startsWith(p))) return `허용 목록 ${ALLOW_PREFIXES.find((p) => key.startsWith(p))}*`;
  if (key.endsWith('_one') && literal.has(key.slice(0, -4))) return `_one 변형(기본 키 ${key.slice(0, -4)} 사용 중)`;
  for (const [p, at] of prefixes) if (key.startsWith(p)) return `계산 키 ${p}* (${at})`;
  for (const [f, src] of SOURCES) {
    if ([`'${key}'`, `"${key}"`, `\`${key}\``].some((q) => src.includes(q))) return `문자열로만 등장: ${f}`;
  }
  return null;
}

test('검사기 자체 점검: 소스와 호출을 충분히 찾았다(정규식이 망가지면 여기서 걸린다)', () => {
  assert.ok(FILES.length >= 10, FILES.join(', '));
  assert.ok(literal.size >= 50, `리터럴 키 ${literal.size}개뿐 — RE_T/RE_TIN을 확인하세요`);
  for (const f of ['js/views/tv.js', 'js/views/teacher.js', 'js/views/home.js', 'js/views/parent.js']) {
    assert.ok(calls.some((c) => c.file === f), `${f}에서 t() 호출을 하나도 못 찾았다`);
  }
});

test('t()/tt()/tIn()에 넘기는 모든 리터럴 키가 ko·en 사전에 다 있다', () => {
  const missing = [];
  for (const [key, where] of literal) {
    const lacks = Object.keys(DICT).filter((l) => !Object.hasOwn(DICT[l], key));
    if (lacks.length) missing.push(`${key} — ${lacks.join(', ')}에 없음 ← ${[...where].join(', ')}`);
  }
  assert.deepEqual(missing, [], `사전에 없는 키 ${missing.length}개:\n${missing.join('\n')}`);
});

test('계산 키의 접두사(t(`a.b.${x}`), t(\'a.b.\' + x)) 아래에 실제 키가 있다', () => {
  for (const [p, at] of prefixes) {
    assert.ok(KEYS.some((k) => k.startsWith(p)), `${at}: 접두사 ${p}* 로 시작하는 키가 사전에 없다`);
  }
});

test('사전의 모든 키가 어디선가 쓰인다(죽은 키 없음)', (ctx) => {
  const unreferenced = KEYS.filter((k) => !literal.has(k));
  const dead = unreferenced.filter((k) => !aliveReason(k));
  const report = unreferenced.map((k) => `  ${k} — ${aliveReason(k) || '죽은 키: 어디서도 쓰지 않는다'}`);
  ctx.diagnostic(`locale-usage: 리터럴 키 ${literal.size}개, 계산 접두사 ${prefixes.size}개, 동적 호출 ${dynamic.length}개, `
    + `직접 쓰이지 않는 키 ${unreferenced.length}개, 죽은 키 ${dead.length}개`);
  assert.deepEqual(dead, [], [
    `t() 리터럴로 직접 쓰이지 않는 키 ${unreferenced.length}개(죽은 키만 실패):`, ...report,
    `키를 정적으로 알 수 없는 호출 ${dynamic.length}개:`, ...dynamic.map((d) => `  ${d}`),
  ].join('\n'));
});

test('같은 파일에서 같은 키에 서로 다른 자리표시자 이름을 넘기지 않는다', () => {
  const seen = new Map(); // file|key → 첫 호출 / first call
  const bad = [];
  for (const c of calls) {
    if (!Array.isArray(c.vars)) continue; // vars 없음·알 수 없음은 비교하지 않는다 / nothing to compare
    const id = `${c.file}|${c.key}`;
    const prev = seen.get(id);
    if (!prev) seen.set(id, c);
    else if (prev.vars.join() !== c.vars.join()) bad.push(`${c.key}: {${prev.vars}} @${prev.at} vs {${c.vars}} @${c.at}`);
  }
  assert.deepEqual(bad, [], `자리표시자 이름이 다른 호출:\n${bad.join('\n')}`);
});

test('문구의 {var}는 호출이 넘기는 변수로 모두 채워진다', () => {
  const bad = [];
  for (const c of calls) {
    if (c.vars === null) continue; // 변수 객체를 정적으로 알 수 없다 / vars not statically known
    const given = c.vars || [];
    for (const [l, d] of Object.entries(DICT)) {
      if (!Object.hasOwn(d, c.key)) continue; // 없는 키는 위 테스트가 잡는다 / missing keys fail above
      const need = [...String(d[c.key]).matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      const lack = need.filter((v) => !given.includes(v));
      if (lack.length) bad.push(`${c.at} t('${c.key}', {${given}}) — ${l}: {${lack}} 가 비어서 그대로 보인다`);
    }
  }
  assert.deepEqual(bad, [], `채워지지 않는 자리표시자:\n${bad.join('\n')}`);
});
