// 진입점: 해시 라우터.
//   #                 홈(세 화면으로 가는 입구)
//   #tv-CODE          교실 TV 무대     (#tv 만 쓰면 새 코드를 만든다)
//   #teacher-CODE     강사 폰 리모컨
//   #parent-CODE      보호자 페이지
//   #demo             플레이그라운드: TV + 강사 폰을 한 화면에, 유령 선생님 자동 진행
//   #demo-LANG        (예: #demo-en) 그 언어 수업팩으로
//   #demo-LANG-PACKID (예: #demo-en-mind-weather, #demo-ko-studio-draft)
//   #studio           수업팩 스튜디오(코드 없이 팩 만들기)
import { esc } from './util.js';
import { parseHash } from './route.js';
import { renderHome } from './views/home.js';
import { renderTeacher } from './views/teacher.js';
import { renderTV } from './views/tv.js';
import { renderParent } from './views/parent.js';
import { renderDemo } from './views/demo.js';
import { renderStudio } from './views/studio.js';
import { t, getLang } from './i18n.js';

const app = document.getElementById('app');
document.documentElement.lang = getLang();
let current = null;
let routeSeq = 0;

async function route() {
  const seq = ++routeSeq;
  if (current && current.destroy) { try { current.destroy(); } catch (e) { console.warn(e); } }
  current = null;
  app.innerHTML = '';
  const parsed = parseHash(location.hash);
  const { view, code } = parsed;
  document.body.dataset.view = view;
  try {
    let next;
    if (view === 'tv') next = await renderTV(app, code);
    else if (view === 'teacher') next = await renderTeacher(app, code);
    else if (view === 'parent') next = await renderParent(app, code);
    else if (view === 'demo') next = await renderDemo(app, { lang: parsed.lang, packId: parsed.packId });
    else if (view === 'studio') next = await renderStudio(app);
    else next = await renderHome(app);
    if (seq !== routeSeq) { if (next && next.destroy) next.destroy(); return; }
    current = next;
  } catch (e) {
    console.error(e);
    app.innerHTML = `<main class="page"><section class="card"><h2>${esc(t('common.errorTitle'))}</h2><p class="err">${esc(e && e.message)}</p><a class="btn" href="#">${esc(t('common.home'))}</a></section></main>`;
  }
}

window.addEventListener('hashchange', route);
route();

// PWA 설치·오프라인: 일반 웹서버에서만. (아티팩트 안에서는 서비스워커를 쓸 수 없다.)
if ('serviceWorker' in navigator && !window.claude && /^https?:/.test(location.protocol)) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
