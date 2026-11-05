# Changelog

이모렌 교실(emoren-classroom)의 눈에 띄는 변화를 버전별로 적는다. 형식은 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)를, 버전 번호는 [Semantic Versioning](https://semver.org/)을 따른다. 한국어 항목마다 바로 아래에 영어 한 줄을 둔다.

All notable changes to emoren-classroom are listed here. The format follows Keep a Changelog and the version numbers follow Semantic Versioning; every Korean entry has an English line under it.

## [Unreleased]

## [0.2.0] - 2026-11-05

첫 공개판. 한국어·영어 전면 지원, 기기 두 대 없이 10초 안에 전체 흐름을 보는 플레이그라운드, 수업 끝에 TV가 그림책이 되는 「오늘 우리 반 책」, 그리고 믿고 쓸 수 있는 공개 저장소(README·CI·라이선스·기여 안내).

First public release: a fully bilingual UI, a one-URL playground that shows a whole lesson in ten seconds without two devices, "Our Class Book" that turns the TV into a picture book at the end of a lesson, and a public repository people can trust (README, CI, licenses, contributing guide).

### Added

- **한국어·영어 전면 지원.** 화면의 모든 문구가 `t('key')`(`js/i18n.js`)를 거치고, `js/locales/ko.js`와 `en.js`가 같은 키 묶음을 가진다(단위 테스트가 확인). 홈 화면의 KO / EN 토글, 언어별 수업팩 `packs/<id>.<lang>.json`, 방 상태의 `lang`. TV와 보호자 페이지는 수업 언어를, 강사 폰은 기기 언어를 따르고 음성도 언어에 맞는 목소리를 고른다. 「오늘의 마음 날씨」 영어판 「Mood Weather」.
  - Fully bilingual UI (ko/en): every string goes through `t()`, both locale files share one key set (unit-tested), a KO / EN toggle on the home screen, per-language packs `packs/<id>.<lang>.json`, `room.lang`, TV and family page follow the lesson language while the teacher phone follows the device, per-language speech voices, and an English edition of Mood Weather.
- **원-URL 플레이그라운드 `#demo`.** 한 탭 안에 교실 TV(16:9)와 강사 폰(세로)을 나란히 띄운다. 같은 방 코드를 쓰고 같은 브라우저 동기화로 움직인다. "유령 선생님" 버튼을 누르면 수업 한 회기(시작 → 집계 → 확정 → 짧은 타이머 → 이야기 → 마무리)를 자동으로 진행하고, 언제든 사람이 넘겨받을 수 있다. `#demo-<lang>`, `#demo-<lang>-<packId>`로 언어와 수업팩을 고른다. 홈 화면에 '10초 만에 보기' 입구.
  - One-URL playground `#demo`: classroom TV (16:9) and teacher phone side by side in one tab, sharing one room code over same-browser sync. A "ghost teacher" button runs a whole lesson (start → tallies → confirm → short timer → story → closing) and a person can take over at any moment. `#demo-<lang>` and `#demo-<lang>-<packId>` pick the language and pack; the home screen links to it.
- **수업팩 2개 추가, 각각 ko·en.** 「친구 마음 알아맞히기 / Guess the Feeling」(`feeling-guess`, 공감: 선생님의 표정·상황 카드와 선택지 4개, 몸놀이 '표정 따라 하기')과 「마음 신호등 / Feelings Traffic Light」(`traffic-light`, 진정하기: 멈추기·숨쉬기·말하기, 30초 호흡 타이머, '우리 반이 고른 신호' 이야기). 기존 단계 유형만으로 쓰였고 `docs/PACK-FORMAT.md`의 만 4~5세 대사 규칙을 따른다.
  - Two new bilingual packs: "Guess the Feeling" (`feeling-guess`, empathy: the teacher's face and situation cards, four options, a copy-the-face movement game) and "Feelings Traffic Light" (`traffic-light`, calming down: stop, breathe, talk, a 30-second breathing timer and the story of the signal the class chose). Both use the existing step types and follow the writing rules in `docs/PACK-FORMAT.md`.
- **팩 점검 도구 `npm run packs:check`(`tools/packs-check.mjs`).** 모든 팩을 `validatePack`으로 점검하고, 같은 id의 언어판끼리 단계 id·선택지 id·유형·순서가 같은지, 이야기 템플릿 변수가 실제 선택지와 맞는지 확인한다. CI에서도 돈다.
  - Pack check `npm run packs:check` (`tools/packs-check.mjs`): validates every pack, makes sure the language editions of one pack share step ids, option ids, types and order, and that template variables match real options. Runs in CI.
- **새 단계 유형 `book` — 「오늘 우리 반 책 / Our Class Book」.** 마무리 직전에 TV 전체가 그림책이 된다: 표지(수업 이름과 날짜, 이름 없음) → 선택 단계마다 한 쪽(이모지 스탬프가 집계 수만큼 찍힘) → 몸놀이 한 쪽 → 오늘 이야기 한 쪽 → 뒤표지("우리 반이 함께 만들었어요"). 자동으로 넘어가며 캐릭터가 읽어 주고, 강사 폰에서 이전·다음 쪽을 넘길 수 있다. 보호자 페이지에는 같은 책을 세로로 보여 준다. 팩에는 `{ "id": "book", "type": "book", "title", "cover_line", "back_line" }`만 적고 나머지는 상태에서 만든다. `validatePack`이 점검하고(제목 필수, 팩당 하나) 수업팩 세 개의 두 언어판 모두에 들어 있다.
  - New step type `book`, "Our Class Book": right before closing the whole TV becomes a picture book — cover (lesson name and date, no names) → one page per choice step with as many emoji stamps as the tally → an activity page → today's story → back cover ("made together by our class"). It turns pages by itself while the character reads, the teacher phone can go back and forth, and the family page shows the same book in a portrait layout. A pack only declares `{ id, type: "book", title, cover_line, back_line }`; the rest comes from room state. Checked by `validatePack` (title required, one per pack) and present in all three packs in both languages.
- **TV 대기 화면 QR 입장.** TV 대기 화면에 강사 폰 링크(`#teacher-코드`)의 QR 코드를 띄운다. 외부 의존성 없이 작은 MIT 라이선스 QR 인코더를 내장했고(라이선스 파일 포함), 테스트에서 실제로 읽히는지 확인한다.
  - QR code on the TV waiting screen for the teacher link (`#teacher-code`), produced by a small bundled MIT-licensed encoder with no external dependency (license file included); tests decode it for real.
- **README 영문·국문 전면 개편.** `README.md`는 영어, `README.ko.md`는 한국어. 한 줄 피치 → 30초 데모 → "Try it in 10 seconds" → 왜 아이 기기가 없는가 → 세 화면 → 수업팩 만들기 → 아키텍처 → 배포 → 기여·라이선스. 스크린샷은 손으로 찍지 않고 플레이그라운드에서 Playwright가 `npm run shots`로 만들어 `docs/shots/`에 둔다.
  - English `README.md` with a Korean twin `README.ko.md`: one-line pitch, 30-second demo, "Try it in 10 seconds", why there is no child device, the three screens, making a pack, architecture, deployment, contributing and licenses. Screenshots are generated from the playground by Playwright (`npm run shots`) into `docs/shots/`, never taken by hand.
- **수업팩 스튜디오 `#studio` — v0.2.1로 미룸(v0.2에서는 안내 화면만).** 계획: 코드 없이 수업팩을 만드는 폼 편집기: 단계 추가, 선택지, 대사, 이야기 템플릿 미리보기, 실시간 `validatePack`, "TV에서 미리 보기"(localStorage 임시 팩 `studio-draft`), JSON 내려받기·복사. 홈 화면에 입구.
  - Pack studio `#studio` — deferred to v0.2.1 (v0.2 ships a placeholder screen). Planned: a form editor that needs no code — add steps, options and lines, preview story templates, live `validatePack`, "preview on TV" through a localStorage draft (`studio-draft`), download or copy the JSON. Linked from the home screen.
- **"남는 기록 / What is stored" 패널.** 강사 폰에서 지금 방에 저장된 것 전부(반 전체 숫자, 이야기, 반 메모)를 보여 주고 한 번에 지운다. 상태 JSON에 반 메모 말고는 자유 텍스트가 없다는 것을 테스트가 강제한다.
  - "What is stored" panel on the teacher phone: shows everything the room holds (class-level counts, the story, the class note) and clears it in one tap. A test enforces that the room JSON carries no free text other than the class note.
- **효과음.** WebAudio로 합성한 짧은 차임(소리 파일 없음): 확정할 때, 타이머가 끝날 때.
  - Chimes synthesized with WebAudio, no audio files: one on confirm, one when the timer ends.
- **TV 키오스크 모드.** 전체 화면 유지, 화면 꺼짐 방지(wake lock 시도), 가만히 두면 마우스 커서 숨김.
  - TV kiosk mode: keeps fullscreen, tries a wake lock so the screen stays on, hides the cursor when idle.
- **문서.** `docs/BRAIN.md`: 캐릭터 반응은 지금 규칙과 템플릿으로만 정해진다(결정론)는 것과, 나중에 LLM 어댑터를 붙일 때의 가드레일(관찰 언어, 아이 데이터 미전송, 미리 검수한 대사만 음성 출력). `docs/DEPLOY.md`: 정적 서버·아티팩트·Firebase 배포 경로, Firebase 운영 경로 확인 절차, 방 만료(7일) 권고.
  - Docs: `docs/BRAIN.md` explains that character reactions are deterministic rules and templates today and sets the guardrails for any future LLM adapter (observational language, no child data sent, only pre-reviewed lines spoken aloud). `docs/DEPLOY.md` covers static, artifact and Firebase deployment, how to verify the Firebase path, and the recommended 7-day room expiry.
- **GitHub Pages 배포 워크플로.** `.github/workflows`에서 정적 사이트를 GitHub Pages로 올린다.
  - A GitHub Pages workflow under `.github/workflows` publishes the static site.
- **공개 저장소 뼈대.** `LICENSE`(MIT, 코드)와 `packs/LICENSE.md`(CC BY-NC-SA 4.0, 수업팩 내용), `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, CI 워크플로, 이슈·PR 템플릿.
  - Public repository skeleton: `LICENSE` (MIT, code) and `packs/LICENSE.md` (CC BY-NC-SA 4.0, pack content), `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, a CI workflow and issue/PR templates.

### Changed

- **e2e 테스트를 `tests/e2e/*.e2e.mjs`로 나눴다.** 공용 도구는 `tests/e2e/helpers.mjs`, `npm run e2e -- <이름>`으로 일부만 돌릴 수 있고 `E2E_TIMEOUT`으로 대기 시간을 조절한다.
  - E2E tests are split into `tests/e2e/*.e2e.mjs` with shared helpers in `tests/e2e/helpers.mjs`; `npm run e2e -- <name>` runs a subset and `E2E_TIMEOUT` sets the wait.
- **해시 규칙을 `js/route.js`의 순수 함수로 분리했다**(`#demo`, `#demo-<lang>`, `#demo-<lang>-<packId>`, `#studio`). `renderTV`·`renderTeacher`·`renderParent`가 옵션(`sync`, `embedded`, `timerSec`, `packId`/`packLang`)을 받는다.
  - Hash routing lives in pure functions in `js/route.js`; `renderTV`, `renderTeacher` and `renderParent` take an options object (`sync`, `embedded`, `timerSec`, `packId`/`packLang`).
- **`sw.js` SHELL 목록은 한 줄에 하나, 정렬 순.** `tools/build-artifact.mjs`는 폴더를 훑어 파일 목록을 만들고, `tests/unit/shell.test.mjs`가 목록과 실제 파일이 맞는지 확인한다. 서비스워커 캐시 이름도 올려 기존 TV가 새 셸을 받는다.
  - `sw.js` SHELL is one file per line, sorted; `tools/build-artifact.mjs` scans folders, `tests/unit/shell.test.mjs` keeps the list and the files in step, and the service-worker cache name is bumped so existing TVs pick up the new shell.
- **화면 문자열(`js/locales/*.js`)과 CSS(`css/app.css`)에 기능별 구역 표시**를 두어 여러 사람이 동시에 작업해도 병합 충돌이 적다.
  - Locale files and `css/app.css` carry per-feature marked blocks so parallel work merges without conflicts.
- **`docs/PACK-FORMAT.md`**: 언어별 파일, 새 필드, `book` 단계 설명을 더했다.
  - `docs/PACK-FORMAT.md` now covers per-language files, the new fields and the `book` step.

### Fixed

- **타이머 시계 차이 보정.** 강사 폰이 상태를 쓴 시각을 기준으로 오프셋을 계산해(`js/clock.js`), 기기 시계가 서로 달라도 TV 타이머가 어긋나지 않는다.
  - Clock-offset correction: the offset is computed from the time the teacher phone wrote the state (`js/clock.js`), so the TV timer stays right even when device clocks differ.

## [0.1.0] - 2026-11-04

1단계 데모. 강사 폰 한 대가 교실 TV의 캐릭터를 움직이고, 아이들은 화면 대신 카드로 답한다.

First working demo: one phone drives the classroom TV character, and children answer with cards instead of screens.

### Added

- **세 화면.** 강사 폰 리모컨 `#teacher-코드`, 교실 TV 무대 `#tv-코드`(가로 16:9 한 장면, 큰 글씨, 이모지+이름), 보호자 페이지 `#parent-코드`.
  - Three screens: the teacher phone remote, the classroom TV stage (one landscape 16:9 scene, big type, emoji plus label) and the family page.
- **상태 하나(room JSON).** 강사 폰만 쓰고 TV와 보호자 페이지는 읽기만 한다. 동기화 어댑터 3종: 같은 브라우저 / 클라우드(아티팩트 db) / Firebase.
  - One room JSON written only by the teacher phone and read by the TV and the family page; three sync adapters: same browser / cloud (artifact db) / Firebase.
- **빌드 없이 그대로 실행.** 프레임워크·빌드·런타임 의존성 없이 정적 서버(`node tools/serve.mjs`)에서 바로 돌고, `tools/build-artifact.mjs`가 아티팩트용으로 묶는다.
  - Runs as plain static files (`node tools/serve.mjs`) with no framework, build step or runtime dependency; `tools/build-artifact.mjs` bundles it for the artifact build.
- **수업팩 JSON 형식.** 단계 유형 talk·choice·activity·story·closing, 형식 점검(`validatePack`), 이야기 템플릿 조건문. 첫 수업팩 「오늘의 마음 날씨」.
  - Lesson pack JSON format with the step types talk, choice, activity, story and closing, `validatePack`, conditional story templates, and the first pack "Mood Weather".
- **SVG 임시 캐릭터와 브라우저 음성.**
  - Placeholder SVG character and browser speech.
- **테스트.** 단위 테스트 10개, 두 화면 Playwright 시나리오 36개.
  - Tests: 10 unit tests and a 36-check two-screen Playwright scenario.

### Fixed

- TV 이야기 장면의 자막 중복을 없애고 긴 자막의 글자 크기를 조정했다.
  - Removed the duplicated subtitle in the TV story scene and resized long subtitles.

[Unreleased]: https://github.com/immawang-beep/emoren/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/immawang-beep/emoren/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/immawang-beep/emoren/releases/tag/v0.1.0
