// 단위 테스트: 개발·시연·테스트용 정적 서버(tools/serve.mjs).
//   MIME 유형, 모든 응답의 Cache-Control: no-store, 404, 루트 밖 경로 탈출 차단, 잘못된 인코딩·널 바이트 → 400,
//   close() 후 포트 반납. 실제 저장소 대신 임시 루트를 만들고 그 "옆"에 비밀 파일을 두어 밖으로 새지 않음을 증명한다.
// Unit tests for the dev static server: MIME types, no-store on every response, 404, path traversal never escapes
// root (a temp root with a sibling secret file proves it), bad percent-encoding / NUL byte → 400, port release.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import { startServer } from '../../tools/serve.mjs';

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'emoren-serve-'));
const root = path.join(base, 'root');
const SECRET = `outside-root-${Date.now()}`;
const FILES = {
  'index.html': '<!doctype html><title>emoren</title>',
  'js/app.js': 'export const ok = 1;',
  'packs/index.json': '{"packs":[]}',
  'manifest.webmanifest': '{"name":"emoren"}',
  'css/app.css': 'body{margin:0}',
  'assets/icon.svg': '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
  'assets/blob.xyz': 'unknown-extension',
};
const write = (f, body) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body); };
for (const [f, body] of Object.entries(FILES)) write(path.join(root, f), body);
// 루트 옆(= 루트 밖)의 비밀 파일들. 탈출 경로가 가리키는 바로 그 이름들이다.
// Secret files next to (outside) root, at exactly the names the traversal paths point at.
write(path.join(base, 'package.json'), SECRET);
write(path.join(base, 'secret.txt'), SECRET);
write(path.join(base, 'etc', 'passwd'), SECRET);

let srv;
before(async () => { srv = await startServer(root, 0); });
after(async () => { await srv?.close(); fs.rmSync(base, { recursive: true, force: true }); });

// 응답이 영영 오지 않는 회귀(핸들러가 예외로 죽는 경우)는 매달리지 말고 빨리 실패한다.
// A regression where the handler dies and never answers should fail fast, not hang.
const WAIT = 5000;
const get = (p) => fetch(`http://127.0.0.1:${srv.port}${p}`, { signal: AbortSignal.timeout(WAIT) });

// fetch는 '..' 같은 점 구간을 보내기 전에 스스로 지워 버린다. 서버가 그 요청을 "정말로" 받았을 때를 검사하려면
// 소켓으로 요청 줄을 그대로 보내야 한다.
// fetch removes dot segments client-side, so to test what the server itself does with them we write the
// request line verbatim over a raw socket.
const rawGet = (target) => new Promise((resolve, reject) => {
  const sock = net.createConnection(srv.port, '127.0.0.1', () => {
    sock.write(`GET ${target} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n`);
  });
  let buf = '';
  sock.setEncoding('utf8');
  sock.setTimeout(WAIT, () => sock.destroy(new Error(`no response for ${target}`)));
  sock.on('data', (d) => { buf += d; });
  sock.on('error', reject);
  sock.on('end', () => {
    const [head, ...body] = buf.split('\r\n\r\n');
    const [line, ...hdrs] = head.split('\r\n');
    const headers = Object.fromEntries(hdrs.map((h) => {
      const i = h.indexOf(':');
      return [h.slice(0, i).toLowerCase(), h.slice(i + 1).trim()];
    }));
    resolve({ status: Number(line.split(' ')[1]), headers, body: body.join('\r\n\r\n') });
  });
});

test('/ 는 index.html을 text/html; charset=utf-8 로 준다', async () => {
  const r = await get('/');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.equal(await r.text(), FILES['index.html']);
});

const MIMES = [
  ['/js/app.js', 'text/javascript; charset=utf-8'],
  ['/packs/index.json', 'application/json; charset=utf-8'],
  ['/manifest.webmanifest', 'application/manifest+json'],
  ['/css/app.css', 'text/css; charset=utf-8'],
  ['/assets/icon.svg', 'image/svg+xml'],
  ['/assets/blob.xyz', 'application/octet-stream'],
];
for (const [p, type] of MIMES) {
  test(`MIME: ${p} → ${type}`, async () => {
    const r = await get(p);
    assert.equal(r.status, 200, p);
    assert.equal(r.headers.get('content-type'), type);
    assert.equal(r.headers.get('cache-control'), 'no-store');
    assert.equal(await r.text(), FILES[p.slice(1)]);
  });
}

test('없는 파일과 index.html 없는 폴더는 404', async () => {
  for (const p of ['/nope.html', '/js/nope.js', '/js', '/js/', '/packs/']) {
    const r = await get(p);
    assert.equal(r.status, 404, p);
    assert.equal(r.headers.get('cache-control'), 'no-store', p);
    assert.equal(await r.text(), 'not found', p);
  }
});

test('오류 응답(400·403·404)에도 Cache-Control: no-store 가 붙는다', async () => {
  const seen = new Set();
  for (const t of ['/%', '/%2e%2e%2fpackage.json', '/nope.html']) {
    const r = await rawGet(t);
    assert.equal(r.headers['cache-control'], 'no-store', t);
    seen.add(r.status);
  }
  assert.deepEqual([...seen].sort(), [400, 403, 404]);
});

const TRAVERSAL = [
  '/../package.json', '/%2e%2e/package.json', '/js/../../etc/passwd',
  '/..%2fpackage.json', '/%2e%2e%2fsecret.txt', '/js%2f..%2f..%2fetc%2fpasswd', '/%2e%2e%2f',
  '//../secret.txt', 'http://evil/../secret.txt', '/..\\secret.txt', '/%5c..%5csecret.txt',
];

test('경로 탈출: 소켓으로 그대로 보내도 루트 밖 파일은 절대 나오지 않는다(403 또는 404)', async () => {
  for (const t of TRAVERSAL) {
    const r = await rawGet(t);
    assert.ok(r.status === 403 || r.status === 404, `${t} → ${r.status}`);
    assert.ok(!r.body.includes(SECRET), `${t} leaked a file outside root`);
    assert.equal(r.headers['cache-control'], 'no-store', t);
  }
});

test('경로 탈출: fetch 로 보내도 마찬가지', async () => {
  for (const t of TRAVERSAL.filter((x) => x.startsWith('/'))) {
    const r = await get(t);
    assert.ok(r.status === 403 || r.status === 404, `${t} → ${r.status}`);
    assert.ok(!(await r.text()).includes(SECRET), `${t} leaked a file outside root`);
  }
});

test('잘못된 퍼센트 인코딩(/%)은 400', async () => {
  for (const p of ['/%', '/%zz', '/js/%e0%a4%a']) {
    const r = await get(p);
    assert.equal(r.status, 400, p);
    assert.equal(r.headers.get('cache-control'), 'no-store', p);
  }
});

test('널 바이트(/%00)는 400이고 서버는 계속 살아 있다', async () => {
  for (const p of ['/%00', '/js/app.js%00.png']) {
    const r = await get(p);
    assert.equal(r.status, 400, p);
    assert.equal(r.headers.get('cache-control'), 'no-store', p);
  }
  const r = await get('/js/app.js');
  assert.equal(r.status, 200);
});

test('close()는 resolve 되고 포트가 반납되어 같은 포트로 다시 열 수 있다', async () => {
  const a = await startServer(root, 0);
  assert.equal(a.url, `http://127.0.0.1:${a.port}`);
  assert.equal((await fetch(`${a.url}/`)).status, 200); // keep-alive 연결이 풀에 남은 상태에서 닫는다
  await a.close();
  await assert.rejects(fetch(`${a.url}/`), 'closed server must refuse connections');
  const b = await startServer(root, a.port);
  try {
    assert.equal(b.port, a.port);
    assert.equal((await fetch(`${b.url}/css/app.css`)).status, 200);
  } finally {
    await b.close();
  }
});
