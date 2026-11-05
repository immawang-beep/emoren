// 수업팩 불러오기와 형식 검사. 수업팩은 언어별 JSON 한 장(packs/<id>.<lang>.json)으로 수업 전체를 정의한다.
// Lesson packs: one JSON per language, packs/<id>.<lang>.json. packs/index.json lists ids and their languages.
// 형식 설명: docs/PACK-FORMAT.md
import { getLang } from './i18n.js';

const cache = new Map();      // `${id}.${lang}` → pack
let indexPromise = null;
export const DEFAULT_PACK = 'mind-weather';
export const STEP_TYPES = ['talk', 'choice', 'activity', 'story', 'book', 'closing'];

const safeId = (id) => String(id || '').replace(/[^a-z0-9-]/gi, '').toLowerCase();
const safeLang = (lang) => String(lang || '').replace(/[^a-z-]/gi, '').toLowerCase().split('-')[0];

export async function loadPackIndex() {
  if (!indexPromise) {
    indexPromise = (async () => {
      const res = await fetch('packs/index.json');
      if (!res.ok) throw new Error('packs/index.json을 찾을 수 없어요 / packs/index.json not found');
      const idx = await res.json();
      idx.packs = (idx.packs || []).map((p) => ({ ...p, langs: p.langs || {} }));
      return idx;
    })().catch((e) => { indexPromise = null; throw e; });
  }
  return indexPromise;
}

// 색인의 한 팩이 가진 언어 목록 / languages a pack is available in (index order)
export function packLangs(entry) {
  return entry && entry.langs ? Object.keys(entry.langs) : [];
}

// 홈 화면용: 팩 × 언어 평면 목록 / flat list of { id, lang, title, domain, age, minutes }
export function listPackChoices(index) {
  const out = [];
  for (const p of (index && index.packs) || []) {
    for (const lang of packLangs(p)) out.push({ id: p.id, lang, ...(p.langs[lang] || {}) });
  }
  return out;
}

// 팩에 있는 언어 중 고르기: 원하는 언어 → UI 언어 → 첫 번째 / pick a language the pack has
export function pickPackLang(entry, want) {
  const langs = packLangs(entry);
  if (!langs.length) return null;
  for (const l of [safeLang(want), getLang()]) if (l && langs.includes(l)) return l;
  return langs[0];
}

// 스튜디오 초안: #studio가 localStorage(emoren.studio.draft)에 둔 팩을 id 'studio-draft'로 불러온다(TV 미리 보기용).
// Studio draft: the pack #studio keeps in localStorage is loadable as id 'studio-draft' (for TV preview).
export const STUDIO_DRAFT_ID = 'studio-draft';
export const STUDIO_DRAFT_KEY = 'emoren.studio.draft';
function readDraft() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STUDIO_DRAFT_KEY) : null;
    if (!raw) return null;
    const pack = JSON.parse(raw);
    validatePack(pack);
    return { ...pack, id: STUDIO_DRAFT_ID };
  } catch (e) { console.warn('[pack] studio draft', e); return null; }
}

async function fetchPack(id, lang) {
  if (id === STUDIO_DRAFT_ID) return readDraft();
  const key = `${id}.${lang}`;
  if (cache.has(key)) return cache.get(key);
  const res = await fetch(`packs/${id}.${lang}.json`);
  if (!res.ok) return null;
  const pack = await res.json();
  validatePack(pack);
  cache.set(key, pack);
  return pack;
}

// loadPack(id, lang): packs/<id>.<lang>.json. 그 언어가 없으면 index.json에 적힌 첫 번째 언어로 대신한다.
// Falls back to the first language listed for the pack in index.json.
export async function loadPack(id, lang) {
  const sid = safeId(id);
  const want = safeLang(lang);
  if (want) {
    const direct = await fetchPack(sid, want).catch((e) => { if (/형식 오류|format/.test(String(e && e.message))) throw e; return null; });
    if (direct) return direct;
  }
  let entry = null;
  try { entry = ((await loadPackIndex()).packs || []).find((p) => p.id === sid) || null; } catch { /* 색인 없이도 시도 */ }
  const fallback = pickPackLang(entry, want) || (want ? null : getLang());
  if (fallback && fallback !== want) {
    const pack = await fetchPack(sid, fallback);
    if (pack) { if (want) cache.set(`${sid}.${want}`, pack); return pack; }
  }
  throw new Error(`수업팩 '${sid}'(${want || fallback || '?'})을(를) 찾을 수 없어요 / lesson pack '${sid}' (${want || fallback || '?'}) not found`);
}

export function validatePack(p) {
  const errs = [];
  if (!p || typeof p !== 'object') throw new Error('수업팩이 JSON 객체가 아니에요 / pack is not a JSON object');
  if (!p.id) errs.push('id 없음 / missing id');
  if (!p.lang || !/^[a-z]{2,3}(-[A-Za-z0-9]+)?$/.test(String(p.lang))) errs.push('lang 없음 (예: ko, en) / missing lang');
  if (!p.title) errs.push('title 없음 / missing title');
  if (!Array.isArray(p.steps) || p.steps.length === 0) errs.push('steps 비어 있음 / steps empty');
  const ids = new Set();
  let books = 0;
  for (const s of p.steps || []) {
    if (!s.id) errs.push('단계 id 없음 / missing step id');
    else if (ids.has(s.id)) errs.push(`단계 id 중복 / duplicate step id: ${s.id}`);
    ids.add(s.id);
    if (!STEP_TYPES.includes(s.type)) errs.push(`알 수 없는 단계 유형 / unknown step type: ${s.id} (${s.type})`);
    if ((s.type === 'talk' || s.type === 'closing') && !(Array.isArray(s.lines) && s.lines.length)) errs.push(`lines 없음 / missing lines: ${s.id}`);
    if (s.type === 'choice') {
      if (!s.prompt) errs.push(`prompt 없음 / missing prompt: ${s.id}`);
      if (!Array.isArray(s.options) || s.options.length < 2) errs.push(`options 2개 이상 필요 / needs 2+ options: ${s.id}`);
      const oids = new Set();
      for (const o of s.options || []) {
        if (!o.id || !o.label) errs.push(`선택지 id/label 없음 / option missing id/label: ${s.id}`);
        if (oids.has(o.id)) errs.push(`선택지 id 중복 / duplicate option id: ${s.id}/${o.id}`);
        oids.add(o.id);
      }
    }
    if (s.type === 'activity' && !(Number(s.timer_sec) > 0)) errs.push(`timer_sec 필요 / timer_sec required: ${s.id}`);
    if (s.type === 'story' && !s.template) errs.push(`template 없음 / missing template: ${s.id}`);
    if (s.type === 'book') {
      // 「오늘 우리 반 책」: 쪽은 상태에서 만든다. 팩에는 제목과 앞·뒤표지 한 줄만 / pages are built from state
      if (!s.title) errs.push(`title 없음 / missing title: ${s.id}`);
      for (const k of ['cover_line', 'back_line']) if (s[k] != null && typeof s[k] !== 'string') errs.push(`${k}는 문자열 / ${k} must be a string: ${s.id}`);
      if (books++) errs.push(`book 단계는 하나만 / only one book step: ${s.id}`);
    }
  }
  if (errs.length) throw new Error('수업팩 형식 오류 / pack format error: ' + errs.join(', '));
  return true;
}
