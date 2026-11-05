// 단위 테스트: 캐릭터 음성(js/ui/speech.js)과 자리표시 캐릭터(js/ui/character.js). 실행: npm test
// node에는 speechSynthesis가 없으므로 첫 묶음은 '자막 길이만큼 기다리는' 대체 경로를 가짜 타이머로 확인하고,
// 둘째 묶음은 가짜 speechSynthesis를 전역에 심은 뒤 모듈을 캐시 우회(?fake=1)로 다시 불러와 실제 음성 경로를 탄다.
// Unit tests for the TTS wrapper and the placeholder character. Block 1: caption-timing fallback (mock timers).
// Block 2: a fake speechSynthesis on globalThis + a cache-busting re-import so the module sees it. Block 3: character.
import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { canSpeak, voiceLang, speak, unlock, stop, isUnlocked } from '../../js/ui/speech.js';
import { createCharacter } from '../../js/ui/character.js';
import { t as tr, setLang } from '../../js/i18n.js';
import { esc } from '../../js/util.js';

// setTimeout만 가짜이므로 setImmediate는 진짜로 돈다: 마이크로태스크를 비우는 데 쓴다.
// Only setTimeout is mocked, so setImmediate still runs for real: use it to drain microtasks.
const flush = () => new Promise((r) => setImmediate(r));
// 프라미스가 끝났는지 기다리지 않고 들여다본다 / peek at a promise without awaiting it
const settle = (p) => { const s = { done: false, value: undefined }; p.then((v) => { s.done = true; s.value = v; }); return s; };

describe('speech: 음성 합성이 없을 때(node) — 자막 대체 경로', () => {
  test('voiceLang: 짧은 코드는 BCP47로, 전체 태그와 모르는 코드는 그대로', () => {
    assert.equal(voiceLang('ko'), 'ko-KR');
    assert.equal(voiceLang('en'), 'en-US');
    assert.equal(voiceLang('EN'), 'en-US', '대소문자 무관');
    assert.equal(voiceLang('en-GB'), 'en-GB', '전체 태그는 그대로');
    assert.equal(voiceLang('ko-KR'), 'ko-KR');
    assert.equal(voiceLang('ja'), 'ja', '모르는 짧은 코드는 그대로');
    assert.equal(voiceLang(), 'ko-KR', '기본은 ko');
  });

  test('canSpeak()는 node에서 false, unlock()/stop()은 던지지 않는다', () => {
    assert.equal(canSpeak(), false);
    assert.equal(isUnlocked(), false);
    assert.doesNotThrow(() => unlock('ko'));
    assert.equal(isUnlocked(), true);
    assert.doesNotThrow(() => stop());
  });

  test('speak(""): 타이머 없이 바로 false, onStart/onEnd는 부르지 않는다', async (tc) => {
    tc.mock.timers.enable({ apis: ['setTimeout'] });
    let calls = 0;
    assert.equal(await speak('', { onStart: () => calls++, onEnd: () => calls++ }), false);
    assert.equal(await speak('   '), false, '공백만 있으면 빈 문장');
    assert.equal(await speak(undefined), false);
    assert.equal(calls, 0);
  });

  test('speak(text): 자막 길이만큼 기다렸다가 false (ko 115ms/글자, en 70ms/글자, 최대 9000ms)', async (tc) => {
    tc.mock.timers.enable({ apis: ['setTimeout'] });
    const cases = [
      ['안녕하세요 친구들', { lang: 'ko' }, 700 + '안녕하세요 친구들'.length * 115],
      ['Hello there, friends', { lang: 'en' }, 700 + 'Hello there, friends'.length * 70],
      ['Hello', { lang: 'en-GB' }, 700 + 5 * 70],
      ['안녕', {}, 700 + 2 * 115],
      ['가'.repeat(120), { lang: 'ko' }, 9000],
    ];
    for (const [text, opts, ms] of cases) {
      const events = [];
      const s = settle(speak(text, { ...opts, onStart: () => events.push('start'), onEnd: () => events.push('end') }));
      assert.deepEqual(events, ['start'], `${text.slice(0, 8)}: onStart는 바로 불린다`);
      tc.mock.timers.tick(ms - 1);
      await flush();
      assert.equal(s.done, false, `${text.slice(0, 8)}: ${ms - 1}ms에는 아직`);
      tc.mock.timers.tick(1);
      await flush();
      assert.equal(s.done, true, `${text.slice(0, 8)}: ${ms}ms에 끝난다`);
      assert.equal(s.value, false, '자막만 보여 줬으니 false');
      assert.deepEqual(events, ['start', 'end']);
    }
  });
});

describe('speech: 가짜 speechSynthesis를 심고 다시 불러오면 실제 음성 경로', () => {
  class FakeUtterance {
    constructor(text) {
      Object.assign(this, { text, lang: '', voice: null, rate: 1, pitch: 1, volume: 1, onstart: null, onend: null, onerror: null });
    }
  }
  const voice = (lang, name) => ({ lang, name, voiceURI: name, localService: true, default: false });
  // 선호 목소리 앞에 미끼를 둔다: ko는 이름이 안 맞는 'Minsu', en은 지역이 다른 en-AU 'Karen'(이름은 선호 목록에 있음).
  // Decoys before the preferred voices: a non-preferred ko name and a preferred en name in the wrong region.
  const VOICES = [
    voice('ja-JP', 'Kyoko'), voice('ko-KR', 'Minsu'), voice('en-AU', 'Karen'),
    voice('ko-KR', 'Yuna'), voice('en-US', 'Samantha'), voice('en-GB', 'Daniel'),
  ];
  const synth = {
    voices: VOICES,
    spoken: [],
    cancelled: 0,
    mute: false,   // true면 onstart/onend를 영영 안 준다 / never fires events
    fail: false,   // true면 onerror / fires onerror instead
    onvoiceschanged: null,
    getVoices() { return synth.voices; },
    cancel() { synth.cancelled++; },
    speak(u) {
      synth.spoken.push(u);
      if (synth.mute) return;
      queueMicrotask(() => {
        if (synth.fail) { if (u.onerror) u.onerror({ error: 'synthesis-failed' }); return; }
        if (u.onstart) u.onstart();
        if (u.onend) u.onend();
      });
    },
  };
  let S; // 다시 불러온 모듈 / the re-imported module

  before(async () => {
    globalThis.window = { speechSynthesis: synth, SpeechSynthesisUtterance: FakeUtterance };
    globalThis.speechSynthesis = synth;            // 모듈은 전역 식별자로 부른다 / referenced as bare globals
    globalThis.SpeechSynthesisUtterance = FakeUtterance;
    S = await import('../../js/ui/speech.js?fake=1');
  });
  after(() => {
    delete globalThis.window;
    delete globalThis.speechSynthesis;
    delete globalThis.SpeechSynthesisUtterance;
  });

  test('다시 불러온 모듈은 canSpeak() true, 모듈 수준에서 onvoiceschanged를 등록한다', () => {
    assert.equal(S.canSpeak(), true);
    assert.equal(typeof synth.onvoiceschanged, 'function');
    assert.notEqual(S.speak, speak, '캐시를 우회한 새 인스턴스');
    assert.equal(S.isUnlocked(), false, '새 인스턴스는 잠겨 있다');
  });

  test('unlock 전에는 소리를 내지 않고 자막 대체 경로로 간다', async (tc) => {
    tc.mock.timers.enable({ apis: ['setTimeout'] });
    const s = settle(S.speak('안녕', { lang: 'ko' }));
    assert.equal(synth.spoken.length, 0);
    tc.mock.timers.tick(700 + 2 * 115);
    await flush();
    assert.deepEqual([s.done, s.value], [true, false]);
  });

  test('unlock("ko"): 무음 발화로 잠금을 풀고 선호 한국어 목소리를 미리 고른다', () => {
    S.unlock('ko');
    assert.equal(S.isUnlocked(), true);
    assert.equal(synth.spoken.length, 1);
    const u = synth.spoken[0];
    assert.equal(u.text, ' ');
    assert.equal(u.volume, 0);
    assert.equal(u.lang, 'ko-KR');
    assert.equal(u.voice && u.voice.name, 'Yuna', '앞에 있는 Minsu보다 선호 이름');
  });

  test('speak(ko): cancel 뒤 선호 목소리·기본 속도 0.95/높이 1.15로 말하고 끝나면 true', async (tc) => {
    tc.mock.timers.enable({ apis: ['setTimeout'] });
    const events = [];
    const cancelled = synth.cancelled;
    const p = S.speak('안녕하세요', { lang: 'ko', onStart: () => events.push('start'), onEnd: () => events.push('end') });
    assert.equal(synth.cancelled, cancelled + 1, '말하기 전에 cancel()');
    const u = synth.spoken.at(-1);
    assert.equal(u.text, '안녕하세요');
    assert.equal(u.lang, 'ko-KR');
    assert.equal(u.voice.name, 'Yuna');
    assert.equal(u.rate, 0.95);
    assert.equal(u.pitch, 1.15);
    assert.deepEqual(events, [], 'onStart는 실제로 말하기 시작할 때');
    assert.equal(await p, true);
    assert.deepEqual(events, ['start', 'end']);
  });

  test('speak(en): en-US/GB 목소리를 다른 영어 지역보다 먼저 고르고 rate/pitch 옵션을 넘긴다', async (tc) => {
    tc.mock.timers.enable({ apis: ['setTimeout'] });
    const p = S.speak('Hello, friends', { lang: 'en', rate: 1, pitch: 1 });
    const u = synth.spoken.at(-1);
    assert.equal(u.lang, 'en-US');
    assert.equal(u.voice.name, 'Samantha', 'en-AU Karen이 앞에 있어도 en-US');
    assert.equal(u.rate, 1);
    assert.equal(u.pitch, 1);
    assert.equal(await p, true);
  });

  test('합성 오류(onerror)면 false로 끝나고 onEnd는 한 번만', async (tc) => {
    tc.mock.timers.enable({ apis: ['setTimeout'] });
    synth.fail = true;
    let ends = 0;
    const r = await S.speak('Hello', { lang: 'en', onEnd: () => ends++ });
    synth.fail = false;
    assert.equal(r, false);
    tc.mock.timers.tick(10000);  // 안전장치 타이머가 onEnd를 다시 부르면 안 된다
    assert.equal(ends, 1);
  });

  test('onend가 안 와도 길이 기준 안전장치(1500 + 글자×160ms, en)로 true', async (tc) => {
    tc.mock.timers.enable({ apis: ['setTimeout'] });
    synth.mute = true;
    let ends = 0;
    const s = settle(S.speak('Hello', { lang: 'en', onEnd: () => ends++ }));
    const ms = 1500 + 5 * 160;
    tc.mock.timers.tick(ms - 1);
    await flush();
    assert.equal(s.done, false);
    tc.mock.timers.tick(1);
    await flush();
    assert.deepEqual([s.done, s.value, ends], [true, true, 1]);
    synth.mute = false;
  });

  test('목소리 목록이 바뀌면(onvoiceschanged) 캐시를 비우고 다시 고른다', async (tc) => {
    tc.mock.timers.enable({ apis: ['setTimeout'] });
    synth.voices = [voice('ko-KR', 'Heami'), voice('en-US', 'Samantha')];
    S.speak('가', { lang: 'ko' });
    assert.equal(synth.spoken.at(-1).voice.name, 'Yuna', '목록만 바뀌면 아직 캐시된 목소리');
    synth.onvoiceschanged();
    S.speak('나', { lang: 'ko' });
    assert.equal(synth.spoken.at(-1).voice.name, 'Heami', '이벤트 뒤에는 새 목록에서 고른다');
    await flush();
    synth.voices = VOICES;
    synth.onvoiceschanged();
  });

  test('stop()은 cancel()을 부른다', () => {
    const cancelled = synth.cancelled;
    S.stop();
    assert.equal(synth.cancelled, cancelled + 1);
  });
});

// 보라/자주 계열인지: 채도가 있고 HSL 색상환 250°~325°면 보라로 본다(핑크 토큰 #FF6B9D는 ~340°).
// Purple-ish: chromatic and hue 250°–325° (the pink token #FF6B9D sits near 340°).
function isPurple(hex) {
  let h = hex.slice(1);
  if (h.length <= 4) h = h.split('').map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d < 0.1) return false;
  let hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  hue = (hue * 60 + 360) % 360;
  return hue >= 250 && hue <= 325;
}

describe('character: 자리표시 캐릭터', () => {
  function fakeSlot() {
    const classes = new Set();
    const el = {
      dataset: {},
      classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) },
    };
    const slot = { innerHTML: '', querySelector: (sel) => (sel === '.chr' ? el : null) };
    return { slot, el, classes };
  }

  test('createCharacter: aria-label은 t("common.characterAlt")를 거치고 이름은 esc()된다', () => {
    setLang('ko');
    const { slot, el } = fakeSlot();
    const chr = createCharacter(slot);
    assert.equal(chr.el, el);
    assert.equal(chr.name, '조앤');
    const label = esc(tr('common.characterAlt', { name: '조앤' }));
    assert.equal(label, '조앤 (임시 그림)');
    assert.ok(slot.innerHTML.includes(`aria-label="${label}"`));
    assert.ok(slot.innerHTML.includes('role="img"'));
    assert.ok(slot.innerHTML.includes('data-mood="idle"'));

    setLang('en');
    const en = fakeSlot();
    createCharacter(en.slot, { name: 'Joanne' });
    assert.ok(en.slot.innerHTML.includes('aria-label="Joanne (placeholder art)"'));

    const x = fakeSlot();
    createCharacter(x.slot, { name: '<b>' });
    assert.ok(!x.slot.innerHTML.includes('<b>'));
    assert.ok(x.slot.innerHTML.includes('aria-label="&lt;b&gt; (placeholder art)"'));
  });

  test('setMood: data-mood를 바꾸고 hold 뒤에 idle로 돌아간다', (tc) => {
    tc.mock.timers.enable({ apis: ['setTimeout'] });
    const { slot, el } = fakeSlot();
    const chr = createCharacter(slot);
    chr.setMood('happy', 10);
    assert.equal(el.dataset.mood, 'happy');
    tc.mock.timers.tick(9);
    assert.equal(el.dataset.mood, 'happy');
    tc.mock.timers.tick(1);
    assert.equal(el.dataset.mood, 'idle');
    chr.setMood('think');              // hold 없음 → 그대로 / no hold: stays
    tc.mock.timers.tick(1000);
    assert.equal(el.dataset.mood, 'think');
    chr.setMood('happy', 10);
    chr.setMood('talk', 50);           // 앞 타이머는 취소 / earlier timer is cleared
    tc.mock.timers.tick(10);
    assert.equal(el.dataset.mood, 'talk');
    tc.mock.timers.tick(40);
    assert.equal(el.dataset.mood, 'idle');
  });

  test('startTalking/stopTalking: is-talking 클래스를 켜고 끈다', () => {
    const { slot, classes } = fakeSlot();
    const chr = createCharacter(slot);
    assert.equal(classes.has('is-talking'), false);
    chr.startTalking();
    assert.ok(classes.has('is-talking'));
    chr.startTalking();
    chr.stopTalking();
    assert.equal(classes.has('is-talking'), false);
  });

  test('SVG에는 보라색 계열 hex가 없고 악센트 토큰(핑크·초록)을 쓴다', () => {
    assert.equal(isPurple('#800080'), true, '검사기 자체 확인: purple');
    assert.equal(isPurple('#8A2BE2'), true, 'blueviolet');
    assert.equal(isPurple('#FF6B9D'), false, '핑크 토큰은 보라가 아니다');
    assert.equal(isPurple('#16B364'), false);
    assert.equal(isPurple('#fff'), false);
    const { slot } = fakeSlot();
    createCharacter(slot);
    const hexes = slot.innerHTML.match(/#[0-9a-f]{3,8}\b/gi) || [];
    assert.ok(hexes.length >= 5, '색이 들어 있어야 검사가 의미 있다');
    for (const h of hexes) assert.equal(isPurple(h), false, `${h} looks purple/violet`);
    assert.doesNotMatch(slot.innerHTML, /purple|violet|indigo|magenta|fuchsia|orchid|plum/i);
    assert.match(slot.innerHTML, /#FF6B9D/i);
    assert.match(slot.innerHTML, /#16B364/i);
  });
});
