// index.html → dist/artifact.html
// claude.ai 아티팩트는 문서 뼈대(doctype/html/head/body, charset, viewport)를 직접 씌우므로 벗겨서 낸다.
// 나머지 파일(css, js, locales, packs/<id>.<lang>.json, assets)은 같은 상대 경로로 함께 올린다.
// 직접 실행하면 dist/에 쓴다. 테스트는 stripShell(html)·build(root, outDir)·artifactFiles(root)를 import한다.
// Run directly to write dist/; tests import stripShell(html), build(root, outDir) and artifactFiles(root).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();

function main() {
  const { html, files } = build();
  console.log(`dist/artifact.html (${html.length}자) + 함께 올릴 파일 ${files.length}개 → dist/artifact-files.json`);
}

// 문서 뼈대를 벗기고 아티팩트용 viewport 메타를 <title> 바로 앞에 넣는다(순수 함수: 파일을 읽지 않는다)
// strip the document shell and put the artifact viewport meta right before <title> (pure: touches no files)
export function stripShell(html) {
  const out = html
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

  return out.replace('<title>', '<meta name="claude:viewport-fit-sides" content="cover">\n<title>');
}

// root/index.html을 변환해 outDir에 artifact.html과 artifact-files.json을 쓴다
// transform root/index.html and write artifact.html + artifact-files.json into outDir
export function build(root = ROOT, outDir = path.join(root, 'dist')) {
  const html = stripShell(fs.readFileSync(path.join(root, 'index.html'), 'utf8'));
  const files = artifactFiles(root);

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'artifact.html'), html.trim() + '\n');
  fs.writeFileSync(path.join(outDir, 'artifact-files.json'), JSON.stringify(files, null, 2) + '\n');
  return { html, files };
}

// 함께 올릴 파일: 폴더를 훑어서 모은다(목록을 손으로 고치지 않는다) / collected by walking folders
export function artifactFiles(base = ROOT) {
  const walk = (dir) => fs.readdirSync(path.join(base, dir), { withFileTypes: true }).flatMap((d) => {
    const rel = dir + '/' + d.name;
    return d.isDirectory() ? walk(rel) : [rel];
  });
  const keep = (f) => /\.(css|js|json|svg|png|md)$/.test(f);
  return ['css', 'assets', 'js', 'packs'].flatMap(walk).filter(keep).sort();
}
