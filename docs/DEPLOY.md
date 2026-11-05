# 배포와 운영 · Deploy and operate

이모렌 교실을 돌리는 방법은 세 가지다. 어떤 방법이든 코드는 같고, 다른 것은 **방(room) JSON을 실어 나르는 동기화 저장소**뿐이다. `js/sync/index.js`가 순서대로 고른다: 아티팩트 db → Firebase(`config.js`가 있을 때) → 같은 브라우저. 영어 요약은 맨 아래.

| 방법 | 어울리는 자리 | 동기화 | 서비스워커 |
| --- | --- | --- | --- |
| 정적 호스팅(GitHub Pages 등) | 공개 데모, 한 PC 시연, Firebase를 얹은 운영 | 같은 브라우저(기본) / Firebase(`config.js`) | 있음 |
| claude.ai 아티팩트 | 두 기기로 바로 써 보기 | 아티팩트 공유 `db` | 없음 |
| Firebase Realtime Database | 실제 교실(TV와 폰이 다른 네트워크) | RTDB `rooms/<code>` | 호스팅을 따른다 |

## 1. 정적 호스팅

빌드가 없다. 저장소 루트를 그대로 내보내면 끝이다.

```bash
node tools/serve.mjs          # http://127.0.0.1:8787 — 의존성 없음
python -m http.server 8787    # 아무 정적 서버면 된다
```

- nginx라면 `root <저장소>;` 하나면 된다. `mime.types`에 `application/manifest+json webmanifest;` 줄이 없으면 추가하고, `sw.js`와 `index.html`은 `Cache-Control: no-cache`로 두어 새 배포가 바로 보이게 한다.
- 주소는 `/#tv`, `/#teacher-코드`, `/#parent-코드`, `/#demo`, `/#studio`. 모든 경로가 상대 경로라 하위 경로(`/emoren/`) 밑에서도 그대로 돈다.
- **GitHub Pages.** [`.github/workflows/pages.yml`](../.github/workflows/pages.yml)이 `main`에 푸시될 때(또는 Actions 탭에서 수동 실행) 저장소 루트를 그대로 Pages에 올린다. 주소는 `https://<owner>.github.io/<repo>/` — 예: `https://<owner>.github.io/emoren/#demo`. 첫 실행이 Pages를 켠다(`actions/configure-pages`의 `enablement: true`). 조직 정책이 Pages를 막으면 이 워크플로우만 실패하고 CI([`ci.yml`](../.github/workflows/ci.yml))에는 영향이 없다. 저장소 설정 → Pages → Source가 "GitHub Actions"인지 확인하면 된다. 포크에서도 같은 워크플로우가 그 포크의 Pages 주소로 올린다.
- **서비스워커가 캐시하는 것.** `sw.js`의 `SHELL` 목록: `index.html`, CSS, 모든 JS 모듈과 로케일, 팩 JSON, 아이콘, 매니페스트. 전략은 네트워크 우선·끊기면 캐시라서 온라인이면 새 배포가 다음 로드에 바로 보인다. **캐시를 비우려면** `sw.js` 맨 위 `CACHE` 이름(`emoren-classroom-v<n>`)의 숫자를 하나 올린다 — 새 워커가 설치되며 옛 캐시를 지운다(`activate`). 새 JS 파일이나 팩을 추가하면 `SHELL`에도 넣어야 하고, `tests/unit/shell.test.mjs`가 그것을 확인한다. 며칠째 켜 둔 TV는 새로고침 한 번.
- **같은 브라우저 동기화의 한계.** `BroadcastChannel` + `localStorage`는 **한 기기의 한 브라우저 안**에서만 통한다. 한 PC에서 TV 탭과 강사 탭을 띄우는 시연과 `#demo`에는 충분하지만, 진짜 교실(TV 한 대 + 폰 한 대)에는 Firebase나 아티팩트가 필요하다. TV 무대 오른쪽 위 배지가 "같은 브라우저 동기화 / Same-browser sync"라면 폰과 연결된 것이 아니다.

## 2. claude.ai 아티팩트

```bash
npm run build:artifact        # → dist/artifact.html + dist/artifact-files.json
```

- `tools/build-artifact.mjs`가 `index.html`에서 **벗겨 내는 것**: `<!doctype>`·`<html>`·`<head>`·`<body>` 껍데기, `charset`·`viewport` 메타, 매니페스트 링크. 아티팩트 호스트가 문서 뼈대를 직접 씌우므로 두 번 들어가면 안 되기 때문이다. 대신 `<meta name="claude:viewport-fit-sides" content="cover">`를 넣어 TV 장면이 옆 여백 없이 꽉 차게 한다. `dist/artifact-files.json`은 함께 올릴 파일 목록(`css/`, `assets/`, `js/`, `packs/` 전부, 같은 상대 경로)이고 폴더를 훑어 만들므로 손으로 고치지 않는다.
- 올리는 법: `artifact.html`을 페이지로, 목록의 파일들을 같은 경로의 지원 파일로 올린다.
- **동기화.** 페이지에 `window.claude`가 있으면 `js/sync/artifactdb.js`가 아티팩트의 공유 `db`에서 문서 `rooms/<code>`를 읽고 쓴다. 같은 아티팩트를 연 모든 사람이 같은 방을 보므로 코드만 알면 TV·폰·보호자가 서로 다른 기기여도 된다.
- **서비스워커 없음.** `js/app.js`가 `window.claude`가 있으면 등록하지 않는다. 오프라인 캐시도 없다. 외부 스크립트는 하나도 싣지 않는다(Firebase SDK는 `config.js`가 없으니 로드되지 않는다).

## 3. Firebase Realtime Database — 운영 경로

> **이 경로는 아직 실제 Firebase 프로젝트로 검증하지 않았다.** 아래 절차가 검증 방법이다. 끝까지 통과하면 이 문단을 고치고 날짜를 적어 달라.

### 설정

1. Firebase 콘솔에서 프로젝트를 만들고 **Build → Realtime Database → 데이터베이스 만들기**(지역을 고르고 잠금 모드로 시작).
2. **Authentication → Sign-in method → Anonymous**를 켠다. `js/sync/firebase.js`는 먼저 익명 로그인을 시도하므로 쓰기 규칙을 `auth != null`로 둘 수 있다.
3. 프로젝트 설정 → 웹 앱 추가 → 설정 값을 저장소 루트의 `config.js`에 쓴다. `.gitignore`에 있어 커밋되지 않는다.

   ```js
   // config.js — 커밋하지 않는다
   window.EMOREN_FIREBASE_CONFIG = {
     apiKey: '…',
     databaseURL: 'https://<project>-default-rtdb.<region>.firebasedatabase.app',
     projectId: '…',
     appId: '…',
     // anonymousAuth: false   // 익명 로그인을 건너뛰려면 — 그러면 규칙도 바꿔야 한다
   };
   ```

   배포본의 `index.html`에서 `<script type="module" src="js/app.js">` **앞**에 `<script src="config.js"></script>`를 넣는다(README처럼 인라인 `<script>`로 넣어도 된다). 웹 설정 값은 그 자체로 비밀이 아니다 — 데이터를 지키는 것은 규칙이다. 다만 이 저장소는 공개 데모에 백엔드가 없도록 `config.js`를 git 밖에 둔다.
4. **규칙**(Realtime Database → 규칙 → 게시). 코드를 아는 사람은 읽고, 로그인(익명 포함)한 사람만 쓴다.

   ```json
   {
     "rules": {
       "rooms": {
         ".indexOn": ["updatedAt"],
         "$code": {
           ".read": true,
           ".write": "auth != null",
           ".validate": "$code.matches(/^[A-Z0-9]{3,8}$/) && newData.child('code').val() === $code"
         }
       }
     }
   }
   ```

   `.validate`는 방 코드의 모양과 "문서의 `code`가 경로와 같다"를 강제한다. `.indexOn`은 아래 만료 함수가 `updatedAt`으로 조회할 때 필요하다.

### 검증 절차 — 두 기기, 서로 다른 네트워크

예: 교실 PC는 유선, 폰은 이동통신. 각 단계의 기대 결과가 나오지 않으면 아래 "콘솔에서 볼 줄"을 본다.

| # | 하는 일 | 기대 결과 |
| --- | --- | --- |
| 1 | 배포본을 TV(기기 A)에서 열고 `#tv`로 간다 | 네 글자 코드가 크게 뜨고, 무대 오른쪽 위 배지가 **"Firebase 동기화 / Firebase sync"**. 콘솔에 `[sync] firebase 사용 불가` 줄이 없다 |
| 2 | 폰(기기 B)에서 홈 → 강사 폰 카드에 그 코드를 넣는다 | 폰 상단 바에 "Firebase 동기화 · 수업 이름". **1초 안에** TV 대기 화면 제목이 수업 이름으로 바뀐다(방이 만들어졌다) |
| 3 | '수업 시작' | TV가 인사 장면으로 바뀌고 자막이 흐른다 |
| 4 | 선택 단계에서 ＋를 몇 번 누른다 | TV의 막대와 숫자가 **1초 안에** 따라온다 |
| 5 | TV를 새로고침한다 | 같은 장면·같은 숫자로 돌아온다(`ref.get()`으로 복구) |
| 6 | '잠깐' → '계속' | TV에 "잠깐 쉬어요 / Break time" 덮개가 덮였다가 걷힌다 |
| 7 | '확정 → 캐릭터 반응' | 캐릭터가 반 전체 숫자로 말한다 |
| 8 | 끝까지 진행해 '수업 마치기' | TV에 "오늘 수업 끝". 세 번째 기기(아무 네트워크)에서 `#parent-코드`를 열면 이야기와 막대가 있다. 수업 중에 미리 열어 두었다면 끝나는 순간 저절로 바뀐다 |
| 9 | Firebase 콘솔 → Realtime Database → 데이터 → `rooms/<코드>` | 키가 `v` `code` `packId` `lang` `phase` `stepIndex` `tallies` `confirmed` `timer` `speakSeq` `startedAt` `endedAt` `notes` `rev` `updatedAt` `book`뿐이다. 이름도, 개인 선택도 없다 |
| 10 | 폰에서 '같은 코드로 새 수업 준비' | 문서가 빈 대기 방으로 덮어써진다(집계·이야기·메모가 사라진다). 키 자체는 남는다 → 아래 만료 |

### 콘솔에서 볼 줄 (배포본에서 F12)

- `[sync:firebase] 익명 로그인 실패(읽기 전용일 수 있음)` → Authentication에서 Anonymous가 꺼져 있다. 켜고 새로고침.
- `[sync:firebase] 쓰기 실패` (PERMISSION_DENIED) → 규칙이 쓰기를 막는다: 익명 로그인이 안 됐거나 규칙을 게시하지 않았다. 폰 화면은 바뀌는데 TV는 그대로다.
- `[sync:firebase] 구독 오류` → 읽기 규칙이 막거나 `databaseURL`이 틀렸다(지역이 다른 URL이 흔한 원인).
- `[sync] firebase 사용 불가:` → SDK 스크립트(`www.gstatic.com`)를 못 받았다. 다음 어댑터(같은 브라우저)로 **조용히** 넘어가므로 배지를 꼭 확인한다.
- 아무 줄도 없는데 둘이 따로 논다 → `config.js`가 로드되지 않았다(`index.html`에 스크립트 줄이 빠졌거나 경로가 다르다). 콘솔에 `window.EMOREN_FIREBASE_CONFIG`를 쳐 본다.

## 4. 방 만료 — 7일 권고

방은 쓰고 버리는 것이다. 한 수업의 반 전체 숫자, 이야기, 반 메모가 전부이고 보관할 이유가 없다. 메모는 자유 텍스트라 오래 둘수록 좋을 게 없다. **`updatedAt`이 7일 지난 `rooms/<code>`는 지우기를 권한다.** 셋 중 하나(또는 둘)를 쓴다.

**(a) 예약 Cloud Function** — 하루 한 번, `updatedAt < now - 7d`인 방을 지운다.

```js
// functions/index.js (Node 20, firebase-functions v2)
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
initializeApp();
exports.expireRooms = onSchedule('every 24 hours', async () => {
  const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
  const rooms = getDatabase().ref('rooms');
  const snap = await rooms.orderByChild('updatedAt').endAt(cutoff).once('value');
  const gone = {};
  snap.forEach((room) => { gone[room.key] = null; });
  if (Object.keys(gone).length) await rooms.update(gone);
});
```

**(b) 규칙으로 오래된 방 읽기 거부** — 지우지는 않는다.

```json
".read": "!data.exists() || data.child('updatedAt').val() > now - 7*24*3600*1000"
```

`!data.exists()`가 꼭 필요하다. 강사 폰은 새 방을 만들기 전에 먼저 읽으므로 빈 경로는 읽을 수 있어야 한다. 이 규칙만 쓰면 오래된 코드를 다시 쓸 때 읽기가 거부되어 화면에 오류 카드가 뜬다. (a)와 함께 쓰거나 콘솔에서 지운다.

**(c) 선생님의 손** — 강사 폰의 '남는 기록' 패널에서 모두 지우기, 또는 수업 뒤 '같은 코드로 새 수업 준비'. 둘 다 방을 빈 대기 방으로 덮어쓴다(RTDB `set`은 통째로 바꾼다). 키 `rooms/<code>`는 남으므로 (a)가 치운다.

아티팩트 db도 같다: 문서 `rooms/<code>`를 지운다(아티팩트 소유자가 지울 수 있다; 페이지는 초기화 때 덮어쓸 뿐 지우지 않는다). 같은 브라우저 동기화는 방을 `localStorage`의 `emoren-classroom:room:<code>`에 **지울 때까지** 둔다 — 브라우저의 사이트 데이터 삭제, 또는 위 (c).

## 5. 운영자 사생활 점검표

- [ ] **분석 도구·비콘 없음.** 페이지가 보내는 요청은 같은 출처의 파일(`packs/*.json` 등), `index.html`의 Google Fonts 스타일시트 `<link>` 한 줄, 그리고 Firebase를 설정했을 때의 SDK와 DB뿐이다. 방문자 IP가 글꼴 서버에 가는 것도 싫으면 그 `<link>` 줄을 지운다 — 시스템 글꼴로 바뀔 뿐 동작은 같다. 요청을 추가하려면 먼저 이 문서를 고친다.
- [ ] **아이 데이터 없음.** 상태에는 반 전체 숫자, id, 시각, 불리언, 그리고 선생님의 반 메모(`notes[].text`)만 들어간다. 메모에 이름을 쓰지 않도록 폰 화면이 안내한다.
- [ ] **코드는 비밀이 아니다.** 네 글자 코드는 세션 번호다. 코드를 아는 누구나 방을 읽을 수 있다(반 전체 숫자·이야기·메모). 그래서 메모에는 이름을 쓰지 않고, 방은 7일 안에 지운다.
- [ ] **QR에는 방 링크만.** TV 대기 화면의 QR(v0.2)은 `…/#teacher-<code>` 주소 한 줄을 담는다. 그 외에는 아무것도 없다.
- [ ] **지우는 법.** Firebase: 콘솔에서 `rooms/<code>` 삭제 또는 (a). 아티팩트: 문서 삭제. 같은 브라우저: 사이트 데이터 삭제. 폰에서: '남는 기록' → 모두 지우기 / '같은 코드로 새 수업 준비'.
- [ ] **브라우저가 기억하는 것(아이와 무관).** `emoren.lang`(화면 언어), `emoren.lastCode`(마지막 코드), `emoren.pack`·`emoren.packLang`(고른 팩), `emoren.sync`(테스트용 강제), `emoren.studio.draft`(스튜디오 초안), `emoren-classroom:room:<code>`(같은 브라우저 동기화의 방).

---

## English summary

**Three ways to run it; the code is identical, only the sync store differs** (`js/sync/index.js` picks artifact db → Firebase when `config.js` exists → same-browser).

**Static hosting.** No build: serve the repository root (`node tools/serve.mjs`, `python -m http.server`, nginx with `root`; serve `sw.js` and `index.html` with `Cache-Control: no-cache`). All paths are relative, so a sub-path such as `/emoren/` works. **GitHub Pages:** [`.github/workflows/pages.yml`](../.github/workflows/pages.yml) deploys the repository root on every push to `main` (and on manual dispatch) to `https://<owner>.github.io/<repo>/` — e.g. `https://<owner>.github.io/emoren/#demo`. The first run enables Pages (`configure-pages` with `enablement: true`); if the organisation forbids Pages, only this workflow fails and CI is unaffected. The service worker caches the `SHELL` list in `sw.js` (network first, cache when offline); to bust it, bump the number in the `CACHE` name, and remember that every new JS file or pack must be added to `SHELL` (`tests/unit/shell.test.mjs` checks). Same-browser sync (`BroadcastChannel` + `localStorage`) only works inside one browser on one device: fine for a one-PC demo and `#demo`, but a real classroom (TV + phone) needs Firebase or the artifact. If the TV badge says "Same-browser sync", the phone is not connected.

**claude.ai artifact.** `npm run build:artifact` writes `dist/artifact.html` and `dist/artifact-files.json`. The builder strips the document skeleton (`doctype`/`html`/`head`/`body`, charset and viewport metas, manifest link) because the artifact host adds its own, and inserts `claude:viewport-fit-sides`. Sync uses the artifact's shared `db`, document `rooms/<code>`; there is no service worker and no external script.

**Firebase Realtime Database (operations path).** Create a project → enable RTDB → enable Anonymous sign-in → put the web config in `config.js` (git-ignored; load it before `js/app.js`) → publish rules that let anyone with the code read and any signed-in (incl. anonymous) user write, with `.indexOn: ["updatedAt"]`. **This path has not yet been verified on a real project; the 10-step checklist above is how to verify it:** TV shows the code with the "Firebase sync" badge; the phone joins from another network and the TV title changes within 1 s; tallies appear on the TV within 1 s; reloading the TV restores scene and numbers; pause covers the TV; confirm makes the character speak; finishing fills the family page (which updates by itself if it was open); the RTDB document holds only the room keys listed above, no names; reset overwrites the room. Console lines to look for: `[sync:firebase] 익명 로그인 실패(읽기 전용일 수 있음)` (Anonymous sign-in is off), `[sync:firebase] 쓰기 실패` (rules refuse the write), `[sync:firebase] 구독 오류` (read rule or wrong `databaseURL`), `[sync] firebase 사용 불가:` (SDK blocked — the app silently falls back to same-browser sync, so check the badge).

**Room expiry (7 days recommended).** Rooms are throwaway. Delete `rooms/<code>` whose `updatedAt` is older than 7 days: (a) a scheduled Cloud Function (snippet above, `updatedAt < now - 7d`), (b) a read rule that refuses stale rooms — it must keep `!data.exists() ||` so new rooms can still be created, and it hides rather than deletes — or (c) the teacher's own erase on the phone (the record panel, or "Set up a new lesson with this code"), which overwrites the room with an empty waiting room. Same for the artifact db (delete the document). Same-browser sync keeps the room in `localStorage` (`emoren-classroom:room:<code>`) until cleared.

**Operator privacy checklist:** no analytics or beacons (the only third-party request is the Google Fonts stylesheet, removable); no child data anywhere (class counts, ids, timestamps, booleans and the teacher's class note); the 4-letter code is a session number, not a secret; the TV's QR encodes only the `#teacher-<code>` link; wipe by deleting the room (Firebase console or function, artifact document, browser site data, or the phone's erase).
