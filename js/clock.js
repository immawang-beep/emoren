// 원격 시계 보정 / remote clock offset.
// 방 상태의 시각(timer.startedAt, updatedAt 등)은 상태를 쓴 기기(강사 폰)의 시계다.
// 읽기만 하는 화면(TV·보호자)은 clock.now()로 "강사 폰 시계로 지금"을 어림해 타이머·책 쪽 넘김을 맞춘다.
// The room's timestamps come from the writer's (teacher phone's) clock. Read-only screens use
// clock.now() as their estimate of "now on the writer's clock" for timers and book page turns.
//
// 모델 / the model
//   상태를 받을 때마다 d = now() - state.updatedAt 을 잰다. d = (이 기기 시계 − 강사 폰 시계) + 전송 지연.
//   전송 지연은 0보다 작을 수 없으니, 최근 24개 샘플 중 가장 작은 d가 참 시차에 가장 가깝다.
//   offset = -min(d), now() = Date.now() + offset.
//   For every received state we sample d = now() - state.updatedAt, i.e. (this clock − writer clock) + transport
//   delay. Delay is never negative, so over the last 24 samples the smallest d is closest to the true skew;
//   offset = -min(d) and now() = Date.now() + offset.
//
// 지킬 것 / guard rails
//   · rev가 바뀐 상태만 새 샘플이다(같은 상태가 다시 오거나 로컬에서 다시 읽은 것은 샘플이 아니다).
//   · |d|가 30일을 넘는 값은 깨진 시각으로 보고 버린다. 샘플이 하나도 없으면 offset은 0.
//   · 오래된 상태(updatedAt이 한참 전)는 d가 커질 뿐이라 최솟값을 움직이지 못한다.
//   · Only a state whose rev changed is a fresh sample; |d| > 30 days is garbage; no samples → offset 0;
//     a stale state only makes d larger, so it cannot move the minimum.
//
//   const clock = createClock();
//   clock.observe(state)   받은 상태마다 한 번 부른다 / call for every received room state
//   clock.now()            쓴 기기 시계 기준 지금(ms) / now, in the writer's clock (ms)
//   clock.offset           now() - Date.now()
//   clock.reset()          샘플을 모두 비운다 / drop all samples
//   clockOffsetFromSamples(ds)  순수 함수: 샘플 목록 → offset / pure helper for tests

export const MAX_SAMPLES = 24;
export const MAX_SKEW_MS = 30 * 24 * 60 * 60 * 1000;

const usable = (d) => Number.isFinite(d) && Math.abs(d) <= MAX_SKEW_MS;

export function clockOffsetFromSamples(ds) {
  const valid = (Array.isArray(ds) ? ds : []).filter(usable).slice(-MAX_SAMPLES);
  return valid.length ? -Math.min(...valid) : 0;
}

export function createClock({ now = () => Date.now() } = {}) {
  let samples = [];
  let lastRev = null;
  let offset = 0;
  return {
    observe(state) {
      if (!state || typeof state.updatedAt !== 'number') return;
      const rev = state.rev == null ? null : state.rev;
      if (lastRev !== null && rev === lastRev) return;   // 다시 온 같은 상태 / the same state again
      lastRev = rev;
      const d = now() - state.updatedAt;
      if (!usable(d)) return;
      samples.push(d);
      if (samples.length > MAX_SAMPLES) samples = samples.slice(-MAX_SAMPLES);
      offset = clockOffsetFromSamples(samples);
    },
    now() { return now() + offset; },
    get offset() { return offset; },
    get size() { return samples.length; },
    reset() { samples = []; lastRev = null; offset = 0; },
  };
}
