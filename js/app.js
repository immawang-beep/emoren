// 진입점: 해시 라우터.
//   #                 홈(세 화면으로 가는 입구)
//   #tv-CODE          교실 TV 무대     (#tv 만 쓰면 새 코드를 만든다)
//   #teacher-CODE     강사 폰 리모컨
//   #parent-CODE      보호자 페이지
import { esc, normalizeCode } from './util.js';
import { renderHome } from './views/home.js';
import { renderTeacher } from './views/teacher.js';
import { renderTV } from './views/tv.js';
import { renderParent } from './views/parent.js';

const app = document.getElementById('app');
let current = null;
let routeSeq = 0;

export function parseHash(hash) {
  const h = String(hash || '').replace(/^#/, '');
  const m = h.match(/^(tv|teacher|parent)-([A-Za-z0-9]{3,8})$/);
  if (m) return { view: m[1], code: normalizeCode(m[2]) };
  if (h === 'tv' || h === 'teacher' || h === 'parent') return { view: h, code: null };
  return { view: 'home', code: null };
}

async function route() {
  const seq = ++routeSeq;
  if (current && current.destroy) { try { current.destroy(); } catch (e) { console.warn(e); } }
  current = null;
  app.innerHTML = '';
  const { view, code } = parseHash(location.hash);
  document.body.dataset.view = view;
  try {
    let next;
    if (view === 'tv') next = await renderTV(app, code);
    else if (view === 'teacher') next = await renderTeacher(app, code);
    else if (view === 'parent') next = await renderParent(app, code);
    else next = await renderHome(app);
    if (seq !== routeSeq) { if (next && next.destroy) next.destroy(); return; }
    current = next;
  } catch (e) {
    console.error(e);
    app.innerHTML = `<main class="page"><section class="card"><h2>문제가 생겼어요</h2><p class="err">${esc(e && e.message)}</p><a class="btn" href="#">처음으로</a></section></main>`;
  }
}

window.addEventListener('hashchange', route);
route();

// PWA 설치·오프라인: 일반 웹서버에서만. (아티팩트 안에서는 서비스워커를 쓸 수 없다.)
if ('serviceWorker' in navigator && !window.claude && /^https?:/.test(location.protocol)) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
