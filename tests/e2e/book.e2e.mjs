// 「오늘 우리 반 책」 시나리오: 교실 TV와 강사 폰(코드 BOOK). 책 단계에서 표지 → 선택 쪽(스탬프) → 뒤표지,
// 강사 폰의 이전·다음 쪽, 저절로 넘어가는 쪽, 그리고 보호자 페이지의 세로 책.
// Class book: cover → choice page with stamps → back cover, phone page buttons, auto-turn, family page stack.

export default async function book(h) {
  const ctx = await h.newContext({ locale: 'ko-KR' });
  h.log('\n[B1] TV와 강사 폰을 코드 BOOK으로 묶고 수업을 책 단계까지 진행한다');
  const tv = await h.newPage(ctx, 'TV-book');
  await tv.goto(`${h.base}/#tv-BOOK`);
  await h.hasText(tv.locator('.bigcode'), 'BOOK');
  const phone = await h.newPage(ctx, 'phone-book', { phone: true });
  await phone.goto(`${h.base}/#teacher-BOOK`);
  await phone.locator('[data-act="start"]').waitFor({ timeout: h.T });
  await phone.click('[data-act="start"]');
  await h.hasText(phone.locator('.stepnav'), '1/6');
  await phone.click('[data-act="next"]');
  await h.hasText(phone.locator('.stepnav'), '2/6');
  const plus = async (id, n) => { for (let i = 0; i < n; i++) await phone.click(`[data-tally="${id}"][data-delta="1"]`); };
  await plus('sunny', 3); await plus('rainy', 1);
  await h.hasText(phone.locator('.trow'), '4');
  await phone.click('[data-act="confirm"]');
  await h.hasText(tv.locator('[data-caption]'), '해님 3명, 비 1명');
  await phone.click('[data-act="next"]');
  await h.hasText(phone.locator('.stepnav'), '3/6');
  await phone.click('[data-act="next"]');
  await h.hasText(phone.locator('.stepnav'), '4/6');
  await phone.click('[data-act="next"]');
  await h.hasText(phone.locator('.stepnav'), '5/6');

  const N = 5; // 표지, 마음 날씨, 몸놀이, 이야기, 뒤표지 / cover, choice, activity, story, back
  const pos = async () => Number(((await phone.locator('[data-bookpos]').textContent()) || '').split('/')[0]) - 1;
  // 강사 폰 버튼으로 k쪽까지 간다(쪽이 저절로 넘어갔어도 맞춰 간다) / walk to page k with the phone buttons
  const gotoPage = async (k) => {
    for (let i = 0; i < 3 * N; i++) {
      const cur = await pos();
      if (cur === k) return;
      await phone.click(cur < k ? '[data-act="book-next"]' : '[data-act="book-prev"]');
    }
    throw new Error(`${k}쪽으로 못 갔다`);
  };

  h.log('\n[B2] 표지: 수업 제목과 날짜, 이름 없음');
  await h.check('TV가 그림책 표지(.book .page.cover)에 수업 제목', () => h.hasText(tv.locator('.book .page.cover h1'), '오늘의 마음 날씨'));
  await h.check('표지에 날짜(…년 …월 …일)', async () => {
    const sub = await tv.locator('.book .page.cover .sub').textContent();
    if (!/\d{4}년 \d{1,2}월 \d{1,2}일/.test(sub)) throw new Error(sub);
  });
  await h.check('TV 상단 제목에 「오늘 우리 반 책」', () => h.hasText(tv.locator('.stage-top .ttl'), '오늘 우리 반 책'));
  await h.check(`강사 폰 쪽 표시 1 / ${N}, 이전 쪽 버튼은 비활성`, async () => {
    await h.hasText(phone.locator('[data-bookpos]'), `1 / ${N}`);
    if (!(await phone.locator('[data-act="book-prev"]').isDisabled())) throw new Error('이전 쪽이 눌린다');
  });
  await h.check('캐릭터가 표지 문구를 읽는다', () => h.hasText(tv.locator('[data-caption]'), '함께 만든 책'));
  await h.shot(tv, 'tv-book-cover.png');

  h.log('\n[B3] 다음 쪽: 마음 날씨 쪽에 집계 수만큼 스탬프');
  await phone.click('[data-act="book-next"]');
  await h.check('TV 선택 쪽: 해님 ☀️ 3개, 비 🌧️ 1개, 구름·천둥 0개, 숫자 표시', async () => {
    await tv.locator('.book .page.choice').waitFor({ timeout: h.T });
    const count = (id) => tv.locator(`.book .page.choice .row[data-opt="${id}"] .stamp`).count();
    const n = async (id) => (await tv.locator(`.book .page.choice .row[data-opt="${id}"] .n`).textContent()).trim();
    const got = { sunny: await count('sunny'), cloudy: await count('cloudy'), rainy: await count('rainy'), stormy: await count('stormy') };
    if (got.sunny !== 3 || got.rainy !== 1 || got.cloudy !== 0 || got.stormy !== 0) throw new Error(JSON.stringify(got));
    const sunny = await tv.locator('.book .page.choice .row[data-opt="sunny"] .stamp').allTextContents();
    if (sunny.join('') !== '☀️☀️☀️') throw new Error(sunny.join(','));
    if ((await n('sunny')) !== '3' || (await n('rainy')) !== '1' || (await n('cloudy')) !== '0') throw new Error('숫자');
  });
  await h.check('선택 쪽 질문과 쪽 번호 2 / 5', async () => { await h.hasText(tv.locator('.book .page.choice h2'), '어떤 날씨'); await h.hasText(tv.locator('.book .pageno'), `2 / ${N}`); });
  await h.check(`강사 폰 쪽 표시 2 / ${N}`, () => h.hasText(phone.locator('[data-bookpos]'), `2 / ${N}`));
  await h.shot(tv, 'tv-book.png');
  await h.shot(phone, 'phone-book.png');

  h.log('\n[B4] 뒤표지까지, 그리고 이전 쪽');
  await gotoPage(2);
  await h.check('몸놀이 쪽(.page.activity)에 동작 카드 4장', async () => { await tv.locator('.book .page.activity').waitFor({ timeout: h.T }); if ((await tv.locator('.book .page.activity .cards div').count()) !== 4) throw new Error('카드 수'); });
  await h.shot(tv, 'tv-book-activity.png');
  await gotoPage(N - 1);
  await h.check('TV 뒤표지(.page.back): 우리 반이 함께 만들었어요', () => h.hasText(tv.locator('.book .page.back'), '함께 만들었어요'));
  await h.shot(tv, 'tv-book-back.png');
  await h.check('뒤표지에서 다음 쪽 버튼은 비활성', async () => {
    await phone.waitForFunction(() => document.querySelector('[data-act="book-next"]')?.disabled === true, null, { timeout: h.T });
  });
  await phone.click('[data-act="book-prev"]');
  await h.check('이전 쪽을 누르면 이야기 쪽(.page.story)에 오늘 숫자', () => h.hasText(tv.locator('.book .page.story p'), '해님 3명, 비 1명'));
  await h.check(`강사 폰 쪽 표시 ${N - 1} / ${N}`, () => h.hasText(phone.locator('[data-bookpos]'), `${N - 1} / ${N}`));
  await h.shot(tv, 'tv-book-story.png');

  h.log('\n[B5] 쪽은 저절로 넘어간다: 표지로 돌아가 기다리면 선택 쪽이 뜬다');
  await gotoPage(0);
  await tv.locator('.book .page.cover').waitFor({ timeout: h.T });
  await h.check('클릭 없이 표지 → 선택 쪽', () => tv.locator('.book .page.choice').waitFor({ timeout: h.T + 4000 }));
  await h.check(`강사 폰 표시도 2 / ${N}로 따라온다`, () => h.hasText(phone.locator('[data-bookpos]'), `2 / ${N}`));

  h.log('\n[B6] 수업을 마치고 보호자 페이지에서 같은 책을 세로로 본다');
  await phone.click('[data-act="next"]');
  await h.hasText(phone.locator('.stepnav'), '6/6');
  await h.check('마무리 장면으로 넘어가면 책이 닫힌다', () => tv.locator('.book').waitFor({ state: 'detached', timeout: h.T }));
  await phone.click('[data-act="next"]');
  await h.hasText(phone.locator('.card .h'), '보호자 페이지');
  const parent = await h.newPage(ctx, 'parent-book', { phone: true });
  await parent.goto(`${h.base}/#parent-BOOK`);
  await h.check('보호자 페이지에 「오늘 우리 반 책」 카드', () => h.hasText(parent.locator('.card .h'), '오늘 우리 반 책'));
  await h.check(`세로 책의 쪽 수 ${N}`, async () => {
    await parent.locator('.book-stack .page').first().waitFor({ timeout: h.T });
    const n = await parent.locator('.book-stack .page').count();
    if (n !== N) throw new Error(String(n));
    const kinds = await parent.locator('.book-stack .page').evaluateAll((els) => els.map((e) => e.className.replace('page', '').trim()));
    if (kinds.join(',') !== 'cover,choice,activity,story,back') throw new Error(kinds.join(','));
  });
  await h.check('세로 책의 선택 쪽에도 해님 스탬프 3개, 비 1개', async () => {
    const sunny = await parent.locator('.book-stack .page.choice .row[data-opt="sunny"] .stamp').count();
    const rainy = await parent.locator('.book-stack .page.choice .row[data-opt="rainy"] .stamp').count();
    if (sunny !== 3 || rainy !== 1) throw new Error(`${sunny}/${rainy}`);
  });
  await h.check('폰 너비에서 가로 스크롤이 없다', async () => {
    const over = await parent.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (over > 0) throw new Error(`${over}px 넘침`);
  });
  await h.shot(parent, 'parent-book.png', { fullPage: true });
}
