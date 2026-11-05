// 원-URL 플레이그라운드 #demo: 교실 TV(16:9)와 강사 폰을 한 화면에 나란히, 유령 선생님이 수업을 자동으로 진행한다.
// One-URL playground: the classroom TV and the teacher phone side by side in one tab, joined to one fresh room
// code through same-browser sync. A ghost teacher (js/demo/ghost.js) can run a whole lesson by itself; any real
// tap on the phone (or the "Take over" button) hands control back to the visitor. After the lesson: open the
// family page in a new tab, or replay with a fresh code.
//   #demo · #demo-<lang> · #demo-<lang>-<packId>   (js/route.js)
// 방은 매번 새 코드로 만든다(버리는 방). 기기 언어 설정은 바꾸지 않는다(setLang persist: false).
// 테스트 훅 / test hook: 이 화면이 떠 있는 동안만 window.emorenDemo = { code, ghost } (destroy 시 삭제).
import { esc, makeCode, pageUrl } from '../util.js';
import { loadPack, loadPackIndex, listPackChoices, DEFAULT_PACK } from '../pack.js';
import { createSync } from '../sync/index.js';
import { renderTV } from './tv.js';
import { renderTeacher } from './teacher.js';
import { createGhost } from '../demo/ghost.js';
import { t, getLang, setLang, LANGS, langName } from '../i18n.js';

const TIMER_SEC = 8;   // 플레이그라운드의 짧은 몸놀이 타이머 / short activity timer for the playground

export async function renderDemo(root, { lang = null, packId = null } = {}) {
  const want = setLang(lang || getLang(), { persist: false });
  const id = packId || DEFAULT_PACK;
  const pack = await loadPack(id, want);                       // 강사 폰이 받을 것과 같은 캐시 항목 / same cached object the phone gets
  const uiLang = setLang(pack.lang || want, { persist: false }); // 팩이 다른 언어로 대신 왔으면 화면도 그 언어로
  let choices = [];
  try { choices = listPackChoices(await loadPackIndex()).filter((c) => c.lang === uiLang); } catch (e) { console.warn(e); }
  if (!choices.some((c) => c.id === pack.id)) choices.unshift({ id: pack.id, lang: uiLang, title: pack.title });
  const speed = (typeof window !== 'undefined' && Number(window.EMOREN_DEMO_SPEED) > 0) ? Number(window.EMOREN_DEMO_SPEED) : 1;
  document.title = `${t('common.appName')} · ${t('demo.title')}`;

  root.innerHTML = `
  <main class="demo">
    <header class="demo-bar">
      <a class="back" href="#" aria-label="${esc(t('common.home'))}">‹</a>
      <div class="demo-brand"><span class="logo">${esc(t('common.appName'))}</span><span class="demo-title">${esc(t('demo.title'))}</span></div>
      <div class="demo-tools">
        <div class="langs" role="group" aria-label="${esc(t('common.language'))}">
          ${LANGS.map((l) => `<button class="pill" type="button" data-lang="${l}" aria-pressed="${l === uiLang}" title="${esc(langName(l))}">${l.toUpperCase()}</button>`).join('')}
        </div>
        <label class="demo-pack"><span>${esc(t('demo.packLabel'))}</span>
          <select data-pack aria-label="${esc(t('demo.packLabel'))}">
            ${choices.map((c) => `<option value="${esc(c.id)}" ${c.id === pack.id ? 'selected' : ''}>${esc(c.title)}</option>`).join('')}
          </select>
        </label>
      </div>
    </header>
    <p class="demo-sub">${esc(t('demo.subtitle'))}</p>
    <div class="demo-grid">
      <section class="demo-tv" aria-label="${esc(t('demo.tvLabel'))}">
        <div class="demo-cap">📺 ${esc(t('demo.tvLabel'))}</div>
        <div class="demo-tv-root" data-tv></div>
      </section>
      <section class="demo-phone" aria-label="${esc(t('demo.phoneLabel'))}">
        <div class="demo-cap">📱 ${esc(t('demo.phoneLabel'))}</div>
        <div class="phone-frame"><div class="phone-screen" data-phone></div></div>
      </section>
    </div>
    <footer class="demo-foot">
      <div class="demo-actions">
        <button class="btn primary" type="button" data-ghost="run">👻 ${esc(t('demo.ghostRun'))}</button>
        <button class="btn" type="button" data-ghost="stop" hidden>✋ ${esc(t('demo.ghostStop'))}</button>
        <a class="btn green" data-demo="family" href="#" target="_blank" rel="noopener" hidden>${esc(t('demo.family'))}</a>
        <button class="btn" type="button" data-demo="replay" hidden>↻ ${esc(t('demo.replay'))}</button>
      </div>
      <p class="demo-status" data-ghost-status aria-live="polite">${esc(t('demo.ghostIdle'))}</p>
      <p class="hint">${esc(t('demo.hint'))}</p>
    </footer>
  </main>`;

  const tvRoot = root.querySelector('[data-tv]');
  const phoneRoot = root.querySelector('[data-phone]');
  const runBtn = root.querySelector('[data-ghost="run"]');
  const stopBtn = root.querySelector('[data-ghost="stop"]');
  const familyBtn = root.querySelector('[data-demo="family"]');
  const replayBtn = root.querySelector('[data-demo="replay"]');
  const statusEl = root.querySelector('[data-ghost-status]');

  let code = null;
  let tvView = null;
  let phoneView = null;
  let ghost = null;
  let watch = null;        // 읽기 전용 구독: 방의 phase를 보고 바닥 버튼을 맞춘다 / read-only: follows the room's phase
  let unwatch = null;
  let lastState = null;
  let phase = 'waiting';
  let ghostStatus = 'idle';   // idle | running | stopped | done
  let destroyed = false;
  let mountSeq = 0;

  function setStatus(status, step) {
    ghostStatus = status;
    if (status === 'running') statusEl.textContent = t('demo.ghostRunning', { step: step || '' });
    else if (status === 'stopped') statusEl.textContent = t('demo.ghostStopped');
    else if (status === 'done') statusEl.textContent = t('demo.ghostDone');
    else statusEl.textContent = t('demo.ghostIdle');
    syncFoot();
  }

  function syncFoot() {
    const done = phase === 'done';
    const running = ghostStatus === 'running';
    runBtn.hidden = running || done;
    stopBtn.hidden = !running;
    familyBtn.hidden = !done;
    replayBtn.hidden = !done;
  }

  function onPhase(next) {
    if (next === phase) return;
    phase = next;
    if (phase === 'done') { if (ghostStatus !== 'done') setStatus('done'); }
    else if (phase === 'waiting' && ghostStatus === 'done') setStatus('idle');   // 폰에서 '같은 코드로 새 수업 준비'
    syncFoot();
  }

  async function mount() {
    const seq = ++mountSeq;
    code = makeCode();
    lastState = null; phase = 'waiting';
    familyBtn.href = pageUrl('parent-' + code);
    tvRoot.innerHTML = ''; phoneRoot.innerHTML = '';
    const tv = await renderTV(tvRoot, code, { sync: 'local', embedded: true });
    if (seq !== mountSeq || destroyed) { tv.destroy(); return; }
    tvView = tv;
    let phone;
    try {
      phone = await renderTeacher(phoneRoot, code, { sync: 'local', embedded: true, timerSec: TIMER_SEC, packId: id, packLang: want });
    } catch (e) { teardown(); throw e; }
    if (seq !== mountSeq || destroyed) { phone.destroy(); return; }
    phoneView = phone;
    ghost = createGhost({ phoneRoot, getPack: () => pack, speed, timerSec: TIMER_SEC, onStatus: (s, info) => { if (!destroyed) setStatus(s, info.step); } });
    watch = await createSync(code, { prefer: 'local' });
    if (seq !== mountSeq || destroyed) { watch.close(); watch = null; return; }
    unwatch = watch.subscribe((s) => { if (!s || s.code !== code) return; lastState = s; onPhase(s.phase); });
    window.emorenDemo = { code, ghost };
    setStatus('idle');
  }

  function teardown() {
    if (ghost) { ghost.destroy(); ghost = null; }
    if (unwatch) { unwatch(); unwatch = null; }
    if (watch) { watch.close(); watch = null; }
    if (phoneView) { phoneView.destroy(); phoneView = null; }
    if (tvView) { tvView.destroy(); tvView = null; }
    if (window.emorenDemo) delete window.emorenDemo;
  }

  // 새 코드로 다시 / replay with a fresh code (same hash)
  async function restart() {
    teardown();
    ghostStatus = 'idle';
    await mount();
  }

  runBtn.addEventListener('click', () => {
    if (!ghost || ghost.running) return;
    const s = lastState;
    const live = s && (s.phase === 'live' || s.phase === 'paused');
    ghost.run(live ? { fromStep: s.stepIndex, paused: s.phase === 'paused' } : {});
  });
  stopBtn.addEventListener('click', () => { if (ghost) ghost.stop('user'); });
  replayBtn.addEventListener('click', () => { restart().catch((e) => console.warn(e)); });
  for (const btn of root.querySelectorAll('.demo-bar [data-lang]')) {
    btn.addEventListener('click', () => { location.hash = `#demo-${btn.dataset.lang}${packId ? `-${packId}` : ''}`; });
  }
  const sel = root.querySelector('[data-pack]');
  if (sel) sel.addEventListener('change', () => { location.hash = `#demo-${uiLang}-${sel.value}`; });

  await mount();
  return {
    destroy() {
      destroyed = true;
      mountSeq++;
      teardown();
    },
  };
}
