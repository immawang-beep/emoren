// 수업팩 스튜디오 #studio: 코드 없이 수업팩 JSON을 만드는 폼 편집기 — v0.2.1에서 구현. 지금은 안내 화면만.
// Lesson pack studio: a no-code form editor for lesson pack JSON — lands in v0.2.1. This is the placeholder screen.
import { esc } from '../util.js';
import { t } from '../i18n.js';

export async function renderStudio(root) {
  document.title = t('studio.soonTitle');
  root.innerHTML = `<main class="page"><section class="card"><h2>${esc(t('studio.soonTitle'))}</h2><p>${esc(t('studio.soonDesc'))}</p>
    <a class="btn" href="docs/PACK-FORMAT.md" target="_blank" rel="noopener">${esc(t('studio.soonFormat'))}</a> <a class="btn ghost" href="#">${esc(t('common.home'))}</a></section></main>`;
  return { destroy() {} };
}
