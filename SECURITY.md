# Security · 보안

emoren-classroom stores no child data by design: a lesson room holds class-level counts, a templated story and the teacher's class note, keyed by a short lesson code.

If you find a way to read or write a room you were not given the code for, to leak data between rooms, to execute script through a lesson pack, or anything else that could expose a classroom, please report it privately through GitHub's security advisory form for this repository rather than a public issue. We aim to acknowledge within 72 hours.

Operational notes for deployers:

- The 4-letter lesson code is a session number, not a password. Expire rooms (for example after 7 days) in any real deployment.
- With Firebase, keep `.write` behind authentication (`auth != null`) and never commit `config.js`.
- Lesson packs are data. The renderer escapes all pack text; keep it that way when you add fields.

## Privacy by design

There is no child record to protect, because none is ever written:

- No child's name, photo, voice or individual choice is stored, sent or logged. The phone counts raised cards; the TV and the parent page only read.
- A room holds exactly three things: class totals per step, the story generated from those totals, and the teacher's class note (the only free text in the state).
- Room codes are not secrets. Anyone with the code can read the room, so think of it as a door number: fine to show on the TV, not a key to anything personal.
- The QR code on the TV waiting screen encodes only the room link (the same `#teacher-CODE` URL a teacher would type). Nothing else rides along.
- No analytics, no beacons. Apart from the sync backend you configure, the only outside request is for the web fonts.
- To erase a room: on the teacher phone, "Set up a new lesson with this code" overwrites it with an empty room (counts, story and note included). To remove it entirely, delete `rooms/CODE` in Firebase or the artifact store; with same-browser sync it lives only in that browser, under the `localStorage` key `emoren-classroom:room:CODE`, so clearing the site's data removes it.

---

아이 데이터는 설계상 저장하지 않습니다. 코드 없이 방을 읽거나 쓰는 방법, 방 사이 정보 유출, 수업팩을 통한 스크립트 실행 등을 발견하면 공개 이슈 대신 GitHub 보안 권고 양식으로 알려 주세요. 72시간 안에 답하는 것을 목표로 합니다.

설계로 지키는 개인정보 — 아이의 이름·사진·음성·개인 선택은 어디에도 저장·전송·기록하지 않습니다. 방에 남는 것은 단계별 반 전체 숫자, 그 숫자로 만든 이야기, 선생님의 반 메모뿐입니다. 수업 코드는 비밀이 아니라 교실 문패 같은 번호이고, TV의 QR에는 방 링크만 들어 있습니다. 분석 도구나 비콘은 없습니다. 방을 지우려면 강사 폰에서 '같은 코드로 새 수업 준비'를 누릅니다. 숫자·이야기·메모가 모두 빈 방으로 덮입니다. 완전히 없애려면 Firebase나 아티팩트 저장소의 `rooms/코드`를 삭제하면 되고, 같은 브라우저 동기화라면 그 브라우저의 사이트 데이터만 지우면 됩니다.
