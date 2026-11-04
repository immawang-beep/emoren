// 강사 폰 리모컨. 유일하게 상태를 쓰는 화면.
// 한 손 조작: 큰 버튼, 단계마다 '선생님 할 일' 한 줄, 아래에 이전·잠깐·다음.
import { esc, pageUrl, readLocal, writeLocal } from '../util.js';
import { loadPack, DEFAULT_PACK } from '../pack.js';
import { createSync } from '../sync/index.js';
import {
  newRoom, stamp, actions, currentStep, tallyFor, total, storyVars, renderTemplate, summaryOf, SYNC_LABEL,
} from '../store.js';

export async function renderTeacher(root, code) {
  if (!code) { location.replace('#'); return { destroy() {} }; }
  writeLocal('emoren.lastCode', code);
  document.title = `강사 리모컨 · ${code}`;

  const sync = await createSync(code);
  let state = await sync.get();
  let pack;
  if (!state) {
    pack = await loadPack(readLocal('emoren.pack', DEFAULT_PACK));
    state = stamp(newRoom(code, pack));
    await sync.set(state);
  } else {
    pack = await loadPack(state.packId || DEFAULT_PACK);
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
        <a class="back" href="#" aria-label="처음으로">‹</a>
        <div class="grow">
          <div class="tcode">수업 코드 ${esc(code)}</div>
          <div class="tsync">${esc(SYNC_LABEL[sync.kind] || sync.kind)} · ${esc(pack.title)}</div>
        </div>
        ${state.phase === 'live' || paused ? `<button class="btn small ${paused ? 'green' : ''}" data-act="pause">${paused ? '계속' : '잠깐'}</button>` : ''}
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
        <div class="eyebrow">오늘 수업</div>
        <h2>${esc(pack.title)}</h2>
        <p class="muted">${esc(pack.age)} · ${esc(pack.minutes)}분 · ${pack.steps.length}단계</p>
        <p>${esc(pack.goal || '')}</p>
      </section>
      <section class="card">
        <div class="h">TV 확인</div>
        <p>교실 TV에 코드 <b>${esc(code)}</b>가 떠 있고 '소리 켜기'를 눌렀으면 준비 끝. TV가 아직이면 TV에서 아래 링크를 여세요.</p>
        <div class="copyrow"><input readonly value="${esc(tvUrl)}" aria-label="TV 링크"><button class="btn small" type="button" data-copy="${esc(tvUrl)}">복사</button></div>
        ${pack.materials ? `<p class="hint">준비물: ${esc(pack.materials.join(', '))}</p>` : ''}
      </section>
      <ol class="steps muted">${pack.steps.map((s) => `<li>${esc(s.title)}</li>`).join('')}</ol>
      <button class="btn primary wide" type="button" data-act="start">수업 시작</button>
    </div>`;
  }

  function livePanel(paused) {
    const step = currentStep(pack, state);
    const i = state.stepIndex;
    const n = pack.steps.length;
    const last = i >= n - 1;
    return `
    <div class="panel">
      <div class="stepnav"><b>${i + 1}/${n}</b><span>${esc(step.title)}</span>${paused ? '<span class="pausetag">일시정지 · TV 가림</span>' : ''}</div>
      <div class="cue"><div class="eyebrow">선생님 할 일</div><p>${esc(step.cue || '')}</p></div>
      ${controlsFor(step)}
      <div class="nav">
        <button class="btn" type="button" data-act="prev" ${i === 0 ? 'disabled' : ''}>이전</button>
        <button class="btn" type="button" data-act="respeak">다시 말하기</button>
        <button class="btn primary" type="button" data-act="next">${last ? '수업 마치기' : '다음 →'}</button>
      </div>
      <details class="notes" ${notesOpen ? 'open' : ''}>
        <summary>반 메모 (${state.notes.length})</summary>
        <p class="hint">반 전체 분위기만 적어요. 아이 이름은 적지 않아요.</p>
        <textarea rows="2" data-note placeholder="예: 비 카드가 많아서 몸놀이를 길게 했다">${esc(noteDraft)}</textarea>
        <button class="btn small" type="button" data-act="note">메모 저장</button>
        <ul>${state.notes.slice(-5).reverse().map((m) => `<li>${esc(m.text)}</li>`).join('')}</ul>
      </details>
    </div>`;
  }

  function controlsFor(step) {
    if (step.type === 'choice') {
      const t = tallyFor(state, step.id);
      const sum = total(t);
      const confirmed = !!state.confirmed[step.id];
      return `
      <div class="tally" data-step="${esc(step.id)}">
        ${step.options.map((o) => `
        <div class="row">
          <div class="olabel"><span><span class="oe">${esc(o.emoji || '')}</span> ${esc(o.label)}</span><small>${esc(o.hint || '')}</small></div>
          <button class="btn" type="button" data-tally="${esc(o.id)}" data-delta="-1" aria-label="${esc(o.label)} 하나 빼기">−</button>
          <div class="n" data-n="${esc(o.id)}">${t[o.id] || 0}</div>
          <button class="btn green" type="button" data-tally="${esc(o.id)}" data-delta="1" aria-label="${esc(o.label)} 하나 더하기">＋</button>
        </div>`).join('')}
      </div>
      <div class="trow">
        <span class="muted">모두 <b>${sum}</b>명</span>
        <button class="btn ${confirmed ? '' : 'primary'}" type="button" data-act="confirm" ${sum === 0 ? 'disabled' : ''}>${confirmed ? '다시 확정 (캐릭터 반응)' : '확정 → 캐릭터 반응'}</button>
      </div>`;
    }
    if (step.type === 'activity') {
      const t = state.timer && state.timer.stepId === step.id ? state.timer : null;
      return `
      <div class="timerbox">
        <span class="big" data-timer>${t ? remaining(t) : step.timer_sec}</span><span class="muted">초 ${t ? '남음' : '타이머'}</span>
        <span style="flex:1"></span>
        <button class="btn ${t ? '' : 'green'}" type="button" data-act="timer">${t ? '다시 시작' : '타이머 시작'}</button>
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
        <h2>수업 끝!</h2>
        <p>오늘 「${esc(pack.title)}」 기록이 정리됐어요. 반 전체 숫자와 이야기만 남습니다.</p>
        ${summaryBars()}
      </section>
      <section class="card">
        <div class="h">보호자 페이지</div>
        <p>이 링크를 반 단체방에 올리면 보호자가 오늘 이야기와 집에서 이어갈 질문을 볼 수 있어요.</p>
        <div class="copyrow"><input readonly value="${esc(parentUrl)}" aria-label="보호자 페이지 링크"><button class="btn small" type="button" data-copy="${esc(parentUrl)}">복사</button></div>
        <a class="btn wide" href="${esc(parentUrl)}" target="_blank" rel="noopener">보호자 페이지 미리 보기</a>
      </section>
      <button class="btn ghost wide" type="button" data-act="reset">같은 코드로 새 수업 준비</button>
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
        try { await navigator.clipboard.writeText(text); btn.textContent = '복사됨'; }
        catch { const inp = btn.parentElement.querySelector('input'); if (inp) { inp.focus(); inp.select(); } btn.textContent = '길게 눌러 복사'; }
        setTimeout(() => { btn.textContent = '복사'; }, 1800);
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
