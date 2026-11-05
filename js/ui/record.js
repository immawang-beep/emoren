// 남는 기록 패널 / "what this room stores" panel (강사 폰).
// 방 JSON에 들어 있는 것 전부를 선생님이 읽을 수 있는 말로 보여 준다: 선택 단계별 반 전체 숫자, 반 메모,
// 숫자로 만든 오늘 이야기, 시작·끝 시각, 수업팩·언어, 수업 코드, 동기화 방식 — 그리고 원본 JSON 그대로.
// 아이 이름·사진·목소리·개인 선택은 애초에 상태에 없다(js/store.js checkRoom이 그 모양을 지킨다).
// Shows everything the room JSON holds, in plain words, plus the raw JSON. No DOM at import time (node:test-safe).
//
//   recordSummary(pack, state) → 순수 데이터 / plain data
//     { code, packId, lang, phase, startedAt, endedAt,
//       choices: [{ stepId, title, rows: [{ id, emoji, label, n }], total }],
//       notes: [{ t, text }], story: string|null, book, empty, raw }
//   renderRecordPanel(summary, { syncLabel, armed, erased, open, rawOpen }) → <details class="record"> HTML
//     버튼 data-act="erase": 첫 탭은 무장(다시 누르면 지워져요), 5초 안에 또 누르면 actions.reset — 연결은 teacher.js
import { esc, fmtDate } from '../util.js';
import { t, getLang } from '../i18n.js';
import { tallyFor, total, storyVars, renderTemplate } from '../store.js';

export function recordSummary(pack, state) {
  const s = state || {};
  const steps = pack && Array.isArray(pack.steps) ? pack.steps : [];
  const choices = steps.filter((st) => st.type === 'choice').map((st) => {
    const tl = tallyFor(s, st.id);
    return {
      stepId: st.id,
      title: st.title || st.id,
      rows: (st.options || []).map((o) => ({ id: o.id, emoji: o.emoji || '', label: o.label, n: Number(tl[o.id]) || 0 })),
      total: total(tl),
    };
  });
  const storyStep = steps.find((st) => st.type === 'story');
  const notes = Array.isArray(s.notes) ? s.notes.map((m) => ({ t: m.t, text: String(m.text ?? '') })) : [];
  const counted = choices.reduce((a, c) => a + c.total, 0);
  // 비어 있음 = 코드·팩 말고는 아무것도 남지 않은 새 방 / empty = a fresh room: nothing but its code and pack
  const empty = !s.startedAt && !s.endedAt && counted === 0 && notes.length === 0 && !(s.stepIndex > 0)
    && !Object.keys(s.confirmed || {}).length && !s.timer && s.book == null;
  return {
    code: s.code,
    packId: s.packId,
    lang: s.lang,
    phase: s.phase,
    startedAt: s.startedAt || null,
    endedAt: s.endedAt || null,
    choices,
    notes,
    story: storyStep ? renderTemplate(storyStep.template, storyVars(pack, s)) : null,
    book: s.book == null ? null : s.book,
    empty,
    raw: s,
  };
}

// 시각 표기 / timestamp label: "2026년 11월 5일 오후 2:03" · "November 5, 2026 2:03 PM". 없으면 record.notYet
const TIME_LOCALE = { ko: 'ko-KR', en: 'en-US' };
export function fmtWhen(ts, lang = getLang()) {
  if (!ts) return t('record.notYet');
  const d = new Date(ts);
  let hm;
  try { hm = new Intl.DateTimeFormat(TIME_LOCALE[lang] || 'en-US', { hour: 'numeric', minute: '2-digit' }).format(d); }
  catch { hm = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; }
  return `${fmtDate(ts, lang)} ${hm}`;
}

export function renderRecordPanel(sum, opts = {}) {
  const { syncLabel = '', armed = false, erased = false, open = false, rawOpen = false } = opts;
  const lang = getLang();
  const row = (label, body) => `<dt>${esc(label)}</dt><dd>${body}</dd>`;
  let rows = '';
  if (!sum.empty) {
    if (sum.choices.length) {
      rows += row(t('record.counts'), sum.choices.map((c) => `
        <div class="rec-step">
          <b>${esc(c.title)}</b>
          <ul>${c.rows.map((r) => `<li>${esc(r.emoji)} ${esc(r.label)} <b>${esc(r.n)}</b></li>`).join('')}</ul>
          <small>${esc(t('teacher.total', { n: c.total }))}</small>
        </div>`).join(''));
    }
    rows += row(t('record.notes'), sum.notes.length
      ? `<ul class="rec-notes">${sum.notes.map((m) => `<li>${esc(m.text)}</li>`).join('')}</ul>`
      : esc(t('record.none')));
    if (sum.story != null) rows += row(t('record.story'), `<p class="rec-story">${esc(sum.story)}</p>`);
    rows += row(t('record.times'),
      `${esc(t('record.startedAt'))} ${esc(fmtWhen(sum.startedAt, lang))} · ${esc(t('record.endedAt'))} ${esc(fmtWhen(sum.endedAt, lang))}`);
  }
  rows += row(t('record.pack'), `${esc(sum.packId)} · ${esc(sum.lang)}`);
  rows += row(t('common.code'), esc(sum.code));
  rows += row(t('record.sync'), esc(syncLabel));
  return `
  <details class="record" ${open ? 'open' : ''}>
    <summary>${esc(t('record.title'))}</summary>
    <p class="rec-intro">${esc(t('record.intro'))}</p>
    ${sum.empty ? `<p class="rec-empty">${esc(t('record.empty'))}</p>` : ''}
    <dl class="rec">${rows}</dl>
    <details class="rec-raw" ${rawOpen ? 'open' : ''}>
      <summary>${esc(t('record.raw'))}</summary>
      <pre data-raw>${esc(JSON.stringify(sum.raw, null, 2))}</pre>
    </details>
    <div class="rec-actions">
      <button class="btn small rec-erase ${armed ? 'armed' : ''}" type="button" data-act="erase" ${sum.empty && !armed ? 'disabled' : ''}>${esc(armed ? t('record.eraseArmed') : t('record.erase'))}</button>
      <span class="rec-status" role="status" aria-live="polite">${erased ? esc(t('record.erased')) : ''}</span>
    </div>
  </details>`;
}
