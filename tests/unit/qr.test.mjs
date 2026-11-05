// 단위 테스트: js/vendor/qr.js — 바깥 디코더 없이 구조만 본다(크기·파인더·타이밍·여백·결정성·라벨 이스케이프).
// 실제로 읽히는지는 tests/e2e/qr.e2e.mjs가 jsQR(테스트 전용)로 확인한다. 실행: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { qrMatrix, qrSvg } from '../../js/vendor/qr.js';

const TEACHER_URL = 'http://192.168.0.12:8787/#teacher-ABCD';                 // 39 bytes → v3
const PAGES_URL = 'https://example.github.io/emoren-classroom/#teacher-ABCD'; // 57 bytes → v4

// (ox, oy)에서 시작하는 7×7 칸이 파인더 패턴인가 / is the 7×7 block at (ox, oy) a finder pattern
function isFinder(m, ox, oy) {
  for (let dy = 0; dy < 7; dy++) {
    for (let dx = 0; dx < 7; dx++) {
      const dist = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
      if (m.get(ox + dx, oy + dy) !== (dist !== 2)) return false;
    }
  }
  return true;
}
const darkCount = (m) => { let n = 0; for (let y = 0; y < m.size; y++) for (let x = 0; x < m.size; x++) if (m.get(x, y)) n++; return n; };

test('크기는 버전을 따른다(21, 25, 29, 37, 41 = 4v + 17)', () => {
  assert.equal(qrMatrix('HELLO').size, 21);           // v1 (영숫자 모드)
  assert.equal(qrMatrix('a'.repeat(14)).size, 21);    // v1-M은 바이트 14개까지
  assert.equal(qrMatrix('a'.repeat(15)).size, 25);    // v2
  assert.equal(qrMatrix(TEACHER_URL).size, 29);       // v3
  assert.equal(qrMatrix(PAGES_URL).size, 33);         // v4
  assert.equal(qrMatrix('a'.repeat(84)).size, 37);    // v5-M은 바이트 84개까지
  assert.equal(qrMatrix('a'.repeat(85)).size, 41);    // v6
  for (const s of ['', 'x', TEACHER_URL, PAGES_URL, 'a'.repeat(90)]) {
    const m = qrMatrix(s);
    assert.equal((m.size - 17) % 4, 0, s);
    assert.equal(m.size, m.version * 4 + 17, s);
    assert.ok(m.version >= 1 && m.version <= 40);
  }
});

test('파인더 패턴은 세 모서리에, 분리선은 희고, 타이밍 패턴은 번갈아 난다', () => {
  for (const s of ['HELLO', TEACHER_URL, PAGES_URL, 'a'.repeat(90)]) {
    const m = qrMatrix(s);
    const n = m.size;
    assert.ok(isFinder(m, 0, 0), `${s}: top-left`);
    assert.ok(isFinder(m, n - 7, 0), `${s}: top-right`);
    assert.ok(isFinder(m, 0, n - 7), `${s}: bottom-left`);
    assert.ok(!isFinder(m, n - 7, n - 7), `${s}: bottom-right is data, not a finder`);
    for (let i = 0; i < 8; i++) {
      assert.equal(m.get(7, i), false, 'separator'); assert.equal(m.get(i, 7), false, 'separator');
      assert.equal(m.get(n - 8, i), false, 'separator'); assert.equal(m.get(i, n - 8), false, 'separator');
    }
    for (let i = 8; i < n - 8; i++) {
      assert.equal(m.get(i, 6), i % 2 === 0, `${s}: timing row x=${i}`);
      assert.equal(m.get(6, i), i % 2 === 0, `${s}: timing column y=${i}`);
    }
    assert.equal(m.get(8, n - 8), true, 'dark module next to the bottom-left finder');
    assert.equal(m.get(-1, 0), false); assert.equal(m.get(0, n), false); // 범위 밖은 false
  }
});

test('같은 입력이면 늘 같은 결과(결정적), 다른 입력이면 다르다', () => {
  const a = qrMatrix(PAGES_URL), b = qrMatrix(PAGES_URL);
  assert.equal(a.size, b.size);
  for (let y = 0; y < a.size; y++) for (let x = 0; x < a.size; x++) assert.equal(a.get(x, y), b.get(x, y));
  assert.equal(qrSvg(PAGES_URL, { label: 'x' }), qrSvg(PAGES_URL, { label: 'x' }));
  assert.notEqual(qrSvg(PAGES_URL), qrSvg(PAGES_URL + 'E'));
  assert.notEqual(qrSvg('#teacher-ABCD'), qrSvg('#teacher-ABCE'));
});

test('SVG: 여백 4칸, 어두운 칸은 여백을 넘지 않고, path 하나·crispEdges·role=img·잉크색', () => {
  const m = qrMatrix(TEACHER_URL);
  const svg = qrSvg(TEACHER_URL, { label: 'QR' });
  const n = m.size + 8;
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(svg.endsWith('</svg>'));
  assert.ok(svg.includes(`viewBox="0 0 ${n} ${n}"`));
  assert.ok(svg.includes('shape-rendering="crispEdges"'));
  assert.ok(svg.includes('role="img"'));
  assert.ok(svg.includes(`<rect width="${n}" height="${n}" fill="#FFFFFF"/>`), '흰 바탕이 여백까지 덮는다');
  assert.equal(svg.match(/<path /g).length, 1);
  assert.ok(svg.includes('fill="#2B2622"'));
  const d = svg.match(/<path d="([^"]*)"/)[1];
  const runs = [...d.matchAll(/M(\d+) (\d+)h(\d+)v1h-(\d+)z/g)];
  assert.ok(runs.length > 0);
  let dark = 0;
  for (const [, x, y, w, w2] of runs) {
    const X = Number(x), Y = Number(y), W = Number(w);
    assert.equal(w, w2);
    assert.ok(X >= 4 && Y >= 4 && X + W <= n - 4 && Y < n - 4, `quiet zone broken at ${x},${y} w=${w}`);
    dark += W;
  }
  assert.equal(dark, darkCount(m), 'path의 어두운 칸 수 = 행렬의 어두운 칸 수');
  assert.equal(d.replace(/M\d+ \d+h\d+v1h-\d+z/g, ''), '', 'path에는 그 조각들만 있다');
  // 첫 파인더의 윗줄(7칸)이 여백 뒤 (4,4)에서 시작한다
  assert.ok(d.startsWith('M4 4h7v1h-7z'));
  const s0 = qrSvg('HELLO', { margin: 0, dark: '#000000', light: '#FFF' });
  assert.ok(s0.includes('viewBox="0 0 21 21"') && s0.includes('fill="#000000"') && s0.includes('fill="#FFF"'));
  assert.ok(qrSvg('HELLO', { margin: 2 }).includes('viewBox="0 0 25 25"'));
});

test('라벨은 aria-label에 이스케이프되어 들어간다', () => {
  const svg = qrSvg('HELLO', { label: 'Open <b>"remote"</b> & \'code\' QRTV' });
  assert.ok(svg.includes('aria-label="Open &lt;b&gt;&quot;remote&quot;&lt;/b&gt; &amp; &#39;code&#39; QRTV"'));
  assert.ok(!svg.includes('<b>'));
  assert.ok(qrSvg('HELLO').includes('aria-label=""'));
  assert.ok(qrSvg('HELLO', { dark: '"><script>' }).includes('fill="&quot;&gt;&lt;script&gt;"'), '색 값도 이스케이프');
});

test('60~90자 URL이 모두 인코딩되고(기본 M), ecl 옵션을 받으며, 너무 길면 RangeError', () => {
  const long = 'https://a-rather-long-organisation-name.github.io/emoren-classroom/#teacher-WXYZ';
  assert.ok(long.length >= 60 && long.length <= 90, String(long.length));
  for (let len = 60; len <= 90; len += 5) {
    const m = qrMatrix(long.slice(0, len).padEnd(len, 'x'));
    assert.ok(m.size >= 33 && m.size <= 41, `${len} chars → ${m.size}`);
    assert.ok(isFinder(m, 0, 0));
  }
  assert.equal(qrMatrix(long).size, 37);                                      // 81 bytes → v5
  assert.ok(qrMatrix(long, { ecl: 'H' }).size > qrMatrix(long, { ecl: 'L' }).size);
  assert.equal(qrMatrix(long, { ecl: 'nope' }).size, qrMatrix(long).size, '모르는 ecl은 M');
  assert.ok(qrMatrix('안녕하세요 #teacher-ABCD').size >= 25, 'UTF-8 바이트로 인코딩');
  assert.throws(() => qrMatrix('a'.repeat(3000)), RangeError);
});
