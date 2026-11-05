// 홈: 세 화면으로 가는 입구. 교실 TV는 코드를 만들고, 강사 폰과 보호자는 코드를 넣는다.
// Home: entry to the three screens. Has the KO / EN language toggle and (when there is more than one
// choice) the lesson pack / language picker for the teacher.
import { esc, makeCode, normalizeCode, readLocal, writeLocal, pageUrl } from '../util.js';
import { loadPackIndex, listPackChoices, DEFAULT_PACK } from '../pack.js';
import { t, getLang, setLang, LANGS, langName } from '../i18n.js';

export async function renderHome(root) {
  let choices = [];
  try { choices = listPackChoices(await loadPackIndex()); } catch (e) { console.warn(e); }
  let destroyed = false;

  // 강사 카드의 팩·언어 선택값: 저장된 것 → UI 언어로 된 기본 팩 → 첫 번째
  function pickedChoice() {
    const id = readLocal('emoren.pack', '');
    const lang = readLocal('emoren.packLang', '');
    return choices.find((c) => c.id === id && c.lang === lang)
      || choices.find((c) => c.id === DEFAULT_PACK && c.lang === getLang())
      || choices.find((c) => c.lang === getLang())
      || choices[0] || null;
  }

  function draw() {
    if (destroyed) return;
    const last = readLocal('emoren.lastCode', '');
    const lang = getLang();
    const picked = pickedChoice();
    const byPack = new Map();
    for (const c of choices) { if (!byPack.has(c.id)) byPack.set(c.id, []); byPack.get(c.id).push(c); }

    root.innerHTML = `
    <main class="page home">
      <header class="brand">
        <div class="brand-row">
          <div class="logo">${esc(t('home.title'))}</div>
          <div class="langs" role="group" aria-label="${esc(t('common.language'))}">
            ${LANGS.map((l) => `<button class="pill" type="button" data-lang="${l}" aria-pressed="${l === lang}" title="${esc(langName(l))}">${l.toUpperCase()}</button>`).join('')}
          </div>
        </div>
        <p class="tag">${esc(t('home.tagline'))}</p>
      </header>

      <section class="card">
        <h2>${esc(t('home.tv.title'))}</h2>
        <p>${esc(t('home.tv.desc'))}</p>
        <a class="btn primary wide" href="#tv">${esc(t('home.tv.open'))}</a>
      </section>

      <section class="card">
        <h2>${esc(t('home.teacher.title'))}</h2>
        <p>${esc(t('home.teacher.desc'))}</p>
        ${choices.length > 1 ? `
        <label class="packpick"><span>${esc(t('home.teacher.packLabel'))}</span>
          <select data-pack aria-label="${esc(t('home.teacher.packLabel'))}">
            ${choices.map((c) => `<option value="${esc(c.id)}|${esc(c.lang)}" ${picked && c.id === picked.id && c.lang === picked.lang ? 'selected' : ''}>${esc(c.title)} · ${esc(langName(c.lang))}</option>`).join('')}
          </select>
        </label>` : ''}
        <form class="join" data-role="teacher">
          <input name="code" inputmode="text" autocapitalize="characters" autocomplete="off" spellcheck="false" maxlength="8" placeholder="${esc(t('common.code'))}" value="${esc(last)}" aria-label="${esc(t('common.codeLabel'))}">
          <button class="btn green" type="submit">${esc(t('home.teacher.open'))}</button>
          <button class="btn ghost" type="button" data-new>${esc(t('home.teacher.new'))}</button>
        </form>
        <div class="hint" data-newbox hidden></div>
      </section>

      <section class="card">
        <h2>${esc(t('home.parent.title'))}</h2>
        <p>${esc(t('home.parent.desc'))}</p>
        <form class="join" data-role="parent">
          <input name="code" inputmode="text" autocapitalize="characters" autocomplete="off" spellcheck="false" maxlength="8" placeholder="${esc(t('common.code'))}" aria-label="${esc(t('common.codeLabel'))}">
          <button class="btn" type="submit">${esc(t('home.parent.open'))}</button>
        </form>
      </section>

      <section class="card how">
        <h2>${esc(t('home.packs.title'))}</h2>
        <ol>${[...byPack.values()].map((vs) => {
          const p = vs.find((c) => c.lang === lang) || vs[0];
          return `<li><b>${esc(p.title)}</b> <span class="muted">· ${esc(p.domain)} · ${esc(p.age)} · ${esc(t('common.minutes', { n: p.minutes }))} · ${vs.map((c) => esc(langName(c.lang))).join(' / ')}</span></li>`;
        }).join('') || `<li class="muted">${esc(t('home.packs.loading'))}</li>`}</ol>
        <p class="hint">${t('home.packs.hint')}</p>
      </section>

      <p class="foot">${esc(t('home.foot'))}</p>
    </main>`;
    bind();
  }

  function bind() {
    for (const form of root.querySelectorAll('form.join')) {
      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const code = normalizeCode(form.elements.code.value);
        if (code.length < 3) { form.elements.code.focus(); return; }
        location.hash = `${form.dataset.role}-${code}`;
      });
    }
    const sel = root.querySelector('[data-pack]');
    if (sel) {
      sel.addEventListener('change', () => {
        const [id, lang] = sel.value.split('|');
        writeLocal('emoren.pack', id);
        writeLocal('emoren.packLang', lang);
      });
    }
    for (const btn of root.querySelectorAll('[data-lang]')) {
      btn.addEventListener('click', () => { setLang(btn.dataset.lang); });  // 'emoren:lang' 이벤트가 다시 그린다
    }
    const newBtn = root.querySelector('[data-new]');
    const newBox = root.querySelector('[data-newbox]');
    newBtn.addEventListener('click', () => {
      const code = makeCode();
      root.querySelector('form[data-role="teacher"] input').value = code;
      newBox.hidden = false;
      const link = `<a href="${esc(pageUrl('tv-' + code))}" target="_blank" rel="noopener">${esc(t('home.teacher.thisLink'))}</a>`;
      newBox.innerHTML = `${t('home.teacher.newCode', { code: `<b class="tcode">${esc(code)}</b>` })} · ${t('home.teacher.newHint', { link })}`;
    });
    document.title = t('home.title');
  }

  const onLang = () => draw();
  window.addEventListener('emoren:lang', onLang);
  draw();
  return { destroy() { destroyed = true; window.removeEventListener('emoren:lang', onLang); } };
}
