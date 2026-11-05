// 캐릭터 음성: 브라우저 음성 합성을 쓴다. 수업팩 언어(ko/en)에 맞는 목소리를 고른다.
// Browser TTS. speak(text, { lang }) picks a voice for that language; real voice files plug in here later.
// 브라우저는 사용자가 한 번 눌러야 소리를 낼 수 있으므로 TV 화면에 '소리 켜기' 버튼이 있다.
// 소리를 못 낼 때도 자막은 같은 길이만큼 보여 준다.

let unlocked = false;
const voices = new Map();   // lang → SpeechSynthesisVoice

const BCP47 = { ko: 'ko-KR', en: 'en-US' };
// 선호 목소리(자연스러운/여성 목소리 우선) / preferred voices per language
const PREFER = {
  ko: /Yuna|SunHi|Heami|Google 한국의|Google 한국어|여성|female/i,
  en: /Samantha|Google US English|Microsoft Aria|Aria|Jenny|Ava|Allison|Zira|Karen|Moira|Google UK English Female|female/i,
};

export function canSpeak() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

function short(lang) { return String(lang || 'ko').toLowerCase().split(/[-_]/)[0]; }
export function voiceLang(lang) {
  const l = String(lang || 'ko');
  return l.includes('-') ? l : (BCP47[short(l)] || l);
}

function pickVoice(lang) {
  if (!canSpeak()) return null;
  const l = short(lang);
  const vs = speechSynthesis.getVoices() || [];
  // 같은 선호 순위 안에서는 기기 안 목소리(localService)를 네트워크 목소리보다 먼저: 교실 와이파이가 끊겨도 말한다.
  // 안정 정렬이라 같은 종류끼리의 순서는 그대로다. localService가 없으면(undefined) 기기 안으로 본다.
  // Within the same preference tier, on-device voices come before network ones (a stalled Wi-Fi still speaks).
  // The sort is stable, so order within a group is kept; a missing localService counts as on-device.
  const local = (v) => (v.localService !== false ? 0 : 1);
  const same = vs.filter((v) => short(v.lang) === l).sort((a, b) => local(a) - local(b));
  const pref = PREFER[l] || /female/i;
  if (l === 'en') {
    // en-US / en-GB 먼저, 그 다음 아무 영어 목소리
    const usgb = same.filter((v) => /^en[-_](US|GB)$/i.test(v.lang));
    return usgb.find((v) => pref.test(v.name)) || same.find((v) => pref.test(v.name)) || usgb[0] || same[0] || null;
  }
  return same.find((v) => pref.test(v.name)) || same[0] || null;
}

function voiceFor(lang) {
  const l = short(lang);
  if (!voices.has(l)) { const v = pickVoice(l); if (v) voices.set(l, v); }
  return voices.get(l) || null;
}

// 사용자 제스처 안에서 한 번 부른다. lang을 주면 그 언어 목소리를 미리 고른다.
export function unlock(lang) {
  unlocked = true;
  if (!canSpeak()) return;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    u.lang = voiceLang(lang);
    const v = voiceFor(lang);
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch { /* 지원 안 하면 조용히 */ }
}

export function isUnlocked() { return unlocked; }

// 한 문장을 말한다. 끝나면 resolve(true: 실제 음성 / false: 자막만).
export function speak(text, { onStart, onEnd, rate = 0.95, pitch = 1.15, lang = 'ko' } = {}) {
  const line = String(text || '').trim();
  return new Promise((resolve) => {
    const fallback = () => {
      if (onStart) onStart();
      const ms = Math.min(9000, 700 + line.length * (short(lang) === 'en' ? 70 : 115));
      setTimeout(() => { if (onEnd) onEnd(); resolve(false); }, ms);
    };
    if (!line) return resolve(false);
    if (!canSpeak() || !unlocked) return fallback();
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(line);
      u.lang = voiceLang(lang);
      u.rate = rate;
      u.pitch = pitch;
      const v = voiceFor(lang);
      if (v) u.voice = v;
      let done = false;
      const finish = (ok) => { if (done) return; done = true; if (onEnd) onEnd(); resolve(ok); };
      u.onstart = () => { if (onStart) onStart(); };
      u.onend = () => finish(true);
      u.onerror = () => finish(false);
      // 일부 브라우저는 onend를 안 주기도 한다: 길이 기준으로 안전장치.
      setTimeout(() => finish(true), 1500 + line.length * (short(lang) === 'en' ? 160 : 260));
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
  speechSynthesis.onvoiceschanged = () => { voices.clear(); };
}
