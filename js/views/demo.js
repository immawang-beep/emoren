// 원-URL 플레이그라운드 #demo: 교실 TV(16:9)와 강사 폰을 한 화면에 나란히, 유령 선생님이 수업을 자동으로 진행한다.
// One-URL playground: classroom TV + teacher phone side by side; a ghost teacher runs the lesson.
// (v0.2에서 구현 / implemented in v0.2)
import { esc } from '../util.js';
import { t } from '../i18n.js';

export async function renderDemo(root, { lang = null, packId = null } = {}) {
  void lang; void packId;
  root.innerHTML = `<main class="page"><section class="card"><h2>${esc(t('common.appName'))}</h2></section></main>`;
  return { destroy() {} };
}
