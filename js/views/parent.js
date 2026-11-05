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
      <p class="asof">${esc(fmtDate(state.endedAt || state.updatedAt, getLang()))}${sum ? ` · ${esc(t('parent.joined', { n: sum.total }))}` : ''}</p>
      ${sum ? `<section class="card"><div class="h">${esc(sum.step.title)}</div><div class="summary-bars">${sum.rows.map((r) => `
        <div class="r"><span>${esc(r.emoji || '')} ${esc(r.label)}</span><div class="track"><i style="--c:${esc(r.color || '#16B364')};width:${r.pct}%"></i></div><span class="n">${r.n}</span></div>`).join('')}</div></section>` : ''}
      ${text ? `<p class="story">${esc(text)}</p>` : ''}
      ${book}
      ${home.tips ? `<section class="card"><div class="h">${esc(home.title || t('parent.homeTitle'))}</div><ul class="tips">${home.tips.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>` : ''}
      <p class="note">${esc(home.note || t('parent.noteDefault'))}</p>`;
    }
    root.innerHTML = `
    <main class="page parent">
      <header class="brand small"><div class="logo">${esc(t('common.appName'))}</div></header>
      ${body}
      <p class="foot"><a href="#">${esc(t('common.home'))}</a></p>
    </main>`;
  }

  const unsub = sync.subscribe((s) => { if (s && s.code === code) { state = s; render(); } });
  await render();
  return { destroy() { destroyed = true; unsub(); sync.close(); } };
}
