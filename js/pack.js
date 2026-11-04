// 수업팩 불러오기와 형식 검사. 수업팩은 packs/*.json 한 장으로 수업 전체를 정의한다.
// 형식 설명: docs/PACK-FORMAT.md

const cache = new Map();
export const DEFAULT_PACK = 'mind-weather';
const STEP_TYPES = ['talk', 'choice', 'activity', 'story', 'closing'];

export async function loadPackIndex() {
  const res = await fetch('packs/index.json');
  if (!res.ok) throw new Error('packs/index.json을 찾을 수 없어요');
  return res.json();
}

export async function loadPack(id) {
  const safe = String(id || '').replace(/[^a-z0-9-]/gi, '');
  if (cache.has(safe)) return cache.get(safe);
  const res = await fetch(`packs/${safe}.json`);
  if (!res.ok) throw new Error(`수업팩 '${safe}'을(를) 찾을 수 없어요`);
  const pack = await res.json();
  validatePack(pack);
  cache.set(safe, pack);
  return pack;
}

export function validatePack(p) {
  const errs = [];
  if (!p || typeof p !== 'object') throw new Error('수업팩이 JSON 객체가 아니에요');
  if (!p.id) errs.push('id 없음');
  if (!p.title) errs.push('title 없음');
  if (!Array.isArray(p.steps) || p.steps.length === 0) errs.push('steps 비어 있음');
  const ids = new Set();
  for (const s of p.steps || []) {
    if (!s.id) errs.push('단계 id 없음');
    else if (ids.has(s.id)) errs.push(`단계 id 중복: ${s.id}`);
    ids.add(s.id);
    if (!STEP_TYPES.includes(s.type)) errs.push(`알 수 없는 단계 유형: ${s.id} (${s.type})`);
    if ((s.type === 'talk' || s.type === 'closing') && !(Array.isArray(s.lines) && s.lines.length)) errs.push(`lines 없음: ${s.id}`);
    if (s.type === 'choice') {
      if (!s.prompt) errs.push(`prompt 없음: ${s.id}`);
      if (!Array.isArray(s.options) || s.options.length < 2) errs.push(`options 2개 이상 필요: ${s.id}`);
      const oids = new Set();
      for (const o of s.options || []) {
        if (!o.id || !o.label) errs.push(`선택지 id/label 없음: ${s.id}`);
        if (oids.has(o.id)) errs.push(`선택지 id 중복: ${s.id}/${o.id}`);
        oids.add(o.id);
      }
    }
    if (s.type === 'activity' && !(Number(s.timer_sec) > 0)) errs.push(`timer_sec 필요: ${s.id}`);
    if (s.type === 'story' && !s.template) errs.push(`template 없음: ${s.id}`);
  }
  if (errs.length) throw new Error('수업팩 형식 오류: ' + errs.join(', '));
  return true;
}
