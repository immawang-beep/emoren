# 캐릭터는 어떻게 생각하나 · How the character thinks

TV 속 캐릭터(조앤 / Joanne, 힐링이 / Healingi 같은 임시 캐릭터)가 **무엇을 근거로 무슨 말을 하는지** 그대로 적은 문서다. 영어 요약은 맨 아래.

**지금(v0.2)의 답: 모델이 아니라 규칙과 템플릿이다.** 아이가 듣는 모든 문장은 수업팩 JSON(`packs/<id>.<lang>.json`)에 사람이 미리 써 둔 글이고, 숫자가 들어가는 자리만 반 전체 집계로 채운다. 같은 숫자면 어느 교실에서나 같은 문장이 나온다. 형식은 [PACK-FORMAT.md](PACK-FORMAT.md).

## 1. 한 수업에서 실제로 일어나는 일

1. **강사 폰이 상태를 바꾼다.** 리듀서(`js/store.js`의 `actions`)가 방 JSON의 `phase`·`stepIndex`·`tallies`·`confirmed`·`timer`·`speakSeq`를 바꾸고 동기화 저장소에 쓴다. 캐릭터에게 "말하라"는 신호는 **`speakSeq`가 1 커지는 것**뿐이다. 시작·다음·이전·확정·다시 말하기·수업 마치기가 올리고, ＋/−(집계)는 올리지 않는다.
2. **TV가 상태를 받아 `render()`한다**(`js/views/tv.js`). 장면 키 `phase|stepIndex|packId|lang`가 바뀌면 장면을 다시 그리고, 대사 키 `장면키|speakSeq|확정여부`가 바뀌면 `say()`를 부른다. 집계는 대사 키를 건드리지 않으므로 막대와 숫자만 자라고 캐릭터는 조용히 기다린다.
3. **`say(lines, mood)`는 한 줄씩 간다.** 자막을 바꾸고 → 입을 움직이고(`startTalking`) → 기분을 2.5초 올리고(`setMood`) → `speak()`가 끝나길 기다렸다가 320 ms 쉬고 다음 줄. 새 `say()`가 오면 앞의 것은 토큰으로 끊긴다.
4. **무슨 말을 할지는 단계 유형과 상태가 정한다.**
   - 단계에 들어가면 `step.lines`를 차례로(talk·choice·activity·closing). 기분은 그대로, 입만 움직인다.
   - 선택 단계를 '확정'하면 `step.on_confirm`을 집계로 채운 문장. 기분 happy.
   - 이야기 단계는 `step.template`을 채운 문장. 기분 think. 화면에 글이 있으니 자막은 끈다.
   - 몸놀이 타이머가 0이 되면 `step.done_line`. 타이머 한 번에 한 번만(`stepId|startedAt` 키로 기억).
   - 수업을 마치면 `pack.outro`, 없으면 화면 문자열 `tv.outroDefault`.
   - 책 단계(v0.2)는 쪽마다 그 쪽에 적힌 글을 읽는다. 쪽 내용도 같은 집계에서 만든다.
   - 대기·일시정지·초기화 상태에서는 아무 말도 하지 않는다. 일시정지는 하던 말을 끊는다.

### 입력 → 캐릭터의 말과 행동

| 강사 폰에서 | 상태 변화 | TV·캐릭터 |
| --- | --- | --- |
| 수업 시작 | `phase: live`, `stepIndex: 0`, `speakSeq+1` | 1단계 장면, `lines`를 차례로 말한다 |
| 다음 / 이전 | `stepIndex ± 1`, `timer: null`, `speakSeq+1` | 새 단계 장면과 그 단계의 `lines` |
| ＋ / − | `tallies[step][option] ± 1` (0 아래로는 안 간다) | 막대와 숫자가 자라고 최다 칸에 `lead` 표시. 말은 없다 |
| 확정 → 캐릭터 반응 | `confirmed[step]: true`, `speakSeq+1` | `on_confirm` 문장, 두 번 통통(happy) |
| 타이머 시작 | `timer: { stepId, startedAt, seconds }` | 링이 줄고 남은 초가 보인다. 0이 되면 `done_line` |
| 잠깐 / 계속 | `phase: paused ↔ live` | 말을 끊고 "잠깐 쉬어요" 덮개 ↔ 그 단계 대사를 처음부터 |
| 다시 말하기 | `speakSeq+1` | 같은 대사를 다시 |
| 이야기 단계 진입 | `stepIndex` | `template` 문장을 화면에 띄우고 읽는다(think) |
| 수업 마치기 | `phase: done`, `endedAt` | "오늘 수업 끝" 장면과 숫자 칩, `outro` |
| 같은 코드로 새 수업 준비 | `newRoom()` | 대기 화면. 침묵 |

### 템플릿 변수 — `storyVars(pack, state)`가 만드는 전부

모든 선택(choice) 단계를 훑어 만든다. 선택 단계 id가 `weather`, 선택지가 `sunny`·`cloudy`·`rainy`·`stormy`라면:

| 변수 | 값 | 예 (ko / en) |
| --- | --- | --- |
| `{sunny}` — 선택지 id마다 하나 | 그 선택지의 개수(숫자) | `3` |
| `{weather_total}` | 그 단계의 합계 | `6` |
| `{weather_list}` | 0이 아닌 선택지만 `list_item` 꼴로 `, `로 이어 붙인다. 아무도 없으면 `list_empty` | `해님 3명, 구름 2명, 비 1명` / `3 Sunny, 2 Cloudy, 1 Rainy` |
| `{weather_lead}` | 가장 많은 선택지의 이름. 동률이면 먼저 적힌 것, 아무도 없으면 빈 문자열 | `해님` / `Sunny` |
| `{class}` | 팩의 `class_name` (기본 "우리 반" / "our class") | |

문법(`renderTemplate`): `{변수}`는 치환하고, `[[변수: 내용]]`은 변수가 0이거나 빈 문자열이면 통째로 빠진다. 모르는 `{변수}`는 일부러 그대로 남겨 오타가 눈에 보이게 한다. 선택 단계가 둘이면 변수도 두 벌(`{mood_list}`, `{signal_lead}` …) 생긴다. 이야기 단계와 책 단계, 보호자 페이지는 **같은 변수**로 글을 만들므로 셋이 서로 다른 숫자를 말할 수 없다.

### 예: 해님 3, 구름 2, 비 1, 천둥 0일 때

「오늘의 마음 날씨」의 `on_confirm` 템플릿은 이렇다.

> 오늘 우리 반 하늘에는 {weather_list}이 있구나. [[rainy: 비 친구들, 괜찮아. 비가 와야 꽃도 자라.]] [[stormy: 천둥 친구들, 화나는 마음도 말해 줘서 고마워.]] 어떤 날씨든 다 소중한 내 마음이야!

선생님이 '확정'을 누르면 `{weather_list}`에 "해님 3명, 구름 2명, 비 1명"이 들어가고, 천둥이 0이라 `[[stormy: …]]`는 통째로 빠진다. 캐릭터가 하는 말:

> 오늘 우리 반 하늘에는 해님 3명, 구름 2명, 비 1명이 있구나. 비 친구들, 괜찮아. 비가 와야 꽃도 자라. 어떤 날씨든 다 소중한 내 마음이야!
>
> (en) Today our class sky has 3 Sunny, 2 Cloudy, 1 Rainy. Rainy friends, that's okay. Flowers need rain to grow. Every kind of weather is a feeling, and every feeling matters!

같은 숫자로 이야기 단계는 `{weather_lead}` = "해님"을 써서 "그중에서 해님이 제일 많았지요."라고 읽는다. 단위 테스트가 이 값들을 실제 `storyVars` 결과와 맞춰 본다.

### 기분과 목소리

- 기분은 `idle | talk | happy | think` 넷뿐이다(`js/ui/character.js`의 `data-mood`, 표정과 움직임은 `css/app.css`). `talk`는 말하는 동안 입이 움직이는 것, `happy`는 두 번 통통 튀기, `think`는 눈이 옆으로. 2.5초가 지나면 `idle`로 돌아온다.
- 목소리는 브라우저 음성 합성이다(`js/ui/speech.js`). 팩 언어(`ko` → `ko-KR`, `en` → `en-US`)에 맞는 목소리를 선호 목록에서 고르고, 팩의 `character.voice { rate, pitch }`를 쓴다. 브라우저는 사람이 한 번 눌러야 소리를 내므로 TV 대기 화면에 '소리 켜기' 버튼이 있다.
- 소리를 못 낼 때(또는 아직 안 눌렀을 때)는 자막만 **글자 수만큼**의 시간 동안 보여 준다: `700 ms + 글자 수 × 115 ms`(영어는 70 ms), 최대 9초. 음성이 끝났다는 신호를 주지 않는 브라우저를 위해 같은 길이 기준의 안전장치가 하나 더 있다. 그래서 소리가 없어도 수업의 리듬은 같다.

## 2. 왜 결정론부터인가

- **모든 문장을 사람이 썼고 사람이 읽었다.** 팩은 PR에서 사람이 읽고, `npm run packs:check`(`tools/packs-check.mjs`)가 형식과 금지어를 본다. 캐릭터가 즉석에서 지어낸 문장은 하나도 없다.
- **어느 교실에서나 같다.** 같은 숫자 → 같은 문장. 그래서 단위 테스트로 못 박을 수 있다(`tests/unit/store.test.mjs`).
- **오프라인에서도 돈다.** 서비스워커가 팩까지 캐시하므로 교실 와이파이가 끊겨도 TV는 말을 이어 간다.
- **아이에 관한 것은 방을 떠나지 않는다.** 캐릭터의 입력은 반 전체 숫자뿐이고, 그 숫자조차 동기화 저장소 말고는 어디로도 가지 않는다.
- **기다림이 없다.** 탭 → 1초 안에 TV. 외부 호출의 지연과 실패가 수업 리듬을 깨지 않는다.

## 3. 언젠가 LLM 어댑터를 붙인다면 — 가드레일

캐릭터에 모델을 꽂는 일은 "더 좋은 한 줄을 **제안**하는 선택 기능"이어야 한다. 모델이 없거나 늦으면 지금 그대로 돌아가야 하고, 수업이 모델 때문에 멈추는 구조는 안 된다. 어댑터 PR은 아래 여섯 가지를 전부 만족해야 한다.

1. **관찰 언어만.** 아이의 상태에 이름표를 붙이거나, 아이를 가려내거나, 고치려 들거나, 등급·순위를 매기거나, 어떤 마음을 "문제"라고 부르는 문장은 생성되더라도 버린다. 날씨는 날씨일 뿐이다. 점검표: ① 문장의 주어가 "우리 반"이지 한 아이가 아닌가 ② 묻고 기다리는가 ③ 칭찬·꾸중 대신 고마움인가 ④ 이름이 없는가 ⑤ `tools/packs-check.mjs`의 금지어 목록을 **런타임에도** 통과하는가 — 팩을 거르는 그 목록을 생성 문장에 그대로 돌리고, 걸리면 템플릿 문장으로 간다.
2. **아이 데이터는 보내지 않는다.** 어댑터가 받을 수 있는 입력은 네 가지뿐이다: 팩 JSON(사람이 쓴 글), 현재 단계, 반 전체 집계 `{ [optionId]: n }`, 언어. 이름·사진·음성·개인 선택은 애초에 상태에 없고, **반 메모(`notes`)도 보내지 않는다**(자유 텍스트라 이름이 섞일 수 있다). 기기 식별자와 방 코드도 필요 없다.
3. **사전 검수 대사만 음성으로.** 두 길 중 하나다.
   - (a) **허용 목록·슬롯**: 모델은 사람이 쓴 문장 목록에서 id를 고르거나 숫자 슬롯만 채운다. 음성으로 나가는 글자는 전부 사람이 쓴 것이다.
   - (b) **선생님 승인**: 자유 생성 문장은 먼저 강사 폰에 뜨고, 선생님이 탭해야 TV가 말한다. 상태에는 자유 텍스트를 넣을 수 없으므로(`notes[].text`만 예외) 승인은 `{ stepId, seed, hash }` 같은 숫자·id로만 기록하고, TV는 같은 입력과 seed로 같은 문장을 다시 만들어 hash가 맞을 때만 말한다.
4. **결정론 폴백.** 어댑터가 1.5초 안에 답하지 않거나, 오프라인이거나, 금지어에 걸리면 지금의 템플릿 문장을 말한다. 아이 쪽에서 느끼는 차이는 "조금 덜 재치 있다" 정도여야 한다.
5. **로그에 아이 관련 내용이 없게.** 남겨도 되는 것: `packId`, `stepId`, `lang`, 집계 숫자, 지연 시간, `source`. 남기면 안 되는 것: 반 메모, 방 코드와 시각을 묶어 교실을 특정할 수 있는 조합, 프롬프트 전문.
6. **인터페이스와 꽂는 자리.**

```js
// 어댑터는 함수 하나다. 없거나 늦으면 부르는 쪽이 템플릿으로 간다.
//   pack    수업팩 JSON 그대로(사람이 쓴 글)     step   현재 단계 객체
//   counts  { [optionId]: n } 반 전체 집계        lang   'ko' | 'en'
//   →  { line: '…', source: 'template' | 'allowlist' | 'model' }
export async function suggestLine({ pack, step, counts, lang }) { /* … */ }
```

꽂는 자리는 두 곳이다. TV 쪽은 `js/views/tv.js`의 `render()`에서 `say()`에 넘길 문장을 고르는 세 줄(확정·이야기·단계 입장) — 여기서 `suggestLine()`을 기다리되 시간 제한을 두고 `renderTemplate()`로 떨어진다. 강사 폰 쪽은 (b)를 위한 승인 UI와 `actions.approve(stepId, seed, hash)` 같은 리듀서 하나. 어댑터가 없을 때 두 화면의 동작은 지금과 글자 하나 다르지 않아야 하며, e2e 시나리오(`tests/e2e/lesson-ko.e2e.mjs`, `lesson-en.e2e.mjs`)가 그것을 지킨다.

---

## English summary

**Today the character is rules and templates, not a model.** Every sentence a child hears was written by a person in the lesson pack (`packs/<id>.<lang>.json`, see [PACK-FORMAT.md](PACK-FORMAT.md)); only the number slots are filled from class-level counts, so the same numbers give the same sentence in every classroom.

**What happens.** The teacher phone changes the room JSON through the reducers in `js/store.js`; the only "speak" signal is `speakSeq` going up (start, next/prev, confirm, say-again, finish — tallies do not touch it, so bars grow silently). The TV (`js/views/tv.js`) redraws when the scene key `phase|stepIndex|packId|lang` changes and calls `say()` when `sceneKey|speakSeq|confirmed` changes. `say()` goes line by line: caption, mouth animation, mood for 2.5 s, wait for `speak()`, 320 ms pause. What is said: the step's `lines` on entry; `renderTemplate(step.on_confirm, vars)` on confirm (mood `happy`); `renderTemplate(step.template, vars)` in the story step (`think`, caption hidden because the text is on screen); `done_line` when the activity timer reaches zero (once per timer); `pack.outro` when the lesson ends; nothing while waiting, paused or reset.

**Variables** (`storyVars`): for every choice step `<step>` with options `<opt>`: `{<opt>}` (count), `{<step>_total}`, `{<step>_list}` (non-zero options as `list_item`, joined with ", ", or `list_empty`), `{<step>_lead}` (label of the largest count; the earlier option wins ties; empty when nobody chose), plus `{class}` (`class_name`). `[[var: text]]` drops the whole bracket when the variable is 0 or empty; unknown `{vars}` stay visible on purpose. The story step, the class book and the family page all use the same variables.

**Moods** are `idle | talk | happy | think` (`js/ui/character.js`). **Voice** is browser speech synthesis in the pack language with the pack's `character.voice { rate, pitch }` (`js/ui/speech.js`); without a voice the caption is shown for `700 ms + chars × 115 ms` (en: 70 ms), capped at 9 s, so the lesson keeps the same rhythm.

**Why deterministic first:** every line was written and reviewed by a human and linted (`npm run packs:check`); the same numbers give the same sentence everywhere, so it is unit-testable (`tests/unit/store.test.mjs`); it works offline; nothing about children leaves the room; no latency.

**Guardrails for a future LLM adapter** (an optional "suggest a better line" feature, never a dependency): (1) observational language only — never label, sort, rank or "fix" a child and never call a feeling a problem; the pack lint from `tools/packs-check.mjs` runs on generated text at runtime too. (2) No child data is ever sent — the adapter receives only the pack text, the current step, class-level counts and the language; never names, photos, audio, an individual child's choice, or the class note. (3) Only pre-approved lines reach the voice: either an allow-list / template slots written by people, or the teacher taps the suggestion on the phone before the TV speaks it (recorded in state as `{ stepId, seed, hash }`, never as free text; the TV regenerates and speaks only when the hash matches). (4) Deterministic fallback when the adapter is slow (> 1.5 s), offline or rejected by the lint. (5) Logs hold nothing from children. (6) Interface sketch: `suggestLine({ pack, step, counts, lang }) → { line, source }`, hooked in where `render()` in `js/views/tv.js` picks the sentence for `say()`, plus an approval UI and one reducer on the teacher phone. With no adapter, both screens must behave exactly as today — the e2e scenarios guard that.
