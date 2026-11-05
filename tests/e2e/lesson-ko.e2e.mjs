// 두 화면 시나리오(한국어): 교실 TV 탭과 강사 폰 탭을 한 컨텍스트에 열어 '같은 브라우저 동기화'로 수업 한 회기를 끝까지 돌린다.
//   시작 → 집계 → TV 새로고침 복구 → 일시정지 → 확정 → 타이머 → 이야기 → 메모 → 책 → 마무리 → 끝 → 보호자 페이지 → 초기화
// 이어서 홈 화면 입구와 KO / EN 토글.
import path from 'node:path';

export default async function lessonKo(h) {
  const ctx = await h.newContext({ locale: 'ko-KR' });
  h.log('\n[1] 교실 TV가 먼저 열리고 코드를 만든다');
  const tv = await h.newPage(ctx, 'TV');
  await tv.goto(`${h.base}/#tv`);
  await tv.waitForFunction(() => /^#tv-[A-Z0-9]{4}$/.test(location.hash), null, { timeout: h.T });
  const autoCode = (await tv.evaluate(() => location.hash)).slice(4);
  await h.check(`TV 대기 화면에 코드 ${autoCode}가 크게 뜬다`, () => h.hasText(tv.locator('.bigcode'), autoCode));

  h.log('\n[2] 고정 코드 DEMO로 TV와 강사 폰을 묶는다');
  await tv.goto(`${h.base}/#tv-DEMO`);
  await h.hasText(tv.locator('.bigcode'), 'DEMO');
  const phone = await h.newPage(ctx, '강사폰');
  await phone.setViewportSize({ width: 390, height: 844 });
  await phone.goto(`${h.base}/#teacher-DEMO`);
  await h.check('강사 폰에 수업 시작 버튼이 뜬다', () => phone.locator('[data-act="start"]').waitFor({ timeout: h.T }));
  await h.check('TV 대기 화면이 수업 제목을 받는다', () => h.hasText(tv.locator('.wait h1'), '오늘의 마음 날씨'));
  await phone.screenshot({ path: path.join(h.SHOTS, 'phone-1-waiting.png') });

  h.log('\n[3] 수업 시작: 인사');
  await phone.click('[data-act="start"]');
  await h.check('TV에 인사 장면', () => h.hasText(tv.locator('.scene h1'), '마음에도 날씨가 있대'));
  await h.check('TV 자막에 첫 대사', () => h.hasText(tv.locator('[data-caption]'), '안녕, 친구들'));
  await h.check('강사 폰이 1/5 단계를 표시한다', () => h.hasText(phone.locator('.stepnav'), '1/6'));
  await tv.screenshot({ path: path.join(h.SHOTS, 'tv-1-hello.png') });

  h.log('\n[4] 마음 날씨 고르기: 집계가 TV에 실시간으로 간다');
  await phone.click('[data-act="next"]');
  await h.check('TV에 질문과 선택지 4개', async () => { await h.hasText(tv.locator('.scene h1'), '어떤 날씨'); if ((await tv.locator('.opt').count()) !== 4) throw new Error('선택지 수'); });
  const plus = (id, n) => (async () => { for (let i = 0; i < n; i++) await phone.click(`[data-tally="${id}"][data-delta="1"]`); })();
  await plus('sunny', 3); await plus('cloudy', 2); await plus('rainy', 1);
  await h.check('TV 해님 칸이 3', () => h.hasText(tv.locator('[data-opt="sunny"] .count'), '3'));
  await h.check('TV에서 해님이 가장 큰 막대(lead)', () => tv.locator('.opt.lead[data-opt="sunny"]').waitFor({ timeout: h.T }));
  await h.check('강사 폰 합계 6명', () => h.hasText(phone.locator('.trow'), '6'));
  await phone.click('[data-tally="rainy"][data-delta="-1"]');
  await phone.click('[data-tally="rainy"][data-delta="-1"]');
  await h.check('빼기는 0 아래로 안 내려간다', () => h.hasText(tv.locator('[data-opt="rainy"] .count'), '0'));
  await plus('rainy', 1);
  await tv.screenshot({ path: path.join(h.SHOTS, 'tv-2-choice.png') });
  await phone.screenshot({ path: path.join(h.SHOTS, 'phone-2-choice.png') });

  h.log('\n[5] 끊김 복구: TV를 새로고침해도 같은 장면과 숫자로 돌아온다');
  await tv.reload();
  await h.check('새로고침 후 TV가 선택 장면을 복구', () => h.hasText(tv.locator('.scene h1'), '어떤 날씨'));
  await h.check('새로고침 후 숫자 유지(해님 3)', () => h.hasText(tv.locator('[data-opt="sunny"] .count'), '3'));

  h.log('\n[6] 일시정지: TV가 가려지고 다시 열린다');
  await phone.click('[data-act="pause"]');
  await h.check('TV에 쉬는 시간 덮개', () => h.hasText(tv.locator('.pause'), '잠깐 쉬어요'));
  await phone.click('[data-act="pause"]');
  await h.check('덮개가 사라진다', () => tv.locator('.pause').waitFor({ state: 'detached', timeout: h.T }));

  h.log('\n[7] 확정: 캐릭터가 반 전체 숫자로 반응한다');
  await phone.click('[data-act="confirm"]');
  await h.check('TV 자막에 "해님 3명, 구름 2명, 비 1명"', () => h.hasText(tv.locator('[data-caption]'), '해님 3명, 구름 2명, 비 1명'));
  await h.check('비 친구들에게 한마디', () => h.hasText(tv.locator('[data-caption]'), '비 친구들'));
  await h.check('캐릭터 기분이 happy', () => tv.locator('.chr[data-mood="happy"]').waitFor({ timeout: h.T }));

  h.log('\n[8] 몸놀이 타이머');
  await phone.click('[data-act="next"]');
  await h.check('TV 몸놀이 장면', () => h.hasText(tv.locator('.scene h1'), '몸으로 날씨'));
  await phone.click('[data-act="timer"]');
  await h.check('TV 타이머가 돈다', async () => {
    await tv.waitForFunction(() => { const n = Number(document.querySelector('[data-tleft]')?.textContent); return n > 0 && n <= 60; }, null, { timeout: h.T });
  });
  await h.check('강사 폰에도 남은 초', async () => {
    await phone.waitForFunction(() => { const n = Number(document.querySelector('[data-timer]')?.textContent); return n > 0 && n <= 60; }, null, { timeout: h.T });
  });
  await tv.screenshot({ path: path.join(h.SHOTS, 'tv-3-activity.png') });

  h.log('\n[9] 숫자로 만든 오늘 이야기');
  await phone.click('[data-act="next"]');
  await h.check('TV 이야기에 오늘 숫자', () => h.hasText(tv.locator('.story p'), '해님 3명, 구름 2명, 비 1명'));
  await h.check('최다 날씨 문장', () => h.hasText(tv.locator('.story p'), '해님이 제일 많았지요'));
  await h.check('강사 폰 미리보기도 같은 문장', () => h.hasText(phone.locator('.preview'), '해님이 제일 많았지요'));
  await tv.screenshot({ path: path.join(h.SHOTS, 'tv-4-story.png') });

  h.log('\n[10] 반 메모');
  await phone.click('details.notes summary');
  await phone.fill('[data-note]', '비 카드가 나와서 몸놀이를 길게 했다');
  await phone.click('[data-act="note"]');
  await h.check('메모가 저장된다', () => h.hasText(phone.locator('details.notes li'), '몸놀이를 길게'));

  h.log('\n[10b] 오늘 우리 반 책');
  await phone.click('[data-act="next"]');
  await h.check('TV가 「오늘 우리 반 책」 단계로', () => h.hasText(tv.locator('.stage-top .ttl'), '오늘 우리 반 책'));
  await h.check('강사 폰 5/6', () => h.hasText(phone.locator('.stepnav'), '5/6'));
  await phone.click('[data-act="next"]');
  await h.check('TV 마무리 장면에 칩 4개', async () => { await h.hasText(tv.locator('.closing h1'), '고마워'); if ((await tv.locator('.closing .chip').count()) !== 4) throw new Error('칩 수'); });
  await h.check('강사 폰 버튼이 "수업 마치기"', () => h.hasText(phone.locator('[data-act="next"]'), '수업 마치기'));
  await phone.click('[data-act="next"]');
  await h.check('TV: 오늘 수업 끝', () => h.hasText(tv.locator('.scene h1'), '오늘 수업 끝'));
  await h.check('강사 폰: 보호자 링크', () => h.hasText(phone.locator('.card .h'), '보호자 페이지'));
  await tv.screenshot({ path: path.join(h.SHOTS, 'tv-5-done.png') });
  await phone.screenshot({ path: path.join(h.SHOTS, 'phone-3-done.png') });

  h.log('\n[11] 보호자 페이지');
  const parent = await h.newPage(ctx, '보호자');
  await parent.setViewportSize({ width: 390, height: 844 });
  await parent.goto(`${h.base}/#parent-DEMO`);
  await h.check('오늘 이야기', () => h.hasText(parent.locator('.story'), '해님 3명, 구름 2명, 비 1명'));
  await h.check('집에서 이어갈 질문 3개', async () => { await parent.locator('.tips li').first().waitFor({ timeout: h.T }); if ((await parent.locator('.tips li').count()) !== 3) throw new Error('질문 수'); });
  await h.check('반 전체 막대', async () => { if ((await parent.locator('.summary-bars .r').count()) !== 4) throw new Error('막대 수'); });
  await parent.screenshot({ path: path.join(h.SHOTS, 'parent.png'), fullPage: true });

  h.log('\n[12] 수업 중인 보호자 페이지는 기다리라고 말하고, 끝나면 저절로 바뀐다');
  await phone.click('[data-act="reset"]');
  await h.check('초기화 후 TV는 대기 화면', () => h.hasText(tv.locator('.bigcode'), 'DEMO'));
  await h.check('보호자 페이지는 진행 중 안내', () => h.hasText(parent.locator('h2'), '진행 중'));

  h.log('\n[13] 홈 화면 입구');
  const home = await h.newPage(ctx, '홈');
  await home.setViewportSize({ width: 390, height: 844 });
  await home.goto(`${h.base}/#`);
  await h.check('홈에 세 입구', async () => { await h.hasText(home.locator('.card h2'), '교실 TV'); await h.hasText(home.locator('.card h2'), '강사 폰'); await h.hasText(home.locator('.card h2'), '보호자 페이지'); });
  await home.fill('form[data-role="teacher"] input', 'demo');
  await home.click('form[data-role="teacher"] button[type="submit"]');
  await h.check('소문자 코드도 대문자로 정리되어 리모컨이 열린다', () => h.hasText(home.locator('.tcode'), 'DEMO'));
  await home.screenshot({ path: path.join(h.SHOTS, 'home.png'), fullPage: true });

  h.log('\n[14] 홈의 언어 토글: EN을 누르면 바로 영어로 바뀌고, KO를 누르면 돌아온다');
  await home.goto(`${h.base}/#`);
  await h.hasText(home.locator('.logo'), '이모렌 교실');
  await h.check('KO 알약이 눌린 상태', () => home.locator('.langs [data-lang="ko"][aria-pressed="true"]').waitFor({ timeout: h.T }));
  await home.click('.langs [data-lang="en"]');
  await h.check('EN을 누르면 로고·카드 제목이 영어', async () => { await h.hasText(home.locator('.logo'), 'Emoren Classroom'); await h.hasText(home.locator('.card h2'), 'Classroom TV'); await h.hasText(home.locator('.card h2'), 'Teacher phone'); await h.hasText(home.locator('.card h2'), 'Family page'); });
  await h.check('<html lang>과 저장값이 en', async () => {
    const r = await home.evaluate(() => [document.documentElement.lang, localStorage.getItem('emoren.lang'), document.title]);
    if (r[0] !== 'en' || r[1] !== 'en' || r[2] !== 'Emoren Classroom') throw new Error(JSON.stringify(r));
  });
  await h.check('수업팩 목록이 영어 제목', () => h.hasText(home.locator('.how li'), 'Mood Weather'));
  await h.check('수업팩·언어 선택이 English 기본값', async () => {
    const v = await home.locator('select[data-pack]').inputValue();
    if (v !== 'mind-weather|en') throw new Error(v);
  });
  await home.screenshot({ path: path.join(h.SHOTS, 'home-en.png'), fullPage: true });
  await home.click('.langs [data-lang="ko"]');
  await h.check('KO를 누르면 한국어로 돌아온다', () => h.hasText(home.locator('.logo'), '이모렌 교실'));
  await h.check('강사 폰(DEMO)은 수업이 한국어라 TV는 한국어 그대로', () => h.hasText(tv.locator('.wait .sub'), '소리 켜기'));
}
