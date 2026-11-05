// QR 입장 시나리오: TV 대기 화면의 QR이 (1) 코드 오른쪽에 나란히 뜨고(1280×720, 1920×1080) (2) 실제로 읽히며
// (3) 강사 폰 링크 #teacher-코드를 정확히 가리키는지. 영어 화면의 라벨도 본다.
// 디코더 jsQR은 테스트 전용(npm install --no-save jsqr). 없으면 CI 밖에서는 경고만 하고 디코드 검사를 건너뛴다.
// Decoding uses the test-only jsQR; without it the decode check is skipped locally (and fails in CI).
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// 페이지 안에서: 대기 화면의 QR SVG를 ~400px 캔버스에 그려 jsQR로 읽는다 / in-page: SVG → <img> → canvas → jsQR
async function decodeInPage() {
  const px = 400;
  const svg = document.querySelector('.wait [data-qr] svg').cloneNode(true);
  svg.setAttribute('width', px); svg.setAttribute('height', px);
  const img = new Image();
  await new Promise((ok, bad) => {
    img.onload = ok; img.onerror = () => bad(new Error('svg → image failed'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
  });
  const c = document.createElement('canvas'); c.width = px; c.height = px;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, px, px);
  g.drawImage(img, 0, 0, px, px);
  const d = g.getImageData(0, 0, px, px);
  const r = window.jsQR(d.data, d.width, d.height);
  return r ? r.data : null;
}

// 무대 안 배치 수치 / layout numbers inside the stage (plain objects: DOMRect does not cross evaluate)
function layoutInPage() {
  const r = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width, height: b.height }; };
  const stage = r('.stage'), title = r('.wait h1'), code = r('.wait .bigcode'), qr = r('.wait [data-qr] svg'), label = r('.wait .qrlabel'), sub = r('.wait .sub');
  const em = parseFloat(getComputedStyle(document.querySelector('.stage')).fontSize);
  const inside = (b) => b.left >= stage.left - 1 && b.right <= stage.right + 1 && b.top >= stage.top - 1 && b.bottom <= stage.bottom + 1;
  return {
    em, qrEm: Math.round((qr.width / em) * 10) / 10, qr, code,
    square: Math.abs(qr.width - qr.height) <= 1,
    inside: inside(qr) && inside(code) && inside(title) && inside(sub) && inside(label),
    sideBySide: qr.left >= code.right - 1 && qr.left >= title.right - 1,
    labelUnder: label.top >= qr.bottom - 1 && Math.abs((label.left + label.right) / 2 - (qr.left + qr.right) / 2) < 2,
    subBelow: sub.top >= code.bottom - 1 && sub.top >= qr.bottom - 1,
    stage: { w: stage.width, h: stage.height },
  };
}

export default async function qr(h) {
  let jsqr = null;
  try { jsqr = require.resolve('jsqr/dist/jsQR.js'); } catch { /* 아래에서 안내 */ }

  const ctx = await h.newContext({ locale: 'ko-KR' });
  h.log('\n[Q1] TV 대기 화면: 코드 옆에 강사 폰 링크 QR');
  const tv = await h.newPage(ctx, 'TV-QR');
  await tv.goto(`${h.base}/#tv-QRTV`);
  await h.hasText(tv.locator('.bigcode'), 'QRTV');
  await h.check('QR SVG가 뜬다(path 하나, role=img, crispEdges)', async () => {
    const svg = tv.locator('.wait [data-qr] svg');
    await svg.waitFor({ timeout: h.T });
    if ((await svg.locator('path').count()) !== 1) throw new Error('path 수');
    if ((await svg.getAttribute('role')) !== 'img') throw new Error('role');
    if ((await svg.getAttribute('shape-rendering')) !== 'crispEdges') throw new Error('shape-rendering');
  });
  await h.check('라벨 문구와 aria-label(코드 포함)', async () => {
    await h.hasText(tv.locator('.wait .qrlabel'), '폰으로 찍으면 리모컨이 열려요');
    const al = await tv.locator('.wait [data-qr] svg').getAttribute('aria-label');
    if (!al || !al.includes('QRTV')) throw new Error(`aria-label: ${al}`);
  });
  await h.check('기존 대기 화면 요소는 그대로(h1, bigcode, sub)', async () => {
    await h.hasText(tv.locator('.wait h1'), '이모렌 교실');
    await h.hasText(tv.locator('.wait .sub'), '소리 켜기');
  });
  await h.check('1280×720: QR은 코드 오른쪽에 나란히, 약 14em 정사각형, 라벨은 그 아래, 전부 무대 안', async () => {
    const L = await tv.evaluate(layoutInPage);
    if (!L.inside || !L.sideBySide || !L.labelUnder || !L.subBelow || !L.square) throw new Error(JSON.stringify(L));
    if (Math.abs(L.qrEm - 14) > 0.5) throw new Error(`QR ${L.qrEm}em`);
    if (L.qr.width < 200) throw new Error(`QR too small: ${L.qr.width}px`);
  });

  h.log('\n[Q2] 실제로 읽히는가 (jsQR)');
  if (!jsqr) {
    if (process.env.CI) h.fail('jsQR 디코더가 없다 — CI에서는 반드시 설치한다', new Error('npm install --no-save jsqr'));
    else h.log('  ! jsqr가 없어 실제 디코드 검사를 건너뜁니다 / decode check skipped — run: npm install --no-save jsqr');
  } else {
    await tv.addScriptTag({ path: jsqr });
    await h.check('QR을 디코드하면 정확히 강사 폰 링크(#teacher-QRTV)', async () => {
      const got = await tv.evaluate(decodeInPage);
      const want = `${h.base}/#teacher-QRTV`;
      if (got !== want) throw new Error(`${got} ≠ ${want}`);
    });
  }
  await h.shot(tv, 'tv-waiting-qr.png');

  h.log('\n[Q3] 1920×1080에서도 같은 배치');
  await tv.setViewportSize({ width: 1920, height: 1080 });
  await h.check('1920×1080: 나란히, 14em(=336px) 정사각형, 무대 안', async () => {
    const L = await tv.evaluate(layoutInPage);
    if (!L.inside || !L.sideBySide || !L.labelUnder || !L.subBelow || !L.square) throw new Error(JSON.stringify(L));
    if (Math.abs(L.qrEm - 14) > 0.5 || L.qr.width < 300) throw new Error(`QR ${L.qrEm}em ${L.qr.width}px`);
  });
  await h.shot(tv, 'tv-waiting-qr-1080.png');

  h.log('\n[Q4] 영어 화면의 라벨');
  const en = await h.newContext({ locale: 'en-US' });
  const tvEn = await h.newPage(en, 'TV-QR-en');
  await tvEn.goto(`${h.base}/#tv-QREN`);
  await h.check('영어 라벨과 aria-label', async () => {
    await h.hasText(tvEn.locator('.wait .qrlabel'), 'Scan with your phone to open the remote');
    const al = await tvEn.locator('.wait [data-qr] svg').getAttribute('aria-label');
    if (!al || !al.includes('QREN')) throw new Error(`aria-label: ${al}`);
  });
  if (jsqr) {
    await tvEn.addScriptTag({ path: jsqr });
    await h.check('영어 화면의 QR도 #teacher-QREN', async () => {
      const got = await tvEn.evaluate(decodeInPage);
      if (got !== `${h.base}/#teacher-QREN`) throw new Error(String(got));
    });
  }
}
