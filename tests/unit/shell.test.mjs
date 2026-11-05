// 단위 테스트: 오프라인 셸(sw.js SHELL)과 아티팩트 파일 목록이 실제 파일과 맞는지.
// SHELL에 없는 파일이 있으면 cache.addAll이 통째로 실패한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { artifactFiles } from '../../tools/build-artifact.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const SHELL = [...sw.match(/const SHELL = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
const walk = (dir) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })
  .flatMap((d) => (d.isDirectory() ? walk(`${dir}/${d.name}`) : [`${dir}/${d.name}`]));

test('SHELL의 모든 파일이 실제로 있다', () => {
  for (const f of SHELL) {
    if (f === './') continue;
    assert.ok(fs.existsSync(path.join(ROOT, f)), `sw.js SHELL에 있는데 파일이 없다: ${f}`);
  }
});

test('js/ 아래 모든 모듈과 모든 수업팩이 SHELL에 있다(오프라인에서도 뜬다)', () => {
  const need = [...walk('js').filter((f) => f.endsWith('.js')), ...walk('packs').filter((f) => f.endsWith('.json'))];
  for (const f of need) assert.ok(SHELL.includes(f), `sw.js SHELL에 빠졌다: ${f}`);
});

test('SHELL은 중복 없이 정렬되어 있다(병합 충돌을 줄인다)', () => {
  const rest = SHELL.filter((f) => f !== './' && f !== 'index.html');
  assert.equal(new Set(SHELL).size, SHELL.length, '중복');
  assert.deepEqual(rest, [...rest].sort(), "'./', 'index.html' 다음은 알파벳 순");
});

test('아티팩트 파일 목록은 js/·packs/·css/를 빠짐없이 담는다', () => {
  const files = artifactFiles(ROOT);
  for (const f of walk('js').filter((x) => x.endsWith('.js'))) assert.ok(files.includes(f), f);
  for (const f of walk('packs').filter((x) => x.endsWith('.json'))) assert.ok(files.includes(f), f);
  assert.ok(files.includes('css/app.css'));
});
