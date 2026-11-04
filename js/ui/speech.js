// 캐릭터 음성: 브라우저 음성 합성(ko-KR)을 쓴다. 실제 성우 음성 파일은 나중에 같은 자리에 꽂는다.
// 브라우저는 사용자가 한 번 눌러야 소리를 낼 수 있으므로 TV 화면에 '소리 켜기' 버튼이 있다.
// 소리를 못 낼 때도 자막은 같은 길이만큼 보여 준다.

let unlocked = false;
let voice = null;

export function canSpeak() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

function pickVoice() {
  if (!canSpeak()) return null;
  const vs = speechSynthesis.getVoices() || [];
  const ko = vs.filter((v) => /^ko/i.test(v.lang));
  return ko.find((v) => /Yuna|SunHi|Heami|Google 한국의|여성|female/i.test(v.name)) || ko[0] || null;
}

export function unlock() {
  unlocked = true;
  if (!canSpeak()) return;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
  } catch { /* 지원 안 하면 조용히 */ }
}

export function isUnlocked() { return unlocked; }

// 한 문장을 말한다. 끝나면 resolve(true: 실제 음성 / false: 자막만).
export function speak(text, { onStart, onEnd, rate = 0.95, pitch = 1.15 } = {}) {
  const line = String(text || '').trim();
  return new Promise((resolve) => {
    const fallback = () => {
      if (onStart) onStart();
      const ms = Math.min(9000, 700 + line.length * 115);
      setTimeout(() => { if (onEnd) onEnd(); resolve(false); }, ms);
    };
    if (!line) return resolve(false);
    if (!canSpeak() || !unlocked) return fallback();
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(line);
      u.lang = 'ko-KR';
      u.rate = rate;
      u.pitch = pitch;
      if (!voice) voice = pickVoice();
      if (voice) u.voice = voice;
      let done = false;
      const finish = (ok) => { if (done) return; done = true; if (onEnd) onEnd(); resolve(ok); };
      u.onstart = () => { if (onStart) onStart(); };
      u.onend = () => finish(true);
      u.onerror = () => finish(false);
      // 일부 브라우저는 onend를 안 주기도 한다: 길이 기준으로 안전장치.
      setTimeout(() => finish(true), 1500 + line.length * 260);
      speechSynthesis.speak(u);
    } catch {
      fallback();
    }
  });
}

export function stop() {
  if (canSpeak()) { try { speechSynthesis.cancel(); } catch { /* 무시 */ } }
}

if (canSpeak()) {
  speechSynthesis.onvoiceschanged = () => { voice = pickVoice(); };
}
