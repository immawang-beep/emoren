// 보호자 페이지. 읽기만 한다. 반 전체 숫자와 오늘 이야기, 집에서 이어갈 질문.
// 아이 개인의 선택이나 이름은 어디에도 없다.
import { esc, fmtDate } from '../util.js';
import { loadPack } from '../pack.js';
import { createSync } from '../sync/index.js';
import { storyVars, renderTemplate, summaryOf } from '../store.js';

export async function renderParent(root, code) {
  if (!code) { location.replace('#'); return { destroy() {} }; }
  document.title = '오늘 우리 반 이야기';
  const sync = await createSync(code);
  let state = await sync.get();
  let pack = null;
  let destroyed = false;

  async function render() {
    if (destroyed) return;
    if (state && (!pack || pack.id !== state.packId)) {
      try { pack = await loadPack(state.packId); } catch (e) { console.warn(e); }
    }
    let body;
    if (!state || !pack) {
      body = `<section class="card"><h2>아직 수업 기록이 없어요</h2><p>코드 <b>${esc(code)}</b>로 시작한 수업이 없거나, 다른 기기에서 열린 수업이에요. 선생님이 보내 준 링크로 다시 열어 주세요.</p></section>`;
    } else if (state.phase !== 'done') {
      body = `<section class="card"><h2>「${esc(pack.title)}」 수업이 진행 중이에요</h2><p>수업이 끝나면 이 페이지에 오늘 우리 반 이야기가 올라와요. 페이지는 저절로 바뀝니다.</p></section>`;
    } else {
      const story = pack.steps.find((s) => s.type === 'story');
      const text = story ? renderTemplate(story.template, storyVars(pack, state)) : '';
      const sum = summaryOf(pack, state);
      const home = pack.home || {};
      body = `
      <h1>오늘 우리 반 「${esc(pack.title)}」</h1>
      <p class="asof">${esc(fmtDate(state.endedAt || state.updatedAt))} · ${sum ? `${sum.total}명이 함께했어요` : ''}</p>
      ${sum ? `<section class="card"><div class="h">${esc(sum.step.title)}</div><div class="summary-bars">${sum.rows.map((r) => `
        <div class="r"><span>${esc(r.emoji || '')} ${esc(r.label)}</span><div class="track"><i style="--c:${esc(r.color || '#16B364')};width:${r.pct}%"></i></div><span class="n">${r.n}</span></div>`).join('')}</div></section>` : ''}
      ${text ? `<p class="story">${esc(text)}</p>` : ''}
      ${home.tips ? `<section class="card"><div class="h">${esc(home.title || '집에서 이어가기')}</div><ul class="tips">${home.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></section>` : ''}
      <p class="note">${esc(home.note || '이 페이지에는 반 전체의 숫자와 이야기만 있어요.')}</p>`;
    }
    root.innerHTML = `
    <main class="page parent">
      <header class="brand small"><div class="logo">이모렌 교실</div></header>
      ${body}
      <p class="foot"><a href="#">처음으로</a></p>
    </main>`;
  }

  const unsub = sync.subscribe((s) => { if (s && s.code === code) { state = s; render(); } });
  await render();
  return { destroy() { destroyed = true; unsub(); sync.close(); } };
}
