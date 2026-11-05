// 단위 테스트: 「오늘 우리 반 책」 — 쪽 만들기(js/book.js), 읽는 시간과 자동 넘김, 방 상태의 book 필드(js/store.js). 실행: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bookPages, bookStep, pageDurationMs, currentBookPage, MAX_STAMPS } from '../../js/book.js';
import { newRoom, actions, bookPageCount, currentStep, storyVars } from '../../js/store.js';
import { setLang } from '../../js/i18n.js';
import { fmtDate } from '../../js/util.js';

const read = (f) => JSON.parse(fs.readFileSync(new URL(f, import.meta.url), 'utf8'));
const pack = read('../../packs/mind-weather.ko.json');
const packEn = read('../../packs/mind-weather.en.json');

// 해님 3, 구름 2, 비 1 로 집계된 방 / a room tallied sunny 3, cloudy 2, rainy 1
function tallied(p) {
  let s = actions.start(newRoom('BOOK', p), p);
  for (const [id, n] of [['sunny', 3], ['cloudy', 2], ['rainy', 1]]) for (let i = 0; i < n; i++) s = actions.tally(s, 'weather', id, 1);
  return s;
}
const noTemplate = (str) => assert.doesNotMatch(str, /\{|\[\[/, str);

test('쪽 순서: 표지 → 선택 → 몸놀이 → 이야기 → 뒤표지 (ko, en 모두)', () => {
  for (const p of [pack, packEn]) {
    const pages = bookPages(p, tallied(p));
    assert.deepEqual(pages.map((x) => x.kind), ['cover', 'choice', 'activity', 'story', 'back'], p.lang);
    assert.equal(pages.length, bookPageCount(p), `${p.lang}: store.bookPageCount와 같은 쪽 수`);
    assert.equal(pages[0].title, p.title);
    assert.equal(pages[0].kicker, bookStep(p).title);
    assert.equal(pages[0].line, bookStep(p).cover_line);
    assert.equal(pages[4].line, bookStep(p).back_line);
    for (const pg of pages) { assert.equal(typeof pg.line, 'string'); assert.ok(pg.line.length > 0, pg.kind); noTemplate(pg.line); }
  }
});

test('선택 쪽: 선택지마다 집계 수 n(스탬프는 화면에서 30개까지만 그리고 숫자는 늘 보인다)', () => {
  const s = tallied(pack);
  const page = bookPages(pack, s)[1];
  assert.equal(page.prompt, '지금 내 마음은 어떤 날씨일까?');
  assert.deepEqual(page.options.map((o) => [o.id, o.emoji, o.n]), [['sunny', '☀️', 3], ['cloudy', '☁️', 2], ['rainy', '🌧️', 1], ['stormy', '⛈️', 0]]);
  assert.equal(page.total, 6);
  assert.equal(MAX_STAMPS, 30);
  // 40명이 골라도 n은 원래 숫자 그대로(자르기는 화면의 몫) / the cap is a view concern: n stays raw
  let big = s;
  for (let i = 0; i < 40; i++) big = actions.tally(big, 'weather', 'stormy', 1);
  assert.equal(bookPages(pack, big)[1].options.find((o) => o.id === 'stormy').n, 40);
});

test('쪽의 글은 이야기 변수와 같은 목록을 쓰고 템플릿 찌꺼기가 없다', () => {
  const s = tallied(pack);
  const vars = storyVars(pack, s);
  const [cover, choice, activity, story, back] = bookPages(pack, s);
  assert.equal(vars.weather_list, '해님 3명, 구름 2명, 비 1명');
  assert.ok(choice.line.includes(vars.weather_list), choice.line);
  assert.ok(choice.line.includes(choice.prompt));
  assert.ok(activity.line.includes('날씨 몸놀이'), activity.line);
  assert.deepEqual(activity.moves.map((m) => m.emoji), ['☀️', '☁️', '🌧️', '⛈️']);
  assert.ok(story.text.includes('해님 3명, 구름 2명, 비 1명') && story.text.includes('해님이 제일 많았지요'));
  assert.equal(story.line, story.text);
  assert.equal(cover.date, fmtDate(s.startedAt, 'ko'));
  assert.match(cover.date, /^\d{4}년 \d{1,2}월 \d{1,2}일$/);
  assert.equal(back.kind, 'back');
  for (const pg of [cover, choice, activity, story, back]) noTemplate(pg.line);
});

test('쪽의 글은 언제나 수업팩 언어다: 화면 언어가 ko여도 영어 팩은 영어(tIn)', () => {
  setLang('ko');
  const s = tallied(packEn);
  const pages = bookPages(packEn, s);
  assert.equal(pages[1].line, "What's your mood weather right now? Our answers: 3 Sunny, 2 Cloudy, 1 Rainy.");
  assert.equal(pages[2].line, 'We did Weather moves together.');
  assert.match(pages[3].text, /^Today the sky over our class had 3 Sunny, 2 Cloudy, 1 Rainy\./);
  assert.equal(pages[0].date, fmtDate(s.startedAt, 'en'));
  assert.match(pages[0].date, /^[A-Z][a-z]+ \d{1,2}, \d{4}$/);
  // 표지·뒤표지 문구를 팩이 생략하면 팩 언어의 기본 문구 / defaults follow the pack language too
  const bare = { ...packEn, steps: packEn.steps.map((st) => (st.type === 'book' ? { id: st.id, type: 'book', title: st.title } : st)) };
  const dp = bookPages(bare, s);
  assert.equal(dp[0].line, 'Here is the "Mood Weather" book our class made today.');
  assert.equal(dp[4].line, 'Our class made this together.');
  setLang('en');
  const bareKo = { ...pack, steps: pack.steps.map((st) => (st.type === 'book' ? { id: st.id, type: 'book', title: st.title } : st)) };
  const kp = bookPages(bareKo, tallied(pack));
  assert.equal(kp[0].line, '오늘 우리 반이 만든 「오늘의 마음 날씨」 책이에요.');
  assert.equal(kp[4].line, '우리 반이 함께 만들었어요.');
  setLang('ko');
});

test('book 단계가 없는 팩은 쪽이 없다', () => {
  const noBook = { ...pack, steps: pack.steps.filter((st) => st.type !== 'book') };
  assert.deepEqual(bookPages(noBook, newRoom('X', noBook)), []);
  assert.equal(bookPageCount(noBook), 0);
  assert.equal(bookStep(noBook), null);
  const empty = bookPages(pack, newRoom('X', pack));
  assert.equal(empty.length, 5, '집계가 비어도 쪽은 다 있다');
  assert.ok(empty[1].line.includes('조용한 하늘'));
  assert.deepEqual(empty[1].options.map((o) => o.n), [0, 0, 0, 0]);
});

test('읽는 시간: 최소 4초 + 1.5초, 글자 수에 비례, 영어는 글자당 더 짧다', () => {
  assert.equal(pageDurationMs({ kind: 'cover', line: '짧아' }, 'ko'), 5500);
  assert.equal(pageDurationMs({ kind: 'back', line: '' }, 'en'), 5500);
  const ko60 = pageDurationMs({ kind: 'choice', line: '가'.repeat(60) }, 'ko');
  assert.equal(ko60, 60 * 115 + 1500);
  assert.equal(pageDurationMs({ kind: 'choice', line: 'a'.repeat(60) }, 'en'), 60 * 70 + 1500);
  assert.ok(pageDurationMs({ kind: 'choice', line: 'a'.repeat(60) }, 'en') < ko60);
  // 이야기 쪽은 line === text 라 두 번 세지 않는다 / the story page counts its text once
  const story = { kind: 'story', line: '가'.repeat(100), text: '가'.repeat(100) };
  assert.equal(pageDurationMs(story, 'ko'), 100 * 115 + 1500);
  const pages = bookPages(pack, tallied(pack));
  for (const pg of pages) assert.ok(pageDurationMs(pg, 'ko') >= 4000 + 1500, pg.kind);
});

test('지금 쪽: book 상태와 시각으로 결정되고, 마지막 쪽에서 멈춘다', () => {
  const pages = bookPages(pack, tallied(pack));
  const d = pages.map((pg) => pageDurationMs(pg, 'ko'));
  const t0 = 1_700_000_000_000;
  assert.equal(currentBookPage(pages, null, t0, 'ko'), 0, 'book이 없으면 0');
  assert.equal(currentBookPage(pages, { page: 0, startedAt: t0 }, t0, 'ko'), 0);
  assert.equal(currentBookPage(pages, { page: 0, startedAt: t0 }, t0 + d[0] - 1, 'ko'), 0);
  assert.equal(currentBookPage(pages, { page: 0, startedAt: t0 }, t0 + d[0], 'ko'), 1);
  assert.equal(currentBookPage(pages, { page: 0, startedAt: t0 }, t0 + d[0] + d[1] + d[2], 'ko'), 3);
  assert.equal(currentBookPage(pages, { page: 0, startedAt: t0 }, t0 + 10 * 60 * 1000, 'ko'), 4, '뒤표지에서 멈춘다(돌아가지 않는다)');
  assert.equal(currentBookPage(pages, { page: 2, startedAt: t0 }, t0 + d[2] + 10, 'ko'), 3, '중간 쪽에서 시작');
  assert.equal(currentBookPage(pages, { page: 9, startedAt: t0 }, t0, 'ko'), 4, '범위 밖은 마지막 쪽');
  assert.equal(currentBookPage(pages, { page: 1, startedAt: t0 }, t0 - 5000, 'ko'), 1, '시계가 앞서도 뒤로 가지 않는다');
  assert.equal(currentBookPage([], { page: 0, startedAt: t0 }, t0, 'ko'), 0);
});

test('방 상태: book 단계에 들어서면 첫 쪽을 펴고, 나가면 지운다', () => {
  assert.equal(newRoom('BOOK', pack).book, null);
  let s = tallied(pack);
  assert.equal(s.book, null, '인사 단계');
  const bookIndex = pack.steps.findIndex((st) => st.type === 'book');
  while (s.stepIndex < bookIndex - 1) s = actions.next(s, pack);
  assert.equal(s.book, null, '이야기 단계까지는 null');
  const before = Date.now();
  s = actions.next(s, pack);
  assert.equal(currentStep(pack, s).type, 'book');
  assert.deepEqual(Object.keys(s.book).sort(), ['page', 'startedAt']);
  assert.equal(s.book.page, 0);
  assert.ok(s.book.startedAt >= before && s.book.startedAt <= Date.now());
  s = actions.next(s, pack);
  assert.equal(currentStep(pack, s).type, 'closing');
  assert.equal(s.book, null, '다음 단계로 가면 지워진다');
  s = actions.prev(s, pack);
  assert.equal(currentStep(pack, s).type, 'book');
  assert.equal(s.book.page, 0, '이전으로 돌아와도 첫 쪽부터');
  s = actions.prev(s, pack);
  assert.equal(s.book, null, '이전 단계로 가도 지워진다');
  s = actions.next(s, pack);
  s = actions.next(s, pack);
  s = actions.next(s, pack);
  assert.equal(s.phase, 'done');
  assert.equal(s.book, null, '수업이 끝나면 null');
  assert.equal(actions.start(newRoom('X', pack), pack).book, null, '첫 단계는 책이 아니다');
  assert.equal(actions.start(newRoom('X', pack)).book, null, 'pack 없이 불러도 된다(이전 호출부 호환)');
});

test('bookPage: 쪽 번호를 [0, 쪽 수 - 1]로 자르고 speakSeq를 올린다', () => {
  let s = tallied(pack);
  while (currentStep(pack, s).type !== 'book') s = actions.next(s, pack);
  const seq = s.speakSeq;
  s = actions.bookPage(s, pack, 2);
  assert.equal(s.book.page, 2);
  assert.equal(s.speakSeq, seq + 1);
  assert.equal(actions.bookPage(s, pack, 99).book.page, 4);
  assert.equal(actions.bookPage(s, pack, -3).book.page, 0);
  assert.equal(actions.bookPage(s, pack, 1.7).book.page, 1);
  assert.equal(actions.bookPage(s, pack, 'x').book.page, 0);
  const t1 = actions.bookPage(s, pack, 3).book.startedAt;
  assert.ok(typeof t1 === 'number' && t1 > 0);
});

test('일시정지: 책 단계에서는 보이던 쪽을 붙들고, 돌아오면 같은 쪽을 처음부터', () => {
  let s = tallied(pack);
  while (currentStep(pack, s).type !== 'book') s = actions.next(s, pack);
  s = { ...s, book: { page: 0, startedAt: Date.now() - 60_000 } };   // 1분 전에 펼친 책: 저절로 뒤표지까지 갔을 시각
  const pages = bookPages(pack, s);
  const shown = currentBookPage(pages, s.book, Date.now(), 'ko');
  assert.equal(shown, 4);
  s = actions.togglePause(s, 2);   // 강사 폰이 '지금 2쪽'이라고 알려 준 경우
  assert.equal(s.phase, 'paused');
  assert.equal(s.book.page, 2);
  assert.ok(Date.now() - s.book.startedAt < 1000);
  assert.equal(currentBookPage(pages, s.book, Date.now(), 'ko'), 2, '쉬는 동안 넘어가지 않는다');
  s = actions.togglePause(s);
  assert.equal(s.phase, 'live');
  assert.equal(s.book.page, 2);
  assert.ok(Date.now() - s.book.startedAt < 1000, '돌아오면 그 쪽을 처음부터 읽는다');
  // 책 단계가 아니면 book은 null 그대로 / outside the book step nothing changes
  let p = actions.start(newRoom('X', pack), pack);
  p = actions.togglePause(p);
  assert.equal(p.phase, 'paused');
  assert.equal(p.book, null);
  assert.equal(actions.togglePause(p).book, null);
});

test('상태는 숫자·불리언·id·시각만 담는다: book은 숫자 두 개, 새 문자열 필드는 없다', () => {
  let s = tallied(pack);
  s = actions.startTimer(s, 'move', 60);
  while (currentStep(pack, s).type !== 'book') s = actions.next(s, pack);
  s = actions.bookPage(s, pack, 1);
  s = actions.note(s, '반 전체 메모');
  assert.deepEqual(Object.keys(s.book).sort(), ['page', 'startedAt']);
  assert.equal(typeof s.book.page, 'number');
  assert.equal(typeof s.book.startedAt, 'number');
  const strings = [];
  (function walk(v, path) {
    if (typeof v === 'string') strings.push(path);
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === 'object') for (const k of Object.keys(v)) walk(v[k], path ? `${path}.${k}` : k);
  })(JSON.parse(JSON.stringify(s)), '');
  const allowed = /^(code|packId|lang|phase|timer\.stepId|notes\[\d+\]\.text)$/;
  for (const p of strings) assert.match(p, allowed, `자유 문자열이 들어갈 수 없는 자리: ${p}`);
  assert.ok(!strings.some((p) => p.startsWith('book')), 'book에는 문자열이 없다');
});
