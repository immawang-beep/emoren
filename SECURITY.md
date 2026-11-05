# Security · 보안

emoren-classroom stores no child data by design: a lesson room holds class-level counts, a templated story and the teacher's class note, keyed by a short lesson code.

If you find a way to read or write a room you were not given the code for, to leak data between rooms, to execute script through a lesson pack, or anything else that could expose a classroom, please report it privately through GitHub's security advisory form for this repository rather than a public issue. We aim to acknowledge within 72 hours.

Operational notes for deployers:

- The 4-letter lesson code is a session number, not a password. Expire rooms (for example after 7 days) in any real deployment.
- With Firebase, keep `.write` behind authentication (`auth != null`) and never commit `config.js`.
- Lesson packs are data. The renderer escapes all pack text; keep it that way when you add fields.

---

아이 데이터는 설계상 저장하지 않습니다. 코드 없이 방을 읽거나 쓰는 방법, 방 사이 정보 유출, 수업팩을 통한 스크립트 실행 등을 발견하면 공개 이슈 대신 GitHub 보안 권고 양식으로 알려 주세요. 72시간 안에 답하는 것을 목표로 합니다.
