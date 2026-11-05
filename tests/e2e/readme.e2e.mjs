// README 정직성 스모크: README.md가 안내하는 해시 주소를 실제 브라우저에서 열어, 각각 그 화면으로 라우팅되고
// 오류 카드(.err) 없이 뜨는지 본다. 내용은 다른 시나리오가 검사하므로 여기서는 "문서가 가리키는 문이 열리는가"만.
// README honesty smoke: every hash route the English README mentions opens in a real browser as that view,
// with no error card. Other scenarios cover what each screen does; this one only checks the doors exist.
import fs from 'node:fs';
import path from 'node:path';

export default async function readme(h) {
  const md = fs.readFileSync(path.join(h.ROOT, 'README.md'), 'utf8');
  const routes = [...new Set([...md.matchAll(/`(#[a-z][a-z0-9-]*(?:-CODE)?)`/g)].map((m) => m[1]))]
    .map((r) => ({ shown: r, hash: r.replace('CODE', 'RDME') }));
  h.log(`\n[R1] README.md의 해시 주소 ${routes.length}개: ${routes.map((r) => r.shown).join(' ')}`);

  const ctx = await h.newContext({ locale: 'en-US' });
  await ctx.addInitScript(() => { try { localStorage.setItem('emoren.lang', 'en'); } catch {} });
  // 강사 폰을 먼저 열어 방 RDME를 만들면 TV·보호자 페이지도 같은 방을 읽는다 / phone first so the room exists
  routes.sort((a, b) => Number(b.hash.startsWith('#teacher')) - Number(a.hash.startsWith('#teacher')));
  const page = await h.newPage(ctx, 'readme-routes');
  for (const { shown, hash } of routes) {
    const view = hash.slice(1).split('-')[0];
    await page.goto(`${h.base}/${hash}`);
    await h.check(`${shown} → ${view} 화면이 오류 없이 뜬다`, async () => {
      await page.waitForFunction((v) => document.body.dataset.view === v && document.querySelector('#app > *'), view, { timeout: h.T });
      if (await page.locator('#app .err').count()) throw new Error(await page.locator('#app .err').first().textContent());
    });
  }
  await h.check('#tv 는 새 코드로 넘어간다(README의 "#tv makes a new code")', async () => {
    await page.goto(`${h.base}/#tv`);
    await page.waitForFunction(() => /^#tv-[A-Z0-9]{4}$/.test(location.hash), null, { timeout: h.T });
  });
  await h.shot(page, 'readme-routes.png');
}
