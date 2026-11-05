[한국어 원문 · Korean original: docs/PACK-FORMAT.md](PACK-FORMAT.md)

# Lesson pack format

A lesson pack is **one file per language**, `packs/<id>.<lang>.json` (for example `packs/mind-weather.ko.json` and `packs/mind-weather.en.json`). A new lesson is a new JSON file; no code changes.
`<lang>` is a short BCP-47 code (`ko`, `en`) and must equal the `lang` value inside the file. If the shape is wrong, loading fails with a message in Korean and English that says exactly what is wrong (`validatePack` in `js/pack.js`).

## Per-language files and the index

- Language editions of the same `id` must have **the same step `id`s, the same option `id`s, and the same step order and types**. The room state (the tallies) is recorded by id only, so the numbers line up no matter which language a class used.
- A translation is not a word-for-word rendering. Write **what the character would actually say to four- and five-year-olds in that language**. Titles and option names should sound natural in that language too.
- When you add a pack (or a new language edition), add it to `packs/index.json`. The home-screen list and the teacher phone's pack and language pickers read this index.

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

- `loadPack(id, lang)` reads `packs/<id>.<lang>.json`; if that language does not exist it falls back to the first language listed for the pack in the index.
- When the teacher phone creates a room it picks the pack in the **device's UI language** (or the first language if there is none). When there is more than one choice, the teacher card on the home screen lets you pick pack and language.
- The room state stores `lang`, and the on-screen text (buttons, hints) on the TV and the family page follows that lesson language.

## Top-level keys

| Key | Meaning |
| --- | --- |
| `id` | Same as the first part of the file name: lowercase letters, digits and hyphens |
| `lang` | **Required.** The language of this file (`ko`, `en`). Must match `<lang>` in the file name |
| `title` | Lesson name. Shown as-is on the TV, the teacher phone and the family page |
| `domain`, `age`, `minutes` | Area, target age, lesson length in minutes |
| `goal` | One-sentence goal. Shown on the teacher phone's waiting screen |
| `materials` | List of things to prepare |
| `character` | `{ name, color, voice: { rate, pitch } }`. Name, colour and voice of the placeholder character |
| `steps` | Array of steps. See below |
| `outro` | What the character says once the lesson is over (array) |
| `home` | Family page: `{ title, tips: [...], note }` |
| `list_item` | Optional. The shape of one item in `{weather_list}`; uses `{label}` and `{n}`. Defaults: ko `"{label} {n}명"`, en `"{n} {label}"` |
| `list_empty` | Optional. `{weather_list}` when nobody chose anything. Defaults: ko `"조용한 하늘"`, en `"a quiet sky"` |
| `class_name` | Optional. What `{class}` expands to. Defaults: ko `"우리 반"`, en `"our class"` |

If `list_item`, `list_empty` or `class_name` is left out, the default for the pack's `lang` is used (`PACK_TEXT_DEFAULTS` in `js/store.js`). A language without defaults falls back to the English ones.

## The six step types

Common to every step: `id` (unique within the pack), `type`, `title` (top of the teacher phone and the TV), `cue` (one or two sentences on what the teacher does), `heading` (the big text on the TV; `title` if missing), `lines` (what the character says when the step starts; array).

| type | What it does | Required keys |
| --- | --- | --- |
| `talk` | The character talks | `lines` |
| `choice` | Children choose and the teacher counts. Bars grow on the TV. On **Confirm** the character says `on_confirm` | `prompt`, `options` (2 or more: `{ id, label, emoji, color, hint }`), `on_confirm` |
| `activity` | Movement game: a timer and move cards | `timer_sec`, `moves` (`{ emoji, text }`), `done_line` (said when the timer ends) |
| `story` | Reads a story built from today's numbers | `template` |
| `book` | **Our Class Book.** The TV turns into a picture book whose pages are built from the room state (see below) | `title`; optional `cue`, `cover_line`, `back_line` (one-line strings). One per pack, placed right before `closing` |
| `closing` | Goodbye. Today's number chips on the TV | `lines` |

### The `book` step

```json
{
  "id": "book",
  "type": "book",
  "title": "Our Class Book",
  "cue": "The TV turns into a picture book of what our class made today and reads it page by page. When it's done, tap Next.",
  "cover_line": "Here is the book our class made today.",
  "back_line": "Our class made this together."
}
```

The pack carries only the title, the teacher cue and one line each for the front and back cover. Every page is generated from the room state at that moment:

1. **Cover** — the lesson title and the date, no names. The character reads `cover_line`.
2. **One page per `choice` step** — the step's prompt, with one emoji stamp for every child counted under each option.
3. **Activity page** — the moves from the `activity` step.
4. **Story page** — the `story` template, filled with today's numbers.
5. **Back cover** — `back_line` ("Our class made this together").

Pages turn by themselves while the character reads them, and the teacher phone has previous / next page buttons. The family page shows the same book as a vertical scroll. The validator allows one `book` step per pack; put it right before `closing` so the book is the last thing the class sees before goodbye. Because the pages come from class totals only, the book never contains an individual child's choice.

## Template syntax

Used in `on_confirm` and `template`. Variables are built from a choice step's `id` and its option `id`s. With a choice step `weather` and an option `sunny`:

| Write | Result |
| --- | --- |
| `{sunny}` | How many chose Sunny |
| `{weather_total}` | Total for that step |
| `{weather_list}` | Only the non-zero options, each in `list_item` shape, joined: ko "해님 3명, 구름 2명" / en "3 Sunny, 2 Cloudy". `list_empty` when nobody chose |
| `{weather_lead}` | Label of the most-chosen option (empty string if none) |
| `{class}` | `class_name` (ko "우리 반" / en "our class") |
| `[[rainy: Rainy friends, that's okay.]]` | Dropped entirely when `rainy` is 0 |

## Writing lines for ages 4–5

- One line, one breath. About fifteen Korean characters, or a short English sentence of around ten words; no more than four lines per step.
- Ask, then wait. After "…?" or "Shall we…?", write as if the teacher has time to take the children's answers before the next line.
- Don't grade. Instead of "Good job" / "That's wrong", say "Thank you for telling me" or "I see".
- Use observational language. Say what you can see and hear; never sort, grade or label a child, and keep clinical or medical words out of anything a child hears or a family reads. A weather is a weather — it says nothing about who a child is.
- No names. The only record is the class totals and the story.

## Writing the English edition

- Same principles in English: one breath per line, ask and wait, no grading ("Thank you for telling me" instead of "Good job"), observational language, no names.
- Plain words a four-year-old already knows. Contractions are fine ("I'm", "let's"); idioms are not.
- Option labels appear in big type on the TV. Use a single word (Sunny / Cloudy / Rainy / Stormy).
- Keep `list_item` as `"{n} {label}"` for English word order, so the list reads "3 Sunny, 2 Cloudy".

## Checking packs: `npm run packs:check`

`npm run packs:check` (`tools/packs-check.mjs`) looks at every file under `packs/` and fails with a reason when something is off. It also runs in CI. It checks that:

- every pack passes `validatePack`, the same check the app runs when it loads a pack;
- language editions of the same `id` share step ids, step types, step order and option ids;
- every `{var}` and `[[var: …]]` in `on_confirm` and `template` resolves to a real choice step or option (`{sunny}`, `{weather_total}`, `{weather_list}`, `{weather_lead}`, `{class}`), so no placeholder ever reaches the TV;
- `packs/index.json` matches the files on disk: every pack and language on disk is listed, nothing listed is missing, and the index's `title` matches the pack's;
- the pack text passes an observational-language lint, which flags words that sort, grade or label a child (the words ruled out by the hard constraints in `docs/HANDOVER-v0.2.md`).

Run it after editing any pack, before you commit.

## Example

`packs/mind-weather.ko.json` (오늘의 마음 날씨) and `packs/mind-weather.en.json` (Mood Weather) use all six types. Copy one of them to start.
