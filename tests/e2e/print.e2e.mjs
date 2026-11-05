// 인쇄 시나리오: 코드 PRNT로 강사 폰만 써서 수업 한 회기를 빠르게 끝내고(시작 → 집계 → 확정 → 다음… → 마치기),
// 보호자 페이지의 '인쇄하기' 버튼과 인쇄용 스타일(print 매체: 버튼·바닥글 숨김, 흰 배경, 검정 글자, 막대 색 유지)을 확인한다.
// Print scenario: finish a quick lesson on code PRNT with the teacher phone alone, open the family page,
// check the print button, then emulate print media (button hidden, white body) and take a full-page shot.
export default async function printPage(h) {
  const ctx = await h.newContext({ locale: 'ko-KR' });
  h.log('\n[P1] 강사 폰만으로 수업 한 회기를 빠르게 끝낸다 (PRNT)');
  const phone = await h.newPage(ctx, '강사폰-print', { phone: true });
  await phone.goto(`${h.base}/#teacher-PRNT`);
  await phone.locator('[data-act="start"]').waitFor({ timeout: h.T });
  await phone.click('[data-act="start"]');
  await h.hasText(phone.locator('.stepnav'), '1/');
  await phone.click('[data-act="next"]');
  await phone.locator('[data-tally="sunny"][data-delta="1"]').waitFor({ timeout: h.T });
  for (let i = 0; i < 3; i++) await phone.click('[data-tally="sunny"][data-delta="1"]');
  await phone.click('[data-tally="cloudy"][data-delta="1"]');
  await h.hasText(phone.locator('.trow'), '4');
  await phone.click('[data-act="confirm"]');
  // 다음 단계로 끝까지: 마지막 단계의 버튼은 '수업 마치기' / press next until the last step's finish label
  for (let i = 0; i < 10; i++) {
    const next = phone.locator('[data-act="next"]');
    await next.waitFor({ timeout: h.T });
    const label = (await next.textContent()).trim();
    const nav = await phone.locator('.stepnav').textContent();
    await next.click();
    if (label === '수업 마치기') break;
    await phone.waitForFunction((prev) => document.querySelector('.stepnav')?.textContent !== prev, nav, { timeout: h.T });
  }
  await h.check('강사 폰이 끝 상태(보호자 페이지 링크)', () => h.hasText(phone.locator('.card .h'), '보호자 페이지'));

  h.log('\n[P2] 보호자 페이지에 인쇄 버튼');
  const parent = await h.newPage(ctx, '보호자-print', { phone: true });
  await parent.goto(`${h.base}/#parent-PRNT`);
  await h.check('오늘 이야기가 뜬다', () => h.hasText(parent.locator('.story'), '해님 3명'));
  const btn = parent.locator('button[data-print]');
  await h.check('인쇄 버튼이 날짜 줄 옆에 있고 보인다', async () => {
    await h.hasText(btn, '인쇄하기');
    if (!(await btn.isVisible())) throw new Error('hidden');
    if ((await parent.locator('.asof-row .asof').count()) !== 1) throw new Error('asof');
  });
  await h.check('버튼을 누르면 window.print()가 불린다', async () => {
    await parent.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
    await btn.click();
    const n = await parent.evaluate(() => window.__printed);
    if (n !== 1) throw new Error(String(n));
  });

  h.log('\n[P3] 인쇄 매체: 버튼·바닥글은 숨고 배경은 흰색');
  await parent.emulateMedia({ media: 'print' });
  await h.check('인쇄에서는 버튼이 숨는다', async () => { if (await btn.isVisible()) throw new Error('visible'); });
  await h.check('바닥글 링크도 숨는다', async () => { if (await parent.locator('.foot').isVisible()) throw new Error('visible'); });
  await h.check('본문 배경이 흰색, 글자는 검정', async () => {
    const r = await parent.evaluate(() => { const s = getComputedStyle(document.body); return [s.backgroundColor, s.color]; });
    if (r[0] !== 'rgb(255, 255, 255)' || r[1] !== 'rgb(0, 0, 0)') throw new Error(JSON.stringify(r));
  });
  await h.check('막대 색은 인쇄에서도 유지(print-color-adjust: exact)', async () => {
    const v = await parent.evaluate(() => { const s = getComputedStyle(document.querySelector('.summary-bars .track i')); return s.printColorAdjust || s.webkitPrintColorAdjust; });
    if (v !== 'exact') throw new Error(String(v));
  });
  await h.shot(parent, 'parent-print.png', { fullPage: true });
  await parent.emulateMedia({ media: null });
}
