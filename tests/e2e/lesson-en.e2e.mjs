// 영어 시나리오: 기기 언어가 en인 새 컨텍스트(emoren.lang=en)에서 영어 수업 한 회기(코드 ENGL),
// 그리고 수업 언어(ko)와 기기 언어(en)가 다를 때 TV·보호자 페이지가 수업 언어를 따르는지.
import path from 'node:path';

export default async function lessonEn(h) {
  const en = await h.newContext({ locale: 'en-US' });
  await en.addInitScript(() => { try { localStorage.setItem('emoren.lang', 'en'); } catch {} });
  h.log('\n[E1] 영어 홈: 저장된 emoren.lang=en 으로 뜬다');
  const home = await h.newPage(en, 'home-en');
  await home.setViewportSize({ width: 390, height: 844 });
  await home.goto(`${h.base}/#`);
  await h.check('홈 로고·안내가 영어', async () => { await h.hasText(home.locator('.logo'), 'Emoren Classroom'); await h.hasText(home.locator('.brand .tag'), 'One teacher phone'); await h.hasText(home.locator('.card h2'), 'Teacher phone'); });
  await h.check('EN 알약이 눌린 상태', () => home.locator('.langs [data-lang="en"][aria-pressed="true"]').waitFor({ timeout: h.T }));
  await h.check('바닥글이 영어', () => h.hasText(home.locator('.foot'), 'No child'));

  h.log('\n[E2] 교실 TV(ENGL)와 강사 폰: 영어 팩으로 방이 만들어진다');
  const tv = await h.newPage(en, 'TV-en');
  await tv.goto(`${h.base}/#tv-ENGL`);
  await h.check('TV 대기 화면 안내가 영어', async () => { await h.hasText(tv.locator('.bigcode'), 'ENGL'); await h.hasText(tv.locator('.wait .sub'), 'Turn on sound'); await h.hasText(tv.locator('[data-unlock]'), 'Turn on sound'); });
  const phone = await h.newPage(en, 'phone-en');
  await phone.setViewportSize({ width: 390, height: 844 });
  await phone.goto(`${h.base}/#teacher-ENGL`);
  await h.check('강사 폰이 영어(Mood Weather, Start lesson)', async () => { await h.hasText(phone.locator('.panel h2'), 'Mood Weather'); await h.hasText(phone.locator('[data-act="start"]'), 'Start lesson'); await h.hasText(phone.locator('.tsync'), 'Same-browser sync'); await h.hasText(phone.locator('.tcode'), 'Lesson code ENGL'); });
  await h.check('방 상태에 lang=en', async () => {
    const lang = await phone.evaluate(() => { const k = Object.keys(localStorage).find((x) => /ENGL/.test(x)); return k && JSON.parse(localStorage.getItem(k)).lang; });
    if (lang !== 'en') throw new Error(String(lang));
  });
  await h.check('TV 대기 화면이 영어 제목을 받는다', () => h.hasText(tv.locator('.wait h1'), 'Mood Weather'));
  await phone.screenshot({ path: path.join(h.SHOTS, 'phone-en-waiting.png') });

  h.log('\n[E3] 수업 시작: 영어 인사');
  await phone.click('[data-act="start"]');
  await h.check('TV 인사 장면', () => h.hasText(tv.locator('.scene h1'), 'Feelings have weather too'));
  await h.check("TV 자막 'Hello, friends!'", () => h.hasText(tv.locator('[data-caption]'), 'Hello, friends'));
  await h.check('강사 폰 1/5, 선생님 할 일이 영어', async () => { await h.hasText(phone.locator('.stepnav'), '1/6'); await h.hasText(phone.locator('.cue .eyebrow'), "Teacher's cue"); await h.hasText(phone.locator('[data-act="next"]'), 'Next'); });
  await tv.screenshot({ path: path.join(h.SHOTS, 'tv-en-hello.png') });

  h.log('\n[E4] 선택·확정: 영어 목록 "3 Sunny, 2 Cloudy, 1 Rainy"');
  await phone.click('[data-act="next"]');
  await h.check('TV 질문과 선택지 Sunny/Cloudy/Rainy/Stormy', async () => {
    await h.hasText(tv.locator('.scene h1'), 'mood weather');
    const labels = await tv.locator('.opt .label').allTextContents();
    if (labels.join(',') !== 'Sunny,Cloudy,Rainy,Stormy') throw new Error(labels.join(','));
  });
  const plus = async (id, n) => { for (let i = 0; i < n; i++) await phone.click(`[data-tally="${id}"][data-delta="1"]`); };
  await plus('sunny', 3); await plus('cloudy', 2); await plus('rainy', 1);
  await h.check('강사 폰 합계 "6 in all"', () => h.hasText(phone.locator('.trow'), '6 in all'));
  await phone.click('[data-act="confirm"]');
  await h.check('TV 자막에 "3 Sunny, 2 Cloudy, 1 Rainy"', () => h.hasText(tv.locator('[data-caption]'), '3 Sunny, 2 Cloudy, 1 Rainy'));
  await h.check('Rainy friends 한마디', () => h.hasText(tv.locator('[data-caption]'), 'Rainy friends'));
  await tv.screenshot({ path: path.join(h.SHOTS, 'tv-en-choice.png') });

  h.log('\n[E5] 몸놀이 → 이야기 → 책 → 마무리 → 끝');
  await phone.click('[data-act="next"]');
  await h.check('TV 몸놀이 장면과 타이머 버튼', async () => { await h.hasText(tv.locator('.scene h1'), 'bodies'); await h.hasText(phone.locator('[data-act="timer"]'), 'Start timer'); });
  await phone.click('[data-act="next"]');
  await h.check('TV 이야기: 오늘 숫자', () => h.hasText(tv.locator('.story p'), 'Today the sky over our class had 3 Sunny, 2 Cloudy, 1 Rainy'));
  await h.check('최다 날씨 문장', () => h.hasText(tv.locator('.story p'), 'Sunny was the biggest of all'));
  await h.check('강사 폰 미리보기도 같은 문장', () => h.hasText(phone.locator('.preview'), 'Sunny was the biggest of all'));
  await tv.screenshot({ path: path.join(h.SHOTS, 'tv-en-story.png') });
  await phone.click('[data-act="next"]');
  await h.check('TV moves to the "Our Class Book" step', () => h.hasText(tv.locator('.stage-top .ttl'), 'Our Class Book'));
  await phone.click('[data-act="next"]');
  await h.check('강사 폰 버튼이 "Finish lesson"', () => h.hasText(phone.locator('[data-act="next"]'), 'Finish lesson'));
  await phone.click('[data-act="next"]');
  await h.check("TV: That's all for today!", () => h.hasText(tv.locator('.scene h1'), "That's all for today"));
  await h.check('강사 폰: Family page', () => h.hasText(phone.locator('.card .h'), 'Family page'));

  h.log('\n[E6] 영어 보호자 페이지');
  const parent = await h.newPage(en, 'parent-en');
  await parent.setViewportSize({ width: 390, height: 844 });
  await parent.goto(`${h.base}/#parent-ENGL`);
  await h.check('제목·날짜·인원이 영어', async () => {
    await h.hasText(parent.locator('h1'), 'Our class today: "Mood Weather"');
    await h.hasText(parent.locator('.asof'), '6 children joined');
    const asof = await parent.locator('.asof').textContent();
    if (!/^[A-Z][a-z]+ \d{1,2}, \d{4}/.test(asof.trim())) throw new Error(asof);
  });
  await h.check('오늘 이야기', () => h.hasText(parent.locator('.story'), '3 Sunny, 2 Cloudy, 1 Rainy'));
  await h.check('집에서 이어가기 3개', async () => { await h.hasText(parent.locator('.card .h'), 'Keep it going at home'); if ((await parent.locator('.tips li').count()) !== 3) throw new Error('tips'); });
  await h.check('문서 title과 <html lang>', async () => {
    const r = await parent.evaluate(() => [document.title, document.documentElement.lang]);
    if (r[0] !== 'Our Class Today' || r[1] !== 'en') throw new Error(JSON.stringify(r));
  });
  await parent.screenshot({ path: path.join(h.SHOTS, 'parent-en.png'), fullPage: true });

  h.log('\n[E7] 수업 언어와 기기 언어가 다를 때: 한국어 팩을 고르면 TV와 보호자 페이지는 한국어를 따른다');
  await phone.click('[data-act="reset"]');
  await h.hasText(tv.locator('.wait .sub'), 'Turn on sound');
  await home.evaluate(() => { localStorage.setItem('emoren.pack', 'mind-weather'); localStorage.setItem('emoren.packLang', 'ko'); });
  const tv2 = await h.newPage(en, 'TV-ko-in-en');
  await tv2.goto(`${h.base}/#tv-KOEN`);
  await h.hasText(tv2.locator('.wait .sub'), 'Turn on sound');
  const phone2 = await h.newPage(en, 'phone-ko-in-en');
  await phone2.setViewportSize({ width: 390, height: 844 });
  await phone2.goto(`${h.base}/#teacher-KOEN`);
  await h.check('강사 폰 화면은 기기 언어(영어)로, 수업은 한국어 팩', async () => { await h.hasText(phone2.locator('[data-act="start"]'), 'Start lesson'); await h.hasText(phone2.locator('.panel h2'), '오늘의 마음 날씨'); });
  await h.check('TV 화면 안내가 한국어로 바뀐다', async () => { await h.hasText(tv2.locator('.wait h1'), '오늘의 마음 날씨'); await h.hasText(tv2.locator('.wait .sub'), '소리 켜기'); });
  await h.check('기기 언어 저장값은 그대로 en', async () => {
    const v = await tv2.evaluate(() => localStorage.getItem('emoren.lang'));
    if (v !== 'en') throw new Error(String(v));
  });
}
