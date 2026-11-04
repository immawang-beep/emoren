// index.html → dist/artifact.html
// claude.ai 아티팩트는 문서 뼈대(doctype/html/head/body, charset, viewport)를 직접 씌우므로 벗겨서 낸다.
// 나머지 파일(css, js, packs, assets)은 같은 상대 경로로 함께 올린다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let out = src
  .replace(/<!doctype html>\s*/i, '')
  .replace(/<html[^>]*>\s*/i, '')
  .replace(/<\/html>\s*/i, '')
  .replace(/<head>\s*/i, '')
  .replace(/<\/head>\s*/i, '')
  .replace(/<body>\s*/i, '')
  .replace(/<\/body>\s*/i, '')
  .replace(/^[ \t]*<meta charset[^>]*>[ \t]*\n?/im, '')
  .replace(/^[ \t]*<meta name="viewport"[^>]*>[ \t]*\n?/im, '')
  .replace(/^[ \t]*<link rel="manifest"[^>]*>[ \t]*\n?/im, '');

out = out.replace('<title>', '<meta name="claude:viewport-fit-sides" content="cover">\n<title>');

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'artifact.html'), out.trim() + '\n');

const files = [
  'css/app.css', 'assets/icon.svg',
  'js/app.js', 'js/util.js', 'js/store.js', 'js/pack.js',
  'js/sync/index.js', 'js/sync/local.js', 'js/sync/artifactdb.js', 'js/sync/firebase.js',
  'js/ui/character.js', 'js/ui/speech.js',
  'js/views/home.js', 'js/views/teacher.js', 'js/views/tv.js', 'js/views/parent.js',
  'packs/index.json', ...fs.readdirSync(path.join(root, 'packs')).filter((f) => f.endsWith('.json') && f !== 'index.json').map((f) => 'packs/' + f),
];
fs.writeFileSync(path.join(root, 'dist', 'artifact-files.json'), JSON.stringify(files, null, 2) + '\n');
console.log(`dist/artifact.html (${out.length}자) + 함께 올릴 파일 ${files.length}개 → dist/artifact-files.json`);
