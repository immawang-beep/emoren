// 캐릭터(임시 그림). 조앤·힐링이의 실제 그림과 음성은 공개 저장소에 넣지 않고, 운영 배포에서 같은 자리에 꽂는다.
// 공개 코드에는 SVG 한 덩어리로 그린 자리표시 캐릭터만 들어 있다.
// 상태: idle(기본) | talk(말하는 중) | happy(기뻐함) | think(생각 중)

import { esc } from '../util.js';
import { t } from '../i18n.js';

export function createCharacter(slot, { name = '조앤', color = '#FF6B9D' } = {}) {
  slot.innerHTML = `
  <svg class="chr" viewBox="0 0 200 220" role="img" aria-label="${esc(t('common.characterAlt', { name }))}" data-mood="idle">
    <defs>
      <radialGradient id="chrG" cx="38%" cy="32%" r="72%">
        <stop offset="0" stop-color="#FFC1D6"/>
        <stop offset="1" stop-color="${esc(color)}"/>
      </radialGradient>
    </defs>
    <ellipse cx="100" cy="207" rx="54" ry="8" fill="rgba(40,60,90,.12)"/>
    <g class="body">
      <path d="M100 22 l9 -16 l5 18 z" fill="#16B364"/>
      <circle cx="100" cy="112" r="86" fill="url(#chrG)"/>
      <circle cx="58" cy="134" r="11" fill="#FF8FB3" opacity=".75"/>
      <circle cx="142" cy="134" r="11" fill="#FF8FB3" opacity=".75"/>
      <g class="eyes">
        <ellipse class="eye" cx="72" cy="104" rx="9" ry="12" fill="#2B2622"/>
        <ellipse class="eye" cx="128" cy="104" rx="9" ry="12" fill="#2B2622"/>
        <circle cx="75" cy="99" r="3" fill="#fff"/>
        <circle cx="131" cy="99" r="3" fill="#fff"/>
      </g>
      <g class="mouth">
        <path class="mouth-closed" d="M84 144 q16 14 32 0" stroke="#7A2E4C" stroke-width="5" fill="none" stroke-linecap="round"/>
        <ellipse class="mouth-open" cx="100" cy="150" rx="12" ry="9" fill="#7A2E4C"/>
      </g>
    </g>
  </svg>`;
  const el = slot.querySelector('.chr');
  let moodTimer = null;
  return {
    el,
    name,
    setMood(mood, holdMs = 0) {
      clearTimeout(moodTimer);
      el.dataset.mood = mood;
      if (holdMs > 0) moodTimer = setTimeout(() => { el.dataset.mood = 'idle'; }, holdMs);
    },
    startTalking() { el.classList.add('is-talking'); },
    stopTalking() { el.classList.remove('is-talking'); },
  };
}
