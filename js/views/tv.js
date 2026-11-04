// 교실 TV 무대. 읽기만 한다. 16:9 한 장면, 왼쪽에 캐릭터, 오른쪽에 장면.
// 상태가 바뀌면 장면을 그리고, speakSeq가 바뀌면 캐릭터가 그 단계의 대사를 말한다.
import { esc, makeCode } from '../util.js';
import { loadPack } from '../pack.js';
import { createSync } from '../sync/index.js';
import { currentStep, tallyFor, leadOption, storyVars, renderTemplate, summaryOf, SYNC_LABEL } from '../store.js';
import { createCharacter } from '../ui/character.js';
import { speak, stop as stopSpeech, unlock, isUnlocked, canSpeak } from '../ui/speech.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function renderTV(root, code) {
  if (!code) { location.replace('#tv-' + makeCode()); return { destroy() {} }; }
  document.title = `이모렌 교실 TV · ${code}`;

  root.innerHTML = `
  <div class="stage-wrap">
    <div class="stage" id="stage" aria-live="polite">
      <div class="stage-top"><span class="ttl">이모렌 교실</span><span class="syncbadge" data-sync></span></div>
      <div class="stage-body">
        <div class="chr-slot"></div>
        <div class="scene" data-scene></div>
      </div>
      <div class="caption" data-caption></div>
      <button class="unlock" type="button" data-unlock>🔊 소리 켜기</button>
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
  if (!canSpeak()) unlockBtn.textContent = '⛶ 전체 화면';

  const sync = await createSync(code);
  syncBadge.textContent = SYNC_LABEL[sync.kind] || sync.kind;

  let pending = null;
  let flushing = false;
  async function accept(s) {
    pending = s;
    if (flushing) return;
    flushing = true;
    try {
      while (pending && !destroyed) {
        const next = pending; pending = null;
        if (!pack || pack.id !== next.packId) {
          pack = await loadPack(next.packId);
          chr = createCharacter(slot, pack.character || {});
        }
        state = next;
        render();
      }
    } finally { flushing = false; }
  }

  const unsub = sync.subscribe((s) => { if (s && s.code === code) accept(s); });
  const first = await sync.get();
  if (first) await accept(first); else render();

  unlockBtn.addEventListener('click', () => {
    unlock();
    unlockBtn.hidden = true;
    try { if (stage.requestFullscreen) stage.requestFullscreen().catch(() => {}); } catch { /* 전체 화면 불가 */ }
    speakKey = null; // 지금 단계 대사를 소리로 다시 들려준다
    render();
  });

  function say(lines, mood) {
    const my = ++speakToken;
    stopSpeech();
    (async () => {
      for (const line of lines) {
        if (my !== speakToken || destroyed) return;
        caption.textContent = line;
        chr.startTalking();
        if (mood) chr.setMood(mood, 2500);
        await speak(line, (pack && pack.character && pack.character.voice) || {});
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
    const key = `${state.phase}|${state.stepIndex}|${state.packId}`;

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
      if (!pause) { pause = document.createElement('div'); pause.className = 'pause'; pause.textContent = '잠깐 쉬어요'; stage.appendChild(pause); }
      stopSpeech(); speakToken++; chr.stopTalking();
    } else if (pause) pause.remove();

    stage.querySelector('.ttl').textContent = pack ? `${pack.title}${step ? ` · ${state.stepIndex + 1}/${pack.steps.length} ${step.title}` : ''}` : '이모렌 교실';

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
      else if (step.type === 'story') say([renderTemplate(step.template, vars)], 'think');
      else say(step.lines || []);
    } else if (state.phase === 'done' && sk !== speakKey) {
      speakKey = sk;
      say(pack.outro || ['오늘 수업 끝! 고마워.'], 'happy');
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
    return `
    <div class="wait">
      <h1>${pack ? esc(pack.title) : '이모렌 교실'}</h1>
      <div class="bigcode">${esc(code)}</div>
      <p class="sub">① 아래 '소리 켜기'를 한 번 누르세요 &nbsp; ② 강사 폰에서 이 코드를 넣고 수업을 시작하세요</p>
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
      <h1>오늘 수업 끝!</h1>
      ${sum ? `<div class="chips">${sum.rows.map((r) => `<span class="chip">${esc(r.emoji || '')} ${esc(r.label)} ${r.n}</span>`).join('')}</div>` : ''}
      <p class="sub">보호자 페이지에 오늘 이야기가 올라갔어요.</p>
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
      const rem = Math.max(0, t.seconds - (Date.now() - t.startedAt) / 1000);
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
