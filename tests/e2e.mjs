// 두 화면 시나리오 테스트(Playwright). 실행: npm run e2e
// 한 브라우저 안에서 교실 TV 탭과 강사 폰 탭을 열어 '같은 브라우저 동기화'로 수업 한 회기를 끝까지 돌린다.
//   시작 → 집계 → TV 새로고침 복구 → 일시정지 → 확정 → 타이머 → 이야기 → 마무리 → 끝 → 보호자 페이지
// 그 다음 홈의 KO/EN 토글, 그리고 영어(emoren.lang=en) 컨텍스트에서 영어 수업 한 회기(코드 ENGL)를 돈다.
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

  log('\n[14] 홈의 언어 토글: EN을 누르면 바로 영어로 바뀌고, KO를 누르면 돌아온다');
  await home.goto(`${base}/#`);
  await hasText(home.locator('.logo'), '이모렌 교실');
  await check('KO 알약이 눌린 상태', () => home.locator('.langs [data-lang="ko"][aria-pressed="true"]').waitFor({ timeout: T }));
  await home.click('.langs [data-lang="en"]');
  await check('EN을 누르면 로고·카드 제목이 영어', async () => { await hasText(home.locator('.logo'), 'Emoren Classroom'); await hasText(home.locator('.card h2'), 'Classroom TV'); await hasText(home.locator('.card h2'), 'Teacher phone'); await hasText(home.locator('.card h2'), 'Family page'); });
  await check('<html lang>과 저장값이 en', async () => {
    const r = await home.evaluate(() => [document.documentElement.lang, localStorage.getItem('emoren.lang'), document.title]);
    if (r[0] !== 'en' || r[1] !== 'en' || r[2] !== 'Emoren Classroom') throw new Error(JSON.stringify(r));
  });
  await check('수업팩 목록이 영어 제목', () => hasText(home.locator('.how li'), 'Mood Weather'));
  await check('수업팩·언어 선택이 English 기본값', async () => {
    const v = await home.locator('select[data-pack]').inputValue();
    if (v !== 'mind-weather|en') throw new Error(v);
  });
  await home.screenshot({ path: path.join(SHOTS, 'home-en.png'), fullPage: true });
  await home.click('.langs [data-lang="ko"]');
  await check('KO를 누르면 한국어로 돌아온다', () => hasText(home.locator('.logo'), '이모렌 교실'));
  await check('강사 폰(DEMO)은 수업이 한국어라 TV는 한국어 그대로', () => hasText(tv.locator('.wait .sub'), '소리 켜기'));
} finally {
  await browser.close();
  await srv.close();
}

// ---------- 영어 시나리오: 기기 언어가 en인 새 브라우저 컨텍스트 ----------
{
  const browser2 = await chromium.launch();
  const srv2 = await startServer(ROOT, 0);
  const base2 = srv2.url;
  const en = await browser2.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: SCALE, locale: 'en-US' });
  await en.addInitScript(() => { try { localStorage.setItem('emoren.lang', 'en'); } catch {} });
  try {
    log('\n[E1] 영어 홈: 저장된 emoren.lang=en 으로 뜬다');
    const home = await en.newPage(); watch(home, 'home-en');
    await home.setViewportSize({ width: 390, height: 844 });
    await home.goto(`${base2}/#`);
    await check('홈 로고·안내가 영어', async () => { await hasText(home.locator('.logo'), 'Emoren Classroom'); await hasText(home.locator('.brand .tag'), 'One teacher phone'); await hasText(home.locator('.card h2'), 'Teacher phone'); });
    await check('EN 알약이 눌린 상태', () => home.locator('.langs [data-lang="en"][aria-pressed="true"]').waitFor({ timeout: T }));
    await check('바닥글이 영어', () => hasText(home.locator('.foot'), 'No child'));

    log('\n[E2] 교실 TV(ENGL)와 강사 폰: 영어 팩으로 방이 만들어진다');
    const tv = await en.newPage(); watch(tv, 'TV-en');
    await tv.goto(`${base2}/#tv-ENGL`);
    await check('TV 대기 화면 안내가 영어', async () => { await hasText(tv.locator('.bigcode'), 'ENGL'); await hasText(tv.locator('.wait .sub'), 'Turn on sound'); await hasText(tv.locator('[data-unlock]'), 'Turn on sound'); });
    const phone = await en.newPage(); watch(phone, 'phone-en');
    await phone.setViewportSize({ width: 390, height: 844 });
    await phone.goto(`${base2}/#teacher-ENGL`);
    await check('강사 폰이 영어(Mood Weather, Start lesson)', async () => { await hasText(phone.locator('.panel h2'), 'Mood Weather'); await hasText(phone.locator('[data-act="start"]'), 'Start lesson'); await hasText(phone.locator('.tsync'), 'Same-browser sync'); await hasText(phone.locator('.tcode'), 'Lesson code ENGL'); });
    await check('방 상태에 lang=en', async () => {
      const lang = await phone.evaluate(() => { const k = Object.keys(localStorage).find((x) => /ENGL/.test(x)); return k && JSON.parse(localStorage.getItem(k)).lang; });
      if (lang !== 'en') throw new Error(String(lang));
    });
    await check('TV 대기 화면이 영어 제목을 받는다', () => hasText(tv.locator('.wait h1'), 'Mood Weather'));
    await phone.screenshot({ path: path.join(SHOTS, 'phone-en-waiting.png') });

    log('\n[E3] 수업 시작: 영어 인사');
    await phone.click('[data-act="start"]');
    await check('TV 인사 장면', () => hasText(tv.locator('.scene h1'), 'Feelings have weather too'));
    await check("TV 자막 'Hello, friends!'", () => hasText(tv.locator('[data-caption]'), 'Hello, friends'));
    await check('강사 폰 1/5, 선생님 할 일이 영어', async () => { await hasText(phone.locator('.stepnav'), '1/5'); await hasText(phone.locator('.cue .eyebrow'), "Teacher's cue"); await hasText(phone.locator('[data-act="next"]'), 'Next'); });
    await tv.screenshot({ path: path.join(SHOTS, 'tv-en-hello.png') });

    log('\n[E4] 선택·확정: 영어 목록 "3 Sunny, 2 Cloudy, 1 Rainy"');
    await phone.click('[data-act="next"]');
    await check('TV 질문과 선택지 Sunny/Cloudy/Rainy/Stormy', async () => {
      await hasText(tv.locator('.scene h1'), 'mood weather');
      const labels = await tv.locator('.opt .label').allTextContents();
      if (labels.join(',') !== 'Sunny,Cloudy,Rainy,Stormy') throw new Error(labels.join(','));
    });
    const plus = async (id, n) => { for (let i = 0; i < n; i++) await phone.click(`[data-tally="${id}"][data-delta="1"]`); };
    await plus('sunny', 3); await plus('cloudy', 2); await plus('rainy', 1);
    await check('강사 폰 합계 "6 in all"', () => hasText(phone.locator('.trow'), '6 in all'));
    await phone.click('[data-act="confirm"]');
    await check('TV 자막에 "3 Sunny, 2 Cloudy, 1 Rainy"', () => hasText(tv.locator('[data-caption]'), '3 Sunny, 2 Cloudy, 1 Rainy'));
    await check('Rainy friends 한마디', () => hasText(tv.locator('[data-caption]'), 'Rainy friends'));
    await tv.screenshot({ path: path.join(SHOTS, 'tv-en-choice.png') });

    log('\n[E5] 몸놀이 → 이야기 → 마무리 → 끝');
    await phone.click('[data-act="next"]');
    await check('TV 몸놀이 장면과 타이머 버튼', async () => { await hasText(tv.locator('.scene h1'), 'bodies'); await hasText(phone.locator('[data-act="timer"]'), 'Start timer'); });
    await phone.click('[data-act="next"]');
    await check('TV 이야기: 오늘 숫자', () => hasText(tv.locator('.story p'), 'Today the sky over our class had 3 Sunny, 2 Cloudy, 1 Rainy'));
    await check('최다 날씨 문장', () => hasText(tv.locator('.story p'), 'Sunny was the biggest of all'));
    await check('강사 폰 미리보기도 같은 문장', () => hasText(phone.locator('.preview'), 'Sunny was the biggest of all'));
    await tv.screenshot({ path: path.join(SHOTS, 'tv-en-story.png') });
    await phone.click('[data-act="next"]');
    await check('강사 폰 버튼이 "Finish lesson"', () => hasText(phone.locator('[data-act="next"]'), 'Finish lesson'));
    await phone.click('[data-act="next"]');
    await check("TV: That's all for today!", () => hasText(tv.locator('.scene h1'), "That's all for today"));
    await check('강사 폰: Family page', () => hasText(phone.locator('.card .h'), 'Family page'));

    log('\n[E6] 영어 보호자 페이지');
    const parent = await en.newPage(); watch(parent, 'parent-en');
    await parent.setViewportSize({ width: 390, height: 844 });
    await parent.goto(`${base2}/#parent-ENGL`);
    await check('제목·날짜·인원이 영어', async () => {
      await hasText(parent.locator('h1'), 'Our class today: "Mood Weather"');
      await hasText(parent.locator('.asof'), '6 children joined');
      const asof = await parent.locator('.asof').textContent();
      if (!/^[A-Z][a-z]+ \d{1,2}, \d{4}/.test(asof.trim())) throw new Error(asof);
    });
    await check('오늘 이야기', () => hasText(parent.locator('.story'), '3 Sunny, 2 Cloudy, 1 Rainy'));
    await check('집에서 이어가기 3개', async () => { await hasText(parent.locator('.card .h'), 'Keep it going at home'); if ((await parent.locator('.tips li').count()) !== 3) throw new Error('tips'); });
    await check('문서 title과 <html lang>', async () => {
      const r = await parent.evaluate(() => [document.title, document.documentElement.lang]);
      if (r[0] !== 'Our Class Today' || r[1] !== 'en') throw new Error(JSON.stringify(r));
    });
    await parent.screenshot({ path: path.join(SHOTS, 'parent-en.png'), fullPage: true });

    log('\n[E7] 수업 언어와 기기 언어가 다를 때: 한국어 팩을 고르면 TV와 보호자 페이지는 한국어를 따른다');
    await phone.click('[data-act="reset"]');
    await hasText(tv.locator('.wait .sub'), 'Turn on sound');
    await home.evaluate(() => { localStorage.setItem('emoren.pack', 'mind-weather'); localStorage.setItem('emoren.packLang', 'ko'); });
    const tv2 = await en.newPage(); watch(tv2, 'TV-ko-in-en');
    await tv2.goto(`${base2}/#tv-KOEN`);
    await hasText(tv2.locator('.wait .sub'), 'Turn on sound');
    const phone2 = await en.newPage(); watch(phone2, 'phone-ko-in-en');
    await phone2.setViewportSize({ width: 390, height: 844 });
    await phone2.goto(`${base2}/#teacher-KOEN`);
    await check('강사 폰 화면은 기기 언어(영어)로, 수업은 한국어 팩', async () => { await hasText(phone2.locator('[data-act="start"]'), 'Start lesson'); await hasText(phone2.locator('.panel h2'), '오늘의 마음 날씨'); });
    await check('TV 화면 안내가 한국어로 바뀐다', async () => { await hasText(tv2.locator('.wait h1'), '오늘의 마음 날씨'); await hasText(tv2.locator('.wait .sub'), '소리 켜기'); });
    await check('기기 언어 저장값은 그대로 en', async () => {
      const v = await tv2.evaluate(() => localStorage.getItem('emoren.lang'));
      if (v !== 'en') throw new Error(String(v));
    });
  } finally {
    await browser2.close();
    await srv2.close();
  }
}

const realErrors = pageErrors.filter((e) => !/favicon|ERR_FAILED.*fonts|net::ERR/.test(e));
if (realErrors.length) { failures++; log('\n페이지 오류:'); for (const e of realErrors) log('  ', e); }
log(`\n${failures ? `실패 ${failures}건` : '모두 통과'} · 스크린샷 ${SHOTS}`);
process.exit(failures ? 1 : 0);
