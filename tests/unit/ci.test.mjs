// 단위 테스트: CI 워크플로(.github/workflows/ci.yml)가 약속한 모양을 지키는지 — YAML을 텍스트로만 본다(파서 의존성 없음).
// Unit test: the CI workflow keeps its promised shape — the YAML is read as plain text (no parser dependency).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const yml = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');

// 최상위 키 한 블록: 그 `key:` 줄부터 다음 들여쓰기 없는 줄 직전까지 / one top-level block, up to the next unindented line
const block = (key) => {
  const m = yml.match(new RegExp(`^${key}:[^\\n]*\\n(?:(?:[ \\t][^\\n]*)?\\n)*`, 'm'));
  assert.ok(m, `ci.yml에 최상위 '${key}:'가 없다`);
  return m[0];
};
const countLines = (re) => yml.split('\n').filter((l) => re.test(l)).length;

test('main 푸시와 pull_request에서 돈다', () => {
  const on = block('on');
  assert.match(on, /^  push:\n(?: {4}.*\n)*? {4}branches: \[main\]$/m, 'push → main 브랜치');
  assert.match(on, /^  pull_request:$/m, 'pull_request 트리거');
});

test('단위 테스트 → 플레이라이트 설치(한 번) → e2e 순서로 돈다', () => {
  const unit = yml.indexOf('run: npm test');
  const install = yml.indexOf('npx playwright install --with-deps chromium');
  const e2e = yml.indexOf('run: npm run e2e');
  assert.ok(unit > -1, 'npm test');
  assert.match(yml, /^\s+npm install --no-save playwright@\d+\.\d+\.\d+( [a-z0-9@.\/_-]+)*$/m, '버전을 못 박은 playwright 설치(+ 테스트 전용 패키지)');
  assert.ok(install > -1, 'npx playwright install --with-deps chromium');
  assert.ok(e2e > -1, 'npm run e2e');
  assert.ok(unit < install && install < e2e, '순서: npm test < playwright install < npm run e2e');
  assert.equal(countLines(/npx playwright install/), 1, '브라우저 설치는 매트릭스 한 칸당 한 번');
});

test('같은 ref의 이전 실행은 취소한다', () => {
  const c = block('concurrency');
  assert.match(c, /^  group: ci-\$\{\{ github\.ref \}\}$/m);
  assert.match(c, /^  cancel-in-progress: true$/m);
});

test('node 20과 22에서 각각 끝까지 돈다(fail-fast 끔)', () => {
  assert.match(yml, /^\s+node: \[20, 22\]$/m, 'matrix.node');
  assert.match(yml, /^\s+fail-fast: false$/m);
  assert.match(yml, /^\s+node-version: \$\{\{ matrix\.node \}\}$/m, 'setup-node가 매트릭스를 따른다');
  assert.match(yml, /^\s+name: unit \+ e2e \(node \$\{\{ matrix\.node \}\}\)$/m, '잡 이름에 노드 버전');
});

test('e2e는 느린 러너를 기다려 주고, 스크린샷은 노드별 이름으로 7일 남는다', () => {
  assert.match(yml, /^\s+E2E_TIMEOUT: 15000$/m);
  assert.match(yml, /^\s+name: screenshots-node\$\{\{ matrix\.node \}\}$/m);
  assert.match(yml, /^\s+retention-days: 7$/m);
});
