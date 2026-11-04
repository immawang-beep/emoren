// 홈: 세 화면으로 가는 입구. 교실 TV는 코드를 만들고, 강사 폰과 보호자는 코드를 넣는다.
import { esc, makeCode, normalizeCode, readLocal, pageUrl } from '../util.js';
import { loadPackIndex } from '../pack.js';

export async function renderHome(root) {
  const last = readLocal('emoren.lastCode', '');
  let packs = [];
  try { packs = (await loadPackIndex()).packs || []; } catch (e) { console.warn(e); }

  root.innerHTML = `
  <main class="page home">
    <header class="brand">
      <div class="logo">이모렌 교실</div>
      <p class="tag">강사 폰 한 대로 교실 TV와 AI 캐릭터가 함께 움직이는 15분 수업</p>
    </header>

    <section class="card">
      <h2>교실 TV</h2>
      <p>교실 TV(또는 큰 화면)에 연결된 브라우저에서 여세요. 수업 코드가 크게 뜹니다.</p>
      <a class="btn primary wide" href="#tv">교실 TV 열기</a>
    </section>

    <section class="card">
      <h2>강사 폰</h2>
      <p>TV에 뜬 네 글자 코드를 넣으면 리모컨이 열립니다.</p>
      <form class="join" data-role="teacher">
        <input name="code" inputmode="text" autocapitalize="characters" autocomplete="off" spellcheck="false" maxlength="8" placeholder="코드" value="${esc(last)}" aria-label="수업 코드">
        <button class="btn green" type="submit">리모컨 열기</button>
        <button class="btn ghost" type="button" data-new>새 수업 만들기</button>
      </form>
      <div class="hint" data-newbox hidden></div>
    </section>

    <section class="card">
      <h2>보호자 페이지</h2>
      <p>수업이 끝나면 반 전체의 마음 날씨와 오늘 이야기가 올라옵니다.</p>
      <form class="join" data-role="parent">
        <input name="code" inputmode="text" autocapitalize="characters" autocomplete="off" spellcheck="false" maxlength="8" placeholder="코드" aria-label="수업 코드">
        <button class="btn" type="submit">열어 보기</button>
      </form>
    </section>

    <section class="card how">
      <h2>수업팩</h2>
      <ol>${packs.map((p) => `<li><b>${esc(p.title)}</b> <span class="muted">· ${esc(p.domain)} · ${esc(p.age)} · ${esc(p.minutes)}분</span></li>`).join('') || '<li class="muted">불러오는 중…</li>'}</ol>
      <p class="hint">수업팩은 <code>packs/*.json</code> 한 장으로 수업 전체를 정의합니다. 코드를 건드리지 않고 JSON만 바꿔 새 수업을 만듭니다.</p>
    </section>

    <p class="foot">아이 이름이나 개인 정보는 어디에도 저장하지 않습니다. 기록은 반 전체 숫자와 이야기뿐입니다.</p>
  </main>`;

  for (const form of root.querySelectorAll('form.join')) {
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const code = normalizeCode(form.elements.code.value);
      if (code.length < 3) { form.elements.code.focus(); return; }
      location.hash = `${form.dataset.role}-${code}`;
    });
  }
  const newBtn = root.querySelector('[data-new]');
  const newBox = root.querySelector('[data-newbox]');
  newBtn.addEventListener('click', () => {
    const code = makeCode();
    root.querySelector('form[data-role="teacher"] input').value = code;
    newBox.hidden = false;
    newBox.innerHTML = `새 수업 코드 <b class="tcode">${esc(code)}</b> · 교실 TV에서 <a href="${esc(pageUrl('tv-' + code))}" target="_blank" rel="noopener">이 링크</a>를 열거나 코드를 넣은 뒤, 여기서 '리모컨 열기'를 누르세요.`;
  });
  document.title = '이모렌 교실';
  return { destroy() {} };
}
