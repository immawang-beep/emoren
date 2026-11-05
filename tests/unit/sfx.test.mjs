// 단위 테스트: 효과음 표(notesFor)와 Node(window 없음)에서의 createSfx. 실행: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { notesFor, createSfx, KINDS, MAX_GAIN, MAX_TOTAL_MS, STORAGE_KEY } from '../../js/ui/sfx.js';

test('KINDS: confirm · timer · page', () => {
  assert.deepEqual(KINDS, ['confirm', 'timer', 'page']);
});

for (const kind of KINDS) {
  test(`notesFor('${kind}'): 시간이 늘어나고, 음량 ≤ 0.25, 전체 길이 ≤ 900ms`, () => {
    const notes = notesFor(kind);
    assert.ok(notes.length > 0);
    let prevAt = -1;
    let end = 0;
    for (const n of notes) {
      assert.ok(n.freq > 100 && n.freq < 4000, `freq ${n.freq}`);
      assert.ok(n.at > prevAt, `at은 커져야 한다: ${n.at} ≤ ${prevAt}`);
      assert.ok(n.dur > 0 && n.dur <= 400, `dur ${n.dur}`);
      assert.ok(n.gain > 0 && n.gain <= 0.25, `gain ${n.gain}`);
      assert.ok(n.gain <= MAX_GAIN, 'MAX_GAIN 이하');
      prevAt = n.at;
      end = Math.max(end, n.at + n.dur);
    }
    assert.ok(end <= MAX_TOTAL_MS && end <= 900, `전체 ${end}ms`);
  });
}

test('음 수: confirm 2, timer 3(올라감), page 1(짧고 작게)', () => {
  const confirm = notesFor('confirm');
  const timer = notesFor('timer');
  const page = notesFor('page');
  assert.equal(confirm.length, 2);
  assert.ok(confirm[1].freq > confirm[0].freq, '두 번째 음이 더 높다');
  assert.equal(timer.length, 3);
  assert.ok(timer[0].freq < timer[1].freq && timer[1].freq < timer[2].freq, '세 음이 올라간다');
  assert.equal(page.length, 1);
  assert.ok(page[0].dur <= 60, '쪽 넘김은 60ms 이하');
  assert.ok(page[0].gain < confirm[0].gain, '쪽 넘김은 더 작게');
});

test('모르는 종류는 빈 배열, 돌려준 표를 고쳐도 원본은 그대로', () => {
  assert.deepEqual(notesFor('boom'), []);
  assert.deepEqual(notesFor(undefined), []);
  const a = notesFor('confirm'); a[0].gain = 9;
  assert.equal(notesFor('confirm')[0].gain, 0.18);
});

test('Node(window 없음)에서 createSfx()는 아무 일도 하지 않는 객체: play·unlock이 던지지 않는다', () => {
  const sfx = createSfx();
  assert.equal(sfx.enabled, true, 'localStorage가 없으면 켜진 채 시작');
  assert.doesNotThrow(() => sfx.unlock());
  assert.doesNotThrow(() => sfx.play('confirm'));
  assert.doesNotThrow(() => sfx.play('nope'));
  sfx.setEnabled(false);
  assert.equal(sfx.enabled, false);
  assert.doesNotThrow(() => sfx.play('timer'));
});

test("저장된 'off'를 읽어 꺼진 채 시작하고, setEnabled가 'emoren.sfx'에 쓴다", () => {
  const store = { [STORAGE_KEY]: 'off' };
  const sfx = createSfx({ read: (k) => store[k] ?? null, write: (k, v) => { store[k] = v; } });
  assert.equal(sfx.enabled, false);
  sfx.setEnabled(true);
  assert.equal(store[STORAGE_KEY], 'on');
  sfx.setEnabled(0);
  assert.equal(sfx.enabled, false);
  assert.equal(store[STORAGE_KEY], 'off');
});
