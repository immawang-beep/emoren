# 이모렌 교실 (emoren-classroom)

강사 스마트폰 한 대가 교실 TV와 AI 캐릭터, 수업 기록을 함께 움직이는 수업 시스템.
아이들 손에는 기기가 없다. 카드와 몸으로 답하고, 선생님이 폰에서 개수를 누르면 TV와 캐릭터가 바로 반응한다.
수업이 끝나면 보호자 페이지에 오늘 우리 반 이야기가 올라간다.

- 프레임워크 없음. HTML + 바닐라 JS 모듈. 빌드 없이 정적 서버에서 바로 돈다.
- 수업 하나는 JSON 한 장(수업팩). 코드를 건드리지 않고 새 수업을 만든다.
- 첫 수업팩: **오늘의 마음 날씨** (정서 알아차리기, 만 4~5세, 15분, 5단계)

## 바로 돌려 보기

```bash
node tools/serve.mjs          # http://127.0.0.1:8787
```

1. **교실 TV**: 큰 화면 브라우저에서 `http://127.0.0.1:8787/#tv` 를 연다. 네 글자 코드가 뜬다. '소리 켜기'를 한 번 누른다.
2. **강사 폰**: 폰에서 홈을 열고 코드를 넣는다(`#teacher-코드`). '수업 시작'.
3. **보호자**: 수업이 끝나면 강사 폰에 보호자 링크가 뜬다(`#parent-코드`).

한 PC에서 시연하려면 TV 탭과 리모컨 탭을 같은 브라우저에 열면 된다(같은 브라우저 동기화).

## 세 화면

| 화면 | 역할 | 쓰기 |
| --- | --- | --- |
| 강사 폰 `#teacher-코드` | 리모컨. 단계 넘기기, 개수 세기, 확정, 타이머, 잠깐 멈춤, 반 메모 | 쓴다 |
| 교실 TV `#tv-코드` | 16:9 무대. 캐릭터, 질문, 자라는 막대, 타이머, 오늘 이야기. 음성 + 자막 | 읽기만 |
| 보호자 `#parent-코드` | 반 전체 숫자, 오늘 이야기, 집에서 이어갈 질문 3개 | 읽기만 |

## 동기화

상태는 방(room) JSON 한 장이다. 어떤 방식이든 이 JSON을 실어 나른다. 자동으로 되는 것부터 고른다.

| 방식 | 언제 | 어떻게 |
| --- | --- | --- |
| 클라우드 | claude.ai 아티팩트로 배포됐을 때 | 아티팩트 공유 저장소(`db`) 문서 `rooms/<코드>` |
| Firebase | 운영 배포. `config.js`가 있을 때 | Realtime Database `rooms/<코드>`, 익명 로그인 |
| 같은 브라우저 | 위 둘이 없을 때, 네트워크 없이 | BroadcastChannel + localStorage. 새로고침해도 복구 |

테스트할 때 `localStorage.setItem('emoren.sync', 'local')` 로 강제할 수 있다.

### Firebase로 운영하기

`config.js`(커밋하지 않음)를 만들고 `index.html`의 `<script type="module" src="js/app.js">` 앞에 불러온다.

```html
<script>
window.EMOREN_FIREBASE_CONFIG = { apiKey: "...", databaseURL: "https://<프로젝트>.firebaseio.com", projectId: "...", appId: "..." };
</script>
```

권장 DB 규칙: 코드를 아는 사람은 읽고, 로그인(익명 포함)한 사람만 쓴다.

```json
{ "rules": { "rooms": { "$code": { ".read": true, ".write": "auth != null" } } } }
```

Firebase 경로는 아직 실제 프로젝트로 검증하지 않았다.

## 수업팩 만들기

`packs/mind-weather.ko.json`(또는 `packs/mind-weather.en.json`)을 복사해 시작한다. 수업팩은 언어마다 한 장(`packs/<id>.<lang>.json`)이고, 홈 화면의 KO / EN 토글로 화면 언어를 바꾼다. 단계 유형은 다섯 가지(talk, choice, activity, story, closing), 이야기 템플릿은 `{sunny}`, `{weather_list}`, `[[rainy: …]]` 조건문을 쓴다. 자세한 설명은 [docs/PACK-FORMAT.md](docs/PACK-FORMAT.md).

## 테스트

```bash
npm test          # 단위: 리듀서·템플릿·팩 검사·i18n (node:test)
npm run e2e       # 두 화면 시나리오 (Playwright, chromium 필요)
```

두 화면 시나리오는 TV 탭과 강사 폰 탭을 한 브라우저에 열어 수업 한 회기를 끝까지 돌린다: 시작 → 집계 → TV 새로고침 복구 → 일시정지 → 확정 → 타이머 → 이야기 → 메모 → 끝 → 보호자 페이지 → 초기화. 이어서 홈의 KO / EN 토글과 영어 수업 한 회기(코드 ENGL)를 돈다. 스크린샷은 `dist/shots/`.

## 지키는 선

- 아이 이름, 사진, 음성, 개인 선택을 저장하지 않는다. 남는 것은 반 전체 숫자와 이야기, 선생님의 반 메모뿐이다.
- 관찰 언어만 쓴다. 진단·검사·치료·판정이라는 말은 화면과 대사에 없다.
- 아이가 보는 화면(TV)은 가로 한 장면. 보라색 배경은 쓰지 않는다.
- 캐릭터 그림과 음성은 임시다. 실제 자산은 `js/ui/character.js`와 `js/ui/speech.js`의 같은 자리에 꽂는다.

## 폴더

```
index.html  css/app.css  manifest.webmanifest  sw.js
js/app.js            해시 라우터
js/store.js          방 상태·리듀서·이야기 템플릿
js/pack.js           수업팩 불러오기(언어별)·형식 검사
js/i18n.js           화면 언어(ko/en): t(), setLang()
js/locales/          ko.js · en.js 화면 문자열
js/sync/             local · artifactdb · firebase
js/views/            home · teacher · tv · parent
js/ui/               character(SVG 임시) · speech(브라우저 음성)
packs/               수업팩 JSON (packs/<id>.<lang>.json + index.json)
tests/               unit(node:test) · e2e.mjs(Playwright)
tools/               serve.mjs · build-artifact.mjs
docs/                PACK-FORMAT.md
```

## 라이선스

공개 전에 정한다. 권장: 코드 MIT, 수업팩 내용(대사·이야기) CC BY-NC-SA.

더멤버스 / 이모렌(emoren)
