// 단위 테스트: 원격 시계 보정(js/clock.js). 가짜 now()를 넣어 강사 폰 시계와 TV 시계가 어긋난 상황을 흉내 낸다. 실행: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { createClock, clockOffsetFromSamples, MAX_SAMPLES, MAX_SKEW_MS } from '../../js/clock.js';

// TV 시계는 tvNow, 강사 폰 시계는 그보다 90초 앞선다 / the writer's clock runs 90 s ahead of the TV's
function setup(skew = 90_000) {
  let tvNow = 1_700_000_000_000;
  const clock = createClock({ now: () => tvNow });
  const writerNow = () => tvNow + skew;
  // delay ms 전에 강사 폰이 쓴 상태가 지금 도착했다 / a state the writer stamped `delay` ms ago arrives now
  const arrive = (rev, delay, extra = {}) => clock.observe({ rev, updatedAt: writerNow() - delay, ...extra });
  const tick = (ms) => { tvNow += ms; };
  return { clock, writerNow, arrive, tick, tv: () => tvNow };
}

test('샘플이 없으면 offset 0, now()는 기기 시계 그대로', () => {
  const { clock, tv } = setup();
  assert.equal(clock.offset, 0);
  assert.equal(clock.now(), tv());
  clock.observe(null);
  clock.observe({ rev: 1 });                 // updatedAt 없음 / no timestamp
  assert.equal(clock.offset, 0);
});

test('강사 폰이 90초 앞설 때: 지연 50/400/120ms 샘플 셋 뒤 now()가 강사 폰 시각과 1초 안에 맞는다', () => {
  const { clock, writerNow, arrive, tick } = setup();
  arrive(1, 50); tick(900);
  arrive(2, 400); tick(900);
  arrive(3, 120); tick(900);
  assert.equal(clock.size, 3);
  assert.ok(Math.abs(clock.now() - writerNow()) <= 1000, `차이 ${clock.now() - writerNow()}ms`);
  assert.equal(clock.offset, 90_000 - 50, '가장 작은 지연(50ms)의 샘플이 기준이 된다');
});

test('오래된 상태(updatedAt 10분 전)는 추정치를 움직이지 않는다', () => {
  const { clock, arrive, tick } = setup();
  arrive(1, 50); tick(500);
  const before = clock.offset;
  arrive(2, 10 * 60_000); tick(500);
  assert.equal(clock.offset, before);
  assert.equal(clock.size, 2, '샘플로는 들어가지만 최솟값은 그대로');
});

test('같은 rev가 다시 오면 샘플로 치지 않는다(재전달·로컬 재읽기)', () => {
  const { clock, arrive, tick } = setup();
  arrive(1, 300); tick(500);
  assert.equal(clock.offset, 90_000 - 300);
  arrive(1, 0); tick(500);                   // 지연 0으로 다시 와도 / even a zero-delay redelivery
  assert.equal(clock.size, 1);
  assert.equal(clock.offset, 90_000 - 300);
  arrive(2, 0);
  assert.equal(clock.offset, 90_000, '새 rev는 샘플이다');
});

test('깨진 시각(|d| > 30일)은 버린다', () => {
  const { clock, arrive } = setup();
  arrive(1, 80);
  clock.observe({ rev: 2, updatedAt: 0 });
  clock.observe({ rev: 3, updatedAt: Number.NaN });
  clock.observe({ rev: 4, updatedAt: 1_700_000_000_000 + MAX_SKEW_MS + 60_000 });
  assert.equal(clock.size, 1);
  assert.equal(clock.offset, 90_000 - 80);
});

test('reset()은 샘플을 비우고 offset을 0으로 돌린다. 그 뒤 같은 rev도 다시 샘플이 된다', () => {
  const { clock, arrive, tv } = setup();
  arrive(1, 80);
  assert.notEqual(clock.offset, 0);
  clock.reset();
  assert.equal(clock.offset, 0);
  assert.equal(clock.size, 0);
  assert.equal(clock.now(), tv());
  arrive(1, 80);
  assert.equal(clock.size, 1);
});

test('최근 24개만 본다: 빠른 샘플이 창 밖으로 밀려나면 추정치가 따라 움직인다', () => {
  const { clock, arrive, tick } = setup();
  arrive(1, 30); tick(500);
  for (let i = 2; i <= MAX_SAMPLES + 1; i++) { arrive(i, 250); tick(500); }
  assert.equal(clock.size, MAX_SAMPLES);
  assert.equal(clock.offset, 90_000 - 250);
});

test('TV 시계가 앞설 때도(음의 시차) 같은 식으로 맞는다', () => {
  const { clock, writerNow, arrive, tick } = setup(-45_000);
  arrive(1, 200); tick(500);
  arrive(2, 90); tick(500);
  assert.ok(Math.abs(clock.now() - writerNow()) <= 1000);
  assert.equal(clock.offset, -45_000 - 90);
});

test('clockOffsetFromSamples: 최솟값의 부호를 뒤집고, 쓸 수 없는 값은 거른다', () => {
  assert.equal(clockOffsetFromSamples([]), 0);
  assert.equal(clockOffsetFromSamples(undefined), 0);
  assert.equal(clockOffsetFromSamples([-89_950, -89_600, -89_880]), 89_950);
  assert.equal(clockOffsetFromSamples([120_050, 120_400]), -120_050);
  assert.equal(clockOffsetFromSamples([Number.NaN, MAX_SKEW_MS * 2, 500]), -500);
  assert.equal(clockOffsetFromSamples([Number.NaN]), 0);
});
