// 강사 폰 리모컨. 유일하게 상태를 쓰는 화면.
// 한 손 조작: 큰 버튼, 단계마다 '선생님 할 일' 한 줄, 아래에 이전·잠깐·다음.
import { esc, pageUrl, readLocal, writeLocal } from '../util.js';
import { loadPack, DEFAULT_PACK } from '../pack.js';
import { createSync } from '../sync/index.js';
import {
  newRoom, stamp, actions, currentStep, tallyFor, total, storyVars, renderTemplate, summaryOf, SYNC_LABEL,
} from '../store.js';
import { t, getLang } from '../i18n.js';

const tt = t; // controlsFor() 안에서 지역변수 t(타이머)와 이름이 겹칠 때 쓰는 별칭

export async function renderTeacher(root, code) {
  if (!code) { location.replace('#'); return { destroy() {} }; }
  writeLocal('emoren.lastCode', code);
  document.title = t('teacher.title', { code });

  const sync = await createSync(code);
  let state = await sync.get();
  let pack;
  if (!state) {
    // 새 방: 홈에서 고른 팩·언어, 없으면 기기 UI 언어로 된 기본 팩(그 언어가 없으면 loadPack이 첫 언어로 대신한다)
    pack = await loadPack(readLocal('emoren.pack', DEFAULT_PACK), readLocal('emoren.packLang', getLang()));
    state = stamp(newRoom(code, pack));
    await sync.set(state);
  } else {
    pack = await loadPack(state.packId || DEFAULT_PACK, state.lang);
  }

  let noteDraft = '';
  let notesOpen = false;
  let timerTick = null;
  let destroyed = false;

  const dispatch = async (fn) => {
    const next = fn(state);
    if (!next || next === state) return;
    state = stamp(next);
    render();
    await sync.set(state);
  };

  const unsub = sync.subscribe((s) => {
    if (!s || s.code !== code) return;
    if (s.rev === state.rev && s.updatedAt === state.updatedAt) return; // 내 쓰기의 메아리
    if ((s.updatedAt || 0) < (state.updatedAt || 0)) return;            // 더 오래된 상태
    state = s;
    render();
  });

  const tvUrl = pageUrl('tv-' + code);
  const parentUrl = pageUrl('parent-' + code);

  function render() {
    if (destroyed) return;
    const paused = state.phase === 'paused';
    let body;
    if (state.phase === 'waiting') body = waitingPanel();
    else if (state.phase === 'done') body = donePanel();
    else body = livePanel(paused);

    root.innerHTML = `
    <main class="page teacher">
      <div class="tbar">
        <a class="back" href="#" aria-label="${esc(t('common.home'))}">‹</a>
        <div class="grow">
          <div class="tcode">${esc(t('teacher.codeLabel', { code }))}</div>
          <div class="tsync">${esc(SYNC_LABEL[sync.kind] || sync.kind)} · ${esc(pack.title)}</div>
        </div>
        ${state.phase === 'live' || paused ? `<button class="btn small ${paused ? 'green' : ''}" data-act="pause">${esc(paused ? t('teacher.resume') : t('teacher.pause'))}</button>` : ''}
      </div>
      ${body}
    </main>`;
    bind();
    scheduleTimer();
  }

  function waitingPanel() {
    return `
    <div class="panel">
      <section class="card">
        <div class="eyebrow">${esc(t('teacher.today'))}</div>
        <h2>${esc(pack.title)}</h2>
        <p class="muted">${esc(pack.age)} · ${esc(t('common.minutes', { n: pack.minutes }))} · ${esc(t('common.steps', { n: pack.steps.length }))}</p>
        <p>${esc(pack.goal || '')}</p>
      </section>
      <section class="card">
        <div class="h">${esc(t('teacher.tvCheck'))}</div>
        <p>${t('teacher.tvCheckDesc', { code: `<b>${esc(code)}</b>` })}</p>
        <div class="copyrow"><input readonly value="${esc(tvUrl)}" aria-label="${esc(t('teacher.tvLink'))}"><button class="btn small" type="button" data-copy="${esc(tvUrl)}">${esc(t('common.copy'))}</button></div>
        ${pack.materials ? `<p class="hint">${esc(t('teacher.materials', { list: pack.materials.join(', ') }))}</p>` : ''}
      </section>
      <ol class="steps muted">${pack.steps.map((s) => `<li>${esc(s.title)}</li>`).join('')}</ol>
      <button class="btn primary wide" type="button" data-act="start">${esc(t('teacher.start'))}</button>
    </div>`;
  }

  function livePanel(paused) {
    const step = currentStep(pack, state);
    const i = state.stepIndex;
    const n = pack.steps.length;
    const last = i >= n - 1;
    return `
    <div class="panel">
      <div class="stepnav"><b>${i + 1}/${n}</b><span>${esc(step.title)}</span>${paused ? `<span class="pausetag">${esc(t('teacher.pausedTag'))}</span>` : ''}</div>
      <div class="cue"><div class="eyebrow">${esc(t('teacher.cue'))}</div><p>${esc(step.cue || '')}</p></div>
      ${controlsFor(step)}
      <div class="nav">
        <button class="btn" type="button" data-act="prev" ${i === 0 ? 'disabled' : ''}>${esc(t('teacher.prev'))}</button>
        <button class="btn" type="button" data-act="respeak">${esc(t('teacher.respeak'))}</button>
        <button class="btn primary" type="button" data-act="next">${esc(last ? t('teacher.finish') : t('teacher.next'))}</button>
      </div>
      <details class="notes" ${notesOpen ? 'open' : ''}>
        <summary>${esc(t('teacher.notes', { n: state.notes.length }))}</summary>
        <p class="hint">${esc(t('teacher.notesHint'))}</p>
        <textarea rows="2" data-note placeholder="${esc(t('teacher.notesPlaceholder'))}">${esc(noteDraft)}</textarea>
        <button class="btn small" type="button" data-act="note">${esc(t('teacher.saveNote'))}</button>
        <ul>${state.notes.slice(-5).reverse().map((m) => `<li>${esc(m.text)}</li>`).join('')}</ul>
      </details>
    </div>`;
  }

  function controlsFor(step) {
    if (step.type === 'choice') {
      const tl = tallyFor(state, step.id);
      const sum = total(tl);
      const confirmed = !!state.confirmed[step.id];
      return `
      <div class="tally" data-step="${esc(step.id)}">
        ${step.options.map((o) => `
        <div class="row">
          <div class="olabel"><span><span class="oe">${esc(o.emoji || '')}</span> ${esc(o.label)}</span><small>${esc(o.hint || '')}</small></div>
          <button class="btn" type="button" data-tally="${esc(o.id)}" data-delta="-1" aria-label="${esc(t('teacher.minus', { label: o.label }))}">−</button>
          <div class="n" data-n="${esc(o.id)}">${tl[o.id] || 0}</div>
          <button class="btn green" type="button" data-tally="${esc(o.id)}" data-delta="1" aria-label="${esc(t('teacher.plus', { label: o.label }))}">＋</button>
        </div>`).join('')}
      </div>
      <div class="trow">
        <span class="muted">${t('teacher.total', { n: `<b>${sum}</b>` })}</span>
        <button class="btn ${confirmed ? '' : 'primary'}" type="button" data-act="confirm" ${sum === 0 ? 'disabled' : ''}>${esc(confirmed ? t('teacher.reconfirm') : t('teacher.confirm'))}</button>
      </div>`;
    }
    if (step.type === 'activity') {
      const t = state.timer && state.timer.stepId === step.id ? state.timer : null;
      return `
      <div class="timerbox">
        <span class="big" data-timer>${t ? remaining(t) : step.timer_sec}</span><span class="muted">${esc(t ? tt('teacher.secLeft') : tt('teacher.secTimer'))}</span>
        <span style="flex:1"></span>
        <button class="btn ${t ? '' : 'green'}" type="button" data-act="timer">${esc(t ? tt('teacher.timerRestart') : tt('teacher.timerStart'))}</button>
      </div>
      <ul class="steps">${(step.moves || []).map((m) => `<li>${esc(m.emoji || '')} ${esc(m.text)}</li>`).join('')}</ul>`;
    }
    if (step.type === 'story') {
      return `<blockquote class="preview">${esc(renderTemplate(step.template, storyVars(pack, state)))}</blockquote>`;
    }
    if (step.type === 'closing') {
      return `${summaryBars()}<blockquote class="preview">${(step.lines || []).map(esc).join('<br>')}</blockquote>`;
    }
    return `<blockquote class="preview">${(step.lines || []).map(esc).join('<br>')}</blockquote>`;
  }

  function summaryBars() {
    const sum = summaryOf(pack, state);
    if (!sum) return '';
    return `<div class="summary-bars">${sum.rows.map((r) => `
      <div class="r"><span>${esc(r.emoji || '')} ${esc(r.label)}</span><div class="track"><i style="--c:${esc(r.color || '#16B364')};width:${r.pct}%"></i></div><span class="n">${r.n}</span></div>`).join('')}</div>`;
  }

  function donePanel() {
    return `
    <div class="panel">
      <section class="card">
        <h2>${esc(t('teacher.doneTitle'))}</h2>
        <p>${esc(t('teacher.doneDesc', { title: pack.title }))}</p>
        ${summaryBars()}
      </section>
      <section class="card">
        <div class="h">${esc(t('teacher.parentPage'))}</div>
        <p>${esc(t('teacher.parentDesc'))}</p>
        <div class="copyrow"><input readonly value="${esc(parentUrl)}" aria-label="${esc(t('teacher.parentLink'))}"><button class="btn small" type="button" data-copy="${esc(parentUrl)}">${esc(t('common.copy'))}</button></div>
        <a class="btn wide" href="${esc(parentUrl)}" target="_blank" rel="noopener">${esc(t('teacher.parentPreview'))}</a>
      </section>
      <button class="btn ghost wide" type="button" data-act="reset">${esc(t('teacher.reset'))}</button>
    </div>`;
  }

  function remaining(t) {
    return Math.max(0, Math.ceil(t.seconds - (Date.now() - t.startedAt) / 1000));
  }

  function scheduleTimer() {
    clearInterval(timerTick);
    const t = state.timer;
    if (!t || state.phase !== 'live') return;
    timerTick = setInterval(() => {
      const el = root.querySelector('[data-timer]');
      if (!el) { clearInterval(timerTick); return; }
      el.textContent = remaining(t);
      if (remaining(t) === 0) clearInterval(timerTick);
    }, 500);
  }

  function bind() {
    const step = state.phase === 'live' || state.phase === 'paused' ? currentStep(pack, state) : null;
    root.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const act = btn.dataset.act;
        if (act === 'start') dispatch((s) => actions.start(s));
        else if (act === 'next') dispatch((s) => actions.next(s, pack));
        else if (act === 'prev') dispatch((s) => actions.prev(s));
        else if (act === 'pause') dispatch((s) => actions.togglePause(s));
        else if (act === 'respeak') dispatch((s) => actions.respeak(s));
        else if (act === 'confirm' && step) dispatch((s) => actions.confirm(s, step.id));
        else if (act === 'timer' && step) dispatch((s) => actions.startTimer(s, step.id, step.timer_sec));
        else if (act === 'reset') dispatch((s) => actions.reset(s, pack));
        else if (act === 'note') {
          const ta = root.querySelector('[data-note]');
          const text = ta ? ta.value : '';
          noteDraft = '';
          notesOpen = true;
          dispatch((s) => actions.note(s, text));
        }
      });
    });
    root.querySelectorAll('[data-tally]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!step) return;
        const delta = Number(btn.dataset.delta);
        dispatch((s) => actions.tally(s, step.id, btn.dataset.tally, delta));
      });
    });
    root.querySelectorAll('[data-copy]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const text = btn.dataset.copy;
        try { await navigator.clipboard.writeText(text); btn.textContent = t('common.copied'); }
        catch { const inp = btn.parentElement.querySelector('input'); if (inp) { inp.focus(); inp.select(); } btn.textContent = t('common.copyHold'); }
        setTimeout(() => { btn.textContent = t('common.copy'); }, 1800);
      });
    });
    const ta = root.querySelector('[data-note]');
    if (ta) ta.addEventListener('input', () => { noteDraft = ta.value; });
    const det = root.querySelector('details.notes');
    if (det) det.addEventListener('toggle', () => { notesOpen = det.open; });
  }

  render();
  return {
    destroy() {
      destroyed = true;
      clearInterval(timerTick);
      unsub();
      sync.close();
    },
  };
}
