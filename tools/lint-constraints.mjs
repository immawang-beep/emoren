// 제약 린트(의존성 없음). 브리프의 '절대 규칙'이 코드·수업팩·문서·최근 커밋 메시지에 새어 들어오지 않았는지 훑는다.
// Constraint lint (no dependencies): scans the tree and recent commit messages for what the brief forbids.
//   node tools/lint-constraints.mjs [dir]   → 문제를 `file:line [rule] text` 한 줄씩 찍고, 하나라도 있으면 exit 1
//   import { lint } from './lint-constraints.mjs'; lint(root) → { ok, problems: [{ file, line, rule, text }] }
//
// 규칙 / rules
//   language  관찰 언어만. 사용자에게 보이는 파일(js/locales, packs/*.json, js/views, js/ui, index.html, manifest)에서
//             진단·검사·치료·판정·위기·장애·문제아 / diagnos·therapy·treatment·assess·screening·disorder·at risk 금지.
//             //, /*, <!-- 로 시작하는 주석 줄은 설명을 위해 허용한다.
//   purple    보라 금지(js, css, packs, index.html): purple·violet·indigo·lavender 낱말과,
//             빨강·파랑 채널이 둘 다 초록보다 60 넘게 큰 hex 색(#rgb, #rrggbb).
//   company   회사 이름은 LICENSE 와 packs/LICENSE.md 에만.
//   finance   코인·저금·coin·savings·wallet 소재 금지(js, packs, docs, README*). 규칙 자체를 적어 둔 브리프(docs/HANDOVER-*.md)는 예외.
//   model     AI 모델/제품 버전 이름 금지: 모든 파일 + 커밋 메시지(최근 200개, 이 도구가 들어온 커밋 이후만 — 이력은 고치지 않는다).
// node_modules, dist, .worktrees, .git 과 이 도구·그 테스트 파일은 보지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SELF = ['tools/lint-constraints.mjs', 'tests/unit/lint-constraints.test.mjs'];
const SKIP_DIRS = new Set(['node_modules', 'dist', '.worktrees', '.git']);
const LOG_COMMITS = 200;

// language — 사용자에게 보이는 파일만 / user-facing sources only
const USER_FACING = (f) => /^js\/locales\/[^/]+\.js$/.test(f) || /^packs\/[^/]+\.json$/.test(f)
  || f.startsWith('js/views/') || f.startsWith('js/ui/') || f === 'index.html' || f === 'manifest.webmanifest';
const COMMENT_LINE = /^\s*(\/\/|\/\*|\*|<!--)/;
const LANGUAGE = [
  // '분위기'(반 분위기)는 '위기'가 아니다 / '분위기' (mood) contains '위기' but is fine
  /진단|검사|치료|판정|(?<!분)위기|장애|문제아|문제 ?행동/,
  /diagnos|therapy|treatment|assess|screening|disorder|\bat[- ]risk\b/i,
];

// purple
const PURPLE_SCOPE = (f) => f.startsWith('js/') || f.startsWith('css/') || f.startsWith('packs/') || f === 'index.html';
const PURPLE_WORDS = /\b(purple|violet|indigo|lavender)/i;
const HEX = /(?<![\w&])#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b/gi;
export function isPurpleHex(hex) {
  const h = hex.replace(/^#/, '');
  const full = h.length <= 4 ? [...h].map((c) => c + c).join('') : h; // #rgb(a) → rrggbb(aa)
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return r - g > 60 && b - g > 60;
}

// company
const COMPANY = /더멤버스|THE MEMBERS|The Members/;
const COMPANY_OK = new Set(['LICENSE', 'packs/LICENSE.md']);

// finance
const FINANCE_SCOPE = (f) => f.startsWith('js/') || f.startsWith('packs/') || f.startsWith('docs/') || /^README[^/]*$/i.test(f);
const BRIEF = /^docs\/HANDOVER-[^/]*\.md$/; // 규칙 자체를 적어 둔 브리프 / the brief that states the rule itself
const FINANCE = /코인|저금|coins?\b|savings\b|wallets?\b/i;

// model — 잘 알려진 AI 모델/제품 버전 이름 / well-known AI model and product version names
const MODEL = [
  /\b(gpt|claude|gemini|gemma|llama|sonnet|opus|haiku|fable|mistral|mixtral|qwen|grok|phi)[- ]?\d/i,
  /\bclaude[- ](opus|sonnet|haiku|fable)\b/i,
  /\bchatgpt\b/i, /\bgpt-?4o\b/i, /\bo[134]-?(mini|pro|preview)\b/i, /\bdeepseek[- ]?[rv]\d/i, /\bcommand[- ]r\b/i,
];

const short = (s) => s.trim().slice(0, 160);

function walk(root, rel = '') {
  const out = [];
  for (const d of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
    const f = rel ? `${rel}/${d.name}` : d.name;
    if (d.isDirectory()) { if (!SKIP_DIRS.has(d.name)) out.push(...walk(root, f)); }
    else if (d.isFile()) out.push(f);
  }
  return out.sort();
}

export function lintText(file, text, problems = []) {
  const language = USER_FACING(file), purple = PURPLE_SCOPE(file);
  const company = !COMPANY_OK.has(file), finance = FINANCE_SCOPE(file) && !BRIEF.test(file);
  text.split(/\r?\n/).forEach((raw, i) => {
    const add = (rule) => problems.push({ file, line: i + 1, rule, text: short(raw) });
    if (language && !COMMENT_LINE.test(raw) && LANGUAGE.some((re) => re.test(raw))) add('language');
    if (purple && (PURPLE_WORDS.test(raw) || [...raw.matchAll(HEX)].some((m) => isPurpleHex(m[1])))) add('purple');
    if (company && COMPANY.test(raw)) add('company');
    if (finance && FINANCE.test(raw)) add('finance');
    if (MODEL.some((re) => re.test(raw))) add('model');
  });
  return problems;
}

// 커밋 메시지: 이 도구를 추가한 커밋 이후만 본다(그 전 이력은 고칠 수 없다). git 이 없거나 저장소가 아니면 건너뛴다.
// Commit messages: only commits after the one that added this tool (older history cannot be rewritten).
function lintGitLog(root, problems) {
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  let top;
  try { top = git('rev-parse', '--show-toplevel'); } catch { return 0; }
  if (fs.realpathSync(top) !== fs.realpathSync(root)) return 0; // 다른 저장소 안의 폴더 / a folder inside some other repo
  let log;
  try {
    const added = git('log', '--diff-filter=A', '--format=%H', '--', SELF[0]).split('\n').filter(Boolean);
    const range = added.length ? [`${added[added.length - 1]}..HEAD`] : [];
    log = git('log', '-n', String(LOG_COMMITS), '--format=%x1e%h%x1f%B', ...range);
  } catch { return 0; }
  const commits = log.split('\x1e').filter(Boolean);
  for (const rec of commits) {
    const [sha, body = ''] = rec.split('\x1f');
    body.split(/\r?\n/).forEach((raw, i) => {
      if (MODEL.some((re) => re.test(raw))) problems.push({ file: `git:${sha}`, line: i + 1, rule: 'model', text: short(raw) });
    });
  }
  return commits.length;
}

export function lint(rootDir) {
  const root = path.resolve(rootDir);
  const problems = [];
  let files = 0;
  for (const file of walk(root)) {
    if (SELF.includes(file)) continue;
    const buf = fs.readFileSync(path.join(root, file));
    if (buf.subarray(0, 512).includes(0)) continue; // 이진 파일 / binary
    files++;
    lintText(file, buf.toString('utf8'), problems);
  }
  const commits = lintGitLog(root, problems);
  return { ok: problems.length === 0, problems, files, commits };
}

export function main(argv = process.argv.slice(2)) {
  const root = argv[0] ? path.resolve(argv[0]) : fileURLToPath(new URL('..', import.meta.url));
  const { ok, problems, files, commits } = lint(root);
  for (const p of problems) console.log(`${p.file}:${p.line} [${p.rule}] ${p.text}`);
  const byRule = [...new Set(problems.map((p) => p.rule))].map((r) => `${r} ${problems.filter((p) => p.rule === r).length}`).join(', ');
  console.log(ok
    ? `제약 린트: 문제 없음 / constraint lint: ok (${files} files, ${commits} commits)`
    : `제약 린트: ${problems.length}곳 / constraint lint: ${problems.length} problem(s) — ${byRule}`);
  process.exitCode = ok ? 0 : 1;
  return ok;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
