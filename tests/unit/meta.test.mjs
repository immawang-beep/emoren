// 단위 테스트: 공개 메타데이터 — index.html <head>(color-scheme, 한·영 설명, Open Graph, 트위터 카드), manifest,
// SECURITY.md의 개인정보 절, 이슈 템플릿의 한·영 프롬프트, 그리고 build:artifact 결과(문서 뼈대 제거, og 태그 유지).
// Unit test: public metadata — index.html <head>, manifest, the SECURITY.md privacy section, bilingual issue
// templates, and the artifact build output. Company names are read from LICENSE at run time, never written here.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const meta = (html, attr, key) => (html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)">`)) || [])[1];
const hasHangul = (s) => /[가-힣]/.test(s);
const hasLatin = (s) => /[A-Za-z]/.test(s);

const DESC = '강사 폰 한 대로 교실 TV와 캐릭터가 함께 움직이는 수업 시스템 · One phone drives a classroom TV character; kids answer with cards, not screens.';
const SITE = 'https://immawang-beep.github.io/emoren/';
const TEMPLATES = fs.readdirSync(path.join(ROOT, '.github/ISSUE_TEMPLATE'))
  .filter((f) => f.endsWith('.md')).sort().map((f) => `.github/ISSUE_TEMPLATE/${f}`);
const FILES = ['index.html', 'manifest.webmanifest', 'SECURITY.md', ...TEMPLATES];

// 브리프의 금지어: 아이를 가르는 임상 표현과 금융 소재. / Forbidden by the brief: clinical wording about a child, money themes.
const FORBIDDEN = /진단|검사|치료|판정|위기|장애|문제 행동|코인|저금|금융|diagnos|therapy|treatment|assess|screening|disorder|at risk|detect|\bcoins?\b|savings|finance/i;

// 회사 이름은 LICENSE 저작권 줄에서만 읽어 온다(이 파일에 적지 않는다). / Company names come from the LICENSE copyright line only.
function companyNames() {
  const holder = read('LICENSE').match(/^Copyright \(c\) \d{4} (.+)$/m)[1];
  return holder.split('·').map((s) => s.trim()).filter((s) => s && !/^emoren$/i.test(s))
    .flatMap((s) => s.split(/[()]/)).map((s) => s.trim()).filter((s) => s.length >= 3);
}

function assertClean(name, text) {
  const hit = text.match(FORBIDDEN);
  assert.equal(hit, null, `${name}: 금지어 / forbidden word "${hit && hit[0]}"`);
  const lower = text.toLowerCase();
  for (const c of companyNames()) assert.ok(!lower.includes(c.toLowerCase()), `${name}: 회사 이름이 들어 있다 / company name present`);
}

test('index.html <head>: color-scheme, 한·영 설명, Open Graph, 트위터 카드, 기존 태그 유지', () => {
  const html = read('index.html');
  assert.ok(html.includes('<meta name="color-scheme" content="light dark">'), 'color-scheme');
  assert.ok(html.includes('<title>이모렌 교실</title>'), 'title 유지');
  assert.ok(hasHangul(DESC) && hasLatin(DESC), '설명은 한·영');
  assert.equal(meta(html, 'name', 'description'), DESC);
  assert.equal(meta(html, 'property', 'og:title'), 'emoren classroom · 이모렌 교실');
  assert.equal(meta(html, 'property', 'og:description'), DESC);
  assert.equal(meta(html, 'property', 'og:type'), 'website');
  assert.equal(meta(html, 'property', 'og:url'), SITE);
  assert.equal(meta(html, 'property', 'og:image'), `${SITE}docs/shots/demo-en.png`);
  assert.equal(meta(html, 'name', 'twitter:card'), 'summary_large_image');
  assert.equal(meta(html, 'name', 'theme-color'), '#FF6B9D', '기존 theme-color 유지');
  for (const keep of [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
    '<link rel="manifest" href="manifest.webmanifest">',
    '<link rel="icon" href="assets/icon.svg" type="image/svg+xml">',
    '<link rel="stylesheet" href="css/app.css">',
    '<script type="module" src="js/app.js"></script>',
  ]) assert.ok(html.includes(keep), `기존 태그 유지: ${keep}`);
});

test('manifest.webmanifest: JSON으로 읽히고 한·영 설명·categories·orientation·색을 가진다', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.equal(m.name, '이모렌 교실');
  assert.equal(m.description, DESC);
  assert.deepEqual(m.categories, ['education']);
  assert.equal(m.orientation, 'any');
  assert.equal(m.display, 'standalone');
  assert.equal(m.theme_color, '#FF6B9D');
  assert.equal(m.background_color, '#FFF8F3');
  assert.ok(Array.isArray(m.icons) && m.icons.length >= 1, '아이콘');
  for (const icon of m.icons) assert.ok(fs.existsSync(path.join(ROOT, icon.src)), icon.src);
});

test('SECURITY.md: "Privacy by design" 절이 영어로 있고 한국어 문단이 따라온다', () => {
  const md = read('SECURITY.md');
  const at = md.indexOf('## Privacy by design');
  assert.ok(at >= 0, 'Privacy 절이 있다');
  const section = md.slice(at);
  for (const w of ['name', 'photo', 'voice', 'total', 'story', 'note', 'secret', 'QR', 'erase']) {
    assert.ok(new RegExp(w, 'i').test(section), `Privacy 절이 다루는 것: ${w}`);
  }
  assert.ok(hasHangul(section), '한국어 문단');
});

test('이슈 템플릿: 모든 항목 프롬프트가 한 줄 영어 + 한국어', () => {
  assert.ok(TEMPLATES.length >= 2, '템플릿 두 개 이상');
  for (const f of TEMPLATES) {
    for (const line of read(f).split('\n')) {
      const isPrompt = line.startsWith('**') || line.startsWith('- [ ]') || /^(name|about):/.test(line);
      if (!isPrompt) continue;
      assert.ok(hasHangul(line) && hasLatin(line), `${f}: 한·영이 아닌 항목 / not bilingual: ${line}`);
      if (line.startsWith('**')) assert.match(line, /^\*\*[^*]+ \/ [^*]+\*\*/, `${f}: "English / 한국어" 라벨: ${line}`);
      const hint = line.match(/\*\*\s*\(([^)]*)\)/);
      if (hint) assert.ok(hasHangul(hint[1]) && hasLatin(hint[1]), `${f}: 괄호 힌트도 한·영 / hint not bilingual: ${line}`);
    }
  }
});

test('공개 메타데이터 파일에 금지어와 회사 이름이 없다', () => {
  assert.ok(companyNames().length >= 1, 'LICENSE 저작권 줄을 읽었다');
  for (const f of FILES) assertClean(f, read(f));
});

test('npm run build:artifact: 문서 뼈대는 벗기고 og 태그는 남긴다', () => {
  // npm run build:artifact == node tools/build-artifact.mjs (dist/는 .gitignore)
  execFileSync(process.execPath, [path.join(ROOT, 'tools/build-artifact.mjs')], { cwd: ROOT, stdio: 'pipe' });
  const out = read('dist/artifact.html');
  for (const bad of [/<!doctype/i, /<\/?html[\s>]/i, /<\/?head[\s>]/i, /<\/?body[\s>]/i, /<meta charset/i, /<meta name="viewport"/i, /<link rel="manifest"/i]) {
    assert.doesNotMatch(out, bad, `아티팩트에 남으면 안 되는 것: ${bad}`);
  }
  assert.ok(out.includes('<meta name="claude:viewport-fit-sides" content="cover">'), '아티팩트 전용 메타');
  assert.ok(out.includes('<title>이모렌 교실</title>'), 'title');
  assert.ok(out.includes('<meta name="color-scheme" content="light dark">'), 'color-scheme');
  assert.equal(meta(out, 'property', 'og:title'), 'emoren classroom · 이모렌 교실');
  assert.equal(meta(out, 'property', 'og:description'), DESC);
  assert.equal(meta(out, 'property', 'og:image'), `${SITE}docs/shots/demo-en.png`);
  assert.equal(meta(out, 'name', 'twitter:card'), 'summary_large_image');
  assert.ok(out.includes('<script type="module" src="js/app.js"></script>'), '앱 스크립트');
  assertClean('dist/artifact.html', out);
  const files = JSON.parse(read('dist/artifact-files.json'));
  assert.ok(files.includes('css/app.css') && files.includes('js/app.js'), '함께 올릴 파일 목록');
});
