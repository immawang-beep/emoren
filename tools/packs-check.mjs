// 수업팩 점검 도구 / Lesson pack checker. 의존성 없음, 브라우저 없이 Node만으로 돈다.
//   npm run packs:check                 packs/<id>.<lang>.json 전부 검사 / checks every pack on disk
//   node tools/packs-check.mjs [root]   다른 저장소 경로를 넘길 수 있다 / optional repo root
//
// 점검 항목 / what it enforces:
//   1. validatePack 통과, 파일 이름의 <id>.<lang>이 파일 안의 id·lang과 같다
//   2. 같은 id의 언어판은 구조가 같다: 단계 id·유형·순서, 선택 단계의 선택지 id 순서, timer_sec, moves 수, home.tips 수
//   3. 템플릿 변수({var}, [[var: …]])는 storyVars가 만드는 것(선택지 id, <단계>_total/_list/_lead, class)만 쓰고,
//      모든 선택지를 1명으로 둔 가짜 상태로 렌더했을 때 { 나 [[ 가 남지 않는다
//   4. packs/index.json은 디스크의 팩 id와 언어를 정확히 담고, 제목·영역·연령·분이 팩 파일과 같다
//   5. 관찰 언어: 아이를 판단하는 낱말(한국어·영어)을 쓰지 않는다, 선택지 색에 보라색 계열이 없다,
//      전화번호 꼴 숫자나 @가 없다(수업팩에는 연락처를 적지 않는다)
// 순수 함수(runChecks 등)는 tests/unit/packs.test.mjs가 쓴다. 직접 실행할 때만 main()이 돈다.
// Pure functions are unit-tested; main() runs only when executed directly (same isMain pattern as tools/serve.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePack, STEP_TYPES } from '../js/pack.js';
import { newRoom, actions, storyVars, renderTemplate } from '../js/store.js';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const PACK_FILE = /^([a-z0-9-]+)\.([a-z]{2,3})\.json$/;

// 관찰 언어가 아닌 낱말 / words that judge a child instead of observing. '분위기'(atmosphere)는 '위기'가 아니다.
export const KO_FORBIDDEN = [/진단/, /검사/, /치료/, /판정/, /(?<!분)위기/, /장애/, /문제아/, /문제 ?행동/];
export const EN_FORBIDDEN = /\b(diagnos\w*|therap(?:y|ies|ist\w*)|treatments?|assess\w*|screenings?|disorders?|at[ -]risk|detect\w*)\b/i;
// 연락처 꼴: @ 또는 9자리 이상 숫자 줄(사이에 공백·하이픈·점 허용) / contact-like: an @ or a 9+ digit run
export const CONTACT = /@|(?:\d[ \-.]?){8}\d/;
// 템플릿에 쓰인 필드 / fields that go through renderTemplate (tv.js, teacher.js, parent.js, book)
export const TEMPLATE_FIELDS = ['on_confirm', 'template', 'done_line', 'cover_line', 'back_line'];

// 보라색 계열인가: 빨강과 파랑이 둘 다 초록보다 60 넘게 크다 / purple-ish: red and blue both exceed green by > 60
export function isPurpleish(hex) {
  let h = String(hex || '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return false;
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return r - g > 60 && b - g > 60;
}

// 문자열 하나의 문제 목록 / problems in one string (empty array = fine)
export function lintString(s) {
  const out = [];
  const text = String(s);
  for (const re of KO_FORBIDDEN) { const m = re.exec(text); if (m) out.push(`관찰 언어가 아닌 낱말 / not observational language: '${m[0]}'`); }
  const en = EN_FORBIDDEN.exec(text);
  if (en) out.push(`관찰 언어가 아닌 낱말 / not observational language: '${en[0]}'`);
  if (CONTACT.test(text)) out.push('연락처 꼴(@ 또는 긴 숫자) / looks like contact data (@ or a long digit run)');
  return out;
}

// 객체 안의 모든 문자열을 경로와 함께 돈다 / visit every string in a JSON value with its path
export function walkStrings(value, fn, trail = '') {
  if (typeof value === 'string') fn(value, trail);
  else if (Array.isArray(value)) value.forEach((v, i) => walkStrings(v, fn, `${trail}[${i}]`));
  else if (value && typeof value === 'object') for (const k of Object.keys(value)) walkStrings(value[k], fn, trail ? `${trail}.${k}` : k);
}

// 템플릿이 쓰는 변수 이름 / variable names a template refers to: {x} and [[x: …]]
export function templateVars(tpl) {
  const names = new Set();
  for (const m of String(tpl || '').matchAll(/\{(\w+)\}/g)) names.add(m[1]);
  for (const m of String(tpl || '').matchAll(/\[\[(\w+):/g)) names.add(m[1]);
  return [...names];
}

// 언어판 비교용 뼈대 / the language-independent shape of a pack
export function packShape(p) {
  return {
    steps: (p.steps || []).map((s) => ({
      id: s.id,
      type: s.type,
      options: s.type === 'choice' ? (s.options || []).map((o) => o.id) : null,
      timer_sec: s.type === 'activity' ? Number(s.timer_sec) : null,
      moves: s.type === 'activity' ? (s.moves || []).length : null,
    })),
    tips: ((p.home && p.home.tips) || []).length,
  };
}

// 두 언어판의 구조 차이 / structural differences between a reference pack and a twin (messages, empty = same)
export function compareTwins(ref, twin) {
  const out = [];
  const a = packShape(ref), b = packShape(twin);
  const sig = (sh) => sh.steps.map((s) => `${s.id}:${s.type}`).join(' ');
  if (sig(a) !== sig(b)) {
    out.push(`단계 id·유형·순서가 ${ref.lang}과 다르다 / steps differ from ${ref.lang}: [${sig(b)}] vs [${sig(a)}]`);
    return out; // 단계가 다르면 아래 비교는 뜻이 없다
  }
  a.steps.forEach((s, i) => {
    const o = b.steps[i];
    if (s.options && s.options.join(',') !== (o.options || []).join(',')) out.push(`${s.id}: 선택지 id가 ${ref.lang}과 다르다 / option ids differ from ${ref.lang}: [${(o.options || []).join(', ')}] vs [${s.options.join(', ')}]`);
    if (s.timer_sec !== null && s.timer_sec !== o.timer_sec) out.push(`${s.id}: timer_sec가 ${ref.lang}과 다르다 / timer_sec differs from ${ref.lang}: ${o.timer_sec} vs ${s.timer_sec}`);
    if (s.moves !== null && s.moves !== o.moves) out.push(`${s.id}: moves 수가 ${ref.lang}과 다르다 / number of moves differs from ${ref.lang}: ${o.moves} vs ${s.moves}`);
  });
  if (a.tips !== b.tips) out.push(`home.tips 수가 ${ref.lang}과 다르다 / number of home tips differs from ${ref.lang}: ${b.tips} vs ${a.tips}`);
  return out;
}

// 모든 선택지를 1명씩 고른 가짜 상태 / fake room state with every option tallied once
export function sampleState(pack, n = 1) {
  let s = newRoom('CHCK', pack);
  for (const st of pack.steps || []) {
    if (st.type !== 'choice') continue;
    for (const o of st.options || []) s = actions.tally(s, st.id, o.id, n);
  }
  return s;
}

// 템플릿 변수 점검 / template variables resolve and nothing is left after rendering
export function checkTemplates(pack) {
  const out = [];
  const vars = storyVars(pack, sampleState(pack));
  for (const st of pack.steps || []) {
    const texts = TEMPLATE_FIELDS.filter((f) => typeof st[f] === 'string').map((f) => [f, st[f]]);
    (st.lines || []).forEach((l, i) => texts.push([`lines[${i}]`, l]));
    for (const [field, tpl] of texts) {
      for (const v of templateVars(tpl)) if (!(v in vars)) out.push(`${st.id}.${field}: 모르는 변수 / unknown template variable: {${v}} (있는 변수 / known: ${Object.keys(vars).join(', ')})`);
      const rendered = renderTemplate(tpl, vars);
      if (/\{|\[\[/.test(rendered)) out.push(`${st.id}.${field}: 렌더 뒤에 { 또는 [[ 가 남는다 / braces left after rendering: ${rendered}`);
    }
  }
  return out;
}

// 관찰 언어·색·연락처 점검 / language, colour and contact lint over the whole pack
export function lintPack(pack) {
  const out = [];
  walkStrings(pack, (s, where) => { for (const msg of lintString(s)) out.push(`${where}: ${msg}`); });
  for (const st of pack.steps || []) {
    for (const o of st.options || []) if (o.color && isPurpleish(o.color)) out.push(`${st.id}/${o.id}: 보라색 계열 색은 쓰지 않는다 / purple-ish colour not allowed: ${o.color}`);
  }
  return out;
}

export function runChecks(rootDir = ROOT) {
  const packsDir = path.join(rootDir, 'packs');
  const problems = [];
  const report = [];
  const packs = []; // { id, lang, file, pack, steps }
  const byId = new Map();
  const files = fs.existsSync(packsDir) ? fs.readdirSync(packsDir).filter((f) => PACK_FILE.test(f)).sort() : [];
  if (!files.length) problems.push(`packs/: 수업팩 파일이 없다 / no packs/<id>.<lang>.json found in ${packsDir}`);

  for (const file of files) {
    const [, fileId, fileLang] = PACK_FILE.exec(file);
    const mine = [];
    const shape = []; // 형식 문제: 이게 있으면 나머지 검사는 뜻이 없다 / format problems; the other checks need a well-formed pack
    let pack = null;
    try { pack = JSON.parse(fs.readFileSync(path.join(packsDir, file), 'utf8')); } catch (e) { shape.push(`JSON을 읽을 수 없다 / cannot parse JSON: ${e.message}`); }
    if (pack) {
      try { validatePack(pack); } catch (e) { shape.push(e.message); }
      if (pack.id !== fileId) shape.push(`id '${pack.id}'가 파일 이름과 다르다 / id does not match the file name '${fileId}'`);
      if (String(pack.lang || '').split('-')[0] !== fileLang) shape.push(`lang '${pack.lang}'이 파일 이름과 다르다 / lang does not match the file name '${fileLang}'`);
    }
    mine.push(...shape);
    if (pack && !shape.length) {
      for (const s of pack.steps || []) if (STEP_TYPES.includes(s.type) && !s.cue) mine.push(`${s.id}: cue(선생님 할 일)가 없다 / missing teacher cue`);
      mine.push(...checkTemplates(pack));
      mine.push(...lintPack(pack));
    }
    const entry = { id: fileId, lang: fileLang, file, pack, valid: !!pack && !shape.length, steps: pack && Array.isArray(pack.steps) ? pack.steps.length : 0, problems: mine };
    packs.push(entry);
    if (!byId.has(fileId)) byId.set(fileId, []);
    byId.get(fileId).push(entry);
    for (const m of mine) problems.push(`${file}: ${m}`);
  }

  // 언어판끼리 / twins: compare every well-formed language against the reference (ko if present, else the first)
  for (const list of byId.values()) {
    const good = list.filter((e) => e.valid);
    if (good.length < 2) continue;
    const ref = good.find((e) => e.lang === 'ko') || good[0];
    for (const e of good) {
      if (e === ref) continue;
      for (const m of compareTwins(ref.pack, e.pack)) { problems.push(`${e.file}: ${m}`); e.problems.push(m); }
    }
  }
  for (const list of byId.values()) {
    if (list.length === 1 && list[0].pack) { const m = '언어판이 하나뿐이다(ko·en 둘 다 필요) / only one language (ship both ko and en)'; problems.push(`${list[0].file}: ${m}`); list[0].problems.push(m); }
  }

  // 색인 / index.json mirrors the disk
  const indexPath = path.join(packsDir, 'index.json');
  let index = null;
  try { index = JSON.parse(fs.readFileSync(indexPath, 'utf8')); } catch (e) { problems.push(`index.json: 읽을 수 없다 / cannot read: ${e.message}`); }
  if (index) {
    const entries = new Map((index.packs || []).map((p) => [p.id, p]));
    for (const [id, list] of byId) {
      const ie = entries.get(id);
      if (!ie) { problems.push(`index.json: '${id}'가 빠졌다 / pack '${id}' is missing from the index`); continue; }
      const onDisk = list.map((e) => e.lang).sort();
      const listed = Object.keys(ie.langs || {}).sort();
      if (onDisk.join(',') !== listed.join(',')) problems.push(`index.json: '${id}'의 언어가 디스크와 다르다 / languages differ from disk: index [${listed.join(', ')}] vs files [${onDisk.join(', ')}]`);
      for (const e of list) {
        const il = ie.langs && ie.langs[e.lang];
        if (!il || !e.pack) continue;
        if (il.title !== e.pack.title) problems.push(`index.json: ${id}.${e.lang} 제목이 팩과 다르다 / title differs from the pack: '${il.title}' vs '${e.pack.title}'`);
        for (const k of ['domain', 'age', 'minutes']) {
          if (il[k] == null) problems.push(`index.json: ${id}.${e.lang}에 ${k}가 없다 / missing ${k}`);
          else if (e.pack[k] != null && il[k] !== e.pack[k]) problems.push(`index.json: ${id}.${e.lang} ${k}가 팩과 다르다 / ${k} differs from the pack: '${il[k]}' vs '${e.pack[k]}'`);
        }
      }
    }
    for (const id of entries.keys()) if (!byId.has(id)) problems.push(`index.json: '${id}'는 색인에만 있고 파일이 없다 / listed in the index but no packs/${id}.<lang>.json on disk`);
  }

  for (const e of packs) report.push(`${e.problems.length ? '✗' : '✓'} ${e.id}.${e.lang}  ${e.steps} steps${e.problems.length ? `  (${e.problems.length})` : ''}`);
  return { ok: problems.length === 0, problems, report, packs };
}

export function main(argv = process.argv.slice(2)) {
  const root = argv[0] ? path.resolve(argv[0]) : ROOT;
  const { ok, problems, report, packs } = runChecks(root);
  for (const line of report) console.log(line);
  if (ok) {
    console.log(`\n수업팩 ${packs.length}개 모두 통과 / all ${packs.length} lesson packs pass`);
    return 0;
  }
  console.error(`\n문제 ${problems.length}건 / ${problems.length} problem${problems.length === 1 ? '' : 's'}:`);
  for (const p of problems) console.error(`  - ${p}`);
  return 1;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) process.exit(main());
