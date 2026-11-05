// 「오늘 우리 반 책」 쪽 그리기. TV 한 장면(renderBookPage)과 보호자 페이지의 세로 묶음(renderBookStack)이 같은 쪽 마크업을 쓴다.
// Renders class-book pages as HTML strings: one 16:9 TV scene (renderBookPage) and the family page's vertical stack (renderBookStack).
// 쪽 내용은 js/book.js bookPages()가 만든다. 여기서는 그리기만: 모든 값은 esc()로 이스케이프한다.
// 스탬프 줄은 장식이라 aria-hidden이고, 정보는 이름과 숫자에 있다(색만으로 구분하지 않는다). 스탬프는 한 선택지에 MAX_STAMPS개까지만 그린다.
import { esc } from '../util.js';
import { tIn } from '../i18n.js';
import { MAX_STAMPS } from '../book.js';

function stampsHtml(o) {
  const n = Math.max(0, Number(o.n) || 0);
  const shown = Math.min(n, MAX_STAMPS);
  const more = n - shown;
  const one = `<span class="stamp">${esc(o.emoji || '●')}</span>`;
  return `<div class="stamps" aria-hidden="true">${one.repeat(shown)}${more ? `<span class="more">+${more}</span>` : ''}</div>`;
}

// 한 쪽. i는 0부터, n은 전체 쪽 수 / one page; i is 0-based, n the page count
function pageHtml(page, lang, i, n) {
  const no = `<div class="pageno">${esc(tIn(lang, 'book.pageNo', { n: i + 1, total: n }))}</div>`;
  switch (page.kind) {
    case 'cover':
      return `<div class="page cover">${page.kicker ? `<div class="kicker">${esc(page.kicker)}</div>` : ''}<h1>${esc(page.title)}</h1><p class="sub">${esc(page.date || '')}</p>${no}</div>`;
    case 'choice':
      return `<div class="page choice"><h2>${esc(page.prompt)}</h2><div class="shelf">${page.options.map((o) => `
        <div class="row" data-opt="${esc(o.id)}" style="--c:${esc(o.color || '#16B364')}">
          <div class="who"><span class="emoji">${esc(o.emoji || '')}</span><span class="label">${esc(o.label)}</span><span class="n">${Number(o.n) || 0}</span></div>
          ${stampsHtml(o)}
        </div>`).join('')}</div>${no}</div>`;
    case 'activity':
      return `<div class="page activity"><h2>${esc(page.heading)}</h2><div class="cards">${(page.moves || []).map((m) => `<div><span>${esc(m.emoji || '')}</span><span>${esc(m.text)}</span></div>`).join('')}</div>${no}</div>`;
    case 'story':
      return `<div class="page story"><h2>${esc(page.heading)}</h2><p>${esc(page.text)}</p>${no}</div>`;
    default:
      return `<div class="page back"><p class="big">${esc(page.line)}</p>${no}</div>`;
  }
}

// TV 장면: 지금 펼친 쪽 하나 / the TV scene: the one open page
export function renderBookPage(page, { lang = 'ko', pageIndex = 0, pageCount = 1 } = {}) {
  if (!page) return '';
  return `<div class="book" data-page="${pageIndex}">${pageHtml(page, lang, pageIndex, pageCount)}</div>`;
}

// 보호자 페이지: 모든 쪽을 세로로 / the family page: every page, stacked
export function renderBookStack(pages, { lang = 'ko' } = {}) {
  const n = pages.length;
  return `<div class="book-stack">${pages.map((p, i) => pageHtml(p, lang, i, n)).join('')}</div>`;
}
