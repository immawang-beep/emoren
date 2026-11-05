// 해시 라우팅 규칙(순수 함수, DOM 없음) / hash routing rules (pure, no DOM). js/app.js가 쓴다.
import { normalizeCode } from './util.js';

export function parseHash(hash) {
  const h = String(hash || '').replace(/^#/, '');
  const m = h.match(/^(tv|teacher|parent)-([A-Za-z0-9]{3,8})$/);
  if (m) return { view: m[1], code: normalizeCode(m[2]) };
  if (h === 'tv' || h === 'teacher' || h === 'parent') return { view: h, code: null };
  const d = h.match(/^demo(?:-([a-z]{2})(?:-([a-z0-9][a-z0-9-]*))?)?$/i);
  if (d) return { view: 'demo', code: null, lang: d[1] ? d[1].toLowerCase() : null, packId: d[2] ? d[2].toLowerCase() : null };
  if (h === 'studio') return { view: 'studio', code: null };
  return { view: 'home', code: null };
}
