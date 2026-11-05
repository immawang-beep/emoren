// 단위 테스트: 해시 라우팅 규칙(js/route.js)
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHash } from '../../js/route.js';

test('세 화면: #tv-CODE, #teacher-CODE, #parent-CODE (코드는 대문자로 정리)', () => {
  assert.deepEqual(parseHash('#tv-demo'), { view: 'tv', code: 'DEMO' });
  assert.deepEqual(parseHash('#teacher-AB12'), { view: 'teacher', code: 'AB12' });
  assert.deepEqual(parseHash('#parent-XYZ'), { view: 'parent', code: 'XYZ' });
  assert.deepEqual(parseHash('#tv'), { view: 'tv', code: null });
  assert.equal(parseHash('#tv-AB').view, 'home', '코드는 3자 이상');
});

test('플레이그라운드: #demo, #demo-LANG, #demo-LANG-PACKID', () => {
  assert.deepEqual(parseHash('#demo'), { view: 'demo', code: null, lang: null, packId: null });
  assert.deepEqual(parseHash('#demo-en'), { view: 'demo', code: null, lang: 'en', packId: null });
  assert.deepEqual(parseHash('#demo-ko-mind-weather'), { view: 'demo', code: null, lang: 'ko', packId: 'mind-weather' });
  assert.deepEqual(parseHash('#demo-en-studio-draft'), { view: 'demo', code: null, lang: 'en', packId: 'studio-draft' });
  assert.equal(parseHash('#demo-english').view, 'home');
});

test('스튜디오와 홈', () => {
  assert.deepEqual(parseHash('#studio'), { view: 'studio', code: null });
  assert.equal(parseHash('').view, 'home');
  assert.equal(parseHash('#nope').view, 'home');
});
