// 단위 테스트: js/ 아래 모든 모듈이 Node에서 그대로 불러와지는지(불러올 때 document/window 를 건드리지 않는지),
// 파일이 주석 줄(두 언어 머리말)로 시작하는지, import 가 모두 상대 경로인지(패키지 이름·URL 금지). 실행: npm test
// Every js/**/*.js module must import cleanly in Node without touching the DOM at import time (js/app.js, the entry
// point that needs a DOM, is the one exception), start with a comment line and use only relative imports.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const walk = (dir) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })
  .flatMap((d) => (d.isDirectory() ? walk(`${dir}/${d.name}`) : [`${dir}/${d.name}`]));
const MODULES = walk('js').filter((f) => f.endsWith('.js')).sort();
const IMPORTABLE = MODULES.filter((f) => f !== 'js/app.js');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

// 한 줄에서 import 경로를 뽑는다 / import specifiers on one line:
//   import … from '…'   export … from '…'   } from '…' (여러 줄 import 의 마지막 줄)   import '…'   import('…')
const STATIC = /^\s*(?:import\b|export\b|\})[^'"]*\bfrom\s*(['"])([^'"]+)\1/;
const SIDE_EFFECT = /^\s*import\s*(['"])([^'"]+)\1/;
const DYNAMIC = /\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g;
const specifiers = (src) => {
  const out = [];
  for (const line of src.split('\n')) {
    const m = STATIC.exec(line) || SIDE_EFFECT.exec(line);
    if (m) out.push(m[2]);
    for (const d of line.matchAll(DYNAMIC)) out.push(d[2]);
  }
  return out;
};

test('js/ 아래 모듈 목록을 찾았다(빈 목록으로 통과하지 않도록)', () => {
  assert.ok(MODULES.length >= 10, `${MODULES.length} modules`);
  assert.ok(MODULES.includes('js/app.js'), 'entry point exists');
  assert.ok(IMPORTABLE.includes('js/store.js'));
  assert.ok(!IMPORTABLE.includes('js/app.js'), 'app.js needs a DOM and is skipped');
});

for (const f of IMPORTABLE) {
  test(`${f} 는 Node에서 불러와지고, 불러올 때 document/window 를 만들지 않는다`, async () => {
    assert.equal(typeof globalThis.document, 'undefined', 'before: no document in Node');
    assert.equal(typeof globalThis.window, 'undefined', 'before: no window in Node');
    const mod = await import(pathToFileURL(path.join(ROOT, f)).href);
    assert.equal(typeof mod, 'object', `${f}: module namespace`);
    assert.equal(typeof globalThis.document, 'undefined', `${f}: must not define document at import time`);
    assert.equal(typeof globalThis.window, 'undefined', `${f}: must not define window at import time`);
  });
}

test('모든 모듈 파일은 주석 줄(두 언어 머리말)로 시작한다', () => {
  for (const f of MODULES) {
    const first = read(f).split('\n')[0];
    assert.match(first, /^\s*(\/\/|\/\*)/, `${f}: first line must be a comment, got ${JSON.stringify(first.slice(0, 60))}`);
  }
});

test('모든 import 는 상대 경로이고(패키지 이름·URL 없음) 가리키는 파일이 실제로 있다', () => {
  let count = 0;
  for (const f of MODULES) {
    for (const spec of specifiers(read(f))) {
      count++;
      assert.doesNotMatch(spec, /^[a-z][a-z0-9+.-]*:/i, `${f}: URL import ${spec}`);
      assert.match(spec, /^\.\.?\//, `${f}: bare specifier ${spec} — use a relative path`);
      const target = path.resolve(path.dirname(path.join(ROOT, f)), spec);
      assert.ok(fs.existsSync(target), `${f}: ${spec} does not exist`);
    }
  }
  assert.ok(count >= 10, `${count} import specifiers found`);
});
