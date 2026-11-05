// README 스크린샷·GIF 생성기(Playwright). 손으로 찍지 않는다. 실행: npm run shots  → docs/shots/
// Generates every image the READMEs reference, from the #demo playground and the real screens, for ko and en.
//   docs/shots/demo-<lang>.gif          유령 선생님이 수업 한 회기를 진행하는 플레이그라운드(프레임 → ffmpeg)
//   docs/shots/demo-<lang>.png          플레이그라운드 한 장(선택 단계)
//   docs/shots/tv-waiting-<lang>.png    TV 대기 화면(코드 + QR)
//   docs/shots/tv-choice-<lang>.png     TV 선택 장면(막대가 자란 뒤)
//   docs/shots/tv-story-<lang>.png      TV 오늘 이야기
//   docs/shots/tv-book-<lang>.png       TV 「오늘 우리 반 책」 선택 쪽(스탬프)
//   docs/shots/phone-choice-<lang>.png  강사 폰 선택 단계
//   docs/shots/parent-<lang>.png        보호자 페이지(책 포함)
// 환경: SHOTS_LANGS=en,ko  SHOTS_OUT=docs/shots  SHOTS_GIF=0(GIF 생략)  ffmpeg가 없으면 GIF만 건너뛴다.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = path.resolve(ROOT, process.env.SHOTS_OUT || 'docs/shots');
const LANGS = (process.env.SHOTS_LANGS || 'en,ko').split(',').map((s) => s.trim()).filter(Boolean);
const WANT_GIF = process.env.SHOTS_GIF !== '0';
fs.mkdirSync(OUT, { recursive: true });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const hasFfmpeg = () => spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;

const srv = await startServer(ROOT, 0);
const browser = await chromium.launch();
const made = [];
async function shot(page, name, opts = {}) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, ...opts });
  made.push(name);
  console.log('  ✓', name);
}

try {
  for (const lang of LANGS) {
    console.log(`\n[${lang}]`);
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, locale: lang === 'ko' ? 'ko-KR' : 'en-US' });
    await ctx.addInitScript((l) => { try { localStorage.setItem('emoren.lang', l); localStorage.setItem('emoren.pack', 'mind-weather'); localStorage.setItem('emoren.packLang', l); } catch {} }, lang);
    const code = `SHOT${lang === 'ko' ? 'K' : 'E'}`;

    // ---- 실제 세 화면 / the real screens
    const tv = await ctx.newPage();
    await tv.goto(`${srv.url}/#tv-${code}`);
    const phone = await ctx.newPage();
    await phone.setViewportSize({ width: 390, height: 844 });
    await phone.goto(`${srv.url}/#teacher-${code}`);
    await phone.locator('[data-act="start"]').waitFor();
    await tv.locator('.wait .bigcode').waitFor();
    await tv.locator('[data-qr] svg').waitFor().catch(() => {});
    await wait(600);
    await shot(tv, `tv-waiting-${lang}.png`);

    await phone.click('[data-act="start"]');
    await phone.click('[data-act="next"]');
    await tv.locator('.opt').first().waitFor();
    const plus = async (id, n) => { for (let i = 0; i < n; i++) await phone.click(`[data-tally="${id}"][data-delta="1"]`); };
    await plus('sunny', 5); await plus('cloudy', 3); await plus('rainy', 2); await plus('stormy', 1);
    await wait(700);
    await shot(tv, `tv-choice-${lang}.png`);
    const phone2x = await ctx.newPage();
    await phone2x.setViewportSize({ width: 390, height: 844 });
    await phone2x.emulateMedia({ colorScheme: 'light' });
    await phone2x.goto(`${srv.url}/#teacher-${code}`);
    await phone2x.locator('[data-tally]').first().waitFor();
    await wait(300);
    await phone2x.screenshot({ path: path.join(OUT, `phone-choice-${lang}.png`) });
    made.push(`phone-choice-${lang}.png`); console.log('  ✓', `phone-choice-${lang}.png`);
    await phone2x.close();

    await phone.click('[data-act="confirm"]');
    await wait(400);
    await phone.click('[data-act="next"]'); // activity
    await phone.click('[data-act="next"]'); // story
    await tv.locator('.story p').waitFor();
    await wait(500);
    await shot(tv, `tv-story-${lang}.png`);
    await phone.click('[data-act="next"]'); // book
    await tv.locator('.book .page').waitFor();
    await phone.locator('[data-act="book-next"]').waitFor();
    await phone.click('[data-act="book-next"]'); // choice page with stamps
    await tv.locator('.book .page.choice').waitFor();
    await wait(500);
    await shot(tv, `tv-book-${lang}.png`);
    await phone.click('[data-act="next"]'); // closing
    await phone.click('[data-act="next"]'); // done
    await tv.locator('.closing .sub').waitFor(); // done 장면만(.closing은 마무리 단계에도 있다)

    const parent = await ctx.newPage();
    await parent.setViewportSize({ width: 390, height: 844 });
    await parent.goto(`${srv.url}/#parent-${code}`);
    await parent.locator('p.story').waitFor();
    await wait(400);
    await shot(parent, `parent-${lang}.png`, { fullPage: true });
    await parent.close(); await phone.close(); await tv.close();

    // ---- 플레이그라운드 + GIF / playground + gif frames
    const demoCtx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, locale: lang === 'ko' ? 'ko-KR' : 'en-US' });
    await demoCtx.addInitScript((l) => { try { localStorage.setItem('emoren.lang', l); } catch {} window.EMOREN_DEMO_SPEED = 3; }, lang);
    const demo = await demoCtx.newPage();
    await demo.goto(`${srv.url}/#demo-${lang}`);
    await demo.locator('[data-ghost="run"]').waitFor();
    await demo.locator('.demo-phone [data-act="start"]').waitFor();
    await wait(800);
    const frames = fs.mkdtempSync(path.join(os.tmpdir(), 'emoren-gif-'));
    let i = 0;
    const grab = async () => { await demo.screenshot({ path: path.join(frames, `f-${String(i++).padStart(3, '0')}.png`) }).catch(() => {}); };
    await grab();
    await demo.click('[data-ghost="run"]');
    let choiceShot = false;
    const t0 = Date.now();
    while (Date.now() - t0 < 90000) {
      await grab();
      if (!choiceShot && (await demo.locator('.demo-tv .opt.lead').count()) > 0) { await wait(300); await shot(demo, `demo-${lang}.png`); choiceShot = true; }
      if ((await demo.locator('.demo-tv .closing h1').count()) > 0 && (await demo.locator('[data-demo="family"]').count()) > 0) break;
      await wait(400);
    }
    for (let k = 0; k < 6; k++) { await wait(400); await grab(); }
    if (!choiceShot) await shot(demo, `demo-${lang}.png`);
    if (WANT_GIF && hasFfmpeg()) {
      const gif = path.join(OUT, `demo-${lang}.gif`);
      const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '2.5', '-i', path.join(frames, 'f-%03d.png'),
        '-vf', 'fps=2.5,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=96[p];[s1][p]paletteuse=dither=bayer:bayer_scale=4', gif], { stdio: 'inherit' });
      if (r.status === 0) { made.push(`demo-${lang}.gif`); console.log('  ✓', `demo-${lang}.gif`, `(${Math.round(fs.statSync(gif).size / 1024)} KB, ${i} frames)`); }
      else console.warn('  ✗ ffmpeg failed for', gif);
    } else if (WANT_GIF) console.warn('  · ffmpeg not found: skipping GIF');
    fs.rmSync(frames, { recursive: true, force: true });
    await demoCtx.close();
    await ctx.close();
  }
} finally {
  await browser.close();
  await srv.close();
}
console.log(`\n${made.length} files → ${OUT}`);
