// 플레이그라운드 시나리오: #demo 한 탭에 교실 TV와 강사 폰이 같은 코드로 뜨고, 유령 선생님이 수업 한 회기를 혼자 진행한다.
//   #demo-ko 자동 진행(집계 → 끝) → 보호자 페이지 새 탭 → 새 코드로 다시 보기 → #demo-en 넘겨받기(사람의 탭이 유령을 멈춤)
//   → #demo-en-mind-weather 영어 팩 + KO/EN 알약 → 폰 너비(390)에서 가로 스크롤 없음.
// 유령 선생님의 대기 시간은 window.EMOREN_DEMO_SPEED = 8 로 8배 빠르게 돌린다.
export default async function demo(h) {
  const ctx = await h.newContext({ locale: 'ko-KR' });
  await ctx.addInitScript(() => { window.EMOREN_DEMO_SPEED = 8; });

  h.log('\n[D1] #demo-ko: 교실 TV와 강사 폰이 한 화면에, 같은 코드로');
  const page = await h.newPage(ctx, 'demo-ko');
  await page.goto(`${h.base}/#demo-ko`);
  await h.check('TV 무대와 폰의 수업 시작 버튼이 함께 보인다', async () => {
    await page.locator('.demo-tv .stage').waitFor({ state: 'visible', timeout: h.T });
    await page.locator('.demo-phone [data-act="start"]').waitFor({ state: 'visible', timeout: h.T });
  });
  let code = '';
  await h.check('TV의 큰 코드 = window.emorenDemo.code = 폰의 코드', async () => {
    await page.waitForFunction(() => window.emorenDemo && /^[A-Z0-9]{4}$/.test(window.emorenDemo.code), null, { timeout: h.T });
    code = await page.evaluate(() => window.emorenDemo.code);
    await h.hasText(page.locator('.demo-tv .bigcode'), code);
    await h.hasText(page.locator('.demo-phone .tcode'), code);
  });
  await h.check('TV 대기 화면에 한국어 수업 제목', () => h.hasText(page.locator('.demo-tv .wait h1'), '오늘의 마음 날씨'));
  await h.check('상태 줄은 준비 상태, 보호자·다시 보기 버튼은 아직 없다', async () => {
    await h.hasText(page.locator('[data-ghost-status]'), '준비');
    if (await page.locator('[data-demo="family"]').isVisible()) throw new Error('family button visible too early');
  });
  await h.check('문서 제목과 <html lang>', async () => {
    const r = await page.evaluate(() => [document.title, document.documentElement.lang, document.body.dataset.view]);
    if (!/플레이그라운드/.test(r[0]) || r[1] !== 'ko' || r[2] !== 'demo') throw new Error(JSON.stringify(r));
  });

  h.log('\n[D2] 유령 선생님이 수업 한 회기를 혼자 진행한다');
  await page.click('[data-ghost="run"]');
  await h.check('상태 줄: 진행 중, "직접 하기" 버튼이 보인다', async () => {
    await h.hasText(page.locator('[data-ghost-status]'), '진행 중');
    await page.locator('[data-ghost="stop"]').waitFor({ state: 'visible', timeout: h.T });
  });
  await h.check('TV 집계가 해님 3 · 구름 2 · 비 1로 자란다', async () => {
    await page.waitForFunction(() => {
      const n = (id) => document.querySelector(`.demo-tv [data-opt="${id}"] .count`)?.textContent;
      return n('sunny') === '3' && n('cloudy') === '2' && n('rainy') === '1';
    }, null, { timeout: 30000 });
  });
  await h.shot(page, 'demo-ko.png');
  await h.check('TV가 "오늘 수업 끝" 장면까지 혼자 간다(60초 안에)', () => h.hasText(page.locator('.demo-tv .closing h1'), '오늘 수업 끝', 60000));
  await h.check('상태 줄: 끝났어요 + 보호자 페이지·다시 보기 버튼, 유령은 멈춘 상태', async () => {
    await h.hasText(page.locator('[data-ghost-status]'), '끝났어요');
    await page.locator('[data-demo="family"]').waitFor({ state: 'visible', timeout: h.T });
    await page.locator('[data-demo="replay"]').waitFor({ state: 'visible', timeout: h.T });
    if (await page.evaluate(() => window.emorenDemo.ghost.running)) throw new Error('ghost still running');
    if (await page.locator('[data-ghost="run"]').isVisible()) throw new Error('run button should hide after done');
  });
  await h.check('강사 폰도 수업 끝 화면', () => h.hasText(page.locator('.demo-phone .card h2'), '수업 끝'));
  await h.shot(page, 'demo-ko-done.png');

  h.log('\n[D3] 보호자 페이지는 새 탭으로 열린다');
  await h.check('새 탭 #parent-코드에 오늘 이야기(해님 3명, 구름 2명, 비 1명)', async () => {
    const [pop] = await Promise.all([ctx.waitForEvent('page', { timeout: h.T }), page.click('[data-demo="family"]')]);
    h.watch(pop, 'demo-family');
    await pop.waitForFunction((c) => location.hash === `#parent-${c}`, code, { timeout: h.T });
    await h.hasText(pop.locator('.story'), '해님 3명, 구름 2명, 비 1명');
    await pop.close();
  });

  h.log('\n[D4] 새 코드로 다시 보기');
  await h.check('다시 보기: 새 코드로 대기 화면, 유령 버튼이 돌아온다', async () => {
    await page.click('[data-demo="replay"]');
    await page.waitForFunction((b) => window.emorenDemo && window.emorenDemo.code !== b, code, { timeout: h.T });
    const next = await page.evaluate(() => window.emorenDemo.code);
    await h.hasText(page.locator('.demo-tv .bigcode'), next);
    await page.locator('.demo-phone [data-act="start"]').waitFor({ state: 'visible', timeout: h.T });
    await page.locator('[data-ghost="run"]').waitFor({ state: 'visible', timeout: h.T });
    if (await page.locator('[data-demo="family"]').isVisible()) throw new Error('family button should hide on a fresh room');
    if ((await page.locator('.demo-tv .stage').count()) !== 1 || (await page.locator('.demo-phone .teacher').count()) !== 1) throw new Error('old views not torn down');
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  await h.shot(page, 'demo-ko-dark.png');

  h.log('\n[D5] 넘겨받기: 사람이 폰을 누르면 유령 선생님이 멈춘다');
  const en = await h.newPage(ctx, 'demo-en');
  await en.goto(`${h.base}/#demo-en`);
  await en.locator('.demo-phone [data-act="start"]').waitFor({ state: 'visible', timeout: h.T });
  await h.check('#demo-en: 테두리 글과 폰이 영어', async () => {
    await h.hasText(en.locator('[data-ghost="run"]'), 'ghost teacher');
    await h.hasText(en.locator('.demo-phone [data-act="start"]'), 'Start lesson');
    await h.hasText(en.locator('.demo-tv .wait h1'), 'Mood Weather');
  });
  await en.click('[data-ghost="run"]');
  await h.hasText(en.locator('[data-ghost-status]'), 'running');
  await en.waitForTimeout(800);
  await en.click('.demo-phone [data-act="pause"]', { timeout: h.T });   // 사람의 실제 탭(isTrusted)
  await h.check('상태 줄: stopped, 유령은 멈춤', async () => {
    await h.hasText(en.locator('[data-ghost-status]'), 'stopped');
    if (await en.evaluate(() => window.emorenDemo.ghost.running)) throw new Error('ghost still running');
  });
  await h.check('TV는 쉬는 시간 덮개, 2초 뒤에도 같은 단계 그대로(유령이 더 진행하지 않는다)', async () => {
    await h.hasText(en.locator('.demo-tv .pause'), 'Break time');
    const step = await en.locator('.demo-phone .stepnav b').textContent();
    await en.waitForTimeout(2000);
    await en.locator('.demo-tv .pause').waitFor({ state: 'visible', timeout: 1000 });
    const step2 = await en.locator('.demo-phone .stepnav b').textContent();
    if (step !== step2) throw new Error(`${step} → ${step2}`);
  });
  await h.check('다시 맡기면 "계속"을 누르고 그 단계부터 이어간다', async () => {
    await en.click('[data-ghost="run"]');
    await h.hasText(en.locator('[data-ghost-status]'), 'running');
    await en.locator('.demo-tv .pause').waitFor({ state: 'detached', timeout: h.T });
  });
  await h.check('"직접 하기" 버튼으로도 멈춘다', async () => {
    await en.click('[data-ghost="stop"]');
    await h.hasText(en.locator('[data-ghost-status]'), 'stopped');
    if (await en.evaluate(() => window.emorenDemo.ghost.running)) throw new Error('ghost still running');
  });

  h.log('\n[D6] #demo-en-mind-weather: 영어 팩을 고른 주소, 알약과 팩 선택');
  const picked = await h.newPage(ctx, 'demo-en-pack');
  await picked.goto(`${h.base}/#demo-en-mind-weather`);
  await h.check('TV 대기 화면에 Mood Weather', () => h.hasText(picked.locator('.demo-tv .wait h1'), 'Mood Weather'));
  await h.check('EN 알약이 눌림, 팩 선택은 mind-weather', async () => {
    await picked.locator('.demo-bar [data-lang="en"][aria-pressed="true"]').waitFor({ timeout: h.T });
    const v = await picked.locator('select[data-pack]').inputValue();
    if (v !== 'mind-weather') throw new Error(v);
  });
  await h.check('KO 알약 → #demo-ko-mind-weather, 한국어 팩으로 새 방', async () => {
    await picked.click('.demo-bar [data-lang="ko"]');
    await picked.waitForFunction(() => location.hash === '#demo-ko-mind-weather', null, { timeout: h.T });
    await h.hasText(picked.locator('.demo-tv .wait h1'), '오늘의 마음 날씨');
    await h.hasText(picked.locator('[data-ghost="run"]'), '유령 선생님');
  });
  await h.check('기기 언어 저장값은 건드리지 않는다', async () => {
    const v = await picked.evaluate(() => localStorage.getItem('emoren.lang'));
    if (v !== null) throw new Error(String(v));
  });

  h.log('\n[D7] 폰 너비(390)에서는 TV 위, 폰 아래로 쌓이고 가로 스크롤이 없다');
  const narrow = await h.newPage(ctx, 'demo-narrow', { phone: true });
  await narrow.goto(`${h.base}/#demo-ko`);
  await narrow.locator('.demo-phone [data-act="start"]').waitFor({ state: 'visible', timeout: h.T });
  await h.check('document.documentElement.scrollWidth <= 390', async () => {
    const w = await narrow.evaluate(() => document.documentElement.scrollWidth);
    if (w > 390) throw new Error(String(w));
  });
  await h.check('TV가 폰 위에 온다', async () => {
    const [tv, ph] = await narrow.evaluate(() => [document.querySelector('.demo-tv').getBoundingClientRect().top, document.querySelector('.demo-phone').getBoundingClientRect().top]);
    if (!(tv < ph)) throw new Error(`${tv} / ${ph}`);
  });
  await h.shot(narrow, 'demo-ko-phone.png', { fullPage: true });
}
