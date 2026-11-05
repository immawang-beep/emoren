// 단위 테스트: README.md(영어)와 README.ko.md(한국어)가 서로 맞고, 저장소를 거짓 없이 설명하는지.
//   서로 링크 · 같은 스크린샷 집합(-en/-ko) · 상대 링크가 실제 파일을 가리킴 · 금지어 없음 · 회사·모델 이름 없음
//   · mermaid 그림 · 색인의 모든 수업팩과 모든 단계 유형이 두 문서에 있음 · 적힌 해시 주소가 실제 라우트
// Unit test: the English README and its Korean twin agree with each other and with the repository.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STEP_TYPES } from '../../js/pack.js';
import { parseHash } from '../../js/route.js';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const FILES = { en: 'README.md', ko: 'README.ko.md' };
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const docs = Object.fromEntries(Object.entries(FILES).map(([lang, f]) => [lang, read(f)]));

// 문서가 가리키는 상대 경로 전부: 마크다운 [..](path), 이미지 ![..](path), HTML src="path" / href="path"
// every relative path a document points at
function relativeLinks(md) {
  const out = new Set();
  for (const m of md.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) out.add(m[1]);
  for (const m of md.matchAll(/\b(?:src|href)="([^"]+)"/g)) out.add(m[1]);
  return [...out]
    .filter((p) => !/^(?:[a-z]+:|#)/i.test(p))           // http(s):, mailto:, 같은 문서 안의 #anchor 제외
    .map((p) => p.replace(/[#?].*$/, ''))
    .filter(Boolean);
}
const shotsOf = (md) => relativeLinks(md).filter((p) => p.startsWith('docs/shots/')).map((p) => path.basename(p));
const normalizeShot = (name) => name.replace(/-(en|ko)(\.[a-z]+)$/, '$2');

// 다른 브랜치가 만드는 파일: 아직 없어도 링크를 허용한다(docs/HANDOVER-v0.2.md가 약속한 파일만).
// 생기는 순간부터 보통 링크처럼 검사된다. 셋 다 저장소에 들어오면 이 목록은 비워도 된다.
// Files produced on sibling branches: a link may dangle only while the file is missing, and only when
// the handover brief names that file. Once they land, this list can be emptied.
const PENDING = ['docs/DEPLOY.md', 'docs/BRAIN.md', 'CHANGELOG.md'];

test('README.md(영어)와 README.ko.md(한국어)가 있고 맨 위에서 서로를 가리킨다', () => {
  for (const f of Object.values(FILES)) assert.ok(fs.existsSync(path.join(ROOT, f)), f);
  const head = (md) => md.split('\n').slice(0, 5).join('\n');
  assert.match(head(docs.en), /\]\(README\.ko\.md\)/, 'README.md → README.ko.md');
  assert.match(head(docs.ko), /\]\(README\.md\)/, 'README.ko.md → README.md');
  assert.match(docs.en, /\bv0\.2\b/);
  assert.match(docs.ko, /\bv0\.2\b/);
});

test('두 문서는 같은 스크린샷 집합을 쓴다(-en / -ko만 다르다)', () => {
  const en = shotsOf(docs.en);
  const ko = shotsOf(docs.ko);
  assert.ok(en.length >= 4, `영어 README의 docs/shots 이미지 ${en.length}개`);
  assert.deepEqual(new Set(en.map(normalizeShot)), new Set(ko.map(normalizeShot)));
  for (const n of en) assert.match(n, /-en\.(gif|png)$/, n);
  for (const n of ko) assert.match(n, /-ko\.(gif|png)$/, n);
  for (const want of ['demo.gif', 'tv-choice.png', 'tv-book.png', 'phone-choice.png']) {
    assert.ok(en.map(normalizeShot).includes(want), `영어 README에 ${want}`);
  }
  // 스크린샷마다 alt 문장(배지 같은 외부 이미지는 제외) / every screenshot has alt text (external badges exempt)
  for (const md of Object.values(docs)) {
    for (const m of md.matchAll(/<img\b[^>]*>/g)) assert.match(m[0], /\balt="[^"]{10,}"/, m[0]);
    for (const m of md.matchAll(/!\[([^\]]*)\]\((docs\/shots\/[^)\s]+)/g)) assert.ok(m[1].length >= 10, `빈 alt: ${m[2]}`);
  }
});

test('docs/shots/ 밖의 상대 링크는 전부 실제 파일을 가리킨다', () => {
  const brief = read('docs/HANDOVER-v0.2.md');
  for (const p of PENDING) assert.ok(brief.includes(p), `PENDING에 있지만 브리프가 약속하지 않은 파일: ${p}`);
  for (const [lang, md] of Object.entries(docs)) {
    const links = relativeLinks(md).filter((p) => !p.startsWith('docs/shots/'));
    assert.ok(links.length >= 6, `${FILES[lang]}: 상대 링크 ${links.length}개`);
    for (const p of links) {
      assert.ok(!p.startsWith('/') && !p.includes('..'), `${FILES[lang]}: 저장소 밖 경로 ${p}`);
      if (PENDING.includes(p) && !fs.existsSync(path.join(ROOT, p))) continue;
      assert.ok(fs.existsSync(path.join(ROOT, p)), `${FILES[lang]}: 깨진 링크 ${p}`);
    }
  }
});

test('관찰 언어: 금지어가 없다 (한국어·영어 두 문서 모두)', () => {
  const KO = ['진단', '검사', '치료', '판정', '평가', '위기', '장애', '문제 행동', '문제행동'];
  const EN = [/diagnos/i, /therap/i, /treatment/i, /assess/i, /screening/i, /disorder/i, /at[ -]risk/i, /detect/i];
  for (const [lang, md] of Object.entries(docs)) {
    for (const w of KO) assert.ok(!md.includes(w), `${FILES[lang]}: 금지어 "${w}"`);
    for (const re of EN) assert.doesNotMatch(md, re, `${FILES[lang]}: forbidden word ${re}`);
  }
});

test('회사·후원사·모델 이름이 없다. 서명은 emoren / 이모렌', () => {
  for (const [lang, md] of Object.entries(docs)) {
    for (const s of ['더멤버스', 'THE MEMBERS']) assert.ok(!md.includes(s), `${FILES[lang]}: "${s}"`);
    assert.doesNotMatch(md, /anthropic/i, FILES[lang]);
    // 'claude.ai'는 배포 대상(아티팩트)이라 쓰이지만, 그 밖의 쓰임(모델·도우미 이름)은 없어야 한다.
    // 'claude.ai' names a deploy target; any other use would be a model or assistant name.
    assert.doesNotMatch(md.replace(/claude\.ai/g, ''), /claude/i, `${FILES[lang]}: 모델 이름`);
    assert.doesNotMatch(md, /\bcoins?\b|저금|코인|savings/i, `${FILES[lang]}: 금융 소재`);
    assert.match(md.trimEnd(), /emoren \/ 이모렌$/, `${FILES[lang]}: 마지막 줄 서명`);
  }
});

test('아키텍처 mermaid 그림이 두 문서에 있고 세 어댑터와 세 화면을 담는다', () => {
  for (const [lang, md] of Object.entries(docs)) {
    const m = md.match(/```mermaid\n([\s\S]+?)\n```/);
    assert.ok(m, `${FILES[lang]}: mermaid 블록`);
    for (const word of ['BroadcastChannel', 'claude.ai', 'Firebase', '#teacher-', '#tv-', '#parent-', 'subscribe']) {
      assert.ok(m[1].includes(word), `${FILES[lang]}: mermaid에 ${word}`);
    }
  }
});

test('색인의 모든 수업팩 id와 여섯 단계 유형이 두 문서에 있다', () => {
  const index = JSON.parse(read('packs/index.json'));
  assert.deepEqual(STEP_TYPES, ['talk', 'choice', 'activity', 'story', 'book', 'closing']);
  for (const [lang, md] of Object.entries(docs)) {
    for (const p of index.packs) {
      assert.ok(md.includes(`\`${p.id}\``), `${FILES[lang]}: 수업팩 ${p.id}`);
      for (const l of Object.values(p.langs)) assert.ok(md.includes(l.title), `${FILES[lang]}: 제목 ${l.title}`);
    }
    for (const type of STEP_TYPES) assert.ok(md.includes(`\`${type}\``), `${FILES[lang]}: 단계 유형 ${type}`);
    assert.ok(md.includes('docs/PACK-FORMAT.md') && md.includes('packs:check') && md.includes('`#studio`'), FILES[lang]);
  }
});

test('문서에 적힌 해시 주소는 전부 실제 라우트다(홈으로 떨어지지 않는다)', () => {
  for (const [lang, md] of Object.entries(docs)) {
    const routes = new Set([...md.matchAll(/`(#[a-z][a-z0-9-]*(?:-(?:CODE|코드))?)`/g)].map((m) => m[1]));
    assert.ok(routes.size >= 5, `${FILES[lang]}: 라우트 ${routes.size}개`);
    for (const r of routes) {
      const view = parseHash(r.replace(/CODE|코드/, 'DEMO')).view;
      assert.notEqual(view, 'home', `${FILES[lang]}: ${r} 는 라우트가 아니다`);
    }
    for (const must of [/`#demo(-[a-z]{2})?`/, /`#tv`/, /`#studio`/]) assert.match(md, must, FILES[lang]);
  }
  assert.ok(docs.en.includes('/emoren/#demo**') && docs.ko.includes('/emoren/#demo-ko**'), '호스팅 플레이그라운드 링크');
});

test('두 문서는 같은 뼈대다: 절 수, 코드 블록 언어, 표 수', () => {
  const shape = (md) => ({
    h2: (md.match(/^## /gm) || []).length,
    fences: (md.match(/^```[a-z]+$/gm) || []).sort(),
    tables: (md.match(/^\| --- /gm) || []).length,
    lines: md.split('\n').length,
  });
  const en = shape(docs.en);
  const ko = shape(docs.ko);
  assert.equal(en.h2, 10, '영어 README 절 10개');
  assert.equal(en.h2, ko.h2);
  assert.deepEqual(en.fences, ko.fences);
  assert.equal(en.tables, ko.tables);
  for (const [lang, s] of [['en', en], ['ko', ko]]) assert.ok(s.lines >= 120 && s.lines <= 260, `${FILES[lang]}: ${s.lines}줄`);
});
