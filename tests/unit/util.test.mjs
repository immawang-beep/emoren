// 단위 테스트: 공용 유틸리티(js/util.js) — HTML 이스케이프, 수업 코드, 날짜 표기, 링크, localStorage 보호막. 실행: npm test
// Unit tests for js/util.js: esc, makeCode, normalizeCode, fmtDate, pageUrl, readLocal/writeLocal.
// util.js는 import 시점에 location/localStorage/crypto를 건드리지 않아야 node:test에서 돌아간다.
// 브라우저 전역(location, localStorage, crypto)은 각 테스트 안에서만 가짜로 바꾸고 finally에서 되돌린다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { esc, makeCode, normalizeCode, fmtDate, pageUrl, readLocal, writeLocal } from '../../js/util.js';

// 전역 속성을 fn이 도는 동안만 바꿨다가 원래 설명자(또는 없음)로 되돌린다 / swap a global for fn, then restore it
function withGlobal(name, value, fn) {
  const had = Object.hasOwn(globalThis, name);
  const desc = had ? Object.getOwnPropertyDescriptor(globalThis, name) : undefined;
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true, enumerable: true });
  try {
    return fn();
  } finally {
    if (had) Object.defineProperty(globalThis, name, desc);
    else delete globalThis[name];
  }
}

// Math.random을 잠시 바꾼다 / temporarily replace Math.random
function withRandom(fn, body) {
  const orig = Math.random;
  Math.random = fn;
  try { return body(); } finally { Math.random = orig; }
}

// 가짜 localStorage: Map 기반 / Map-backed fake storage
function fakeStorage() {
  const store = new Map();
  return {
    store,
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
  };
}

// 사생활 모드처럼 모든 접근이 던지는 저장소 / storage that throws on every access (private mode)
const throwingStorage = {
  getItem() { throw new Error('SecurityError: The operation is insecure.'); },
  setItem() { throw new Error('QuotaExceededError'); },
};

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]*$/;
const TS = new Date(2026, 10, 5, 12).getTime(); // 2026-11-05 정오(현지 시각) — 시간대와 무관하게 같은 날짜

// ---------- esc

test('esc: & < > " \' 다섯 글자를 HTML 엔티티로 바꾼다', () => {
  assert.equal(esc('&'), '&amp;');
  assert.equal(esc('<'), '&lt;');
  assert.equal(esc('>'), '&gt;');
  assert.equal(esc('"'), '&quot;');
  assert.equal(esc("'"), '&#39;');
  assert.equal(esc('<a href="x">Tom & Jerry\'s</a>'), '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;');
  assert.equal(esc('" onclick="alert(1)'), '&quot; onclick=&quot;alert(1)', '속성값 탈출을 막는다');
  assert.equal(esc('&amp;'), '&amp;amp;', '이미 엔티티여도 다시 이스케이프한다(원문은 원문대로)');
});

test('esc: 안전한 글자는 그대로 두고 결과에는 위험 글자가 남지 않는다', () => {
  assert.equal(esc('안녕 hello 123 ☀️ -_./?=:'), '안녕 hello 123 ☀️ -_./?=:');
  assert.equal(esc(''), '');
  const out = esc('<<>>""\'\'&& 마음 날씨 <b>');
  assert.doesNotMatch(out, /[<>"']/);
  assert.doesNotMatch(out, /&(?!amp;|lt;|gt;|quot;|#39;)/, '&는 엔티티의 일부로만 남는다');
});

test('esc: null/undefined는 빈 문자열, 숫자·불리언은 문자열이 된다', () => {
  assert.equal(esc(null), '');
  assert.equal(esc(undefined), '');
  assert.equal(esc(), '');
  assert.equal(esc(0), '0', '0은 빈 문자열이 아니라 "0"');
  assert.equal(esc(15), '15');
  assert.equal(esc(1.5), '1.5');
  assert.equal(esc(-3), '-3');
  assert.equal(esc(NaN), 'NaN');
  assert.equal(esc(false), 'false');
  assert.equal(esc(true), 'true');
  for (const v of [null, undefined, 0, 7, '', 'x', false, {}, []]) assert.equal(typeof esc(v), 'string');
});

// ---------- makeCode

test('makeCode: 기본 4자, 길이 지정, 헷갈리는 글자(0/O/1/I/L) 없음', () => {
  assert.equal(makeCode().length, 4);
  assert.equal(makeCode(6).length, 6);
  assert.equal(makeCode(8).length, 8);
  assert.equal(makeCode(1).length, 1);
  assert.equal(makeCode(0), '');
  for (let i = 0; i < 200; i++) {
    const code = makeCode();
    assert.match(code, /^[A-Z2-9]{4}$/, `대문자·숫자 4자: ${code}`);
    assert.match(code, CODE_RE, `알파벳 밖의 글자: ${code}`);
    assert.doesNotMatch(code, /[01OIL]/, `헷갈리는 글자: ${code}`);
    assert.equal(normalizeCode(code), code, '만든 코드는 normalizeCode를 거쳐도 그대로다');
  }
  for (let i = 0; i < 50; i++) assert.match(makeCode(8), /^[A-Z2-9]{8}$/);
});

test('makeCode: 200번 뽑으면 모두 같지 않다', () => {
  const codes = new Set(Array.from({ length: 200 }, () => makeCode()));
  assert.ok(codes.size > 1, '200개가 전부 같은 코드');
  assert.ok(codes.size > 100, `200번 중 서로 다른 코드가 ${codes.size}개뿐`);
});

test('makeCode: crypto.getRandomValues가 있으면 그것을 쓰고 Math.random은 건드리지 않는다', () => {
  const calls = [];
  const fakeCrypto = {
    getRandomValues(arr) {
      calls.push(arr);
      for (let i = 0; i < arr.length; i++) arr[i] = i; // 0,1,2,… → A,B,C,…
      return arr;
    },
  };
  withGlobal('crypto', fakeCrypto, () => withRandom(() => { throw new Error('Math.random이 호출됨'); }, () => {
    assert.equal(makeCode(), 'ABCD');
    assert.equal(makeCode(6), 'ABCDEF');
    assert.equal(calls.length, 2);
    assert.ok(calls[0] instanceof Uint32Array, '32비트 정수 배열을 넘긴다');
    assert.equal(calls[0].length, 4);
    assert.equal(calls[1].length, 6);
  }));
  // 큰 값은 알파벳 길이(31)로 나눈 나머지를 쓴다(0xFFFFFFFB가 받아들이는 가장 큰 값; 그 위는 아래 거부 테스트)
  // large values wrap modulo the alphabet length (0xFFFFFFFB is the largest accepted value; see the rejection test)
  const wrap = { getRandomValues(arr) { arr.set([0, 30, 31, 0xFFFFFFFB]); return arr; } };
  withGlobal('crypto', wrap, () => {
    assert.equal(makeCode(), 'A' + ALPHABET[30] + 'A' + ALPHABET[0xFFFFFFFB % 31]);
    assert.equal(makeCode(), 'A9A9');
  });
});

test('makeCode: crypto가 없거나 getRandomValues가 없으면 Math.random으로 대신한다', () => {
  withGlobal('crypto', undefined, () => {
    let n = 0;
    withRandom(() => { n++; return 0; }, () => {
      assert.equal(makeCode(), 'AAAA');
      assert.equal(n, 4, '글자 수만큼 Math.random을 부른다');
      assert.equal(makeCode(2), 'AA');
    });
    withRandom(() => 0.9999999, () => assert.match(makeCode(), CODE_RE));
    for (let i = 0; i < 100; i++) assert.match(makeCode(), /^[A-Z2-9]{4}$/, '진짜 Math.random으로도 알파벳 안의 글자만');
  });
  withGlobal('crypto', {}, () => withRandom(() => 0, () => assert.equal(makeCode(), 'AAAA')));
});

test('makeCode: 2^32 - (2^32 % 31) 이상인 난수는 버리고 그 자리만 다시 뽑는다(나머지 편향 없음)', () => {
  const LIMIT = 2 ** 32 - (2 ** 32 % ALPHABET.length); // 4294967292 = 31 × 138547332
  assert.equal(LIMIT, 0xFFFFFFFC);
  assert.equal(LIMIT % ALPHABET.length, 0, '전제: 경계 아래의 값은 31개 글자에 정확히 같은 수만큼 나뉜다');
  // crypto 경로: 첫 4개 중 둘이 거부 → 거부된 자리마다 1개짜리 배열로 다시 뽑고, 또 거부되면 또 뽑는다
  // crypto path: two of the first four are rejected → each rejected slot is redrawn with a 1-element array until accepted
  const seq = [[0, LIMIT, 0xFFFFFFFF, LIMIT - 1], [LIMIT], [1], [2]];
  const sizes = [];
  const fake = { getRandomValues(arr) { sizes.push(arr.length); arr.set(seq.shift()); return arr; } };
  withGlobal('crypto', fake, () => withRandom(() => { throw new Error('Math.random이 호출됨'); }, () => {
    assert.equal(makeCode(), 'ABC9', '거부된 자리는 다시 뽑은 값(B, C)으로, 받아들인 자리는 그대로(A, 9)');
    assert.deepEqual(sizes, [4, 1, 1, 1], '4개를 한 번에 뽑고 거부된 자리마다 1개씩');
    assert.equal(seq.length, 0);
  }));
  // Math.random 대체 경로도 32비트 값을 뽑아 같은 경계로 거른다 / the fallback draws 32-bit values and rejects the same way
  withGlobal('crypto', undefined, () => {
    const rs = [0, LIMIT, 0xFFFFFFFF, LIMIT - 1, LIMIT, 1, 2].map((x) => x / 2 ** 32);
    withRandom(() => rs.shift(), () => {
      assert.equal(makeCode(), 'ABC9');
      assert.equal(rs.length, 0, 'Math.random을 7번(4 + 거부 3) 부른다');
    });
  });
});

// ---------- normalizeCode

test('normalizeCode: 대문자화, 영숫자 외 제거, 8자로 자른다', () => {
  assert.equal(normalizeCode('abcd'), 'ABCD');
  assert.equal(normalizeCode('ab cd'), 'ABCD');
  assert.equal(normalizeCode(' a-b_c.d '), 'ABCD');
  assert.equal(normalizeCode('a\tb\nc d'), 'ABCD');
  assert.equal(normalizeCode('한글abcd!'), 'ABCD', '한글·기호는 빠진다');
  assert.equal(normalizeCode('abcdefghij'), 'ABCDEFGH', '8자까지만');
  assert.equal(normalizeCode('abcdefghij').length, 8);
  assert.equal(normalizeCode('a-b-c-d-e-f-g-h-i-j'), 'ABCDEFGH', '기호를 뺀 뒤에 자른다');
  assert.equal(normalizeCode('0o1il'), '0O1IL', '직접 친 코드의 0/O/1/I/L은 그대로 둔다');
  assert.equal(normalizeCode('WXYZ2345'), 'WXYZ2345');
});

test('normalizeCode: 빈 값·null·숫자도 문자열로 조용히 처리하고 두 번 해도 같다', () => {
  assert.equal(normalizeCode(''), '');
  assert.equal(normalizeCode(null), '');
  assert.equal(normalizeCode(undefined), '');
  assert.equal(normalizeCode(), '');
  assert.equal(normalizeCode(1234), '1234');
  assert.equal(normalizeCode('   '), '');
  assert.equal(normalizeCode('!!!'), '');
  for (const s of ['abcd', ' a b c d e f g h i ', '한글', 'Ab-Cd', '']) {
    assert.equal(normalizeCode(normalizeCode(s)), normalizeCode(s));
  }
});

// ---------- fmtDate

test('fmtDate: ko/en, 지역 코드는 앞 두 글자로 고르고 기본은 ko', () => {
  assert.equal(fmtDate(TS, 'ko'), '2026년 11월 5일');
  assert.equal(fmtDate(TS, 'en'), 'November 5, 2026');
  assert.equal(fmtDate(TS, 'ko-KR'), '2026년 11월 5일');
  assert.equal(fmtDate(TS, 'en-GB'), 'November 5, 2026', 'en-*은 en으로 묶인다');
  assert.equal(fmtDate(TS), '2026년 11월 5일', '기본은 한국어');
  assert.equal(fmtDate(TS, null), '2026년 11월 5일');
  assert.equal(fmtDate(TS, ''), '2026년 11월 5일');
  assert.equal(fmtDate(new Date(TS), 'en'), 'November 5, 2026', 'Date 객체도 받는다');
  assert.equal(fmtDate(new Date(2026, 0, 1, 12).getTime(), 'en'), 'January 1, 2026');
});

test('fmtDate: 모르는 언어 문자열이면 던지지 않고 년/월/일 표기로 돌아간다', () => {
  // Intl이 거부하는 문자열 → catch 경로 / strings Intl rejects take the fallback path
  for (const bad of ['???', 'x', 'not a locale', 'ko_KR!', '123']) {
    assert.throws(() => new Intl.DateTimeFormat(bad), RangeError, `전제: Intl은 ${JSON.stringify(bad)}를 거부한다`);
    assert.equal(fmtDate(TS, bad), '2026년 11월 5일', `fallback for ${JSON.stringify(bad)}`);
  }
  // 형식은 맞지만 목록에 없는 언어 → Intl에 맡기고(기본 언어로 대체될 수 있음) 던지지 않는다
  for (const other of ['fr', 'xx', 'zz-ZZ', 'ja-JP']) {
    const out = fmtDate(TS, other);
    assert.equal(typeof out, 'string');
    assert.match(out, /2026/, `${other}: ${out}`);
    assert.match(out, /(^|\D)5(\D|$)/, `${other}: 날짜 5가 들어 있다 (${out})`);
  }
  assert.equal(fmtDate(new Date(2026, 2, 9, 12).getTime(), '???'), '2026년 3월 9일', '대체 표기는 0을 채우지 않는다');
});

test('fmtDate: Intl 자체가 실패해도 년/월/일 표기로 돌아간다', () => {
  const orig = Intl.DateTimeFormat;
  Intl.DateTimeFormat = function () { throw new RangeError('no Intl here'); };
  try {
    assert.equal(fmtDate(TS, 'en'), '2026년 11월 5일');
    assert.equal(fmtDate(TS, 'ko'), '2026년 11월 5일');
  } finally {
    Intl.DateTimeFormat = orig;
  }
  assert.equal(fmtDate(TS, 'en'), 'November 5, 2026', '되돌린 뒤에는 다시 Intl 표기');
});

test('fmtDate: 날짜가 아니면(NaN·undefined·Infinity·글자·Invalid Date) 던지지 않고 빈 문자열을 돌려준다', () => {
  // 예전에는 catch 경로에서 'NaN년 NaN월 NaN일'이 나왔다 / used to render 'NaN년 NaN월 NaN일' through the catch path
  for (const bad of [NaN, undefined, Infinity, -Infinity, 'not a date', '', new Date('nope'), {}]) {
    for (const lang of ['ko', 'en', '???']) assert.equal(fmtDate(bad, lang), '', `${String(bad)} / ${lang}`);
  }
  assert.equal(fmtDate(), '', '인자가 없어도 빈 문자열');
  const orig = Intl.DateTimeFormat;
  Intl.DateTimeFormat = function () { throw new RangeError('no Intl here'); };
  try { assert.equal(fmtDate(NaN, 'ko'), '', 'Intl이 없어도 NaN년이 아니라 빈 문자열'); } finally { Intl.DateTimeFormat = orig; }
  assert.equal(fmtDate(TS, 'ko'), '2026년 11월 5일', '정상 값은 그대로');
});

// ---------- pageUrl

test('pageUrl: 현재 주소의 해시를 떼고 새 해시를 붙인다', () => {
  assert.equal(Object.hasOwn(globalThis, 'location'), false, '전제: node에는 location이 없다');
  withGlobal('location', { href: 'https://example.test/classroom/index.html#teacher-ABCD' }, () => {
    assert.equal(pageUrl('tv-ABCD'), 'https://example.test/classroom/index.html#tv-ABCD');
    assert.equal(pageUrl('parent-ABCD'), 'https://example.test/classroom/index.html#parent-ABCD');
    assert.equal(pageUrl('tv-ABCD'), pageUrl('tv-ABCD'), '같은 입력이면 같은 링크');
  });
  withGlobal('location', { href: 'https://example.test/' }, () => {
    assert.equal(pageUrl('tv-WXYZ'), 'https://example.test/#tv-WXYZ', '해시가 없어도 된다');
  });
  withGlobal('location', { href: 'https://example.test/app/?v=2#demo-ko' }, () => {
    assert.equal(pageUrl('studio'), 'https://example.test/app/?v=2#studio', '쿼리는 남기고 해시만 바꾼다');
  });
  withGlobal('location', { href: 'http://localhost:8080/index.html#tv-A#B' }, () => {
    assert.equal(pageUrl('tv-C'), 'http://localhost:8080/index.html#tv-C', '해시 안의 #도 모두 떼어 낸다');
  });
  assert.equal(Object.hasOwn(globalThis, 'location'), false, '테스트가 끝나면 location을 되돌린다');
});

// ---------- readLocal / writeLocal

test('readLocal/writeLocal: 가짜 localStorage에 쓰고 읽는다', () => {
  const storage = fakeStorage();
  withGlobal('localStorage', storage, () => {
    assert.equal(readLocal('emoren.pack'), null, '없으면 기본 fallback은 null');
    assert.equal(readLocal('emoren.pack', 'mind-weather'), 'mind-weather', '없으면 넘긴 fallback');
    assert.equal(writeLocal('emoren.pack', 'book'), undefined);
    assert.equal(readLocal('emoren.pack', 'mind-weather'), 'book');
    assert.equal(storage.store.get('emoren.pack'), 'book');
    writeLocal('emoren.lastCode', 'ABCD');
    assert.equal(readLocal('emoren.lastCode', ''), 'ABCD');
    writeLocal('n', 3);
    assert.equal(readLocal('n'), '3', '값은 문자열로 저장된다');
    writeLocal('e', '');
    assert.equal(readLocal('e', 'fallback'), '', '빈 문자열은 값이지 "없음"이 아니다');
    writeLocal('emoren.pack', 'again');
    assert.equal(readLocal('emoren.pack'), 'again', '덮어쓴다');
  });
  assert.equal(Object.hasOwn(globalThis, 'localStorage'), false, '테스트가 끝나면 localStorage를 되돌린다');
});

test('readLocal/writeLocal: 던지는 저장소(사생활 모드)에서는 fallback을 돌려주고 던지지 않는다', () => {
  withGlobal('localStorage', throwingStorage, () => {
    assert.doesNotThrow(() => writeLocal('emoren.pack', 'book'));
    assert.doesNotThrow(() => readLocal('emoren.pack'));
    assert.equal(readLocal('emoren.pack', 'mind-weather'), 'mind-weather');
    assert.equal(readLocal('emoren.pack'), null);
    assert.equal(readLocal('emoren.lastCode', ''), '');
  });
});

test('readLocal/writeLocal: localStorage가 아예 없어도 fallback을 돌려주고 던지지 않는다', () => {
  withGlobal('localStorage', undefined, () => {
    assert.doesNotThrow(() => writeLocal('k', 'v'));
    assert.equal(readLocal('k', 'fb'), 'fb');
    assert.equal(readLocal('k'), null);
  });
  // node 기본 환경(전역 자체가 없음)에서도 같다 / same when the global is missing entirely
  if (!Object.hasOwn(globalThis, 'localStorage')) {
    assert.doesNotThrow(() => writeLocal('k', 'v'));
    assert.equal(readLocal('k', 'fb'), 'fb');
  }
});
