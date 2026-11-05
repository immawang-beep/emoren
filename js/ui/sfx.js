// 효과음 / sound effects. WebAudio로 그 자리에서 합성한다. 소리 파일 없음, 외부 스크립트 없음.
// 확정 때 짧은 차임, 타이머가 끝날 때 올라가는 세 음, 책 쪽이 넘어갈 때 작은 똑 소리.
// Synthesised on the fly with WebAudio: a two-note chime on confirm, three rising notes when the timer ends,
// one soft tick for a book page turn. No audio files.
//
//   const sfx = createSfx();
//   sfx.unlock()          사용자 제스처(소리 켜기 버튼) 안에서 한 번: AudioContext를 만들고 깨운다
//                         call once inside a user gesture; before it nothing plays
//   sfx.play(kind)        'confirm' | 'timer' | 'page' (KINDS). 꺼져 있거나 unlock 전이면 조용히 지나간다
//   sfx.enabled           켜짐 여부. localStorage 'emoren.sfx' === 'off' 면 꺼진 채 시작
//   sfx.setEnabled(on)    켜고 끄기 + 'emoren.sfx' 저장
//   notesFor(kind)        순수 함수: [{ freq(Hz), at(ms), dur(ms), gain }] — 테스트와 재생이 같은 표를 쓴다
//
// 브라우저에 AudioContext가 없으면(또는 Node에서는) 모든 메서드가 아무 일도 하지 않는다.
// Without AudioContext (or in Node) every method is a silent no-op.
import { readLocal, writeLocal } from '../util.js';

export const KINDS = ['confirm', 'timer', 'page'];
export const STORAGE_KEY = 'emoren.sfx';
export const MAX_GAIN = 0.2;          // 부드럽게: 절대 크지 않게 / gentle, never loud
export const MAX_TOTAL_MS = 900;

// 음 높이(Hz) / pitches
const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5, A6 = 1760;

const NOTES = {
  // 확정: 미 → 솔, 120ms씩 / confirm: E5 → G5, 120 ms each
  confirm: [
    { freq: E5, at: 0, dur: 120, gain: 0.18 },
    { freq: G5, at: 130, dur: 120, gain: 0.18 },
  ],
  // 타이머 끝: 도 → 미 → 솔, 올라간다 / timer done: three ascending notes
  timer: [
    { freq: C5, at: 0, dur: 140, gain: 0.18 },
    { freq: E5, at: 160, dur: 140, gain: 0.18 },
    { freq: G5, at: 320, dur: 220, gain: 0.18 },
  ],
  // 쪽 넘김: 아주 짧고 작은 똑 / page turn: one soft short tick
  page: [
    { freq: A6, at: 0, dur: 50, gain: 0.07 },
  ],
};

export function notesFor(kind) {
  const list = NOTES[kind];
  return list ? list.map((n) => ({ ...n })) : [];
}

export function createSfx({ read = readLocal, write = writeLocal } = {}) {
  const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
  let ctx = null;
  let enabled = read(STORAGE_KEY) !== 'off';

  const wake = () => { if (ctx && ctx.state === 'suspended' && ctx.resume) ctx.resume().catch(() => {}); };

  return {
    unlock() {
      if (!AC) return;
      try {
        if (!ctx) ctx = new AC();
        wake();
      } catch { ctx = null; /* 소리 못 내도 수업은 계속 / the lesson goes on without sound */ }
    },
    play(kind) {
      if (!enabled || !ctx) return;
      const notes = notesFor(kind);
      if (!notes.length) return;
      try {
        wake();
        const t0 = ctx.currentTime + 0.02;
        for (const n of notes) {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          const start = t0 + n.at / 1000;
          const end = start + n.dur / 1000;
          osc.type = 'sine';
          osc.frequency.setValueAtTime(n.freq, start);
          // 부드러운 포락선: 올리고(12ms) 내린다 / gentle envelope: 12 ms attack, decay to the end
          g.gain.setValueAtTime(0.0001, start);
          g.gain.exponentialRampToValueAtTime(Math.min(n.gain, MAX_GAIN), start + 0.012);
          g.gain.exponentialRampToValueAtTime(0.0001, end);
          osc.connect(g);
          g.connect(ctx.destination);
          osc.start(start);
          osc.stop(end + 0.03);
        }
      } catch { /* 조용히 / silently */ }
    },
    get enabled() { return enabled; },
    setEnabled(on) {
      enabled = !!on;
      write(STORAGE_KEY, enabled ? 'on' : 'off');
    },
  };
}
