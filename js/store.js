// 수업 방(room) 상태와 순수 리듀서.
// 강사 폰만 상태를 바꾸고(쓰기), TV와 보호자 페이지는 읽기만 한다.
// 상태는 JSON 하나로 끝난다: 어떤 동기화 방식(같은 브라우저 / 클라우드 / Firebase)이든 그대로 실어 나른다.

import { t } from './i18n.js';
import { normalizeCode } from './util.js';

export const VERSION = 1;

// 동기화 방식 이름. 현재 UI 언어를 따른다(getter) / adapter names in the current UI language.
export const SYNC_LABEL = Object.freeze({
  get local() { return t('sync.local'); },
  get artifact() { return t('sync.artifact'); },
  get firebase() { return t('sync.firebase'); },
});

// 수업팩이 생략한 이야기용 문구의 기본값(팩 언어 기준) / defaults for pack-language story text.
//   list_item   {weather_list} 한 항목. {label}, {n}
//   list_empty  아무도 고르지 않았을 때의 {weather_list}
//   class_name  {class}
export const PACK_TEXT_DEFAULTS = {
  ko: { list_item: '{label} {n}명', list_empty: '조용한 하늘', class_name: '우리 반' },
  en: { list_item: '{n} {label}', list_empty: 'a quiet sky', class_name: 'our class' },
};

export function packText(pack, key) {
  if (pack && pack[key]) return String(pack[key]);
  const lang = String((pack && pack.lang) || 'ko').slice(0, 2);
  return (PACK_TEXT_DEFAULTS[lang] || PACK_TEXT_DEFAULTS.en)[key];
}

export function newRoom(code, pack) {
  return {
    v: VERSION,
    code,
    packId: pack.id,
    lang: pack.lang || 'ko',   // 수업팩 언어(BCP-47 짧은 코드). TV·보호자 페이지 화면 언어가 이를 따른다.
    phase: 'waiting',        // waiting | live | paused | done
    stepIndex: 0,
    tallies: {},             // { [stepId]: { [optionId]: count } }
    confirmed: {},           // { [stepId]: true }
    timer: null,             // { stepId, startedAt, seconds }
    speakSeq: 0,             // 바뀔 때마다 TV가 현재 단계 대사를 다시 말한다
    startedAt: null,
    endedAt: null,
    notes: [],               // 반 전체 메모. 아이 이름은 적지 않는다.
    rev: 0,
    updatedAt: Date.now(),
  };
}

// 쓰기 전에 항상 stamp(): rev가 커야 다른 화면이 새 상태로 받아들인다.
export function stamp(s) {
  return { ...s, rev: (s.rev || 0) + 1, updatedAt: Date.now() };
}

export const actions = {
  start(s) {
    return { ...s, phase: 'live', stepIndex: 0, startedAt: s.startedAt || Date.now(), speakSeq: s.speakSeq + 1 };
  },
  next(s, pack) {
    const last = pack.steps.length - 1;
    if (s.stepIndex >= last) return actions.end(s);
    return { ...s, phase: 'live', stepIndex: s.stepIndex + 1, timer: null, speakSeq: s.speakSeq + 1 };
  },
  prev(s) {
    return { ...s, phase: 'live', stepIndex: Math.max(0, s.stepIndex - 1), timer: null, speakSeq: s.speakSeq + 1 };
  },
  tally(s, stepId, optionId, delta) {
    const t = { ...(s.tallies[stepId] || {}) };
    t[optionId] = Math.max(0, (t[optionId] || 0) + delta);
    return { ...s, tallies: { ...s.tallies, [stepId]: t } };
  },
  confirm(s, stepId) {
    return { ...s, confirmed: { ...s.confirmed, [stepId]: true }, speakSeq: s.speakSeq + 1 };
  },
  startTimer(s, stepId, seconds) {
    return { ...s, timer: { stepId, startedAt: Date.now(), seconds } };
  },
  togglePause(s) {
    if (s.phase === 'live') return { ...s, phase: 'paused' };
    if (s.phase === 'paused') return { ...s, phase: 'live' };
    return s;
  },
  respeak(s) {
    return { ...s, speakSeq: s.speakSeq + 1 };
  },
  end(s) {
    return { ...s, phase: 'done', endedAt: Date.now(), timer: null, speakSeq: s.speakSeq + 1 };
  },
  note(s, text) {
    // 300자에서 자른 뒤 다시 다듬는다: 자른 자리의 공백과 반쪽 난 이모지(짝 잃은 서러게이트)를 떼어 낸다.
    // Re-trim after the 300-char cut and drop the half emoji (lone high surrogate) the cut may leave behind.
    const clean = String(text || '').trim().slice(0, 300).replace(/[\uD800-\uDBFF]$/, '').trim();
    if (!clean) return s;
    return { ...s, notes: [...s.notes, { t: Date.now(), text: clean }] };
  },
  reset(s, pack) {
    return newRoom(s.code, pack);
  },
};

export function currentStep(pack, s) {
  const i = Math.min(Math.max(0, s.stepIndex || 0), pack.steps.length - 1);
  return pack.steps[i];
}

// 한 단계의 집계. 공유 저장소에서 온 값은 문자열일 수도 있으므로 0 이상의 정수만 돌려준다(유한하지 않은 값은 뺀다).
// Counts for one step: non-negative integers only, whatever the shared document held (non-finite values are dropped).
export function tallyFor(s, stepId) {
  const raw = (s && s.tallies && s.tallies[stepId]) || {};
  const out = {};
  for (const k of Object.keys(raw)) {
    const n = Math.floor(Number(raw[k]));
    if (Number.isFinite(n)) out[k] = Math.max(0, n) || 0;
  }
  return out;
}

export function total(t) {
  return Object.values(t || {}).reduce((a, b) => a + (Number(b) || 0), 0);
}

export function leadOption(step, t) {
  let best = null;
  for (const o of step.options) {
    const n = t[o.id] || 0;
    if (n > 0 && (!best || n > best.n)) best = { id: o.id, n };
  }
  return best ? best.id : null;
}

// 이야기 템플릿 변수: 모든 선택 단계의 집계 + {class}
//   {sunny}            선택지별 개수
//   {weather_total}    단계 합계
//   {weather_list}     0이 아닌 선택지만 list_item 꼴로(ko "해님 3명, 구름 2명" / en "3 Sunny, 2 Cloudy"), 비면 list_empty
//   {weather_lead}     가장 많은 선택지 이름(없으면 빈 문자열)
//   {class}            class_name(ko "우리 반" / en "our class")
export function storyVars(pack, s) {
  const item = packText(pack, 'list_item');
  const vars = { class: packText(pack, 'class_name') };
  for (const st of pack.steps) {
    if (st.type !== 'choice') continue;
    const t = tallyFor(s, st.id);
    for (const o of st.options) vars[o.id] = t[o.id] || 0;
    vars[st.id + '_total'] = st.options.reduce((n, o) => n + (Number(t[o.id]) || 0), 0);
    const list = st.options
      .filter((o) => (t[o.id] || 0) > 0)
      .map((o) => item.replace(/\{(label|n)\}/g, (m, k) => (k === 'n' ? String(t[o.id]) : o.label)))
      .join(', ');
    vars[st.id + '_list'] = list || packText(pack, 'list_empty');
    const lead = leadOption(st, t);
    vars[st.id + '_lead'] = lead ? st.options.find((o) => o.id === lead).label : '';
  }
  return vars;
}

// 템플릿 문법: {변수} 치환, [[변수: 내용]] 은 변수가 0/빈값이면 통째로 빠진다.
export function renderTemplate(tpl, vars) {
  // 자기 키만 변수다: {constructor} 같은 상속 키는 글자 그대로 남는다 / own keys only, so {constructor} stays literal
  const has = (k) => Object.hasOwn(vars, k);
  let out = String(tpl || '').replace(/\[\[(\w+):([\s\S]*?)\]\]/g, (m, k, inner) => {
    const v = has(k) ? vars[k] : undefined;
    const on = typeof v === 'number' ? v > 0 : Boolean(v);
    return on ? inner : '';
  });
  out = out.replace(/\{(\w+)\}/g, (m, k) => (has(k) ? String(vars[k]) : m));
  return out.replace(/[ \t]{2,}/g, ' ').replace(/\s+([.,!?])/g, '$1').trim();
}

// 보호자 페이지·마무리 화면에서 쓰는 반 전체 요약(첫 번째 선택 단계 기준)
export function summaryOf(pack, s) {
  const step = pack.steps.find((x) => x.type === 'choice');
  if (!step) return null;
  const t = tallyFor(s, step.id);
  const max = Math.max(1, ...step.options.map((o) => t[o.id] || 0));
  return {
    step,
    total: total(t),
    rows: step.options.map((o) => ({ ...o, n: Number(t[o.id]) || 0, pct: Math.round(((t[o.id] || 0) / max) * 100) })),
  };
}

// 공유 저장소에서 온 방 문서를 그대로 믿지 않는다. 코드를 아는 클라이언트는 누구나 아티팩트 db·Firebase의 방 문서를
// 쓸 수 있으므로, 화면에 넘기기 전에 아는 키만 맞는 타입으로 다시 만든다: 숫자·불리언·id·(메모 본문만) 문자열.
// 객체가 아니거나 code가 없으면 null. book은 문서에 없으면 그대로 없다(undefined).
// A room document from a shared adapter is rebuilt from known keys with coerced types before any view sees it
// (any client that knows the code can write the document). Returns null for non-objects or a missing code.
const ID = /^[a-z0-9_-]{1,32}$/i;
const PHASES = ['waiting', 'live', 'paused', 'done'];
const isId = (k) => typeof k === 'string' && ID.test(k) && k !== '__proto__';
const int = (v, d = 0) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? n : d; };
const nonNeg = (v) => Math.max(0, int(v));
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, n) : 0; };
const str = (v, max) => (v == null ? '' : String(v).slice(0, max));
const count = (v) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.max(0, n) || 0 : null; };
const isObj = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

// { [id]: coerce(value) } — id가 아닌 키와 coerce가 null을 준 값은 뺀다 / keep id keys whose coerced value is not null
function idMap(obj, coerce) {
  const out = {};
  if (!isObj(obj)) return out;
  for (const k of Object.keys(obj)) {
    if (!isId(k)) continue;
    const v = coerce(obj[k]);
    if (v !== null) out[k] = v;
  }
  return out;
}

export function sanitizeRoom(s) {
  if (!isObj(s)) return null;
  const code = normalizeCode(s.code);
  if (!code) return null;
  const timer = isObj(s.timer) && isId(s.timer.stepId)
    ? { stepId: s.timer.stepId, startedAt: num(s.timer.startedAt), seconds: num(s.timer.seconds) }
    : null;
  const notes = (Array.isArray(s.notes) ? s.notes : [])
    .filter((n) => isObj(n) && typeof n.text === 'string')
    .map((n) => ({ t: int(n.t), text: n.text.slice(0, 300) }))
    .slice(-50);
  const out = {
    v: int(s.v, VERSION),
    code,
    packId: str(s.packId, 32),
    lang: str(s.lang, 16),
    phase: PHASES.includes(s.phase) ? s.phase : 'waiting',
    stepIndex: nonNeg(s.stepIndex),
    tallies: idMap(s.tallies, (t) => (isObj(t) ? idMap(t, count) : null)),
    confirmed: idMap(s.confirmed, (v) => Boolean(v)),
    timer,
    speakSeq: nonNeg(s.speakSeq),
    startedAt: s.startedAt == null ? null : int(s.startedAt, null),
    endedAt: s.endedAt == null ? null : int(s.endedAt, null),
    notes,
    rev: nonNeg(s.rev),
    updatedAt: nonNeg(s.updatedAt),
  };
  if (s.book !== undefined) out.book = isObj(s.book) ? { page: nonNeg(s.book.page), startedAt: nonNeg(s.book.startedAt) } : null;
  return out;
}
