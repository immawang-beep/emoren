// i18n 핵심 / i18n core.
// 두 언어(ko, en)의 UI 문자열을 돌려준다. 수업팩 본문은 여기서 다루지 않는다(packs/<id>.<lang>.json).
// Import-safe: window/localStorage/navigator는 호출 시점에만, typeof 검사 뒤에 쓴다(node:test에서도 불러올 수 있다).
//
//   LANGS          지원 언어 목록 ['ko', 'en']
//   detectLang()   localStorage 'emoren.lang' → navigator.language(ko*) → 'en'
//   getLang()      현재 언어(처음 부르면 detectLang())
//   setLang(lang, { persist = true })
//                  저장(localStorage) + <html lang> + window 이벤트 'emoren:lang' { detail: { lang } }
//   t(key, vars)   현재 언어 → en → key 순서로 찾고 {var}를 채운다. vars.n === 1이면 key + '_one'을 먼저 본다.
//   langName(lang) '한국어' / 'English'
import ko from './locales/ko.js';
import en from './locales/en.js';

export const LANGS = ['ko', 'en'];
export const STORAGE_KEY = 'emoren.lang';
const DICT = { ko, en };
const NAMES = { ko: '한국어', en: 'English' };

let current = null;

function normalize(lang) {
  const l = String(lang || '').toLowerCase().split(/[-_]/)[0];
  return LANGS.includes(l) ? l : null;
}

export function detectLang() {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = normalize(localStorage.getItem(STORAGE_KEY));
      if (saved) return saved;
    }
  } catch { /* 사생활 모드 등 */ }
  const nav = typeof navigator !== 'undefined' && navigator ? (navigator.language || '') : '';
  return /^ko/i.test(nav) ? 'ko' : 'en';
}

export function getLang() {
  if (!current) current = detectLang();
  return current;
}

export function setLang(lang, { persist = true } = {}) {
  const l = normalize(lang) || 'en';
  const changed = l !== current;
  current = l;
  if (persist) {
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, l); } catch { /* 무시 */ }
  }
  if (typeof document !== 'undefined' && document.documentElement) document.documentElement.lang = l;
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
    window.dispatchEvent(new CustomEvent('emoren:lang', { detail: { lang: l, changed } }));
  }
  return l;
}

export function langName(lang) {
  return NAMES[normalize(lang)] || String(lang || '');
}

function lookup(lang, key) {
  const d = DICT[lang];
  return d && Object.prototype.hasOwnProperty.call(d, key) ? d[key] : undefined;
}

export function interpolate(str, vars) {
  if (!vars) return str;
  return String(str).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

// 특정 언어로 찾기 / lookup in a specific language (fallback: en → key)
export function tIn(lang, key, vars) {
  const l = normalize(lang) || 'en';
  const one = vars && vars.n === 1;
  let str;
  for (const L of l === 'en' ? ['en'] : [l, 'en']) {
    if (one) str = lookup(L, key + '_one');
    if (str === undefined) str = lookup(L, key);
    if (str !== undefined) break;
  }
  return interpolate(str === undefined ? key : str, vars);
}

export function t(key, vars) {
  return tIn(getLang(), key, vars);
}

export function hasKey(key, lang = getLang()) {
  return lookup(normalize(lang) || 'en', key) !== undefined;
}
