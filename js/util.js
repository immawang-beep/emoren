// 공용 유틸리티: HTML 이스케이프, 수업 코드, 날짜 표기, 링크 만들기

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

// 헷갈리는 글자(0/O, 1/I/L)를 뺀 알파벳으로 코드를 만든다.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function makeCode(len = 4) {
  const arr = new Uint32Array(len);
  if (globalThis.crypto && typeof crypto.getRandomValues === 'function') crypto.getRandomValues(arr);
  else for (let i = 0; i < len; i++) arr[i] = Math.floor(Math.random() * 1e9);
  return Array.from(arr, (x) => ALPHABET[x % ALPHABET.length]).join('');
}

export function normalizeCode(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

export function fmtDate(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
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
