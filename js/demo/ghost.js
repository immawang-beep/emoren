// 유령 선생님 / ghost teacher — #demo 플레이그라운드에서 강사 폰을 대신 눌러 수업 한 회기를 자동으로 진행한다.
// 폰 화면의 버튼(data-act / data-tally)을 사람과 똑같이 el.click()으로 누르므로 폰 UI와 같은 리듀서가 그대로 돈다.
// Drives the teacher phone DOM with the very same buttons a human taps, so the phone UI and the same
// reducers run; nothing is simulated behind the UI.
//
//   planFor(pack, { timerSec, fromStep, paused })  순수 함수. 단계 유형별 { action: 'click'|'wait', selector?, ms?, step } 목록
//   scaleWaits(plan, speed)                        순수 함수. 모든 대기를 speed로 나눈다 / divide every wait by speed
//   createGhost({ phoneRoot, getPack, speed, timerSec, onStatus })
//     .run({ fromStep, paused })   계획대로 누르고 기다린다. 끝나면 resolve / click + wait through the plan
//     .stop(reason)                즉시 멈춘다: 기다리던 타이머를 취소하고 더는 누르지 않는다 / cancel, no further clicks
//     .destroy()                   넘겨받기 감지를 떼어 낸다 / detach the take-over listener
//     .running                     진행 중인지 / whether a run is in progress
//   onStatus(status, { step, reason })  status: 'running' | 'stopped' | 'done'
//
// 넘겨받기 / take-over: phoneRoot에 캡처 단계 click 리스너를 달아 사람의 실제 탭(e.isTrusted)이 오면 바로 멈춘다.
// 유령 자신의 el.click()은 isTrusted=false 라서 멈추지 않는다.
// 속도 / speed: 기본 1. window.EMOREN_DEMO_SPEED 가 있으면 그것이 기본값(e2e는 8). 집계 사이 간격은 350ms로 고정, 무작위 없음.
// 모르는 단계 유형(book, 앞으로 생길 유형)은 기다렸다가 '다음'을 누른다. import 시점에 DOM을 건드리지 않는다(node:test에서 돌아간다).

export const SEL = Object.freeze({
  start: '[data-act="start"]',
  next: '[data-act="next"]',
  confirm: '[data-act="confirm"]',
  timer: '[data-act="timer"]',
  pause: '[data-act="pause"]',
  tally: (optionId) => `[data-tally="${optionId}"][data-delta="1"]`,
});

// 기다리는 시간(ms, speed 1 기준) / waits at speed 1
export const WAIT = Object.freeze({
  start: 6000, talk: 5000, choice: 7000, activity: 3000, story: 9000, book: 14000, closing: 6000, other: 5000, tap: 350,
});

// 선택 단계에서 누르는 횟수: 첫째 3, 둘째 2, 셋째 1, 나머지 0 / fixed tally pattern (stable screenshots)
export const TAPS = Object.freeze([3, 2, 1]);

export function planFor(pack, { timerSec = 0, fromStep = null, paused = false } = {}) {
  const steps = (pack && Array.isArray(pack.steps)) ? pack.steps : [];
  const plan = [];
  const click = (selector, step) => plan.push({ action: 'click', selector, step });
  const wait = (ms, step) => plan.push({ action: 'wait', ms, step });
  let from = 0;
  if (fromStep == null) {
    click(SEL.start, null);
    wait(WAIT.start, null);
  } else {
    from = Math.min(Math.max(0, Math.floor(fromStep)), Math.max(0, steps.length - 1));
    if (paused && steps[from]) click(SEL.pause, steps[from].id);   // '계속'을 먼저 누른다 / resume first
  }
  for (let i = from; i < steps.length; i++) {
    const s = steps[i];
    const id = s.id;
    if (s.type === 'talk') wait(WAIT.talk, id);
    else if (s.type === 'choice') {
      (s.options || []).forEach((o, k) => {
        for (let n = 0; n < (TAPS[k] || 0); n++) { click(SEL.tally(o.id), id); wait(WAIT.tap, id); }
      });
      click(SEL.confirm, id);
      wait(WAIT.choice, id);
    } else if (s.type === 'activity') {
      click(SEL.timer, id);
      wait((Number(timerSec) > 0 ? Number(timerSec) : Number(s.timer_sec) || 0) * 1000 + WAIT.activity, id);
    } else if (s.type === 'story') wait(WAIT.story, id);
    else if (s.type === 'book') wait(WAIT.book, id);
    else if (s.type === 'closing') wait(WAIT.closing, id);
    else wait(WAIT.other, id);
    click(SEL.next, id);   // 마지막 단계의 '다음'은 수업을 마친다 / the last next finishes the lesson
  }
  return plan;
}

export function scaleWaits(plan, speed = 1) {
  const k = Number(speed) > 0 ? Number(speed) : 1;
  return plan.map((p) => (p.action === 'wait' ? { ...p, ms: Math.max(1, Math.ceil(p.ms / k)) } : { ...p }));
}

function defaultSpeed() {
  const v = typeof window !== 'undefined' ? Number(window.EMOREN_DEMO_SPEED) : NaN;
  return v > 0 ? v : 1;
}

export function createGhost({ phoneRoot, getPack, speed = null, timerSec = 0, onStatus = () => {} } = {}) {
  const rate = Number(speed) > 0 ? Number(speed) : defaultSpeed();
  let running = false;
  let token = 0;
  let dead = false;
  let timer = null;
  let wake = null;

  const sleep = (ms) => new Promise((resolve) => {
    wake = resolve;
    timer = setTimeout(() => { timer = null; wake = null; resolve(true); }, ms);
  });
  const cancelSleep = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (wake) { const w = wake; wake = null; w(false); }
  };
  const report = (status, info) => { if (!dead) onStatus(status, info || {}); };
  const titleOf = (pack, id) => { const s = (pack.steps || []).find((x) => x.id === id); return s ? (s.title || s.id) : (pack.title || ''); };

  // 사람의 실제 탭이면 멈춘다 / a trusted click means a human took over
  const onTrusted = (e) => { if (running && e && e.isTrusted) stop('human'); };
  if (phoneRoot && typeof phoneRoot.addEventListener === 'function') phoneRoot.addEventListener('click', onTrusted, true);

  async function run({ fromStep = null, paused = false } = {}) {
    if (running || dead) return false;
    const pack = await getPack();
    if (dead) return false;
    const plan = scaleWaits(planFor(pack, { timerSec, fromStep, paused }), rate);
    running = true;
    const my = ++token;
    let shown;
    let reason = 'done';
    for (const item of plan) {
      if (my !== token) return false;
      const label = item.step == null ? (pack.title || '') : titleOf(pack, item.step);
      if (label !== shown) { shown = label; report('running', { step: label }); }
      if (item.action === 'click') {
        const el = phoneRoot.querySelector(item.selector);
        if (!el) { reason = 'lost'; break; }   // 화면이 계획과 다르면 멈춘다 / the phone is not where the plan expects
        el.click();
      } else {
        const ok = await sleep(item.ms);
        if (!ok || my !== token) return false;
      }
    }
    running = false;
    report(reason === 'done' ? 'done' : 'stopped', { reason });
    return reason === 'done';
  }

  function stop(reason = 'user') {
    if (!running) return false;
    running = false;
    token++;
    cancelSleep();
    report('stopped', { reason });
    return true;
  }

  function destroy() {
    if (running) { running = false; token++; cancelSleep(); }
    dead = true;
    if (phoneRoot && typeof phoneRoot.removeEventListener === 'function') phoneRoot.removeEventListener('click', onTrusted, true);
  }

  return { run, stop, destroy, get running() { return running; }, get speed() { return rate; } };
}
