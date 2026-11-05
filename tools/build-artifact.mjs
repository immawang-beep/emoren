// index.html → dist/artifact.html
// claude.ai 아티팩트는 문서 뼈대(doctype/html/head/body, charset, viewport)를 직접 씌우므로 벗겨서 낸다.
// 나머지 파일(css, js, locales, packs/<id>.<lang>.json, assets)은 같은 상대 경로로 함께 올린다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) build();

function build() {
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

const files = artifactFiles();
fs.writeFileSync(path.join(root, 'dist', 'artifact-files.json'), JSON.stringify(files, null, 2) + '\n');
console.log(`dist/artifact.html (${out.length}자) + 함께 올릴 파일 ${files.length}개 → dist/artifact-files.json`);
}

// 함께 올릴 파일: 폴더를 훑어서 모은다(목록을 손으로 고치지 않는다) / collected by walking folders
export function artifactFiles(base = root) {
  const walk = (dir) => fs.readdirSync(path.join(base, dir), { withFileTypes: true }).flatMap((d) => {
    const rel = dir + '/' + d.name;
    return d.isDirectory() ? walk(rel) : [rel];
  });
  const keep = (f) => /\.(css|js|json|svg|png|md)$/.test(f);
  return ['css', 'assets', 'js', 'packs'].flatMap(walk).filter(keep).sort();
}
