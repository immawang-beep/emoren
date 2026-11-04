// 수업 방(room) 상태와 순수 리듀서.
// 강사 폰만 상태를 바꾸고(쓰기), TV와 보호자 페이지는 읽기만 한다.
// 상태는 JSON 하나로 끝난다: 어떤 동기화 방식(같은 브라우저 / 클라우드 / Firebase)이든 그대로 실어 나른다.

export const VERSION = 1;

export const SYNC_LABEL = {
  local: '같은 브라우저 동기화',
  artifact: '클라우드 동기화',
  firebase: 'Firebase 동기화',
};

export function newRoom(code, pack) {
  return {
    v: VERSION,
    code,
    packId: pack.id,
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
//   {weather_list}     0이 아닌 선택지만 "해님 3명, 구름 2명" 꼴로
//   {weather_lead}     가장 많은 선택지 이름(없으면 빈 문자열)
export function storyVars(pack, s) {
  const vars = { class: '우리 반' };
  for (const st of pack.steps) {
    if (st.type !== 'choice') continue;
    const t = tallyFor(s, st.id);
    for (const o of st.options) vars[o.id] = t[o.id] || 0;
    vars[st.id + '_total'] = total(t);
    const list = st.options.filter((o) => (t[o.id] || 0) > 0).map((o) => `${o.label} ${t[o.id]}명`).join(', ');
    vars[st.id + '_list'] = list || '조용한 하늘';
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
