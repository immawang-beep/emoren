// 보호자 페이지. 읽기만 한다. 반 전체 숫자와 오늘 이야기, 집에서 이어갈 질문.
// 아이 개인의 선택이나 이름은 어디에도 없다. 화면 언어는 수업(room.lang)을 따른다.
import { esc, fmtDate } from '../util.js';
import { loadPack } from '../pack.js';
import { createSync } from '../sync/index.js';
import { storyVars, renderTemplate, summaryOf } from '../store.js';
import { t, getLang, setLang } from '../i18n.js';
import { bookPages } from '../book.js';
import { renderBookStack } from '../ui/book.js';

// opts.sync  동기화 방식 강제 / force a sync adapter
export async function renderParent(root, code, opts = {}) {
  if (!code) { location.replace('#'); return { destroy() {} }; }
  const sync = await createSync(code, { prefer: opts.sync });
  let state = await sync.get();
  let pack = null;
  let destroyed = false;
  let lastHtml = '';

  async function render() {
    if (destroyed) return;
    if (state && (!pack || pack.id !== state.packId || (state.lang && pack.lang !== state.lang))) {
      try { pack = await loadPack(state.packId, state.lang); } catch (e) { console.warn(e); }
    }
    // 수업 언어를 따른다(기기 설정은 바꾸지 않는다) / follow the lesson language without persisting it
    const lessonLang = (pack && pack.lang) || (state && state.lang);
    if (lessonLang && lessonLang !== getLang()) setLang(lessonLang, { persist: false });
    document.title = t('parent.title');
    let body;
    if (!state || !pack) {
      body = `<section class="card"><h2>${esc(t('parent.noneTitle'))}</h2><p>${t('parent.noneDesc', { code: `<b>${esc(code)}</b>` })}</p></section>`;
    } else if (state.phase !== 'done') {
      body = `<section class="card"><h2>${esc(t('parent.liveTitle', { title: pack.title }))}</h2><p>${esc(t('parent.liveDesc'))}</p></section>`;
    } else {
      const story = pack.steps.find((s) => s.type === 'story');
      const text = story ? renderTemplate(story.template, storyVars(pack, state)) : '';
      const sum = summaryOf(pack, state);
      const home = pack.home || {};
      // 「오늘 우리 반 책」: TV가 보여 준 쪽을 그대로 세로로. 이름 없이 반 전체 숫자와 이야기뿐 / the class book, stacked
      const pages = bookPages(pack, state);
      const book = pages.length ? `<section class="card"><div class="h">${esc(t('book.familyTitle'))}</div>${renderBookStack(pages, { lang: pack.lang })}</section>` : '';
      body = `
      <h1>${esc(t('parent.heading', { title: pack.title }))}</h1>
      <div class="asof-row"><p class="asof">${esc(fmtDate(state.endedAt || state.updatedAt, getLang()))}${sum ? ` · ${esc(t('parent.joined', { n: sum.total }))}` : ''}</p>
        <button class="btn small" type="button" data-print>${esc(t('parent.print'))}</button></div>
      ${sum ? `<section class="card"><h2 class="h">${esc(sum.step.title)}</h2><div class="summary-bars">${sum.rows.map((r) => `
        <div class="r"><span>${esc(r.emoji || '')} ${esc(r.label)}</span><div class="track"><i style="--c:${esc(r.color || '#16B364')};width:${r.pct}%"></i></div><span class="n">${r.n}</span></div>`).join('')}</div></section>` : ''}
      ${text ? `<p class="story">${esc(text)}</p>` : ''}
      ${book}
      ${home.tips ? `<section class="card"><h2 class="h">${esc(home.title || t('parent.homeTitle'))}</h2><ul class="tips">${home.tips.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>` : ''}
      <p class="note">${esc(home.note || t('parent.noteDefault'))}</p>`;
    }
    const html = `
      <header class="brand small"><div class="logo">${esc(t('common.appName'))}</div></header>
      ${body}
      <p class="foot"><a href="#">${esc(t('common.home'))}</a></p>`;
    // 같은 내용이면 다시 그리지 않고, <main>은 그대로 둔 채 안쪽만 바꾼다: 수업이 끝나 이야기가 나타나면 보조 기술이 읽어 준다(aria-live).
    // Skip identical re-renders and keep <main> in place, swapping only its content, so the story is announced (aria-live) when the lesson ends.
    if (html === lastHtml) return;
    lastHtml = html;
    let main = root.querySelector('main.parent');
    if (!main) { root.innerHTML = '<main class="page parent" aria-live="polite"></main>'; main = root.querySelector('main.parent'); }
    main.innerHTML = html;
    // 인쇄·PDF 저장은 브라우저 인쇄 대화상자로 / print or save as PDF through the browser's print dialog
    const printBtn = root.querySelector('[data-print]');
    if (printBtn) printBtn.addEventListener('click', () => window.print());
  }

  const unsub = sync.subscribe((s) => { if (s && s.code === code) { state = s; render(); } });
  await render();
  return { destroy() { destroyed = true; unsub(); sync.close(); } };
}
