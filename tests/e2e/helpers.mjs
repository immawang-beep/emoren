// e2e 공용 도구 / shared e2e harness. tests/e2e.mjs(실행기)가 만들어 각 시나리오에 넘긴다.
//   h.base            정적 서버 주소 / static server URL
//   h.newContext(o)   새 브라우저 컨텍스트(localStorage가 따로) / isolated context; closed by the runner
//   h.check(name, fn) 한 항목 검사: 실패해도 계속 간다 / one check; failures are counted, run continues
//   h.hasText(loc, s) loc 중 s를 담은 첫 요소가 뜰 때까지 기다린다
//   h.watch(page, n)  페이지 오류·콘솔 오류를 모은다(끝에 실패로 센다)
//   h.shot(page, f)   dist/shots/<f> 스크린샷 (SHOTS_DIR, SHOT_SCALE)
//   h.log(...)        진행 출력
//   T                 기본 대기(ms). 환경변수 E2E_TIMEOUT으로 바꾼다
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { startServer } from '../../tools/serve.mjs';

const require = createRequire(import.meta.url);

export const ROOT = fileURLToPath(new URL('../..', import.meta.url));
// 기본 대기 8초. 느린 기기·동시 실행에서는 E2E_TIMEOUT=15000 npm run e2e / default wait; raise under load
export const T = Number(process.env.E2E_TIMEOUT || 8000);

export async function createHarness() {
  const { chromium } = require('playwright');
  const SHOTS = process.env.SHOTS_DIR || path.join(ROOT, 'dist', 'shots');
  const SCALE = Number(process.env.SHOT_SCALE || 1);
  fs.mkdirSync(SHOTS, { recursive: true });
  const srv = await startServer(ROOT, 0);
  const browser = await chromium.launch();
  const contexts = [];
  const pageErrors = [];
  let failures = 0;
  const log = (...a) => console.log(...a);

  const h = {
    ROOT, T, SHOTS, SCALE, base: srv.url, browser, log,
    get failures() { return failures; },
    fail(name, e) { failures++; log('  ✗', name, '\n     ', ((e && e.message) || String(e)).split('\n')[0]); },
    async check(name, fn) {
      try { await fn(); log('  ✓', name); } catch (e) { h.fail(name, e); }
    },
    async hasText(loc, text, timeout = T) { await loc.filter({ hasText: text }).first().waitFor({ timeout }); },
    watch(page, name) {
      page.on('pageerror', (e) => pageErrors.push(`${name}: ${e.message}`));
      page.on('console', (m) => { if (m.type() === 'error') pageErrors.push(`${name} console: ${m.text()}`); });
      return page;
    },
    async newContext(opts = {}) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: SCALE, locale: 'ko-KR', ...opts });
      contexts.push(ctx);
      return ctx;
    },
    // 새 페이지 + 오류 감시 + (선택) 폰 크기 / new watched page, optionally phone-sized
    async newPage(ctx, name, { phone = false } = {}) {
      const page = h.watch(await ctx.newPage(), name);
      if (phone) await page.setViewportSize({ width: 390, height: 844 });
      return page;
    },
    async shot(page, file, opts = {}) { await page.screenshot({ path: path.join(SHOTS, file), ...opts }); },
    pageErrors,
    async close() {
      for (const c of contexts) { try { await c.close(); } catch { /* 이미 닫힘 */ } }
      await browser.close();
      await srv.close();
    },
  };
  return h;
}
