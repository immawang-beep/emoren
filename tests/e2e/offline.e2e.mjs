// 오프라인 시나리오: 서비스워커가 셸을 캐시한 뒤 네트워크를 끊어도 교실 TV와 강사 폰이 저장된 상태(localStorage)로
// 같은 장면에 다시 뜨고, 같은 브라우저 동기화(BroadcastChannel + localStorage)는 네트워크 없이도 이어진다.
//   TV 열기 → 서비스워커 준비·셸 캐시 확인 → 강사 폰 수업 시작 → 오프라인 → TV·폰 새로고침 → 오프라인에서 다음
//   → 온라인 복귀 후 다음 → tools/serve.mjs 가 sw.js 를 Cache-Control: no-store 로 주는지
// 127.0.0.1은 안전한 출처라 서비스워커가 거부되면 안 된다: 거부·설치 실패는 건너뛰지 않고 실패로 센다.
// Offline scenario: once the service worker has cached the shell, both screens survive a reload with the network cut
// and same-browser sync keeps working. A refused or failed service worker is a failure, never a silent skip.
import fs from 'node:fs';
import path from 'node:path';

const CODE = 'OFFL';
const SW_WAIT = 15000; // 서비스워커 설치·캐시 대기 상한 / upper bound for install + cache

// sw.js SHELL 목록(tests/unit/shell.test.mjs와 같은 방법) / the SHELL list, parsed the same way as the unit test
function readShell(root) {
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  return [...sw.match(/const SHELL = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

// 페이지 안에서 서비스워커 상태를 분명한 이유와 함께 알아낸다 / service worker status with an explicit reason
function waitForServiceWorker(page, timeout) {
  return page.evaluate(async (timeout) => {
    if (!('serviceWorker' in navigator)) {
      return { ok: false, why: `navigator.serviceWorker 없음 / undefined (isSecureContext=${window.isSecureContext}, ${location.origin})` };
    }
    let reg;
    try { reg = await navigator.serviceWorker.register('sw.js'); } catch (e) { return { ok: false, why: `등록 거부 / register rejected: ${e && e.message}` }; }
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      if (reg.active && navigator.serviceWorker.controller) return { ok: true, state: reg.active.state };
      if (!reg.installing && !reg.waiting && !reg.active) {
        return { ok: false, why: '설치 실패(redundant): SHELL 파일이 404이면 cache.addAll이 통째로 실패한다 / install failed, a SHELL file may be missing' };
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    const w = reg.installing || reg.waiting || reg.active;
    return { ok: false, why: `시간 초과 / timeout ${timeout}ms: state=${w && w.state}, controller=${!!navigator.serviceWorker.controller}` };
  }, timeout);
}

// 모든 캐시의 키를 경로로 / every cached request URL, as a pathname
function cachedPaths(page) {
  return page.evaluate(async () => {
    const out = [];
    for (const k of await caches.keys()) {
      const c = await caches.open(k);
      for (const r of await c.keys()) out.push(new URL(r.url).pathname);
    }
    return out;
  });
}

// 캐시에 없는 주소를 받아 본다: 오프라인이면 서비스워커가 index.html로 대신하고, 온라인이면 서버의 404가 온다
// probe an uncached URL: offline → shell fallback (200 html), online → the server's 404
function probe(page) {
  return page.evaluate(async () => {
    try {
      const res = await fetch(`__probe_${Date.now()}.json`);
      const head = (await res.text()).slice(0, 200);
      return { status: res.status, html: /<!doctype html>/i.test(head) };
    } catch (e) { return { error: String(e && e.message) }; }
  });
}

export default async function offline(h) {
  const shell = readShell(h.ROOT);
  const ctx = await h.newContext({ locale: 'ko-KR' });

  h.log('\n[1] 교실 TV를 열고 서비스워커가 셸을 캐시할 때까지 기다린다');
  const tv = await h.newPage(ctx, 'TV');
  await tv.goto(`${h.base}/#tv-${CODE}`);
  await h.hasText(tv.locator('.bigcode'), CODE);
  await h.check('서비스워커가 등록·활성화되고 TV 페이지를 맡는다', async () => {
    const r = await waitForServiceWorker(tv, SW_WAIT);
    if (!r.ok) throw new Error(`서비스워커 사용 불가 / service worker unavailable on ${h.base}: ${r.why}`);
  });
  await h.check('셸이 캐시된다: js/app.js, packs/mind-weather.ko.json', async () => {
    const need = ['/js/app.js', '/packs/mind-weather.ko.json'];
    const t0 = Date.now();
    let have = [];
    while (Date.now() - t0 < SW_WAIT) {
      have = await cachedPaths(tv);
      if (need.every((p) => have.includes(p))) return;
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error(`${SW_WAIT}ms 안에 캐시되지 않음 / not cached in time. 캐시에 있는 것: ${have.length}개 ${JSON.stringify(have.slice(0, 8))}`);
  });
  await h.check(`sw.js SHELL의 모든 파일(${shell.length}개)이 캐시에 있다`, async () => {
    const have = new Set(await cachedPaths(tv));
    const missing = shell.filter((f) => !have.has(f === './' ? '/' : `/${f}`));
    if (missing.length) throw new Error(`캐시에 없음 / not cached: ${missing.join(', ')}`);
  });

  h.log('\n[2] 강사 폰으로 수업을 시작한다');
  const phone = await h.newPage(ctx, '강사폰', { phone: true });
  await phone.goto(`${h.base}/#teacher-${CODE}`);
  await phone.locator('[data-act="start"]').waitFor({ timeout: h.T });
  await phone.click('[data-act="start"]');
  await h.check('TV에 인사 장면', () => h.hasText(tv.locator('.scene h1'), '마음에도 날씨가 있대'));
  await h.check('강사 폰은 진행 패널(1/6)', () => h.hasText(phone.locator('.stepnav'), '1/6'));
  const heading = ((await tv.locator('.scene h1').first().textContent()) || '').trim();

  h.log('\n[3] 네트워크를 끊는다');
  await ctx.setOffline(true);
  try {
    await h.check('페이지가 오프라인을 안다(navigator.onLine=false)', async () => {
      if (await tv.evaluate(() => navigator.onLine)) throw new Error('navigator.onLine이 아직 true');
    });
    await h.check('서비스워커까지 오프라인: 캐시에 없는 주소는 셸(index.html)로 대신 뜬다', async () => {
      const r = await probe(tv);
      if (r.error) throw new Error(`요청이 서비스워커를 거치지 않았다 / request did not go through the SW: ${r.error}`);
      if (r.status !== 200 || !r.html) throw new Error(`서비스워커가 네트워크에 닿았다 / SW still reached the network: ${JSON.stringify(r)} (PLAYWRIGHT_DISABLE_SERVICE_WORKER_NETWORK이 켜져 있나?)`);
    });

    h.log('\n[4] 오프라인 새로고침: TV가 캐시로 뜨고 저장된 상태로 같은 장면을 보여준다');
    await h.check('TV 새로고침이 캐시에서 성공한다', () => tv.reload({ timeout: h.T }));
    await h.check(`TV가 같은 장면(${heading})`, () => h.hasText(tv.locator('.scene h1'), heading));
    const nav = await tv.evaluate(() => {
      const n = performance.getEntriesByType('navigation')[0];
      return n ? { transferSize: n.transferSize, workerStart: Math.round(n.workerStart), deliveryType: n.deliveryType } : null;
    }).catch(() => null);
    h.log('    navigation:', JSON.stringify(nav));
    await h.shot(tv, 'tv-offline.png');

    h.log('\n[5] 강사 폰도 오프라인 새로고침 뒤 진행 패널 그대로');
    await h.check('강사 폰 새로고침이 캐시에서 성공한다', () => phone.reload({ timeout: h.T }));
    await h.check('강사 폰이 진행 패널(1/6)과 다음 버튼을 다시 보여준다', async () => {
      await h.hasText(phone.locator('.stepnav'), '1/6');
      await phone.locator('[data-act="next"]').waitFor({ timeout: h.T });
    });
    await h.shot(phone, 'phone-offline.png');

    h.log('\n[6] 오프라인에서도 같은 브라우저 동기화는 이어진다');
    await phone.click('[data-act="next"]');
    await h.check('오프라인에서 다음 → TV에 날씨 고르기', () => h.hasText(tv.locator('.scene h1'), '어떤 날씨'));
  } finally {
    await ctx.setOffline(false);
  }

  h.log('\n[7] 네트워크 복구 후 그대로 이어진다');
  // 한 번도 캐시된 적 없는 파일(SHELL에도 없고 앱이 받지도 않는다)이 200으로 오면 서버까지 간 것이다
  // a file never cached (not in SHELL, never fetched by the app) arriving as 200 proves the request reached the server
  await h.check('온라인에서는 네트워크 우선: 캐시에 없는 package.json이 서버에서 온다', async () => {
    const r = await tv.evaluate(async () => {
      const res = await fetch('package.json');
      return { status: res.status, name: res.ok ? (await res.json()).name : null };
    });
    if (r.status !== 200 || r.name !== 'emoren-classroom') throw new Error(JSON.stringify(r));
  });
  await phone.click('[data-act="next"]');
  await h.check('온라인 복귀 후 다음 → TV에 몸놀이 장면', () => h.hasText(tv.locator('.scene h1'), '몸으로 날씨'));

  h.log('\n[8] tools/serve.mjs: sw.js는 Cache-Control: no-store (새 서비스워커가 바로 반영된다)');
  await h.check('sw.js 응답 헤더', async () => {
    const res = await fetch(`${h.base}/sw.js`);
    const cc = res.headers.get('cache-control');
    const ct = res.headers.get('content-type') || '';
    if (!res.ok || cc !== 'no-store' || !/javascript/.test(ct)) throw new Error(`status=${res.status} cache-control=${cc} content-type=${ct}`);
  });
}
