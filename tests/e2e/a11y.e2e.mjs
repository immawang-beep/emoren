// 접근성 e2e: axe-core(테스트 전용 패키지)를 페이지에 넣고 serious / critical 위반이 0건인지 확인한다.
//   홈(#: 폰 390×844 · 데스크톱 1280×720 × 라이트 · 다크) → 강사 폰 대기 패널(#teacher-A11Y) → TV 대기 화면(#tv-A11Y, 1280×720)
//   → 수업 한 회기를 빠르게 끝낸 뒤(시작 · 다음 · 집계 · 확정 · 다음×4 · 마치기) 보호자 페이지(#parent-A11Y)
// moderate / minor 발견은 실패로 세지 않고 출력만 한다. 결과 전체는 dist/shots/a11y-report.json.
// Accessibility e2e: injects axe-core (test-only: `npm install --no-save axe-core`) and asserts zero serious / critical
// violations on home (phone + desktop, light + dark), a teacher waiting panel, the TV waiting screen and a family page
// after a finished lesson. moderate / minor findings are only logged. The full result goes to dist/shots/a11y-report.json.
// axe-core not resolvable → warn and skip locally; in CI (process.env.CI set) that is a failure.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const CODE = 'A11Y';
const SERIOUS = new Set(['serious', 'critical']);
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 720 };

function resolveAxe() {
  try { return require.resolve('axe-core/axe.min.js'); } catch { return null; }
}

export default async function a11y(h) {
  const axePath = resolveAxe();
  if (!axePath) {
    if (process.env.CI) throw new Error('axe-core가 없습니다 / axe-core is not installed: npm install --no-save axe-core');
    h.log('  ! axe-core가 없어 접근성 검사를 건너뜁니다 / axe-core not installed, skipping (npm install --no-save axe-core)');
    return;
  }
  const report = [];
  const light = (p) => p.emulateMedia({ colorScheme: 'light' });
  const dark = (p) => p.emulateMedia({ colorScheme: 'dark' });

  // 테마·크기를 바꾼 직후에는 진행 중인 CSS transition(.btn 배경 .2s)이 끝나기를 기다린다: 중간색으로 재면 대비가 틀어진다.
  // After a theme / viewport change, wait for running CSS transitions (.btn background .2s): axe must not measure a mid-transition color.
  async function settle(page) {
    await page.evaluate(async () => {
      const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await frame();
      await Promise.all(document.getAnimations().filter((a) => a instanceof CSSTransition).map((a) => a.finished.catch(() => {})));
      await frame();
    });
  }

  // 한 화면 상태를 검사한다. serious / critical 위반이 있으면 던진다(h.check가 실패로 센다). 나머지는 출력만.
  // Audit one page state; throws on serious / critical violations (h.check counts it). Others are logged only.
  async function audit(page, name, { rules = {}, shot } = {}) {
    await settle(page);
    if (!(await page.evaluate(() => !!window.axe))) await page.addScriptTag({ path: axePath });
    const { violations } = await page.evaluate((opts) => window.axe.run(document, opts), { resultTypes: ['violations'], rules });
    if (shot) await h.shot(page, shot);
    // 노드마다 선택자와 (대비 규칙이면) 색·비율 데이터를 남긴다 / per node: selector plus axe's data (colors + ratio for contrast)
    const found = violations.map((v) => ({
      id: v.id, impact: v.impact, help: v.help,
      targets: v.nodes.map((n) => n.target.join(' ')),
      nodes: v.nodes.map((n) => ({ target: n.target.join(' '), data: (n.any[0] || n.all[0] || {}).data || null })),
    }));
    report.push({ name, violations: found });
    for (const v of found) {
      const more = v.targets.length > 4 ? ` (+${v.targets.length - 4})` : '';
      h.log(`    ${SERIOUS.has(v.impact) ? '✗' : '·'} [${v.impact}] ${v.id}: ${v.help} — ${v.targets.slice(0, 4).join(' | ')}${more}`);
    }
    const bad = found.filter((v) => SERIOUS.has(v.impact));
    if (bad.length) throw new Error(`serious/critical ${bad.length}건: ${bad.map((v) => `${v.id}(${v.targets.length})`).join(', ')}`);
  }

  const ctx = await h.newContext({ locale: 'ko-KR' });

  h.log('\n[1] 홈: 폰 · 데스크톱 × 라이트 · 다크');
  const home = await h.newPage(ctx, 'a11y-홈', { phone: true });
  await home.goto(`${h.base}/#`);
  await home.locator('.card h2').first().waitFor({ timeout: h.T });
  await h.check('홈 · 폰 · 라이트', async () => { await light(home); await audit(home, 'home phone light', { shot: 'a11y-home-phone-light.png' }); });
  await h.check('홈 · 폰 · 다크', async () => { await dark(home); await audit(home, 'home phone dark', { shot: 'a11y-home-phone-dark.png' }); });
  await home.setViewportSize(DESKTOP);
  await h.check('홈 · 데스크톱 · 라이트', async () => { await light(home); await audit(home, 'home desktop light', { shot: 'a11y-home-desktop-light.png' }); });
  await h.check('홈 · 데스크톱 · 다크', async () => { await dark(home); await audit(home, 'home desktop dark', { shot: 'a11y-home-desktop-dark.png' }); });
  // 새 코드 안내(본문 속 링크)를 펼친 상태 / with the new-code hint (a link inside running text) open
  await home.setViewportSize(PHONE);
  await light(home);
  await home.click('[data-new]');
  await home.locator('[data-newbox] a').waitFor({ timeout: h.T });
  await h.check('홈 · 새 코드 안내 펼침', () => audit(home, 'home new-code hint'));

  h.log('\n[2] 강사 폰 대기 패널');
  const phone = await h.newPage(ctx, 'a11y-강사폰', { phone: true });
  await phone.goto(`${h.base}/#teacher-${CODE}`);
  await phone.locator('[data-act="start"]').waitFor({ timeout: h.T });
  await h.check('강사 폰 대기 · 라이트', async () => { await light(phone); await audit(phone, 'teacher waiting light', { shot: 'a11y-teacher-waiting.png' }); });
  await h.check('강사 폰 대기 · 다크', async () => { await dark(phone); await audit(phone, 'teacher waiting dark', { shot: 'a11y-teacher-waiting-dark.png' }); });
  await light(phone);

  h.log('\n[3] TV 대기 화면(1280×720)');
  const tv = await h.newPage(ctx, 'a11y-TV');
  await tv.goto(`${h.base}/#tv-${CODE}`);
  await h.hasText(tv.locator('.bigcode'), CODE);
  await h.check('TV 대기 화면', () => audit(tv, 'tv waiting', { shot: 'a11y-tv-waiting.png' }));
  await tv.close();

  h.log('\n[4] 수업 한 회기를 빠르게 끝낸다: 시작 · 다음 · 집계 · 확정 · 다음… · 마치기');
  await phone.click('[data-act="start"]');
  await phone.locator('.stepnav').waitFor({ timeout: h.T });
  await phone.click('[data-act="next"]');
  const plus = phone.locator('[data-delta="1"]');
  await plus.first().waitFor({ timeout: h.T });
  await plus.nth(0).click();
  await plus.nth(0).click();
  await plus.nth(1).click();
  await h.check('강사 폰 집계 패널', () => audit(phone, 'teacher choice', { shot: 'a11y-teacher-choice.png' }));
  await phone.click('[data-act="confirm"]');
  // 마지막 단계의 '다음'이 '수업 마치기'다. 단계 수가 바뀌어도 끝 패널(초기화 버튼)이 나올 때까지 누른다.
  // The last step's "next" is "finish"; press until the done panel (reset button) shows, whatever the step count.
  for (let i = 0; i < 12 && !(await phone.locator('[data-act="reset"]').count()); i++) await phone.click('[data-act="next"]');
  await h.check('강사 폰이 끝 패널(보호자 링크)을 보인다', () => phone.locator('[data-act="reset"]').waitFor({ timeout: h.T }));

  h.log('\n[5] 보호자 페이지(수업 끝)');
  const parent = await h.newPage(ctx, 'a11y-보호자', { phone: true });
  await parent.goto(`${h.base}/#parent-${CODE}`);
  await parent.locator('.story').waitFor({ timeout: h.T });
  await h.check('보호자 · 폰 · 라이트', async () => { await light(parent); await audit(parent, 'parent phone light', { shot: 'a11y-parent-phone-light.png' }); });
  await h.check('보호자 · 폰 · 다크', async () => { await dark(parent); await audit(parent, 'parent phone dark', { shot: 'a11y-parent-phone-dark.png' }); });
  await parent.setViewportSize(DESKTOP);
  await h.check('보호자 · 데스크톱 · 라이트', async () => { await light(parent); await audit(parent, 'parent desktop light'); });

  const out = path.join(h.SHOTS, 'a11y-report.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  h.log(`  결과 / report: ${out}`);
}
