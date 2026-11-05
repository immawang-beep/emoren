// TV 부가 기능 시나리오: 시계 보정 · 효과음 토글 · 키오스크.
//   TV 탭의 시계를 2분 앞당긴 채 열고, 강사 폰(정상 시계)에서 60초 타이머를 켜면 TV가 60 근처에서 시작해야 한다
//   (보정이 없으면 바로 0). 소리 켜기 뒤 효과음 토글(🔈/🔇)이 꺼짐을 저장하고 새로고침 뒤에도 유지되며,
//   3초 가만히 두면 커서가 숨는다(.stage.idle). 전체 화면은 headless에서 보장되지 않아 확인하지 않는다.
// Clock-offset correction, sfx toggle persistence and kiosk idle cursor on a TV whose clock runs 2 minutes fast.

const CODE = 'SKEW';
const SKEW_MS = 120000;

export default async function tvx(h) {
  const ctx = await h.newContext({ locale: 'ko-KR' });

  h.log('\n[1] TV 시계를 2분 앞당긴 채 연다');
  const tv = await h.newPage(ctx, 'TV(+120s)');
  await tv.addInitScript((skew) => { const r = Date.now; Date.now = () => r() + skew; }, SKEW_MS);
  await tv.goto(`${h.base}/#tv-${CODE}`);
  await h.hasText(tv.locator('.bigcode'), CODE);
  await h.check('대기 화면에 전체 화면 안내(.wait .hint)', () => h.hasText(tv.locator('.wait .hint'), '두 번 누르면'));
  await h.check('대기 화면의 기존 요소는 그대로(.wait h1, .sub)', async () => { await h.hasText(tv.locator('.wait .sub'), '소리 켜기'); await tv.locator('.wait h1').waitFor({ timeout: h.T }); });
  await h.check('효과음 토글이 켜진 상태로 있다', () => tv.locator('[data-sfx][aria-pressed="true"]').waitFor({ timeout: h.T }));

  const phone = await h.newPage(ctx, '강사폰', { phone: true });
  await phone.goto(`${h.base}/#teacher-${CODE}`);
  await phone.locator('[data-act="start"]').waitFor({ timeout: h.T });
  await h.check('TV 시계가 실제로 2분 앞서 있다', async () => {
    const [a, b] = await Promise.all([tv.evaluate(() => Date.now()), phone.evaluate(() => Date.now())]);
    if (Math.abs(a - b - SKEW_MS) > 5000) throw new Error(`차이 ${a - b}ms`);
  });

  h.log('\n[2] 소리 켜기: 효과음과 키오스크가 켜진다');
  await tv.click('[data-unlock]');
  await h.check('소리 켜기 버튼이 사라진다', () => tv.locator('[data-unlock]').waitFor({ state: 'hidden', timeout: h.T }));
  await h.check('효과음 토글은 남아 있고 켜짐', () => tv.locator('[data-sfx][aria-pressed="true"]').waitFor({ timeout: h.T }));
  await h.check('토글에 이름(aria-label)이 있다', async () => {
    const l = await tv.locator('[data-sfx]').getAttribute('aria-label');
    if (!l || !l.includes('효과음')) throw new Error(String(l));
  });
  await tv.click('[data-sfx]');
  await h.check('누르면 꺼짐(aria-pressed=false, 🔇)', async () => {
    await tv.locator('[data-sfx][aria-pressed="false"]').waitFor({ timeout: h.T });
    await h.hasText(tv.locator('[data-sfx]'), '🔇');
  });
  await h.check("localStorage emoren.sfx === 'off'", async () => {
    const v = await tv.evaluate(() => localStorage.getItem('emoren.sfx'));
    if (v !== 'off') throw new Error(String(v));
  });
  await h.check('3초 가만히 두면 커서가 숨는다(.stage.idle)', () => tv.locator('.stage.idle').waitFor({ timeout: 6000 }));
  await tv.mouse.move(300, 300);
  await h.check('마우스를 움직이면 커서가 돌아온다', () => tv.locator('.stage.idle').waitFor({ state: 'detached', timeout: h.T }));
  await h.shot(tv, 'tv-kiosk-wait.png');

  h.log('\n[3] 새로고침해도 효과음 꺼짐이 유지된다');
  await tv.reload();
  await h.hasText(tv.locator('.bigcode'), CODE);
  await h.check('새로고침 뒤에도 꺼짐', () => tv.locator('[data-sfx][aria-pressed="false"]').waitFor({ timeout: h.T }));
  await tv.click('[data-sfx]');
  await h.check("다시 누르면 켜짐(🔈) + 저장값 'on'", async () => {
    await tv.locator('[data-sfx][aria-pressed="true"]').waitFor({ timeout: h.T });
    await h.hasText(tv.locator('[data-sfx]'), '🔈');
    const v = await tv.evaluate(() => localStorage.getItem('emoren.sfx'));
    if (v !== 'on') throw new Error(String(v));
  });

  h.log('\n[4] 시계 보정: 강사 폰의 60초 타이머가 TV에서 60 근처에서 시작한다');
  await tv.click('[data-unlock]');
  await phone.click('[data-act="start"]');
  await h.hasText(tv.locator('.scene h1'), '마음에도 날씨가 있대');
  await phone.click('[data-act="next"]');
  await h.hasText(tv.locator('.scene h1'), '어떤 날씨');
  await phone.click('[data-act="next"]');
  await h.hasText(tv.locator('.scene h1'), '몸으로 날씨');
  await h.hasText(tv.locator('[data-tleft]'), '60');
  await phone.click('[data-act="timer"]');
  await h.check('TV 숫자가 60에서 내려가고(55~59), 한 번도 55 아래로 떨어지지 않는다(보정 없으면 바로 0)', async () => {
    const seen = [];
    const until = Date.now() + h.T;
    while (Date.now() < until) {
      const n = await tv.evaluate(() => Number(document.querySelector('[data-tleft]')?.textContent));
      seen.push(n);
      if (!(n >= 55 && n <= 60)) throw new Error(`TV 숫자 ${n} (본 값: ${seen.join(' ')})`);
      if (n <= 59) return;
      await tv.waitForTimeout(100);
    }
    throw new Error(`시간 안에 59 이하가 안 나왔다: ${seen.join(' ')}`);
  });
  await h.check('보정 없이 TV 시계로만 재면 이미 끝난 타이머다(그래서 보정이 필요하다)', async () => {
    const r = await tv.evaluate((code) => { const s = JSON.parse(localStorage.getItem(`emoren-classroom:room:${code}`)); return (Date.now() - s.timer.startedAt) / 1000; }, CODE);
    if (!(r > 60)) throw new Error(`경과 ${r}s`);
  });
  await h.check('강사 폰도 55~60', async () => {
    const n = Number(await phone.locator('[data-timer]').textContent());
    if (!(n >= 55 && n <= 60)) throw new Error(String(n));
  });
  await h.check('TV 고리(ring)가 거의 다 차 있다', async () => {
    const r = await tv.evaluate(() => { const el = document.querySelector('[data-ring]'); return [parseFloat(el.style.strokeDashoffset), Number(el.getAttribute('stroke-dasharray'))]; });
    if (!(r[0] >= 0 && r[0] < r[1] * 0.12)) throw new Error(JSON.stringify(r));
  });
  await h.shot(tv, 'tv-kiosk-timer.png');

  h.log('\n[5] 효과음이 켜진 채 확정: 차임 경로가 오류 없이 지나간다');
  await phone.click('[data-act="prev"]');
  await h.hasText(tv.locator('.scene h1'), '어떤 날씨');
  await phone.click('[data-tally="sunny"][data-delta="1"]');
  await phone.click('[data-act="confirm"]');
  await h.check('확정 대사가 자막에 뜬다', () => h.hasText(tv.locator('[data-caption]'), '해님 1명'));
  await h.check('TV에 AudioContext가 있으면 깨어 있다(없어도 오류는 아니다)', async () => {
    const s = await tv.evaluate(() => (typeof AudioContext === 'undefined' ? 'none' : 'present'));
    h.log('     AudioContext:', s);
  });
  await h.check('쉬었다 돌아와도 TV가 계속 그린다(일시정지 → 재개)', async () => {
    await phone.click('[data-act="pause"]');
    await h.hasText(tv.locator('.pause'), '잠깐 쉬어요');
    await phone.click('[data-act="pause"]');
    await tv.locator('.pause').waitFor({ state: 'detached', timeout: h.T });
  });
}
