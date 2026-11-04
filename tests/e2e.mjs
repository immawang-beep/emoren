// 두 화면 시나리오 테스트(Playwright). 실행: npm run e2e
// 한 브라우저 안에서 교실 TV 탭과 강사 폰 탭을 열어 '같은 브라우저 동기화'로 수업 한 회기를 끝까지 돌린다.
//   시작 → 집계 → TV 새로고침 복구 → 일시정지 → 확정 → 타이머 → 이야기 → 마무리 → 끝 → 보호자 페이지
// 스크린샷은 dist/shots/ (SHOTS_DIR, SHOT_SCALE 환경변수로 바꿀 수 있다).
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { startServer } from '../tools/serve.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SHOTS = process.env.SHOTS_DIR || path.join(ROOT, 'dist', 'shots');
const SCALE = Number(process.env.SHOT_SCALE || 1);
fs.mkdirSync(SHOTS, { recursive: true });

let failures = 0;
const log = (...a) => console.log(...a);
async function check(name, fn) {
  try { await fn(); log('  ✓', name); }
  catch (e) { failures++; log('  ✗', name, '\n     ', (e && e.message || String(e)).split('\n')[0]); }
}
const T = 6000;
async function hasText(loc, text) { await loc.filter({ hasText: text }).first().waitFor({ timeout: T }); }

const srv = await startServer(ROOT, 0);
const base = srv.url;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: SCALE, locale: 'ko-KR' });
const pageErrors = [];
function watch(page, name) {
  page.on('pageerror', (e) => pageErrors.push(`${name}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') pageErrors.push(`${name} console: ${m.text()}`); });
}

try {
  log('\n[1] 교실 TV가 먼저 열리고 코드를 만든다');
  const tv = await ctx.newPage(); watch(tv, 'TV');
  await tv.goto(`${base}/#tv`);
  await tv.waitForFunction(() => /^#tv-[A-Z0-9]{4}$/.test(location.hash), null, { timeout: T });
  const autoCode = (await tv.evaluate(() => location.hash)).slice(4);
  await check(`TV 대기 화면에 코드 ${autoCode}가 크게 뜬다`, () => hasText(tv.locator('.bigcode'), autoCode));

  log('\n[2] 고정 코드 DEMO로 TV와 강사 폰을 묶는다');
  await tv.goto(`${base}/#tv-DEMO`);
  await hasText(tv.locator('.bigcode'), 'DEMO');
  const phone = await ctx.newPage(); watch(phone, '강사폰');
  await phone.setViewportSize({ width: 390, height: 844 });
  await phone.goto(`${base}/#teacher-DEMO`);
  await check('강사 폰에 수업 시작 버튼이 뜬다', () => phone.locator('[data-act="start"]').waitFor({ timeout: T }));
  await check('TV 대기 화면이 수업 제목을 받는다', () => hasText(tv.locator('.wait h1'), '오늘의 마음 날씨'));
  await phone.screenshot({ path: path.join(SHOTS, 'phone-1-waiting.png') });

  log('\n[3] 수업 시작: 인사');
  await phone.click('[data-act="start"]');
  await check('TV에 인사 장면', () => hasText(tv.locator('.scene h1'), '마음에도 날씨가 있대'));
  await check('TV 자막에 첫 대사', () => hasText(tv.locator('[data-caption]'), '안녕, 친구들'));
  await check('강사 폰이 1/5 단계를 표시한다', () => hasText(phone.locator('.stepnav'), '1/5'));
  await tv.screenshot({ path: path.join(SHOTS, 'tv-1-hello.png') });

  log('\n[4] 마음 날씨 고르기: 집계가 TV에 실시간으로 간다');
  await phone.click('[data-act="next"]');
  await check('TV에 질문과 선택지 4개', async () => { await hasText(tv.locator('.scene h1'), '어떤 날씨'); if ((await tv.locator('.opt').count()) !== 4) throw new Error('선택지 수'); });
  const plus = (id, n) => (async () => { for (let i = 0; i < n; i++) await phone.click(`[data-tally="${id}"][data-delta="1"]`); })();
  await plus('sunny', 3); await plus('cloudy', 2); await plus('rainy', 1);
  await check('TV 해님 칸이 3', () => hasText(tv.locator('[data-opt="sunny"] .count'), '3'));
  await check('TV에서 해님이 가장 큰 막대(lead)', () => tv.locator('.opt.lead[data-opt="sunny"]').waitFor({ timeout: T }));
  await check('강사 폰 합계 6명', () => hasText(phone.locator('.trow'), '6'));
  await phone.click('[data-tally="rainy"][data-delta="-1"]');
  await phone.click('[data-tally="rainy"][data-delta="-1"]');
  await check('빼기는 0 아래로 안 내려간다', () => hasText(tv.locator('[data-opt="rainy"] .count'), '0'));
  await plus('rainy', 1);
  await tv.screenshot({ path: path.join(SHOTS, 'tv-2-choice.png') });
  await phone.screenshot({ path: path.join(SHOTS, 'phone-2-choice.png') });

  log('\n[5] 끊김 복구: TV를 새로고침해도 같은 장면과 숫자로 돌아온다');
  await tv.reload();
  await check('새로고침 후 TV가 선택 장면을 복구', () => hasText(tv.locator('.scene h1'), '어떤 날씨'));
  await check('새로고침 후 숫자 유지(해님 3)', () => hasText(tv.locator('[data-opt="sunny"] .count'), '3'));

  log('\n[6] 일시정지: TV가 가려지고 다시 열린다');
  await phone.click('[data-act="pause"]');
  await check('TV에 쉬는 시간 덮개', () => hasText(tv.locator('.pause'), '잠깐 쉬어요'));
  await phone.click('[data-act="pause"]');
  await check('덮개가 사라진다', () => tv.locator('.pause').waitFor({ state: 'detached', timeout: T }));

  log('\n[7] 확정: 캐릭터가 반 전체 숫자로 반응한다');
  await phone.click('[data-act="confirm"]');
  await check('TV 자막에 "해님 3명, 구름 2명, 비 1명"', () => hasText(tv.locator('[data-caption]'), '해님 3명, 구름 2명, 비 1명'));
  await check('비 친구들에게 한마디', () => hasText(tv.locator('[data-caption]'), '비 친구들'));
  await check('캐릭터 기분이 happy', () => tv.locator('.chr[data-mood="happy"]').waitFor({ timeout: T }));

  log('\n[8] 몸놀이 타이머');
  await phone.click('[data-act="next"]');
  await check('TV 몸놀이 장면', () => hasText(tv.locator('.scene h1'), '몸으로 날씨'));
  await phone.click('[data-act="timer"]');
  await check('TV 타이머가 돈다', async () => {
    await tv.waitForFunction(() => { const n = Number(document.querySelector('[data-tleft]')?.textContent); return n > 0 && n <= 60; }, null, { timeout: T });
  });
  await check('강사 폰에도 남은 초', async () => {
    await phone.waitForFunction(() => { const n = Number(document.querySelector('[data-timer]')?.textContent); return n > 0 && n <= 60; }, null, { timeout: T });
  });
  await tv.screenshot({ path: path.join(SHOTS, 'tv-3-activity.png') });

  log('\n[9] 숫자로 만든 오늘 이야기');
  await phone.click('[data-act="next"]');
  await check('TV 이야기에 오늘 숫자', () => hasText(tv.locator('.story p'), '해님 3명, 구름 2명, 비 1명'));
  await check('최다 날씨 문장', () => hasText(tv.locator('.story p'), '해님이 제일 많았지요'));
  await check('강사 폰 미리보기도 같은 문장', () => hasText(phone.locator('.preview'), '해님이 제일 많았지요'));
  await tv.screenshot({ path: path.join(SHOTS, 'tv-4-story.png') });

  log('\n[10] 반 메모와 마무리');
  await phone.click('details.notes summary');
  await phone.fill('[data-note]', '비 카드가 나와서 몸놀이를 길게 했다');
  await phone.click('[data-act="note"]');
  await check('메모가 저장된다', () => hasText(phone.locator('details.notes li'), '몸놀이를 길게'));
  await phone.click('[data-act="next"]');
  await check('TV 마무리 장면에 칩 4개', async () => { await hasText(tv.locator('.closing h1'), '고마워'); if ((await tv.locator('.closing .chip').count()) !== 4) throw new Error('칩 수'); });
  await check('강사 폰 버튼이 "수업 마치기"', () => hasText(phone.locator('[data-act="next"]'), '수업 마치기'));
  await phone.click('[data-act="next"]');
  await check('TV: 오늘 수업 끝', () => hasText(tv.locator('.scene h1'), '오늘 수업 끝'));
  await check('강사 폰: 보호자 링크', () => hasText(phone.locator('.card .h'), '보호자 페이지'));
  await tv.screenshot({ path: path.join(SHOTS, 'tv-5-done.png') });
  await phone.screenshot({ path: path.join(SHOTS, 'phone-3-done.png') });

  log('\n[11] 보호자 페이지');
  const parent = await ctx.newPage(); watch(parent, '보호자');
  await parent.setViewportSize({ width: 390, height: 844 });
  await parent.goto(`${base}/#parent-DEMO`);
  await check('오늘 이야기', () => hasText(parent.locator('.story'), '해님 3명, 구름 2명, 비 1명'));
  await check('집에서 이어갈 질문 3개', async () => { await parent.locator('.tips li').first().waitFor({ timeout: T }); if ((await parent.locator('.tips li').count()) !== 3) throw new Error('질문 수'); });
  await check('반 전체 막대', async () => { if ((await parent.locator('.summary-bars .r').count()) !== 4) throw new Error('막대 수'); });
  await parent.screenshot({ path: path.join(SHOTS, 'parent.png'), fullPage: true });

  log('\n[12] 수업 중인 보호자 페이지는 기다리라고 말하고, 끝나면 저절로 바뀐다');
  await phone.click('[data-act="reset"]');
  await check('초기화 후 TV는 대기 화면', () => hasText(tv.locator('.bigcode'), 'DEMO'));
  await check('보호자 페이지는 진행 중 안내', () => hasText(parent.locator('h2'), '진행 중'));

  log('\n[13] 홈 화면 입구');
  const home = await ctx.newPage(); watch(home, '홈');
  await home.setViewportSize({ width: 390, height: 844 });
  await home.goto(`${base}/#`);
  await check('홈에 세 입구', async () => { await hasText(home.locator('.card h2'), '교실 TV'); await hasText(home.locator('.card h2'), '강사 폰'); await hasText(home.locator('.card h2'), '보호자 페이지'); });
  await home.fill('form[data-role="teacher"] input', 'demo');
  await home.click('form[data-role="teacher"] button[type="submit"]');
  await check('소문자 코드도 대문자로 정리되어 리모컨이 열린다', () => hasText(home.locator('.tcode'), 'DEMO'));
  await home.screenshot({ path: path.join(SHOTS, 'home.png'), fullPage: true });
} finally {
  await browser.close();
  await srv.close();
}

const realErrors = pageErrors.filter((e) => !/favicon|ERR_FAILED.*fonts|net::ERR/.test(e));
if (realErrors.length) { failures++; log('\n페이지 오류:'); for (const e of realErrors) log('  ', e); }
log(`\n${failures ? `실패 ${failures}건` : '모두 통과'} · 스크린샷 ${SHOTS}`);
process.exit(failures ? 1 : 0);
