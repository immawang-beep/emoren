// 수업팩 시나리오: 홈 목록에 팩 3개(각 한국어 / English)가 보이고, 홈에서 고른 팩·언어로 새 방이 만들어진다.
//   [P1] 홈: 목록 3개, 팩·언어 선택 → localStorage(emoren.pack / emoren.packLang)
//   [P2] 마음 신호등(ko, 코드 TLKO): 신호 3개 🔴🟡🟢 집계·확정 → 호흡 타이머 30초 → 이야기 → tv-traffic-light.png
//   [P3] Guess the Feeling(en, 코드 FGEN): 기기 언어는 한국어, 수업은 영어 — TV 질문에 "feeling", 선택지 4개 → tv-feeling-guess-en.png
export default async function packs(h) {
  const ctx = await h.newContext({ locale: 'ko-KR' });
  const plus = async (page, id, n) => { for (let i = 0; i < n; i++) await page.click(`[data-tally="${id}"][data-delta="1"]`); };

  h.log('\n[P1] 홈: 수업팩 3개, 두 언어');
  const home = await h.newPage(ctx, 'home-packs', { phone: true });
  await home.goto(`${h.base}/#`);
  await h.check('수업팩 목록에 3개, 각각 한국어 / English', async () => {
    await h.hasText(home.locator('.how li'), '마음 신호등');
    const items = await home.locator('.how li').allTextContents();
    if (items.length !== 3) throw new Error(`목록 ${items.length}개`);
    for (const s of items) if (!/한국어 \/ English/.test(s)) throw new Error(s);
    for (const title of ['오늘의 마음 날씨', '친구 마음 알아맞히기', '마음 신호등']) if (!items.some((s) => s.includes(title))) throw new Error(`없음: ${title}`);
  });
  await h.check('팩·언어 선택에 6가지', async () => {
    const n = await home.locator('select[data-pack] option').count();
    if (n !== 6) throw new Error(`option ${n}개`);
  });
  await home.selectOption('select[data-pack]', 'traffic-light|ko');
  await h.check('고른 팩·언어가 저장된다', async () => {
    const r = await home.evaluate(() => [localStorage.getItem('emoren.pack'), localStorage.getItem('emoren.packLang')]);
    if (r[0] !== 'traffic-light' || r[1] !== 'ko') throw new Error(JSON.stringify(r));
  });

  h.log('\n[P2] 마음 신호등(ko): 코드 TLKO');
  const tv = await h.newPage(ctx, 'TV-TLKO');
  await tv.goto(`${h.base}/#tv-TLKO`);
  await h.hasText(tv.locator('.bigcode'), 'TLKO');
  const phone = await h.newPage(ctx, 'phone-TLKO', { phone: true });
  await phone.goto(`${h.base}/#teacher-TLKO`);
  await h.check('강사 폰이 마음 신호등으로 방을 만든다', async () => { await h.hasText(phone.locator('.panel h2'), '마음 신호등'); await h.hasText(phone.locator('.tsync'), '마음 신호등'); });
  await h.check('TV 대기 화면에 마음 신호등', () => h.hasText(tv.locator('.wait h1'), '마음 신호등'));
  await phone.click('[data-act="start"]');
  await h.check('인사 장면과 1/6', async () => { await h.hasText(tv.locator('.scene h1'), '신호등'); await h.hasText(phone.locator('.stepnav'), '1/6'); });
  await phone.click('[data-act="next"]');
  await h.check('TV에 질문과 신호 3개 🔴🟡🟢', async () => {
    await h.hasText(tv.locator('.scene h1'), '필요한 신호');
    const emoji = await tv.locator('.opt .emoji').allTextContents();
    if (emoji.join('') !== '🔴🟡🟢') throw new Error(emoji.join(','));
    const labels = await tv.locator('.opt .label').allTextContents();
    if (labels.join(',') !== '멈추기,숨쉬기,말하기') throw new Error(labels.join(','));
  });
  await plus(phone, 'stop', 2); await plus(phone, 'breathe', 3); await plus(phone, 'say', 1);
  await h.check('TV 숨쉬기 칸이 3이고 가장 큰 막대', async () => {
    await h.hasText(tv.locator('[data-opt="breathe"] .count'), '3');
    await tv.locator('.opt.lead[data-opt="breathe"]').waitFor({ timeout: h.T });
  });
  await h.check('강사 폰 합계 6명', () => h.hasText(phone.locator('.trow'), '6'));
  await phone.click('[data-act="confirm"]');
  await h.check('확정 자막 "멈추기 2명, 숨쉬기 3명, 말하기 1명"', () => h.hasText(tv.locator('[data-caption]'), '멈추기 2명, 숨쉬기 3명, 말하기 1명'));
  await h.check('숨쉬기를 고른 친구가 제일 많았네', () => h.hasText(tv.locator('[data-caption]'), '숨쉬기를 고른 친구가 제일 많았네'));
  await h.shot(tv, 'tv-traffic-light.png');
  await phone.click('[data-act="next"]');
  await h.check('호흡 타이머 30초, 동작 4개', async () => {
    await h.hasText(tv.locator('.scene h1'), '천천히 숨');
    await h.hasText(tv.locator('[data-tleft]'), '30');
    if ((await tv.locator('.moves > div').count()) !== 4) throw new Error('동작 수');
    await h.hasText(phone.locator('[data-timer]'), '30');
  });
  await phone.click('[data-act="next"]');
  await h.check('이야기: 우리 반이 고른 신호', async () => {
    await h.hasText(tv.locator('.story h1'), '우리 반이 고른 신호');
    await h.hasText(tv.locator('.story p'), '멈추기 2명, 숨쉬기 3명, 말하기 1명');
    const text = await tv.locator('.story p').textContent();
    if (/\{|\[\[/.test(text)) throw new Error(text);
  });
  await h.check('강사 폰 미리보기에 같은 문장', () => h.hasText(phone.locator('.preview'), '제일 많이 고른 신호는 숨쉬기였어요'));

  h.log('\n[P3] Guess the Feeling(en): 코드 FGEN — 기기 언어는 한국어, 수업은 영어');
  await home.selectOption('select[data-pack]', 'feeling-guess|en');
  const tv2 = await h.newPage(ctx, 'TV-FGEN');
  await tv2.goto(`${h.base}/#tv-FGEN`);
  await h.hasText(tv2.locator('.bigcode'), 'FGEN');
  const phone2 = await h.newPage(ctx, 'phone-FGEN', { phone: true });
  await phone2.goto(`${h.base}/#teacher-FGEN`);
  await h.check('강사 폰 화면은 한국어, 수업은 Guess the Feeling', async () => { await h.hasText(phone2.locator('.panel h2'), 'Guess the Feeling'); await h.hasText(phone2.locator('[data-act="start"]'), '수업 시작'); });
  await h.check('TV는 수업 언어(영어)를 따른다', async () => { await h.hasText(tv2.locator('.wait h1'), 'Guess the Feeling'); await h.hasText(tv2.locator('.wait .sub'), 'Turn on sound'); });
  await phone2.click('[data-act="start"]');
  await h.hasText(phone2.locator('.stepnav'), '1/6');
  await phone2.click('[data-act="next"]');
  await h.check('TV 질문에 "feeling", 선택지 4개 Happy/Sad/Angry/Scared', async () => {
    await h.hasText(tv2.locator('.scene h1'), 'feeling');
    const labels = await tv2.locator('.opt .label').allTextContents();
    if (labels.join(',') !== 'Happy,Sad,Angry,Scared') throw new Error(labels.join(','));
    const emoji = await tv2.locator('.opt .emoji').allTextContents();
    if (emoji.join('') !== '😊😢😠😨') throw new Error(emoji.join(','));
  });
  await plus(phone2, 'happy', 3); await plus(phone2, 'sad', 1);
  await phone2.click('[data-act="confirm"]');
  await h.check('확정 자막 "You noticed 3 Happy, 1 Sad"', () => h.hasText(tv2.locator('[data-caption]'), 'You noticed 3 Happy, 1 Sad'));
  await h.check('슬픈 얼굴을 알아차린 데 고마움', () => h.hasText(tv2.locator('[data-caption]'), 'noticing a sad face'));
  await h.shot(tv2, 'tv-feeling-guess-en.png');
  await phone2.click('[data-act="next"]');
  await h.check('Copy the face: 45초 타이머', async () => { await h.hasText(tv2.locator('.scene h1'), 'faces'); await h.hasText(tv2.locator('[data-tleft]'), '45'); });
  await phone2.click('[data-act="next"]');
  await h.check('이야기에 "Most friends saw Happy"', () => h.hasText(tv2.locator('.story p'), 'Most friends saw Happy'));
}
