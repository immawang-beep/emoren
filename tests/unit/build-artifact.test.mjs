// 단위 테스트: 아티팩트 빌드(tools/build-artifact.mjs).
// index.html에서 문서 뼈대를 벗기는 stripShell, dist를 쓰는 build, 그리고 외부 스크립트가 섞이지 않는지.
// Unit tests for the artifact build: stripShell (pure HTML transform), build (writes the output folder),
// the companion file list, and that no external script tag reaches the artifact.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stripShell, build, artifactFiles } from '../../tools/build-artifact.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const CLAUDE_META = '<meta name="claude:viewport-fit-sides" content="cover">';
const walk = (dir) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })
  .flatMap((d) => (d.isDirectory() ? walk(`${dir}/${d.name}`) : [`${dir}/${d.name}`]));

// 작은 예제: 실제 index.html과 같은 순서의 뼈대 / a small page shaped like the real index.html
const FIXTURE = [
  '<!doctype html>',
  '<html lang="ko">',
  '<head>',
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width,initial-scale=1">',
  '<title>T</title>',
  '<link rel="manifest" href="manifest.webmanifest">',
  '<link rel="stylesheet" href="css/app.css">',
  '</head>',
  '<body>',
  '<div id="app" class="app"></div>',
  '<noscript><p>JS</p></noscript>',
  '<script type="module" src="js/app.js"></script>',
  '</body>',
  '</html>',
  '',
].join('\n');

test('stripShell: 문서 뼈대(doctype/html/head/body, charset, viewport, manifest)를 벗긴다', () => {
  const out = stripShell(INDEX).toLowerCase();
  const gone = ['<!doctype', '<html', '</html>', '<head>', '</head>', '<body>', '</body>',
    '<meta charset', '<meta name="viewport"', '<link rel="manifest"'];
  for (const g of gone) assert.ok(!out.includes(g), `남아 있으면 안 된다: ${g}`);
});

test('stripShell: 아티팩트 viewport 메타를 <title> 바로 앞에 정확히 한 번 넣는다', () => {
  const out = stripShell(INDEX);
  assert.equal(out.split(CLAUDE_META).length - 1, 1, '정확히 한 번');
  assert.ok(out.includes(`${CLAUDE_META}\n<title>`), '<title> 바로 앞');
  assert.equal(out.split('<title>').length - 1, 1, '<title>도 하나뿐');
});

test('stripShell: 스타일시트 링크, #app, noscript, 모듈 스크립트는 그대로 남는다', () => {
  const out = stripShell(INDEX);
  const keep = [
    '<link rel="stylesheet" href="css/app.css">',
    '<link rel="stylesheet" href="https://fonts.googleapis.com/',
    '<div id="app" class="app"></div>',
    '<noscript>',
    '<script type="module" src="js/app.js"></script>',
  ];
  for (const k of keep) assert.ok(out.includes(k), `사라지면 안 된다: ${k}`);
});

test('stripShell: 작은 예제에서 출력이 정확히 맞는다(순수 함수)', () => {
  const expected = [
    CLAUDE_META,
    '<title>T</title>',
    '<link rel="stylesheet" href="css/app.css">',
    '<div id="app" class="app"></div>',
    '<noscript><p>JS</p></noscript>',
    '<script type="module" src="js/app.js"></script>',
  ].join('\n');
  assert.equal(stripShell(FIXTURE).trim(), expected);
});

// build()는 임시 폴더에 쓴다(저장소의 dist/는 건드리지 않는다) / build() writes into a temp folder
let OUT;
before(() => {
  OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'emoren-artifact-'));
  build(ROOT, OUT);
});
after(() => fs.rmSync(OUT, { recursive: true, force: true }));

test('build(root, outDir): artifact.html과 artifact-files.json을 쓰고, 목록의 파일이 모두 실제로 있다', () => {
  const html = fs.readFileSync(path.join(OUT, 'artifact.html'), 'utf8');
  const files = JSON.parse(fs.readFileSync(path.join(OUT, 'artifact-files.json'), 'utf8'));
  assert.equal(html, stripShell(INDEX).trim() + '\n');
  assert.deepEqual(files, artifactFiles(ROOT));
  assert.ok(files.length > 0);
  for (const f of files) assert.ok(fs.existsSync(path.join(ROOT, f)), `목록에 있는데 파일이 없다: ${f}`);
  for (const f of walk('js').filter((x) => x.endsWith('.js'))) assert.ok(files.includes(f), `빠졌다: ${f}`);
  for (const f of walk('packs').filter((x) => x.endsWith('.json'))) assert.ok(files.includes(f), `빠졌다: ${f}`);
  assert.ok(files.includes('css/app.css'));
});

test('artifact.html에는 외부 스크립트 태그가 하나도 없다(모듈 스크립트는 상대 경로)', () => {
  const html = fs.readFileSync(path.join(OUT, 'artifact.html'), 'utf8');
  const scripts = [...html.matchAll(/<script\b[^>]*>/gi)].map((m) => m[0]);
  assert.ok(scripts.length >= 1, '모듈 스크립트는 있어야 한다');
  for (const s of scripts) {
    assert.ok(!/\bsrc\s*=\s*["']?(?:[a-z]+:)?\/\//i.test(s), `외부 스크립트: ${s}`);
  }
  assert.ok(!/<script[^>]*src=["']?http/i.test(html), '<script src="http… 가 없어야 한다');
});

test('npm run build:artifact 가 0으로 끝나고 dist/에 결과를 쓴다', () => {
  const r = spawnSync('npm', ['run', 'build:artifact'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, `exit ${r.status}\n${r.stderr}`);
  assert.match(r.stdout, /dist\/artifact\.html/);
  assert.ok(fs.existsSync(path.join(ROOT, 'dist', 'artifact.html')));
  assert.ok(fs.existsSync(path.join(ROOT, 'dist', 'artifact-files.json')));
});
