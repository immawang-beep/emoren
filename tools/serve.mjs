// 의존성 없는 정적 서버. 개발·시연·테스트용.
//   node tools/serve.mjs            → http://127.0.0.1:8787
//   PORT=3000 node tools/serve.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
};
// 오류 응답까지 모두 캐시 금지(404는 기본적으로 캐시될 수 있는 상태 코드다), 그리고 MIME 추측 금지(nosniff).
// Every response, errors included, is no-store (404 is heuristically cacheable by default) and nosniff.
const NO_STORE = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

export function startServer(root, port = 0, host = '127.0.0.1') {
  root = path.resolve(root);
  const server = http.createServer((req, res) => {
    let p;
    try { p = decodeURIComponent(new URL(req.url, 'http://local').pathname); } catch { res.writeHead(400, NO_STORE); return res.end(); }
    // 널 바이트가 들어오면 fs.readFile이 동기 예외를 던져 서버 자체가 죽는다 → 400.
    // A NUL byte makes fs.readFile throw synchronously and kill the server → 400.
    if (p.includes('\0')) { res.writeHead(400, NO_STORE); return res.end(); }
    // 점으로 시작하는 경로 조각(.git, .env, .., .well-known…)은 어떤 것도 내주지 않는다 → 403.
    // No path segment may start with a dot (.git, .env, .., …) → 403.
    if (p.split('/').some((seg) => seg.startsWith('.'))) { res.writeHead(403, NO_STORE); return res.end(); }
    if (p.endsWith('/')) p += 'index.html';
    const file = path.normalize(path.join(root, p));
    if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403, NO_STORE); return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...NO_STORE }); return res.end('not found'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', ...NO_STORE });
      res.end(data);
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const { port: p } = server.address();
      resolve({ server, port: p, url: `http://${host}:${p}`, close: () => new Promise((r) => server.close(r)) });
    });
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const port = Number(process.env.PORT || 8787);
  const host = process.env.HOST || '127.0.0.1';
  startServer(root, port, host).then(({ url }) => {
    console.log(`이모렌 교실: ${url}`);
    console.log(`  교실 TV    ${url}/#tv`);
    console.log(`  강사 폰    ${url}/#teacher-코드`);
    console.log(`  보호자     ${url}/#parent-코드`);
  });
}
