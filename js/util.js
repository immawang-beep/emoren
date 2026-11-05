// 공용 유틸리티: HTML 이스케이프, 수업 코드, 날짜 표기, 링크 만들기

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

// 헷갈리는 글자(0/O, 1/I/L)를 뺀 알파벳으로 코드를 만든다.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
// 32비트 난수가 이 값 이상이면 버리고 그 자리만 다시 뽑는다(x % 31의 편향 제거) / reject-and-redraw bound so x % 31 is unbiased
const LIMIT = 2 ** 32 - (2 ** 32 % ALPHABET.length);
export function makeCode(len = 4) {
  const fill = (arr) => {
    if (globalThis.crypto && typeof crypto.getRandomValues === 'function') crypto.getRandomValues(arr);
    else for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 2 ** 32);
    return arr;
  };
  const arr = fill(new Uint32Array(len));
  for (let i = 0; i < len; i++) while (arr[i] >= LIMIT) arr[i] = fill(new Uint32Array(1))[0];
  return Array.from(arr, (x) => ALPHABET[x % ALPHABET.length]).join('');
}

export function normalizeCode(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

// 날짜 표기 / date label. ko: 2026년 11월 5일, en: November 5, 2026
const DATE_LOCALE = { ko: 'ko-KR', en: 'en-US' };
export function fmtDate(ts, lang = 'ko') {
  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return ''; // 날짜가 아니면(NaN·undefined 등) 빈 문자열 / not a date → '' (never 'NaN년')
  const loc = DATE_LOCALE[String(lang || '').slice(0, 2)] || String(lang || 'ko-KR');
  try {
    return new Intl.DateTimeFormat(loc, { year: 'numeric', month: 'long', day: 'numeric' }).format(d);
  } catch {
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
  }
}

export function pageUrl(hash) {
  return location.href.split('#')[0] + '#' + hash;
}

export function readLocal(key, fallback = null) {
  try { const v = localStorage.getItem(key); return v == null ? fallback : v; } catch { return fallback; }
}
export function writeLocal(key, value) {
  try { localStorage.setItem(key, value); } catch { /* 사생활 모드 등: 조용히 넘어간다 */ }
}
