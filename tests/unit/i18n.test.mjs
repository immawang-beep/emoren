// 단위 테스트: i18n 핵심(t 보간·대체 순서, 언어 감지, 날짜 표기). 실행: npm test
// i18n.js는 import 시점에 window/localStorage를 건드리지 않아야 node:test에서 돌아간다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { LANGS, t, tIn, getLang, setLang, detectLang, langName, hasKey, interpolate } from '../../js/i18n.js';
import ko from '../../js/locales/ko.js';
import en from '../../js/locales/en.js';
import { fmtDate } from '../../js/util.js';
import { SYNC_LABEL } from '../../js/store.js';

test('지원 언어와 이름', () => {
  assert.deepEqual(LANGS, ['ko', 'en']);
  assert.equal(langName('ko'), '한국어');
  assert.equal(langName('en'), 'English');
  assert.equal(langName('en-US'), 'English');
});

test('감지: localStorage·navigator가 없으면 en, setLang 뒤에는 그 언어', () => {
  assert.equal(detectLang(), 'en');
  assert.equal(setLang('ko'), 'ko');
  assert.equal(getLang(), 'ko');
  assert.equal(setLang('en-GB'), 'en', '지역 코드는 짧은 코드로 정리된다');
  assert.equal(setLang('xx'), 'en', '모르는 언어는 en');
});

test('t(): 현재 언어 → en → key 순서로 찾고 {var}를 채운다', () => {
  setLang('ko');
  assert.equal(t('home.title'), '이모렌 교실');
  assert.equal(t('common.minutes', { n: 15 }), '15분');
  assert.equal(t('teacher.codeLabel', { code: 'DEMO' }), '수업 코드 DEMO');
  assert.equal(t('parent.joined', { n: 1 }), '1명이 함께했어요', 'ko에는 _one이 없으니 기본 문구');
  assert.equal(t('no.such.key'), 'no.such.key');
  assert.equal(t('home.teacher.newHint', {}).includes('{link}'), true, '없는 변수는 그대로 둔다');
  setLang('en');
  assert.equal(t('home.title'), 'Emoren Classroom');
  assert.equal(t('parent.joined', { n: 3 }), '3 children joined');
  assert.equal(t('parent.joined', { n: 1 }), '1 child joined', '_one 키 우선');
  assert.equal(tIn('ko', 'tv.paused'), '잠깐 쉬어요');
  assert.equal(interpolate('{a}-{b}', { a: 1 }), '1-{b}');
});

test('en에만 있는 키는 ko에서도 en으로 대체된다', () => {
  setLang('ko');
  assert.equal(hasKey('parent.joined_one', 'ko'), false);
  assert.equal(tIn('ko', 'parent.joined_one'), '1 child joined');
});

test('두 사전은 같은 키 집합을 가진다(_one 변형 제외)', () => {
  const strip = (o) => Object.keys(o).filter((k) => !k.endsWith('_one')).sort();
  assert.deepEqual(strip(ko), strip(en));
  for (const k of Object.keys(ko)) assert.equal(typeof ko[k], 'string', k);
  for (const k of Object.keys(en)) assert.equal(typeof en[k], 'string', k);
});

test('SYNC_LABEL은 현재 언어를 따른다', () => {
  setLang('ko');
  assert.equal(SYNC_LABEL.local, '같은 브라우저 동기화');
  setLang('en');
  assert.equal(SYNC_LABEL.local, 'Same-browser sync');
  assert.equal(SYNC_LABEL.firebase, 'Firebase sync');
});

test('fmtDate: 언어별 날짜 표기', () => {
  const ts = new Date(2026, 10, 5, 12).getTime();
  assert.equal(fmtDate(ts, 'ko'), '2026년 11월 5일');
  assert.equal(fmtDate(ts, 'en'), 'November 5, 2026');
  assert.equal(fmtDate(ts), '2026년 11월 5일', '기본은 한국어');
});
