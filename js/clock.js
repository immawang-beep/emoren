// 원격 시계 보정 / remote clock offset.
// 방 상태의 시각(timer.startedAt, updatedAt 등)은 상태를 쓴 기기(강사 폰)의 시계다.
// 읽기만 하는 화면(TV·보호자)은 clock.now()로 "강사 폰 시계로 지금"을 어림해 타이머·책 쪽 넘김을 맞춘다.
// The room's timestamps come from the writer's (teacher phone's) clock. Read-only screens use
// clock.now() as their estimate of "now on the writer's clock" for timers and book page turns.
//
//   const clock = createClock();
//   clock.observe(state)   받은 상태마다 한 번 부른다 / call for every received room state
//   clock.now()            쓴 기기 시계 기준 지금(ms) / now, in the writer's clock (ms)
//   clock.offset           now() - Date.now()
export function createClock({ now = () => Date.now() } = {}) {
  let offset = 0;
  return {
    observe(state) { void state; },
    now() { return now() + offset; },
    get offset() { return offset; },
  };
}
