# v0.2 빌드 브리프 · Build brief (handover)

이 문서는 다음 작업 세션이 그대로 실행하는 작업 지시서다. 영어 요약은 맨 아래.

## 목표

**이모렌 교실(emoren-classroom) v0.2 공개판**: 한국어·영어 전면 지원, 세계 어느 교실에서도 10초 안에 써 볼 수 있는 입구, 사람들이 찍어서 공유할 "우리 반이 함께 만든" 마무리 장면, 그리고 믿음이 가는 공개 저장소(README·CI·라이선스·기여 안내).

## 지금 상태 (main)

- v0.1: 세 화면(강사 폰 `#teacher-코드`, 교실 TV `#tv-코드`, 보호자 `#parent-코드`), 수업팩 JSON(단계 유형 talk/choice/activity/story/closing), 동기화 어댑터 3종(같은 브라우저 / claude.ai 아티팩트 db / Firebase), SVG 임시 캐릭터 + 브라우저 음성, 단위 테스트 + Playwright 두 화면 시나리오.
- i18n 기반 완료: `js/i18n.js`(t, getLang, setLang, LANGS, langName), `js/locales/{ko,en}.js`, 언어별 수업팩 `packs/<id>.<lang>.json`, `room.lang`, 영어판 「Mood Weather」. 형식은 `docs/PACK-FORMAT.md`.
- 공개 저장소 뼈대: `LICENSE`(MIT, 코드) + `packs/LICENSE.md`(CC BY-NC-SA 4.0, 수업팩 내용), `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `.github/`(CI, 이슈·PR 템플릿).
- 실행: `node tools/serve.mjs` → http://127.0.0.1:8787 · 테스트: `npm test`, `npm run e2e`(Playwright·Chromium 필요).

## 바꾸면 안 되는 것 (하드 제약)

1. 프레임워크·빌드·런타임 의존성 없음. HTML + 바닐라 JS ES 모듈. 정적 서버와 claude.ai 아티팩트 안에서 둘 다 돌아야 한다(아티팩트에는 서비스워커 없음, 외부 스크립트는 cdnjs/jsdelivr/unpkg만).
2. 아이 화면(TV)은 가로 16:9 한 장면, 큰 글씨, 이모지+이름(색만으로 구분 금지), 핑크 `#FF6B9D`·그린 `#16B364` 토큰, **보라 배경 금지**.
3. 관찰 언어만. 진단·검사·치료·위기 감지·판정 표현 금지. 아이 이름·사진·음성·개인 선택은 저장·전송·로그 금지. 남는 것은 반 전체 숫자, 이야기, 선생님의 반 메모뿐.
4. 협력 기관·후원사·그쪽 캐릭터·금융(코인·저금) 소재는 코드·문서·커밋 어디에도 넣지 않는다. 써도 되는 이름은 emoren/이모렌, 마음여행, 임시 캐릭터 이름(조앤/Joanne, 힐링이/Healingi)뿐.
5. 상태는 방(room) JSON 하나. 강사 폰만 쓰고 TV·보호자는 읽기만. 동기화 어댑터 인터페이스(get/set/subscribe/close)는 유지.
6. 모든 화면 문구는 `t()`로, 모든 언어 파일에 키가 있어야 한다. 새 수업팩은 ko·en 두 언어판을 같이 낸다.

## v0.2 기능 (우선순위 순)

### P0 — 이게 없으면 공개 못 한다

**A. README 영문·국문 전면 개편**
- `README.md`는 영어(첫 화면), `README.ko.md`는 한국어. 구성: 한 줄 피치 → 30초 데모(GIF/스크린샷) → "Try it in 10 seconds"(플레이그라운드 링크·로컬 실행 3줄) → 왜 아이 기기가 없는가(원칙 3개) → 세 화면 → 수업팩 만들기 → 아키텍처(mermaid 한 장: 폰→상태→TV·보호자, 어댑터 3종) → 배포(정적/아티팩트/Firebase) → 기여·라이선스.
- 피치 후보: "One phone drives a classroom TV character; kids answer with cards, not screens. Every lesson is one JSON file."
- 스크린샷·GIF는 아래 B의 플레이그라운드로 Playwright가 자동 생성해 `docs/shots/`에 커밋한다(손으로 찍지 않는다).

**B. 원-URL 플레이그라운드 `#demo`**
- 한 탭 안에 교실 TV(16:9)와 강사 폰(세로)을 나란히 띄운다. 같은 방 코드를 공유하고 같은 브라우저 동기화로 움직인다.
- "유령 선생님(ghost teacher)" 버튼: 수업 한 회기를 자동으로 진행한다(시작 → 집계 몇 번 → 확정 → 타이머(짧게) → 이야기 → 마무리 → 끝). 언제든 사람이 넘겨받을 수 있다.
- 방문자가 두 기기 없이도 10초 안에 전체 흐름을 본다. 스크린샷·GIF 생성과 e2e 스모크에도 이 화면을 쓴다.

**C. 수업팩 2개 추가(각 ko·en) + 팩 도구**
- 「친구 마음 알아맞히기 / Guess the Feeling」(공감: 사진 대신 선생님 표정·상황 카드, 선택지 4개, 몸놀이 "표정 따라 하기") — 「마음 신호등 / Feelings Traffic Light」(진정하기: 멈추기·숨쉬기·말하기, 활동은 호흡 타이머 30초, 이야기는 "우리 반이 고른 신호").
- 둘 다 기존 5단계 유형만으로 쓴다. 대사는 `docs/PACK-FORMAT.md`의 "만 4~5세 대사를 쓸 때"와 영어판 규칙을 지킨다.
- `tools/packs-check.mjs` + `npm run packs:check`: 모든 팩을 `validatePack`으로 검사하고, 같은 id의 언어판끼리 단계 id·선택지 id·유형·순서가 같은지, 템플릿 변수가 실제 선택지와 맞는지 확인한다. CI에 추가.

**D. 「오늘 우리 반 책 / Our Class Book」 — 새 단계 유형 `book`**
- 마무리 직전에 TV 전체가 그림책이 된다: 표지(수업 이름·날짜, 이름 없음) → 선택 단계마다 한 쪽(이모지 스탬프가 집계 수만큼 찍힘) → 몸놀이 한 쪽 → 오늘 이야기 한 쪽 → 뒤표지("우리 반이 함께 만들었어요"). 자동으로 넘어가며 캐릭터가 읽는다. 강사 폰에서 이전·다음 쪽 조작 가능.
- 보호자 페이지에 같은 책을 세로 레이아웃으로 보여 준다.
- 팩에서는 `{ "id": "book", "type": "book", "title": "...", "cover_line": "...", "back_line": "..." }` 정도만 쓰고 나머지는 상태에서 만든다. `validatePack`, `PACK-FORMAT.md`, 두 언어 팩 3개 모두에 적용.

**E. TV 대기 화면 QR 입장**
- TV 대기 화면에 강사 폰 링크(`#teacher-코드`)의 QR을 띄운다. 의존성 없이: 작은 MIT QR 인코더를 `js/vendor/`에 넣거나(라이선스 파일 포함) 직접 구현한다. 테스트에서 실제로 디코드되는지 확인한다(테스트 전용 디코더 설치는 허용).

### P1 — 있으면 세계가 알아본다

- **수업팩 스튜디오 `#studio`**: 코드 없이 팩을 만드는 폼 편집기(단계 추가·선택지·대사·템플릿 미리보기), 실시간 `validatePack`, "TV에서 미리 보기"(localStorage 임시 팩), JSON 내려받기/복사.
- **"남는 기록" 패널**: 강사 폰에서 지금 방에 저장된 것 전부를 보여 주고(숫자·이야기·메모), 한 번에 지우기. 상태 JSON에 반 메모 외의 자유 텍스트가 없다는 걸 테스트로 강제.
- 타이머 시계 차이 보정(상태에 서버/작성 시각 기준 오프셋), 효과음(WebAudio로 합성, 파일 없음: 확정 때 짧은 차임, 타이머 끝 차임), TV 키오스크(전체 화면 유지, 화면 꺼짐 방지 wake lock 시도).

### P2 — 문서로만

- `docs/BRAIN.md`: 캐릭터 반응은 지금 규칙·템플릿(결정론). LLM 어댑터를 붙일 때의 가드레일(관찰 언어, 아이 데이터 미전송, 사전 검수 대사만 음성 출력).
- Firebase 운영 경로 검증 절차(`docs/DEPLOY.md`), 방 만료(7일) 권고.

## 일하는 방식

- 기능마다 테스트를 붙이고 `npm test`·`npm run e2e`가 녹색일 때만 커밋한다. **기능 하나가 끝날 때마다 main에 커밋·푸시**한다(작게, 자주).
- 병렬로 나눠 맡길 때 파일 충돌 지점: `js/store.js`(단계 유형 추가), `js/views/tv.js`, `js/views/teacher.js`, `css/app.css`, `js/locales/*.js`, `sw.js`·`tools/build-artifact.mjs`(파일 목록). 새 기능은 가능하면 새 모듈(`js/views/demo.js`, `js/views/studio.js`, `js/ui/book.js`, `js/vendor/qr.js`)에 두고 기존 파일에는 연결선만 넣는다.
- 커밋 메시지는 한국어 또는 영어. 모델 이름은 커밋·코드·문서에 넣지 않는다.
- 마지막에 `CHANGELOG.md`에 v0.2 항목을 쓰고, README의 스크린샷을 새로 만든다.

## 완료 기준 (Definition of done)

README(en)+README.ko, 수업팩 3개 × 2언어 + `packs:check` 통과, `#demo` 플레이그라운드와 자동 생성 스크린샷·GIF, `book` 단계, QR 입장, CI 녹색, CHANGELOG. 선택: 스튜디오, 기록 패널.

---

## English summary

Build **emoren-classroom v0.2**: fully bilingual (ko/en; the i18n core is already in), a one-URL playground (`#demo`, TV + phone side by side with a "ghost teacher" auto-run), two more bilingual lesson packs plus a `packs:check` tool, a new `book` step type that turns the TV into the class's own picture book at the end of the lesson (also on the parent page), a QR code on the TV waiting screen, an English-first README with Korean twin, CI green, CHANGELOG. Hard constraints: vanilla JS only, children's screen landscape 16:9 with pink/green tokens and no purple, observational language only, no child data anywhere, never mention any partner or sponsor, every string through `t()`, every pack in both languages. Commit and push to main after every green feature.
