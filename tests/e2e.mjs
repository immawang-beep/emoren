// e2e 실행기(Playwright). 실행: npm run e2e  ·  일부만: npm run e2e -- lesson demo
// tests/e2e/*.e2e.mjs 를 이름 순으로 하나씩 돌린다. 각 파일은 `export default async function (h)` 하나.
// 공용 도구(h)는 tests/e2e/helpers.mjs. 스크린샷은 dist/shots/ (SHOTS_DIR, SHOT_SCALE로 바꿀 수 있다).
// Runs every tests/e2e/*.e2e.mjs in name order; each exports `default async (h) => {}`.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHarness, ROOT } from './e2e/helpers.mjs';

const dir = path.join(ROOT, 'tests', 'e2e');
const filters = process.argv.slice(2);
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.e2e.mjs')).sort()
  .filter((f) => !filters.length || filters.some((x) => f.includes(x)));
if (!files.length) { console.error(`시나리오 없음 / no scenarios match: ${filters.join(' ')}`); process.exit(1); }

const h = await createHarness();
try {
  for (const f of files) {
    h.log(`\n=== ${f}`);
    try {
      const mod = await import(pathToFileURL(path.join(dir, f)).href);
      await mod.default(h);
    } catch (e) {
      h.fail(`${f} 중단 / aborted`, e);
    }
  }
} finally {
  await h.close();
}

const realErrors = h.pageErrors.filter((e) => !/favicon|ERR_FAILED.*fonts|net::ERR/.test(e));
if (realErrors.length) { h.fail('페이지 오류 / page errors', new Error(`${realErrors.length}건`)); for (const e of realErrors) h.log('  ', e); }
h.log(`\n${h.failures ? `실패 ${h.failures}건` : '모두 통과'} · 시나리오 ${files.length}개 · 스크린샷 ${h.SHOTS}`);
process.exit(h.failures ? 1 : 0);
