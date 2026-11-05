# Contributing · 기여 안내

Thank you for helping classrooms run calmer, kinder 15-minute lessons. 한국어 안내는 아래에 있습니다.

## What we welcome

- **Lesson packs** in any language (`packs/<id>.<lang>.json`). Start from `packs/mind-weather.en.json` or `.ko.json`, keep the step ids, and read [docs/PACK-FORMAT.md](docs/PACK-FORMAT.md). A new pack ships in both Korean and English with the same step and option ids, and ends with a `book` step before `closing` so the class gets its picture book. The no-code editor at `#studio` exports a valid file. Packs are reviewed for the writing rules below before merge.
- **Translations** of UI strings: add `js/locales/<lang>.js`, register the code in `js/i18n.js`.
- **Fixes and small features** with tests. Open an issue first for anything that changes the room state shape or the sync adapter interface.

## Ground rules for anything a child sees or hears

1. Observational language only. The character notices and thanks; it never labels, ranks or judges a child. A weather is a weather.
2. No child names, photos, audio or per-child answers are stored, logged or sent anywhere. Class-level counts and the story are the only record.
3. Short lines, one breath each; ask and wait; thank instead of praise/scold.
4. TV is landscape 16:9, large type, emoji + label (never color alone), no purple backgrounds; pink `#FF6B9D` and green `#16B364` are the accents.

## Development

```bash
node tools/serve.mjs     # http://127.0.0.1:8787  (no install step)
npm test                 # unit tests (node:test)
npm run e2e              # all Playwright scenarios, tests/e2e/*.e2e.mjs (needs Chromium)
npm run e2e -- demo      # one scenario by name
npm run packs:check      # every pack: format, ko/en parity, template variables
```

E2E scenarios are one file per feature, `tests/e2e/<name>.e2e.mjs`, exporting `default async function (h)`; the harness `h` is documented at the top of `tests/e2e/helpers.mjs`. Add a scenario (or extend one) for anything a teacher can see. Unit tests are `tests/unit/<name>.test.mjs` with `node:test`. Any new JS file also goes into the `SHELL` list in `sw.js` so it works offline.

No frameworks, no build step, no runtime dependencies. Keep modules small and plain. Every UI string goes through `t()` and exists in every `js/locales/*.js`. Add a test for every behavior you add. Write commit messages in English or Korean.

## Pull requests

- One topic per PR, with a short description of what a teacher will notice.
- CI must be green (unit + e2e + `packs:check`).
- If you add a pack, include the `index.json` entry, both language files, and at least one screenshot of the TV story scene.

---

## 한국어

- **수업팩**(어떤 언어든, `packs/<id>.<lang>.json`), **UI 번역**(`js/locales/<lang>.js`), **테스트가 있는 수정·작은 기능**을 환영합니다. 상태 모양이나 동기화 어댑터 인터페이스를 바꾸는 일은 먼저 이슈로 열어 주세요.
- 새 수업팩은 한국어·영어 두 언어판을 같이 내고(단계 id·선택지 id 동일), `closing` 앞에 `book` 단계를 둡니다. `#studio`에서 코드 없이 만들어 내려받을 수 있습니다. `npm run packs:check`가 형식, 두 언어판의 짝, 템플릿 변수를 확인합니다.
- 아이가 보고 듣는 것의 원칙: 관찰 언어만(아이를 가르거나 판단하는 말 금지, 날씨는 날씨일 뿐), 아이 이름·사진·음성·개인 답 저장 금지, 한 호흡 문장, 가로 16:9 큰 글씨, 이모지+이름, 보라 배경 금지.
- 개발: `node tools/serve.mjs`(설치 없음), `npm test`(단위, `tests/unit/<이름>.test.mjs`), `npm run e2e`(Playwright 시나리오 전부, `tests/e2e/<이름>.e2e.mjs`, 하나만은 `npm run e2e -- <이름>`), `npm run packs:check`. 새 JS 파일은 `sw.js`의 `SHELL`에도 넣습니다.
- 프레임워크·빌드·런타임 의존성 없음. 작은 모듈, 모든 화면 문구는 `t()`로, 모든 동작에 테스트. PR은 CI(단위 + e2e + `packs:check`)가 녹색이어야 합니다.
