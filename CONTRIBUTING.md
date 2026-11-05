# Contributing · 기여 안내

Thank you for helping classrooms run calmer, kinder 15-minute lessons. 한국어 안내는 아래에 있습니다.

## What we welcome

- **Lesson packs** in any language (`packs/<id>.<lang>.json`). Start from `packs/mind-weather.en.json` or `.ko.json`, keep the step ids, and read [docs/PACK-FORMAT.md](docs/PACK-FORMAT.md). Packs are reviewed for the writing rules below before merge.
- **Translations** of UI strings: add `js/locales/<lang>.js`, register the code in `js/i18n.js`.
- **Fixes and small features** with tests. Open an issue first for anything that changes the room state shape or the sync adapter interface.

## Ground rules for anything a child sees or hears

1. Observational language only. Never diagnose, test, treat, rank or label a child. A weather is a weather.
2. No child names, photos, audio or per-child answers are stored, logged or sent anywhere. Class-level counts and the story are the only record.
3. Short lines, one breath each; ask and wait; thank instead of praise/scold.
4. TV is landscape 16:9, large type, emoji + label (never color alone), no purple backgrounds; pink `#FF6B9D` and green `#16B364` are the accents.

## Development

```bash
node tools/serve.mjs     # http://127.0.0.1:8787  (no install step)
npm test                 # unit tests (node:test)
npm run e2e              # two-screen Playwright scenario (needs Chromium)
```

No frameworks, no build step, no runtime dependencies. Keep modules small and plain. Add a test for every behavior you add. Write commit messages in English or Korean.

## Pull requests

- One topic per PR, with a short description of what a teacher will notice.
- CI must be green (unit + e2e).
- If you add a pack, include the `index.json` entry and at least one screenshot of the TV story scene.

---

## 한국어

- **수업팩**(어떤 언어든, `packs/<id>.<lang>.json`), **UI 번역**(`js/locales/<lang>.js`), **테스트가 있는 수정·작은 기능**을 환영합니다. 상태 모양이나 동기화 어댑터 인터페이스를 바꾸는 일은 먼저 이슈로 열어 주세요.
- 아이가 보고 듣는 것의 원칙: 관찰 언어만(진단·검사·치료·판정 금지), 아이 이름·사진·음성·개인 답 저장 금지, 한 호흡 문장, 가로 16:9 큰 글씨, 이모지+이름, 보라 배경 금지.
- 프레임워크·빌드·런타임 의존성 없음. 작은 모듈, 모든 동작에 테스트.
