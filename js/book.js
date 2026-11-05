// 「오늘 우리 반 책 / Our Class Book」: 방 상태로 그림책의 쪽을 만든다. 순수 함수만 있어서 Node에서도 그대로 불러온다.
// Builds the class book's pages from the room state. Pure functions only (no DOM), so node:test can import it.
//
//   bookPages(pack, state)                   쪽 배열. 표지 → 선택 단계마다 한 쪽 → 몸놀이 → 오늘 이야기 → 뒤표지
//                                            pages: cover → one per choice step → activity → story → back
//   pageDurationMs(page, lang)               캐릭터가 그 쪽을 읽는 데 드는 시간(자동 넘김 간격)
//   currentBookPage(pages, book, now, lang)  상태(book = { page, startedAt })와 지금 시각으로 정해지는 쪽 번호
//
// 쪽의 글은 언제나 수업팩 언어(pack.lang)다: tIn(pack.lang, …)을 쓰고 t()는 쓰지 않는다.
// 기록은 반 전체 숫자뿐이다. 아이 이름이나 개인의 선택은 어디에도 없다.
import { tallyFor, total, storyVars, renderTemplate } from './store.js';
import { tIn } from './i18n.js';
import { fmtDate } from './util.js';

// 한 선택지에 그리는 스탬프의 최대 개수(그 이상은 숫자로만) / stamps drawn per option; the number is always shown
export const MAX_STAMPS = 30;

// 읽기 속도 어림(ms/글자). js/ui/speech.js의 자막 대체 시간과 같은 값 / reading-time estimate, same as speech.js
const MS_PER_CHAR = { ko: 115, en: 70 };
const MIN_PAGE_MS = 4000;
const PAGE_GAP_MS = 1500;

const shortLang = (lang) => String(lang || 'ko').slice(0, 2);

// 팩의 book 단계(없으면 null) / the pack's book step, if any
export function bookStep(pack) {
  return ((pack && pack.steps) || []).find((s) => s.type === 'book') || null;
}

export function bookPages(pack, state) {
  const step = bookStep(pack);
  if (!step) return [];
  const lang = pack.lang || 'ko';
  const s = state || {};
  const vars = storyVars(pack, s);
  const title = pack.title;
  const pages = [];

  pages.push({
    kind: 'cover',
    title,
    kicker: step.title,
    date: fmtDate(s.startedAt || s.updatedAt || Date.now(), lang),
    line: step.cover_line || tIn(lang, 'book.coverLine', { title }),
  });

  for (const st of pack.steps) {
    if (st.type === 'choice') {
      const tl = tallyFor(s, st.id);
      const options = st.options.map((o) => ({ id: o.id, label: o.label, emoji: o.emoji || '', color: o.color || '', n: tl[o.id] || 0 }));
      const list = vars[st.id + '_list'];
      pages.push({ kind: 'choice', title: st.title, prompt: st.prompt, options, total: total(tl), line: tIn(lang, 'book.choiceLine', { prompt: st.prompt, list }) });
    } else if (st.type === 'activity') {
      const moves = (st.moves || []).map((m) => ({ emoji: m.emoji || '', text: m.text }));
      pages.push({ kind: 'activity', title: st.title, heading: st.heading || st.title, moves, line: tIn(lang, 'book.activityLine', { title: st.title }) });
    } else if (st.type === 'story') {
      const text = renderTemplate(st.template, vars);
      pages.push({ kind: 'story', title: st.title, heading: st.heading || st.title, text, line: text });
    }
  }

  pages.push({ kind: 'back', title, line: step.back_line || tIn(lang, 'book.backLine') });
  return pages;
}

// 한 쪽을 읽는 시간: 글자 수 × 언어별 속도, 최소 4초, 거기에 숨 고를 1.5초 / chars × rate, min 4 s, plus a 1.5 s breath
export function pageDurationMs(page, lang) {
  const per = MS_PER_CHAR[shortLang(lang)] || MS_PER_CHAR.en;
  const line = String((page && page.line) || '');
  const extra = page && page.text && page.text !== page.line ? String(page.text) : '';
  const chars = line.length + extra.length;
  return Math.max(MIN_PAGE_MS, chars * per) + PAGE_GAP_MS;
}

// book = { page, startedAt }: 쓴 기기 시각 startedAt에 page쪽을 폈다. 거기서부터 읽는 시간만큼씩 넘긴다.
// 마지막 쪽(뒤표지)에서 멈춘다(돌아가지 않는다). book이 없으면 0.
// Deterministic page index: walk reading times forward from (page, startedAt) until now; clamp to the last page.
export function currentBookPage(pages, book, now, lang) {
  const last = Math.max(0, ((pages && pages.length) || 0) - 1);
  if (!book || typeof book.page !== 'number') return 0;
  let i = Math.min(Math.max(0, Math.floor(book.page) || 0), last);
  let at = Number(book.startedAt) || 0;
  const t = Number(now) || 0;
  while (i < last) {
    const d = pageDurationMs(pages[i], lang);
    if (t < at + d) break;
    at += d;
    i++;
  }
  return i;
}
