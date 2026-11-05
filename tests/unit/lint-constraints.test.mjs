// 단위 테스트: tools/lint-constraints.mjs — 현재 트리는 깨끗하고, 규칙마다 임시 폴더의 본보기가 걸린다. 실행: npm test
// Unit tests for the constraint lint: the current tree passes, and a tmp fixture triggers each rule.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { lint, isPurpleHex } from '../../tools/lint-constraints.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const dirs = [];
after(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });

function fixture(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emoren-lint-'));
  dirs.push(dir);
  for (const [f, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), body);
  }
  return dir;
}
const hits = (dir) => lint(dir).problems.map((p) => `${p.file}:${p.line} ${p.rule}`).sort();
const fmt = (p) => `${p.file}:${p.line} [${p.rule}] ${p.text}`;

test('현재 트리는 제약 린트를 통과한다', () => {
  const r = lint(ROOT);
  assert.deepEqual(r.problems, [], `제약 린트 문제:\n${r.problems.map(fmt).join('\n')}`);
  assert.equal(r.ok, true);
  assert.ok(r.files > 20, '파일을 실제로 훑었다');
});

test('language: 사용자에게 보이는 파일의 진단·치료 계열 낱말만 걸린다(주석·비공개 코드·분위기는 제외)', () => {
  const dir = fixture({
    'js/locales/ko.js': "export default {\n  // 진단이라는 말은 쓰지 않는다 (주석은 괜찮다)\n  'a': '오늘 반 분위기',\n  'b': '마음 진단 결과',\n};\n",
    'packs/x.en.json': '{ "line": "Time for Therapy" }\n',
    'js/views/tv.js': "const s = 'at risk';\n",
    'index.html': '<!-- screening is only a comment here -->\n<p>Children at-risk</p>\n',
    'js/store.js': "const x = '진단';\n",
    'docs/a.md': 'assessment words are allowed in docs\n',
  });
  assert.deepEqual(hits(dir), ['index.html:2 language', 'js/locales/ko.js:4 language', 'js/views/tv.js:1 language', 'packs/x.en.json:1 language']);
});

test('purple: 보라 낱말과 R·B가 G보다 60 넘게 큰 색만 걸린다', () => {
  assert.equal(isPurpleHex('#FF6B9D'), false, '핑크 토큰');
  assert.equal(isPurpleHex('#16B364'), false, '그린 토큰');
  assert.equal(isPurpleHex('#7C3AED'), true);
  assert.equal(isPurpleHex('#80f'), true);
  assert.equal(isPurpleHex('#e0497f'), false, 'b-g = 54');
  const dir = fixture({
    'css/app.css': ':root { --pink: #FF6B9D; --green: #16B364; --bad: #7C3AED; }\n.x { color: #e0497f; }\n.y { background: #80f; }\n',
    'js/views/tv.js': "const theme = 'purple';\n",
    'packs/x.ko.json': '{ "color": "#800080" }\n',
    'docs/notes.md': 'purple may be named in docs: #800080\n',
  });
  assert.deepEqual(hits(dir), ['css/app.css:1 purple', 'css/app.css:3 purple', 'js/views/tv.js:1 purple', 'packs/x.ko.json:1 purple']);
});

test('company: 회사 이름은 LICENSE·packs/LICENSE.md 에만', () => {
  const dir = fixture({
    'LICENSE': 'Copyright (c) 2026 더멤버스 (THE MEMBERS)\n',
    'packs/LICENSE.md': '© 2026 더멤버스\n',
    'README.md': 'made by THE MEMBERS\n',
    'js/a.js': '// 더멤버스 에셋으로 교체\n',
    'docs/a.md': 'the members of the class (plain words)\n',
  });
  assert.deepEqual(hits(dir), ['README.md:1 company', 'js/a.js:1 company']);
});

test('finance: 코인·저금·coin·savings·wallet (js, packs, docs, README; 브리프 예외)', () => {
  const dir = fixture({
    'packs/x.ko.json': '{ "line": "저금통에 넣어요" }\n',
    'js/a.js': "const w = 'wallet';\n",
    'README.md': 'savings for kids\n',
    'docs/HANDOVER-v0.2.md': '4. 금융(코인·저금) 소재는 넣지 않는다.\n',
    'docs/a.md': 'these events coincide, no coinage here\n',
    'css/app.css': '/* coin */\n',
  });
  assert.deepEqual(hits(dir), ['README.md:1 finance', 'js/a.js:1 finance', 'packs/x.ko.json:1 finance']);
});

test('model: 모델 이름은 어디서든 걸리고 node_modules·dist·.worktrees 는 보지 않는다', () => {
  const dir = fixture({
    'js/a.js': '// tuned for GPT-4 and Claude Opus\n',
    'docs/a.md': 'Claude-Session: https://claude.ai/code/session_01 (the plain trailer is fine)\n',
    'node_modules/x/index.js': 'gpt-4\n',
    'dist/out.js': 'llama 3\n',
    '.worktrees/b/js/a.js': 'gemini 2\n',
    'tools/lint-constraints.mjs': '// gpt-4 (the tool itself is skipped)\n',
  });
  assert.deepEqual(hits(dir), ['js/a.js:1 model']);
});

test('model: 커밋 메시지도 본다(이 도구가 들어온 커밋 이후만)', (t) => {
  try { execFileSync('git', ['--version'], { stdio: 'ignore' }); } catch { return t.skip('git 없음'); }
  const dir = fixture({ 'README.md': 'hello\n' });
  const git = (...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...a],
    { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  git('init', '-q', '-b', 'main');
  git('add', '.');
  git('commit', '-q', '-m', 'first\n\nCo-Authored-By: Claude Opus 4 <x@example.com>');
  const before = lint(dir).problems;
  assert.deepEqual(before.map((p) => p.rule), ['model']);
  assert.match(before[0].file, /^git:[0-9a-f]+$/);
  assert.equal(before[0].line, 3);
  // 도구가 커밋되면 그 전 커밋은 보지 않는다 / once the tool is committed, older commits are not scanned
  fs.mkdirSync(path.join(dir, 'tools'));
  fs.writeFileSync(path.join(dir, 'tools/lint-constraints.mjs'), '// placeholder\n');
  git('add', '.');
  git('commit', '-q', '-m', 'add lint');
  assert.equal(lint(dir).ok, true);
  git('commit', '-q', '--allow-empty', '-m', 'later: tuned with gpt-5');
  assert.deepEqual(hits(dir).map((h) => h.split(' ')[1]), ['model']);
});
