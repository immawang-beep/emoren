# 수업팩 형식

수업팩은 **언어마다 한 장**, `packs/<id>.<lang>.json` 이다(예: `packs/mind-weather.ko.json`, `packs/mind-weather.en.json`). 코드를 건드리지 않고 JSON만 바꿔 새 수업을 만든다.
`<lang>`은 BCP-47 짧은 코드(`ko`, `en`)이고, 파일 안의 `lang` 값과 같아야 한다. 형식이 틀리면 불러올 때 어디가 틀렸는지 한국어·영어로 알려 준다(`js/pack.js`의 `validatePack`).

## 언어별 파일과 색인

- 같은 `id`의 언어판들은 **단계 `id`, 선택지 `id`, 단계 순서와 유형이 같아야** 한다. 방 상태(집계)는 id로만 기록되므로 언어가 달라도 숫자가 그대로 맞는다.
- 번역은 직역이 아니라 **그 언어로 만 4~5세에게 캐릭터가 실제로 할 말**로 쓴다. 제목·선택지 이름도 그 언어에서 자연스러운 말로.
- 새 팩(또는 새 언어판)을 만들면 `packs/index.json`에 적는다. 홈 화면 목록과 강사 폰의 팩·언어 선택이 이 색인을 읽는다.

```json
{
  "packs": [
    {
      "id": "mind-weather",
      "langs": {
        "ko": { "title": "오늘의 마음 날씨", "domain": "정서 알아차리기", "age": "만 4~5세", "minutes": 15 },
        "en": { "title": "Mood Weather", "domain": "Noticing feelings", "age": "Ages 4–5", "minutes": 15 }
      }
    }
  ]
}
```

- `loadPack(id, lang)`은 `packs/<id>.<lang>.json`을 읽고, 그 언어가 없으면 색인에 적힌 첫 번째 언어로 대신한다.
- 강사 폰은 방을 만들 때 **기기 UI 언어**로 된 팩을 고른다(없으면 첫 언어). 선택지가 둘 이상이면 홈 화면 강사 카드에서 팩·언어를 고를 수 있다.
- 방 상태에 `lang`이 저장되고, TV와 보호자 페이지의 화면 글(버튼·안내)은 그 수업 언어를 따른다.

## 맨 위

| 키 | 뜻 |
| --- | --- |
| `id` | 파일 이름 앞부분과 같은 영문 소문자·숫자·하이픈 |
| `lang` | **필수.** 이 파일의 언어(`ko`, `en`). 파일 이름의 `<lang>`과 같게 |
| `title` | 수업 이름. TV와 강사 폰, 보호자 페이지에 그대로 보인다 |
| `domain`, `age`, `minutes` | 영역, 대상 연령, 수업 길이(분) |
| `goal` | 한 문장 목표. 강사 폰 대기 화면에 보인다 |
| `materials` | 준비물 목록 |
| `character` | `{ name, color, voice: { rate, pitch } }`. 임시 캐릭터의 이름·색·목소리 |
| `steps` | 단계 배열. 아래 참고 |
| `outro` | 수업이 끝났을 때 캐릭터가 하는 말(배열) |
| `home` | 보호자 페이지: `{ title, tips: [...], note }` |
| `list_item` | 선택. `{weather_list}`의 한 항목 꼴. `{label}`, `{n}`을 쓴다. 기본값 ko `"{label} {n}명"`, en `"{n} {label}"` |
| `list_empty` | 선택. 아무도 고르지 않았을 때의 `{weather_list}`. 기본값 ko `"조용한 하늘"`, en `"a quiet sky"` |
| `class_name` | 선택. `{class}`에 들어가는 말. 기본값 ko `"우리 반"`, en `"our class"` |

`list_item`·`list_empty`·`class_name`을 생략하면 팩의 `lang`에 따른 기본값을 쓴다(`js/store.js`의 `PACK_TEXT_DEFAULTS`). 기본값에 없는 언어는 영어 기본값으로 떨어진다.

## 단계 유형 6가지

모든 단계에 공통: `id`(단계 안에서 유일), `type`, `title`(강사 폰·TV 상단), `cue`(선생님 할 일 한두 문장), `heading`(TV 큰 글씨, 없으면 `title`), `lines`(캐릭터가 단계 시작에 하는 말, 배열).

| type | 하는 일 | 꼭 필요한 키 |
| --- | --- | --- |
| `talk` | 캐릭터가 말한다 | `lines` |
| `choice` | 아이들이 고르고 선생님이 센다. TV에 막대가 자란다. '확정'하면 캐릭터가 `on_confirm`을 말한다 | `prompt`, `options`(2개 이상: `{ id, label, emoji, color, hint }`), `on_confirm` |
| `activity` | 몸놀이. 타이머와 동작 카드 | `timer_sec`, `moves`(`{ emoji, text }`), `done_line`(타이머가 끝나면 하는 말) |
| `story` | 오늘 숫자로 만든 이야기를 읽어 준다 | `template` |
| `book` | 「오늘 우리 반 책」. TV가 그림책이 되어 표지(수업 이름·날짜) → 선택 단계마다 한 쪽(집계 수만큼 이모지 스탬프) → 몸놀이 → 오늘 이야기 → 뒤표지를 캐릭터가 읽으며 저절로 넘긴다. 강사 폰에서 이전·다음 쪽. 보호자 페이지에도 같은 책이 세로로 실린다 | `title` (선택: `cover_line`, `back_line`) |
| `closing` | 마무리 인사. TV에 오늘 숫자 칩 | `lines` |

`book`은 한 팩에 하나만, 마무리(`closing`) 바로 앞에 둔다. 쪽의 내용은 전부 방 상태(집계·이야기)에서 만들어지므로 팩에는 제목과 앞·뒤표지 한 줄만 적는다.
`cover_line`·`back_line`을 생략하면 팩 언어의 기본 문구를 쓴다. 선택 쪽의 문장은 `{단계id_list}`와 같은 목록(`list_item`·`list_empty` 설정 그대로)으로 만들어진다. 이름은 어디에도 들어가지 않는다.

## 템플릿 문법

`on_confirm`과 `template`에서 쓴다. 변수는 선택 단계 `id`와 선택지 `id`로 만들어진다. 선택 단계 id가 `weather`, 선택지가 `sunny`라면:

| 쓰기 | 결과 |
| --- | --- |
| `{sunny}` | 해님 개수 |
| `{weather_total}` | 그 단계 합계 |
| `{weather_list}` | 0이 아닌 것만 `list_item` 꼴로 이어 붙인다: ko "해님 3명, 구름 2명" / en "3 Sunny, 2 Cloudy". 비면 `list_empty` |
| `{weather_lead}` | 가장 많은 선택지 이름(없으면 빈 문자열) |
| `{class}` | `class_name`(ko "우리 반" / en "our class") |
| `[[rainy: 비 친구들, 괜찮아.]]` | `rainy`가 0이면 통째로 빠진다 |

## 만 4~5세 대사를 쓸 때

- 한 줄은 한 호흡. 열다섯 글자 안팎, 한 단계에 네 줄을 넘기지 않는다.
- 묻고 기다린다. "~일까?", "~해 볼까?" 다음에는 선생님이 아이들 반응을 받을 시간이 있다고 생각하고 쓴다.
- 평가하지 않는다. "잘했어/틀렸어" 대신 "말해 줘서 고마워", "그랬구나".
- 관찰 언어로 쓴다. 진단·검사·치료 같은 말은 쓰지 않는다. 날씨는 날씨일 뿐, 아이의 상태를 판정하지 않는다.
- 이름을 넣지 않는다. 기록은 반 전체 숫자와 이야기뿐이다.

## 영어판을 쓸 때

- 영어도 같은 원칙: 한 줄 한 호흡, 묻고 기다리기, 평가하지 않기("Good job" 대신 "Thank you for telling me"), 관찰 언어, 이름 없음.
- 선택지 이름은 TV에 큰 글씨로 뜬다. 한 단어(Sunny / Cloudy / Rainy / Stormy)로.
- `list_item`은 영어 어순에 맞춰 `"{n} {label}"`로 두면 "3 Sunny, 2 Cloudy"가 된다.

## 예시

`packs/mind-weather.ko.json`(오늘의 마음 날씨)과 `packs/mind-weather.en.json`(Mood Weather)이 여섯 유형을 전부 쓴다. 복사해서 시작하면 된다.
