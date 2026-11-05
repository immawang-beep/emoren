// 수업 방(room) 상태와 순수 리듀서.
// 강사 폰만 상태를 바꾸고(쓰기), TV와 보호자 페이지는 읽기만 한다.
// 상태는 JSON 하나로 끝난다: 어떤 동기화 방식(같은 브라우저 / 클라우드 / Firebase)이든 그대로 실어 나른다.

import { t } from './i18n.js';

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
    book: null,              // { page, startedAt } — 「오늘 우리 반 책」에서 펼친 쪽(숫자만). book 단계가 아니면 null
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

// 「오늘 우리 반 책」 쪽 수: 표지 + 선택·몸놀이·이야기 단계마다 한 쪽 + 뒤표지. book 단계가 없으면 0.
// (js/book.js bookPages()와 같은 수. 순수 계산만 여기 두어 store ↔ book 순환 import를 피한다)
export function bookPageCount(pack) {
  const steps = (pack && pack.steps) || [];
  if (!steps.some((st) => st.type === 'book')) return 0;
  return 2 + steps.filter((st) => st.type === 'choice' || st.type === 'activity' || st.type === 'story').length;
}

// 단계에 들어설 때의 book 값: book 단계면 첫 쪽을 지금 편다, 아니면 null / book state on entering a step
function bookAt(pack, i) {
  const st = pack && pack.steps ? pack.steps[i] : null;
  return st && st.type === 'book' ? { page: 0, startedAt: Date.now() } : null;
}

export const actions = {
  start(s, pack) {
    return { ...s, phase: 'live', stepIndex: 0, startedAt: s.startedAt || Date.now(), book: bookAt(pack, 0), speakSeq: s.speakSeq + 1 };
  },
  next(s, pack) {
    const last = pack.steps.length - 1;
    if (s.stepIndex >= last) return actions.end(s);
    const i = s.stepIndex + 1;
    return { ...s, phase: 'live', stepIndex: i, timer: null, book: bookAt(pack, i), speakSeq: s.speakSeq + 1 };
  },
  prev(s, pack) {
    const i = Math.max(0, s.stepIndex - 1);
    return { ...s, phase: 'live', stepIndex: i, timer: null, book: bookAt(pack, i), speakSeq: s.speakSeq + 1 };
  },
  // 책 쪽 넘기기(강사 폰의 이전·다음 쪽). 쪽 번호는 [0, 쪽 수 - 1]로 자르고, 그 쪽을 지금 편 것으로 기록한다.
  bookPage(s, pack, page) {
    const last = Math.max(0, bookPageCount(pack) - 1);
    const p = Math.min(Math.max(0, Math.floor(Number(page) || 0)), last);
    return { ...s, book: { page: p, startedAt: Date.now() }, speakSeq: s.speakSeq + 1 };
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
  // bookPage(선택): 책 단계에서 멈출 때 지금 펴져 있는 쪽 번호. 쉬는 동안 쪽이 넘어가지 않도록 그 쪽을 다시 펴 두고,
  // 돌아올 때도 같은 쪽을 처음부터 읽는다 / on the book step, freeze the shown page while paused and reread it on resume
  togglePause(s, bookPage) {
    const freeze = (page) => (s.book ? { page: Math.max(0, Math.floor(Number(page) || 0)), startedAt: Date.now() } : null);
    if (s.phase === 'live') return { ...s, phase: 'paused', book: freeze(typeof bookPage === 'number' ? bookPage : s.book && s.book.page) };
    if (s.phase === 'paused') return { ...s, phase: 'live', book: freeze(s.book && s.book.page) };
    return s;
  },
  respeak(s) {
    return { ...s, speakSeq: s.speakSeq + 1 };
  },
  end(s) {
    return { ...s, phase: 'done', endedAt: Date.now(), timer: null, book: null, speakSeq: s.speakSeq + 1 };
  },
  note(s, text) {
    const clean = String(text || '').trim().slice(0, 300);
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

export function tallyFor(s, stepId) {
  return (s && s.tallies && s.tallies[stepId]) || {};
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
    vars[st.id + '_total'] = total(t);
    const list = st.options
      .filter((o) => (t[o.id] || 0) > 0)
      .map((o) => item.replace(/\{label\}/g, o.label).replace(/\{n\}/g, String(t[o.id])))
      .join(', ');
    vars[st.id + '_list'] = list || packText(pack, 'list_empty');
    const lead = leadOption(st, t);
    vars[st.id + '_lead'] = lead ? st.options.find((o) => o.id === lead).label : '';
  }
  return vars;
}

// 템플릿 문법: {변수} 치환, [[변수: 내용]] 은 변수가 0/빈값이면 통째로 빠진다.
export function renderTemplate(tpl, vars) {
  let out = String(tpl || '').replace(/\[\[(\w+):([\s\S]*?)\]\]/g, (m, k, inner) => {
    const v = vars[k];
    const on = typeof v === 'number' ? v > 0 : Boolean(v);
    return on ? inner : '';
  });
  out = out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
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
    rows: step.options.map((o) => ({ ...o, n: t[o.id] || 0, pct: Math.round(((t[o.id] || 0) / max) * 100) })),
  };
}
