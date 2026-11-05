// 남는 기록 패널 시나리오(한국어, 코드 RECD): 강사 폰에서 집계·메모를 남긴 뒤 '남는 기록'을 열어
// 반 전체 숫자·메모가 그대로 보이는지, 원본 JSON이 허용 목록 키만(허용 자리 밖 문자열 없이) 가지는지,
// '모두 지우기'가 두 번 탭으로만 지워지고 5초가 지나면 저절로 풀리는지 본다.
// What-is-stored panel: counts + note listed, raw JSON holds only allow-listed keys, two-tap erase with a 5 s arm.
const ALLOW = ['v', 'code', 'packId', 'lang', 'phase', 'stepIndex', 'tallies', 'confirmed', 'timer', 'speakSeq', 'startedAt', 'endedAt', 'notes', 'rev', 'updatedAt', 'book'];
const STRING_SLOTS = /^(code|packId|lang|phase|timer\.stepId|notes\[\d+\]\.text)$/;
const strings = (v, path = '', out = []) => {
  if (typeof v === 'string') out.push(path);
  else if (Array.isArray(v)) v.forEach((x, i) => strings(x, `${path}[${i}]`, out));
  else if (v && typeof v === 'object') for (const k of Object.keys(v)) strings(v[k], path ? `${path}.${k}` : k, out);
  return out;
};

export default async function record(h) {
  const ctx = await h.newContext({ locale: 'ko-KR' });
  h.log('\n[1] TV와 강사 폰을 코드 RECD로 묶고 집계·메모를 남긴다');
  const tv = await h.newPage(ctx, 'TV');
  await tv.goto(`${h.base}/#tv-RECD`);
  await h.hasText(tv.locator('.bigcode'), 'RECD');
  const phone = await h.newPage(ctx, '강사폰', { phone: true });
  // 상태 모양 덫(checkRoom)이 보통 수업에서 울리면 안 된다 / the state-shape tripwire must stay silent in a normal lesson
  const roomWarnings = [];
  phone.on('console', (m) => { if (m.type() === 'warning' && m.text().includes('[room]')) roomWarnings.push(m.text()); });
  await phone.goto(`${h.base}/#teacher-RECD`);
  await phone.locator('[data-act="start"]').waitFor({ timeout: h.T });
  await h.check('대기 패널에도 남는 기록 블록이 있고, 새 방은 비어 있다', async () => {
    await phone.click('details.record > summary');
    await h.hasText(phone.locator('.record .rec-empty'), '아직 아무것도 없어요');
  });
  await phone.click('[data-act="start"]');
  await phone.click('[data-act="next"]');
  await h.hasText(tv.locator('.scene h1'), '어떤 날씨');
  for (let i = 0; i < 2; i++) await phone.click('[data-tally="sunny"][data-delta="1"]');
  await phone.click('[data-tally="cloudy"][data-delta="1"]');
  await h.hasText(tv.locator('[data-opt="sunny"] .count'), '2');
  await phone.click('details.notes > summary');
  await phone.fill('[data-note]', '비 카드가 많아서 몸놀이를 길게 했다');
  await phone.click('[data-act="note"]');
  await h.hasText(phone.locator('details.notes li'), '몸놀이를 길게');

  h.log('\n[2] 남는 기록: 숫자와 메모가 그대로 보인다');
  await h.check('패널이 열린 채 유지되고 해님 2', async () => {
    const li = phone.locator('.record .rec-step li').filter({ hasText: '해님' }).first();
    await li.waitFor({ timeout: h.T });
    const n = await li.locator('b').textContent();
    if (n !== '2') throw new Error(`해님 ${n}`);
  });
  await h.check('모두 3명', () => h.hasText(phone.locator('.record .rec-step small'), '모두 3명'));
  await h.check('메모가 보인다', () => h.hasText(phone.locator('.record .rec-notes li'), '몸놀이를 길게'));
  await h.check('안심 문구', () => h.hasText(phone.locator('.record .rec-intro'), '개인 선택은 어디에도 없어요'));
  await h.check('숫자로 만든 이야기', () => h.hasText(phone.locator('.record .rec-story'), '해님 2명, 구름 1명'));
  // 스크린샷: 패널 머리를 고정 막대 바로 아래에 맞춘다 / scroll the panel head just below the sticky bar
  await phone.evaluate(() => {
    document.querySelector('details.record').scrollIntoView({ block: 'start' });
    window.scrollBy(0, -((document.querySelector('.tbar') || {}).offsetHeight || 0) - 8);
  });
  await h.shot(phone, 'phone-record.png');

  h.log('\n[3] 원본 JSON: 허용 목록 키만, 허용 자리 밖 문자열 없음');
  await phone.click('details.rec-raw > summary');
  await h.check('원본 JSON을 열어도 폰 화면이 가로로 넘치지 않는다', async () => {
    await phone.locator('[data-raw]').waitFor({ timeout: h.T });
    const [sw, iw] = await phone.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    if (sw > iw) throw new Error(`scrollWidth ${sw} > ${iw}`);
  });
  await h.check('원본 JSON은 허용 목록 키만 가진다', async () => {
    const obj = JSON.parse(await phone.locator('[data-raw]').textContent());
    const keys = Object.keys(obj);
    if (!keys.includes('tallies')) throw new Error('tallies 없음');
    const extra = keys.filter((k) => !ALLOW.includes(k));
    if (extra.length) throw new Error('허용 목록 밖 키: ' + extra.join(', '));
    if (obj.tallies.weather.sunny !== 2 || obj.tallies.weather.cloudy !== 1) throw new Error(JSON.stringify(obj.tallies));
    if (obj.notes.length !== 1 || !obj.notes[0].text.includes('몸놀이')) throw new Error(JSON.stringify(obj.notes));
    const stray = strings(obj).filter((p) => !STRING_SLOTS.test(p));
    if (stray.length) throw new Error('허용 자리 밖 문자열: ' + stray.join(', '));
  });

  h.log('\n[4] 모두 지우기: 한 번 누르면 무장, 5초가 지나면 저절로 풀린다');
  await phone.click('[data-act="erase"]');
  await h.check('첫 탭: "정말 지울까요?"', () => h.hasText(phone.locator('[data-act="erase"]'), '정말 지울까요'));
  await phone.waitForTimeout(6000);
  await h.check('6초 뒤 다시 "모두 지우기"', () => h.hasText(phone.locator('[data-act="erase"]'), '모두 지우기'));
  await h.check('아직 지워지지 않았다(TV 해님 2)', () => h.hasText(tv.locator('[data-opt="sunny"] .count'), '2'));

  h.log('\n[5] 두 번 빠르게 누르면 지워진다: TV는 대기 화면, 패널은 비어 있다');
  await phone.click('[data-act="erase"]');
  await phone.click('[data-act="erase"]');
  await h.check('TV가 대기 화면(RECD)으로 돌아간다', () => h.hasText(tv.locator('.bigcode'), 'RECD'));
  await h.check('패널: 아직 아무것도 없어요', () => h.hasText(phone.locator('.record .rec-empty'), '아직 아무것도 없어요'));
  await h.check('지웠다는 알림', () => h.hasText(phone.locator('.record .rec-status'), '지웠어요'));
  await h.check('강사 폰은 대기 패널(수업 시작 버튼)', () => phone.locator('[data-act="start"]').waitFor({ timeout: h.T }));
  await h.check('원본 JSON도 비었다(집계 없음, 메모 0, waiting)', async () => {
    const obj = JSON.parse(await phone.locator('[data-raw]').textContent());
    if (Object.keys(obj.tallies).length || obj.notes.length || obj.phase !== 'waiting' || obj.code !== 'RECD') throw new Error(JSON.stringify(obj));
  });
  await h.check('상태 모양 덫([room] 경고)이 한 번도 울리지 않았다', () => { if (roomWarnings.length) throw new Error(roomWarnings.join('\n')); });
}
