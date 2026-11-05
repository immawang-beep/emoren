// 문서·배포 시나리오: 정적 서버가 저장소 루트를 그대로 내보낸다(GitHub Pages가 하는 일과 같다).
//   운영 문서가 열리고, 서비스워커·매니페스트가 맞는 형식으로 나가며, DEPLOY.md가 안내하는 #demo 주소가 오류 없이 뜬다.
// Docs/deploy smoke: the docs are served, sw.js / manifest have the right types, and the advertised #demo route renders.
export default async function docs(h) {
  const ctx = await h.newContext();
  const page = await h.newPage(ctx, '문서');

  h.log('\n[1] 운영 문서가 정적 서버에서 그대로 열린다');
  for (const f of ['docs/BRAIN.md', 'docs/DEPLOY.md']) {
    await h.check(`${f} → 200, markdown, English summary 포함`, async () => {
      const res = await page.request.get(`${h.base}/${f}`);
      if (res.status() !== 200) throw new Error(`status ${res.status()}`);
      const ct = res.headers()['content-type'] || '';
      if (!/markdown/.test(ct)) throw new Error(`content-type ${ct}`);
      const body = await res.text();
      if (!body.includes('## English summary')) throw new Error('English summary 없음');
    });
  }

  h.log('\n[2] 서비스워커와 매니페스트가 맞는 형식으로 나간다(캐시 목록이 깨지지 않게)');
  await h.check('sw.js는 자바스크립트, manifest는 매니페스트 형식', async () => {
    const sw = await page.request.get(`${h.base}/sw.js`);
    const mf = await page.request.get(`${h.base}/manifest.webmanifest`);
    if (sw.status() !== 200 || !/javascript/.test(sw.headers()['content-type'] || '')) throw new Error(`sw.js ${sw.status()} ${sw.headers()['content-type']}`);
    if (mf.status() !== 200 || !/manifest\+json/.test(mf.headers()['content-type'] || '')) throw new Error(`manifest ${mf.status()} ${mf.headers()['content-type']}`);
    if (!/const CACHE = 'emoren-classroom-v\d+'/.test(await sw.text())) throw new Error('CACHE 이름 꼴이 DEPLOY.md 설명과 다르다');
  });

  h.log('\n[3] DEPLOY.md가 안내하는 #demo 주소가 뜬다');
  await page.goto(`${h.base}/#demo`);
  await h.check('#demo가 화면을 그린다', () => page.locator('#app main').first().waitFor({ timeout: h.T }));
  await h.shot(page, 'docs-demo-route.png');
}
