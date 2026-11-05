// 교실 TV 무대. 읽기만 한다. 16:9 한 장면, 왼쪽에 캐릭터, 오른쪽에 장면.
// 상태가 바뀌면 장면을 그리고, speakSeq가 바뀌면 캐릭터가 그 단계의 대사를 말한다.
import { esc, makeCode, pageUrl } from '../util.js';
import { loadPack } from '../pack.js';
import { createSync } from '../sync/index.js';
import { currentStep, tallyFor, leadOption, storyVars, renderTemplate, summaryOf, SYNC_LABEL } from '../store.js';
import { createCharacter } from '../ui/character.js';
import { speak, stop as stopSpeech, unlock, isUnlocked, canSpeak } from '../ui/speech.js';
import { t, getLang, setLang } from '../i18n.js';
import { createClock } from '../clock.js';
import { qrSvg } from '../vendor/qr.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// opts.sync      동기화 방식 강제('local' 등) / force a sync adapter
// opts.embedded  다른 화면(#demo) 안에 끼워 넣었을 때: 문서 제목·전체 화면을 건드리지 않는다
export async function renderTV(root, code, opts = {}) {
  if (!code) { location.replace('#tv-' + makeCode()); return { destroy() {} }; }
  root.innerHTML = `
  <div class="stage-wrap">
    <div class="stage" id="stage" aria-live="polite">
      <div class="stage-top"><span class="ttl"></span><span class="syncbadge" data-sync></span></div>
      <div class="stage-body">
        <div class="chr-slot"></div>
        <div class="scene" data-scene></div>
      </div>
      <div class="caption" data-caption></div>
      <button class="unlock" type="button" data-unlock></button>
    </div>
  </div>`;
  const stage = root.querySelector('#stage');
  const sceneEl = stage.querySelector('[data-scene]');
  const caption = stage.querySelector('[data-caption]');
  const syncBadge = stage.querySelector('[data-sync]');
  const unlockBtn = stage.querySelector('[data-unlock]');
  const slot = stage.querySelector('.chr-slot');

  let chr = createCharacter(slot, {});
  let pack = null;
  let state = null;
  let sceneKey = null;
  let speakKey = null;
  let lastPhase = null;
  let timerDoneKey = null;
  let speakToken = 0;
  let timerTick = null;
  let destroyed = false;
  let sync = null;
  const clock = createClock();

  // 화면 언어에 따라 바뀌는 고정 요소(제목, 소리 버튼, 동기화 배지) / chrome strings that follow the UI language
  function applyChrome() {
    if (!opts.embedded) document.title = t('tv.title', { code });
    unlockBtn.textContent = canSpeak() ? t('tv.unlock') : t('tv.fullscreen');
    if (sync) syncBadge.textContent = SYNC_LABEL[sync.kind] || sync.kind;
    const step = state && pack && state.phase !== 'waiting' && state.phase !== 'done' ? currentStep(pack, state) : null;
    stage.querySelector('.ttl').textContent = pack ? `${pack.title}${step ? ` · ${state.stepIndex + 1}/${pack.steps.length} ${step.title}` : ''}` : t('common.appName');
  }
  applyChrome();

  sync = await createSync(code, { prefer: opts.sync });
  applyChrome();

  let pending = null;
  let flushing = false;
  async function accept(s) {
    pending = s;
    if (flushing) return;
    flushing = true;
    try {
      while (pending && !destroyed) {
        const next = pending; pending = null;
        if (!pack || pack.id !== next.packId || (next.lang && pack.lang !== next.lang)) {
          pack = await loadPack(next.packId, next.lang);
          // 수업 언어를 따른다. 기기의 언어 설정은 바꾸지 않는다 / follow the lesson language, don't persist
          if (pack.lang && pack.lang !== getLang()) setLang(pack.lang, { persist: false });
          chr = createCharacter(slot, pack.character || {});
        }
        clock.observe(next);
        state = next;
        render();
      }
    } finally { flushing = false; }
  }

  const unsub = sync.subscribe((s) => { if (s && s.code === code) accept(s); });
  const first = await sync.get();
  if (first) await accept(first); else render();

  unlockBtn.addEventListener('click', () => {
    unlock((pack && pack.lang) || getLang());
    unlockBtn.hidden = true;
    if (!opts.embedded) { try { if (stage.requestFullscreen) stage.requestFullscreen().catch(() => {}); } catch { /* 전체 화면 불가 */ } }
    speakKey = null; // 지금 단계 대사를 소리로 다시 들려준다
    render();
  });

  // showCaption=false: 화면에 이미 글이 있는 장면(이야기)에서는 자막을 겹쳐 쓰지 않는다
  function say(lines, mood, showCaption = true) {
    const my = ++speakToken;
    stopSpeech();
    (async () => {
      for (const line of lines) {
        if (my !== speakToken || destroyed) return;
        caption.textContent = showCaption ? line : '';
        caption.classList.toggle('long', showCaption && line.length > 40);
        chr.startTalking();
        if (mood) chr.setMood(mood, 2500);
        await speak(line, { ...((pack && pack.character && pack.character.voice) || {}), lang: (pack && pack.lang) || getLang() });
        if (my !== speakToken) return;
        chr.stopTalking();
        await wait(320);
      }
    })();
  }

  function render() {
    if (destroyed) return;
    if (!state) { setScene('waiting', waitingScene()); return; }
    const step = state.phase === 'waiting' || state.phase === 'done' ? null : currentStep(pack, state);
    const key = `${state.phase}|${state.stepIndex}|${state.packId}|${pack.lang || state.lang || ''}`;

    if (state.phase === 'waiting') setScene(key, waitingScene());
    else if (state.phase === 'done') setScene(key, doneScene());
    else if (step.type === 'choice') { setScene(key, choiceScene(step)); updateChoice(step); }
    else if (step.type === 'activity') setScene(key, activityScene(step));
    else if (step.type === 'story') setScene(key, storyScene(step));
    else if (step.type === 'closing') setScene(key, closingScene(step));
    else setScene(key, talkScene(step));

    // 일시정지 덮개
    let pause = stage.querySelector('.pause');
    if (state.phase === 'paused') {
      if (!pause) { pause = document.createElement('div'); pause.className = 'pause'; pause.textContent = t('tv.paused'); stage.appendChild(pause); }
      stopSpeech(); speakToken++; chr.stopTalking();
    } else if (pause) pause.remove();

    applyChrome();

    // 쉬었다 돌아오면 그 단계 대사를 처음부터 다시 들려준다
    if (lastPhase === 'paused' && state.phase === 'live') speakKey = null;
    lastPhase = state.phase;

    // 대사
    const confirmed = step && step.type === 'choice' && state.confirmed[step.id];
    const sk = `${key}|${state.speakSeq}|${confirmed ? 'c' : ''}`;
    if (state.phase === 'live' && sk !== speakKey) {
      speakKey = sk;
      const vars = storyVars(pack, state);
      if (confirmed) say([renderTemplate(step.on_confirm || '', vars)], 'happy');
      else if (step.type === 'story') say([renderTemplate(step.template, vars)], 'think', false);
      else say(step.lines || []);
    } else if (state.phase === 'done' && sk !== speakKey) {
      speakKey = sk;
      say(pack.outro || [t('tv.outroDefault')], 'happy');
    } else if (state.phase === 'waiting') {
      speakKey = null; caption.textContent = '';
    }

    scheduleTimer(step);
  }

  function setScene(key, html) {
    if (key === sceneKey) return;
    sceneKey = key;
    sceneEl.innerHTML = html;
  }

  function waitingScene() {
    // 강사 폰 링크의 QR. 방 링크만 담는다(개인 정보 없음) / QR of the teacher-phone link only
    const qr = qrSvg(pageUrl('teacher-' + code), { label: t('qr.alt', { code }) });
    return `
    <div class="wait">
      <h1>${pack ? esc(pack.title) : esc(t('common.appName'))}</h1>
      <div class="bigcode">${esc(code)}</div>
      <p class="sub">${esc(t('tv.waitStep1'))} &nbsp; ${esc(t('tv.waitStep2'))}</p>
      <div class="qrbox" data-qr>${qr}<p class="qrlabel">${esc(t('qr.scan'))}</p></div>
    </div>`;
  }

  function talkScene(step) {
    return `<h1>${esc(step.heading || step.title)}</h1>`;
  }

  function choiceScene(step) {
    return `
    <h1>${esc(step.prompt)}</h1>
    <div class="options" style="grid-template-columns:repeat(${step.options.length},1fr)">
      ${step.options.map((o) => `
      <div class="opt" data-opt="${esc(o.id)}" style="--c:${esc(o.color || '#16B364')}">
        <div class="emoji">${esc(o.emoji || '')}</div>
        <div class="label">${esc(o.label)}</div>
        <div class="bar"><i></i></div>
        <div class="count">0</div>
      </div>`).join('')}
    </div>`;
  }

  function updateChoice(step) {
    const t = tallyFor(state, step.id);
    const max = Math.max(1, ...step.options.map((o) => t[o.id] || 0));
    const lead = leadOption(step, t);
    for (const o of step.options) {
      const el = sceneEl.querySelector(`[data-opt="${o.id}"]`);
      if (!el) continue;
      const n = t[o.id] || 0;
      el.querySelector('.count').textContent = n;
      el.querySelector('.bar i').style.height = `${Math.round((n / max) * 100)}%`;
      el.classList.toggle('lead', lead === o.id);
    }
  }

  function activityScene(step) {
    const r = 46, c = 2 * Math.PI * r;
    return `
    <h1>${esc(step.heading || step.title)}</h1>
    <div class="activity">
      <div class="moves">${(step.moves || []).map((m) => `<div><span>${esc(m.emoji || '')}</span><span>${esc(m.text)}</span></div>`).join('')}</div>
      <div class="timer">
        <svg class="ring" viewBox="0 0 100 100"><circle class="bg" cx="50" cy="50" r="${r}"/><circle class="fgc" cx="50" cy="50" r="${r}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="0" data-ring/></svg>
        <div class="tleft" data-tleft>${step.timer_sec}</div>
      </div>
    </div>`;
  }

  function storyScene(step) {
    const text = renderTemplate(step.template, storyVars(pack, state));
    return `<div class="story"><h1>${esc(step.heading || step.title)}</h1><p>${esc(text)}</p></div>`;
  }

  function closingScene(step) {
    const sum = summaryOf(pack, state);
    return `
    <div class="closing">
      <h1>${esc(step.heading || step.title)}</h1>
      ${sum ? `<div class="chips">${sum.rows.map((r) => `<span class="chip">${esc(r.emoji || '')} ${esc(r.label)} ${r.n}</span>`).join('')}</div>` : ''}
    </div>`;
  }

  function doneScene() {
    const sum = summaryOf(pack, state);
    return `
    <div class="closing">
      <h1>${esc(t('tv.doneTitle'))}</h1>
      ${sum ? `<div class="chips">${sum.rows.map((r) => `<span class="chip">${esc(r.emoji || '')} ${esc(r.label)} ${r.n}</span>`).join('')}</div>` : ''}
      <p class="sub">${esc(t('tv.doneSub'))}</p>
    </div>`;
  }

  function scheduleTimer(step) {
    clearInterval(timerTick);
    const t = state && state.timer;
    if (!step || step.type !== 'activity' || !t || t.stepId !== step.id || state.phase !== 'live') return;
    const ring = sceneEl.querySelector('[data-ring]');
    const left = sceneEl.querySelector('[data-tleft]');
    const c = ring ? Number(ring.getAttribute('stroke-dasharray')) : 0;
    const tick = () => {
      const rem = Math.max(0, t.seconds - (clock.now() - t.startedAt) / 1000);
      if (left) left.textContent = Math.ceil(rem);
      if (ring) ring.style.strokeDashoffset = (c * (1 - rem / t.seconds)).toFixed(1);
      if (rem <= 0) {
        clearInterval(timerTick);
        const k = `${step.id}|${t.startedAt}`;
        if (timerDoneKey !== k) { timerDoneKey = k; if (step.done_line) say([step.done_line], 'happy'); }
      }
    };
    tick();
    timerTick = setInterval(tick, 500);
  }

  return {
    destroy() {
      destroyed = true;
      clearInterval(timerTick);
      speakToken++;
      stopSpeech();
      unsub();
      sync.close();
    },
  };
}
