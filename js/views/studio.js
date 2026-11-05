// 수업팩 스튜디오 #studio: 코드 없이 수업팩 JSON을 만드는 폼 편집기.
// Lesson pack studio: a no-code form editor for lesson pack JSON.
// (v0.2에서 구현 / implemented in v0.2)
import { esc } from '../util.js';
import { t } from '../i18n.js';

export async function renderStudio(root) {
  root.innerHTML = `<main class="page"><section class="card"><h2>${esc(t('common.appName'))}</h2></section></main>`;
  return { destroy() {} };
}
