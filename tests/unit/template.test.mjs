// 단위 테스트: 이야기 템플릿 엔진(renderTemplate)과 변수 생성(storyVars, leadOption, summaryOf, packText). 실행: npm test
// Unit tests for the story template engine and its variable builders. Uses tiny inline packs, no files.
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderTemplate, storyVars, leadOption, summaryOf, packText, PACK_TEXT_DEFAULTS, newRoom, actions } from '../../js/store.js';

// 선택 단계 두 개 + 선택이 아닌 단계들로 된 작은 팩 / a tiny pack with two choice steps and some non-choice steps
const twoChoice = (lang = 'ko') => ({
  id: 'tiny',
  lang,
  title: 'tiny',
  steps: [
    { id: 'hello', type: 'talk', lines: ['안녕'] },
    {
      id: 'weather', type: 'choice', prompt: '?', on_confirm: '',
      options: [{ id: 'sunny', label: '해님' }, { id: 'rainy', label: '비' }],
    },
    { id: 'move', type: 'activity', timer_sec: 10, moves: [], done_line: '끝' },
    {
      id: 'body', type: 'choice', prompt: '?', on_confirm: '',
      options: [{ id: 'light', label: '가벼움' }, { id: 'heavy', label: '무거움' }, { id: 'warm', label: '따뜻함' }],
    },
    { id: 'story', type: 'story', template: '{weather_list} / {body_list}' },
    { id: 'bye', type: 'closing', lines: ['안녕'] },
  ],
});

const tally = (room, stepId, counts) => {
  let s = room;
  for (const [id, n] of Object.entries(counts)) s = actions.tally(s, stepId, id, n);
  return s;
};

// ---------- renderTemplate ----------

test('템플릿: 아는 {변수}만 바꾸고 모르는 {변수}는 글자 그대로 남긴다', () => {
  assert.equal(renderTemplate('{a} and {nope}', { a: 'A' }), 'A and {nope}');
  assert.equal(renderTemplate('{a}{a}', { a: 1 }), '11', '같은 변수를 여러 번 써도 모두 바뀐다');
  assert.equal(renderTemplate('{weather-lead}', { 'weather-lead': 'x' }), '{weather-lead}', '변수 이름은 글자·숫자·_ 만(\\w)');
  assert.equal(renderTemplate(null, {}), '', 'null 템플릿은 빈 문자열');
  assert.equal(renderTemplate(undefined, {}), '');
  assert.equal(renderTemplate(7, {}), '7', '문자열이 아니면 String()으로 바꾼다');
});

test('템플릿: 조건문 [[k: …]]은 0 / 빈 문자열 / null / undefined / false 이면 통째로 빠진다', () => {
  const vars = { zero: 0, empty: '', nul: null, undef: undefined, no: false };
  for (const k of Object.keys(vars)) {
    assert.equal(renderTemplate(`a [[${k}: hidden]] b`, vars), 'a b', `${k} → 빠짐`);
  }
  assert.equal(renderTemplate('a [[missing: hidden]] b', vars), 'a b', '변수 자체가 없어도 빠진다');
  assert.equal(renderTemplate('[[zero:]]x', vars), 'x', '내용이 비어 있어도 문법은 성립한다');
});

test('템플릿: 조건문은 0보다 큰 숫자 / 비어 있지 않은 문자열 / true 이면 남는다', () => {
  const vars = { one: 1, many: 42, frac: 0.5, str: '해님', yes: true };
  assert.equal(renderTemplate('[[one: 하나]]', vars), '하나');
  assert.equal(renderTemplate('[[many: 많이]]', vars), '많이');
  assert.equal(renderTemplate('[[frac: 조금]]', vars), '조금');
  assert.equal(renderTemplate('[[str: 글]]', vars), '글');
  assert.equal(renderTemplate('[[yes: 참]]', vars), '참');
  // 실제 동작 기록 / actual behaviour, documented:
  assert.equal(renderTemplate('[[neg: 음수]]', { neg: -1 }), '', '음수는 숫자 규칙(> 0)으로 빠진다');
  assert.equal(renderTemplate('[[zs: 영]]', { zs: '0' }), '영', "문자열 '0'은 비어 있지 않으므로 남는다");
  assert.equal(renderTemplate('[[arr: 배열]]', { arr: [] }), '배열', '빈 배열은 객체라 truthy → 남는다(집계 변수에는 없는 경우)');
});

test('템플릿: 붙어 있는 조건문과 여러 조건문이 각각 따로 판단된다', () => {
  const vars = { a: 1, b: 0, c: 'x', d: '' };
  // 콜론 뒤의 빈칸은 내용의 일부다(' A' + ' C' → 'A C') / the space after the colon belongs to the inner text
  assert.equal(renderTemplate('[[a: A]][[b: B]][[c: C]][[d: D]]', vars), 'A C');
  assert.equal(renderTemplate('[[a:A]][[b:B]][[c:C]][[d:D]]', vars), 'AC', '빈칸 없이 쓰면 붙는다');
  assert.equal(renderTemplate('시작 [[a: 하나]] [[b: 둘]] [[c: 셋]] 끝', vars), '시작 하나 셋 끝');
  assert.equal(renderTemplate('[[b: 둘]][[a: 하나]]', vars), '하나');
});

test('템플릿: 줄바꿈을 품은 조건문도 통째로 남거나 통째로 빠진다', () => {
  assert.equal(renderTemplate('[[a: 첫 줄\n둘째 줄]] 끝', { a: 1 }), '첫 줄\n둘째 줄 끝');
  assert.equal(renderTemplate('앞 [[a: 첫 줄\n둘째 줄]] 뒤', { a: 0 }), '앞 뒤');
  assert.equal(renderTemplate('앞\n[[a: 가운데]]\n뒤', { a: 0 }), '앞\n\n뒤', '조건문만 빠지고 줄바꿈은 손대지 않는다');
});

test('템플릿: 남은 조건문 안의 {변수}도 바뀐다', () => {
  const vars = { rainy: 2, weather_lead: '해님', zero: 0 };
  assert.equal(renderTemplate('[[rainy: 비 {rainy}명, 제일 많은 건 {weather_lead}]]', vars), '비 2명, 제일 많은 건 해님');
  assert.equal(renderTemplate('[[rainy: {unknown} 그대로]]', vars), '{unknown} 그대로');
  assert.equal(renderTemplate('[[zero: {rainy}]]x', vars), 'x', '빠진 조건문 안의 변수는 아예 나오지 않는다');
});

test('템플릿: 빈칸 정리는 공백·탭 연속만 하나로 줄이고 줄바꿈은 남긴다', () => {
  assert.equal(renderTemplate('a   b', {}), 'a b');
  assert.equal(renderTemplate('a\t\tb', {}), 'a b');
  assert.equal(renderTemplate('a \t  b', {}), 'a b');
  assert.equal(renderTemplate('a\n\nb', {}), 'a\n\nb', '빈 줄은 그대로');
  assert.equal(renderTemplate('a \n b', {}), 'a \n b', '줄바꿈 앞뒤의 공백 하나는 그대로');
  assert.equal(renderTemplate('  양끝  ', {}), '양끝', '앞뒤는 잘라 낸다');
  assert.equal(renderTemplate('a  b', {}), 'a  b', '줄바꿈 없는 공백(NBSP)은 건드리지 않는다');
});

test('템플릿: 마침표·쉼표·느낌표·물음표 앞의 빈칸은 지우고, 한국어·전각 문장부호는 건드리지 않는다', () => {
  assert.equal(renderTemplate('a . b , c ! d ?', {}), 'a. b, c! d?');
  assert.equal(renderTemplate('[[x: 비!]] . 끝', { x: 0 }), '. 끝', '조건문이 빠져 생긴 빈칸도 정리된다');
  // 실제 동작 기록: \s+ 라서 줄바꿈도 문장부호 앞에서는 사라진다 / newline before . , ! ? is removed too
  assert.equal(renderTemplate('a\n.', {}), 'a.');
  assert.equal(renderTemplate('x\n{list}\n.', { list: 'L' }), 'x\nL.');
  // 전각·한국어 문장부호는 목록에 없으므로 그대로 / '。' '…' '、' '！' '？' are not in the list, untouched
  assert.equal(renderTemplate('a 。 b … c', {}), 'a 。 b … c');
  assert.equal(renderTemplate('a 、 b ！ c ？', {}), 'a 、 b ！ c ？');
  assert.equal(renderTemplate('괜찮아 …', {}), '괜찮아 …');
});

test('템플릿: 숫자는 로케일 서식 없이 그대로 나온다', () => {
  assert.equal(renderTemplate('{n}', { n: 1234567 }), '1234567', '천 단위 쉼표 없음');
  assert.equal(renderTemplate('{n}', { n: 1234567.5 }), '1234567.5');
  assert.equal(renderTemplate('{n}', { n: 0 }), '0', '0도 치환된다(조건문과 다르다)');
  assert.equal(renderTemplate('{n}', { n: -3 }), '-3');
  assert.equal(renderTemplate('{b}', { b: true }), 'true');
});

// ---------- leadOption ----------

test('leadOption: 가장 많은 선택지, 동점이면 선택지 순서상 첫 번째', () => {
  const step = { options: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] };
  assert.equal(leadOption(step, { a: 1, b: 3, c: 2 }), 'b');
  assert.equal(leadOption(step, { a: 2, b: 2, c: 2 }), 'a', '모두 동점 → 첫 번째');
  assert.equal(leadOption(step, { a: 0, b: 2, c: 2 }), 'b', 'b·c 동점 → 먼저 나온 b');
  assert.equal(leadOption(step, { a: 1, b: 0, c: 1 }), 'a');
});

test('leadOption: 모두 0이거나 비어 있으면 null', () => {
  const step = { options: [{ id: 'a' }, { id: 'b' }] };
  assert.equal(leadOption(step, { a: 0, b: 0 }), null);
  assert.equal(leadOption(step, {}), null);
  assert.equal(leadOption(step, { zz: 5 }), null, '선택지에 없는 id는 세지 않는다');
  assert.equal(leadOption({ options: [] }, { a: 1 }), null);
});

// ---------- storyVars ----------

test('storyVars: 선택 단계마다 <id>_total / _list / _lead 와 선택지 개수를 만든다', () => {
  const pack = twoChoice('ko');
  let s = newRoom('T', pack);
  s = tally(s, 'weather', { sunny: 3, rainy: 1 });
  s = tally(s, 'body', { heavy: 2, warm: 2 });
  const vars = storyVars(pack, s);
  assert.deepEqual(vars, {
    class: '우리 반',
    sunny: 3, rainy: 1,
    weather_total: 4, weather_list: '해님 3명, 비 1명', weather_lead: '해님',
    light: 0, heavy: 2, warm: 2,
    body_total: 4, body_list: '무거움 2명, 따뜻함 2명', body_lead: '무거움',
  });
  assert.equal(vars.body_lead, '무거움', '동점이면 선택지 순서상 첫 번째');
  assert.equal(renderTemplate(pack.steps[4].template, vars), '해님 3명, 비 1명 / 무거움 2명, 따뜻함 2명');
});

test('storyVars: 선택이 아닌 단계(talk·activity·story·closing)는 변수를 만들지 않는다', () => {
  const pack = twoChoice('ko');
  const vars = storyVars(pack, newRoom('T', pack));
  for (const id of ['hello', 'move', 'story', 'bye']) {
    assert.equal(id in vars, false, `${id} 자체는 변수가 아니다`);
    assert.equal(`${id}_total` in vars, false);
    assert.equal(`${id}_list` in vars, false);
    assert.equal(`${id}_lead` in vars, false);
  }
  assert.deepEqual(Object.keys(vars).sort(), ['body', 'weather'].flatMap((id) => [`${id}_total`, `${id}_list`, `${id}_lead`])
    .concat(['class', 'sunny', 'rainy', 'light', 'heavy', 'warm']).sort());
});

test('storyVars: 한 단계만 비어 있으면 그 단계만 list_empty·빈 lead 가 된다', () => {
  const pack = twoChoice('en');
  pack.steps[1].options = [{ id: 'sunny', label: 'Sunny' }, { id: 'rainy', label: 'Rainy' }];
  let s = newRoom('T', pack);
  s = tally(s, 'body', { light: 1 });
  const vars = storyVars(pack, s);
  assert.equal(vars.weather_total, 0);
  assert.equal(vars.weather_list, 'a quiet sky');
  assert.equal(vars.weather_lead, '');
  assert.equal(vars.body_total, 1);
  assert.equal(vars.body_list, '1 가벼움', '영어 기본 list_item: {n} {label}');
  assert.equal(vars.body_lead, '가벼움');
  assert.equal(vars.class, 'our class');
  assert.equal(renderTemplate('[[weather_lead: W]][[body_lead: B]]', vars), 'B');
});

test('storyVars: 방 상태가 비어 있거나 없어도 0으로 채운다', () => {
  const pack = twoChoice('ko');
  for (const s of [{}, null, { tallies: {} }]) {
    const vars = storyVars(pack, s);
    assert.equal(vars.weather_total, 0);
    assert.equal(vars.sunny, 0);
    assert.equal(vars.body_list, '조용한 하늘');
  }
});

test('storyVars: 선택지 이름에 $& · $1 · $$ · {n} 같은 글자가 있어도 글자 그대로 들어간다(replace 특수 패턴이 아니다)', () => {
  const pack = twoChoice('ko');
  pack.steps[1].options = [{ id: 'sunny', label: '$& 해님 $1' }, { id: 'rainy', label: '$$' }];
  pack.steps[3].options = [{ id: 'light', label: '{n}' }, { id: 'heavy', label: '{label}' }, { id: 'warm', label: '따뜻함' }];
  let s = newRoom('T', pack);
  s = tally(s, 'weather', { sunny: 2, rainy: 1 });
  s = tally(s, 'body', { light: 3, heavy: 1 });
  const vars = storyVars(pack, s);
  assert.equal(vars.weather_list, '$& 해님 $1 2명, $$ 1명', "'$&'는 '{label}'로, '$$'는 '$'로 바뀌면 안 된다");
  assert.equal(vars.weather_lead, '$& 해님 $1');
  assert.equal(vars.body_list, '{n} 3명, {label} 1명', '이름 속 {n}·{label}은 다시 치환하지 않는다');
  assert.equal(vars.body_lead, '{n}');
});

test('storyVars: <id>_total 은 지금 선택지들의 합이다 — 집계에 남은 옛 선택지 id 는 세지 않는다', () => {
  const pack = twoChoice('ko');
  let s = newRoom('T', pack);
  // 'gone' 은 선택지에 없다(수업팩을 고친 뒤 집계에 남은 id) / an option id no longer in the pack
  s = tally(s, 'weather', { sunny: 2, rainy: 1, gone: 5 });
  const vars = storyVars(pack, s);
  assert.equal(vars.weather_total, 3, '2 + 1, gone 의 5 는 빠진다');
  assert.equal(vars.weather_list, '해님 2명, 비 1명');
  assert.equal(vars.weather_lead, '해님');
  assert.equal('gone' in vars, false, '옛 id 는 변수로도 나오지 않는다');
  assert.equal(renderTemplate('{weather_total}명 [[weather_total: 이야기]]', vars), '3명 이야기');
  // 옛 id 만 남고 지금 선택지는 모두 0 이면 비어 있는 단계로 본다 / only stale ids left → the step counts as empty
  const s2 = tally(newRoom('T', pack), 'body', { gone: 4 });
  const vars2 = storyVars(pack, s2);
  assert.equal(vars2.body_total, 0);
  assert.equal(vars2.body_list, '조용한 하늘');
  assert.equal(vars2.body_lead, '');
  assert.equal(renderTemplate('[[body_total: 이야기]]x', vars2), 'x', '합계가 0 이라 조건문이 빠진다');
});

// ---------- summaryOf ----------

test('summaryOf: 선택 단계가 없으면 null, 있으면 첫 번째 선택 단계 기준', () => {
  const noChoice = { id: 'n', lang: 'ko', title: 'n', steps: [{ id: 'a', type: 'talk', lines: ['x'] }, { id: 'b', type: 'closing', lines: ['y'] }] };
  assert.equal(summaryOf(noChoice, newRoom('N', noChoice)), null);
  assert.equal(summaryOf({ steps: [] }, {}), null);

  const pack = twoChoice('ko');
  let s = newRoom('T', pack);
  s = tally(s, 'body', { heavy: 4 });  // 두 번째 선택 단계만 집계 / only the second choice step has counts
  const sum = summaryOf(pack, s);
  assert.equal(sum.step.id, 'weather', '첫 번째 선택 단계');
  assert.equal(sum.total, 0);
  assert.deepEqual(sum.rows.map((r) => [r.id, r.n, r.pct]), [['sunny', 0, 0], ['rainy', 0, 0]], '0으로 나누지 않는다');
  s = tally(s, 'weather', { sunny: 1, rainy: 4 });
  const sum2 = summaryOf(pack, s);
  assert.equal(sum2.total, 5);
  assert.deepEqual(sum2.rows.map((r) => [r.id, r.n, r.pct]), [['sunny', 1, 25], ['rainy', 4, 100]]);
  assert.equal(sum2.rows[0].label, '해님', '선택지의 다른 필드도 함께 넘어온다');
});

// ---------- packText ----------

test('packText: 기본값은 ko / en, 모르는 언어는 영어, lang 이 없으면 한국어', () => {
  for (const key of ['list_item', 'list_empty', 'class_name']) {
    assert.equal(packText({ lang: 'ko' }, key), PACK_TEXT_DEFAULTS.ko[key]);
    assert.equal(packText({ lang: 'en' }, key), PACK_TEXT_DEFAULTS.en[key]);
    assert.equal(packText({ lang: 'fr' }, key), PACK_TEXT_DEFAULTS.en[key], 'fr → en');
    assert.equal(packText({}, key), PACK_TEXT_DEFAULTS.ko[key], 'lang 없음 → ko(이전 팩 호환)');
    assert.equal(packText(null, key), PACK_TEXT_DEFAULTS.ko[key], '팩 없음 → ko');
  }
  assert.equal(packText({ lang: 'ko-KR' }, 'class_name'), '우리 반', '지역 코드는 앞 두 글자만 본다');
  assert.equal(packText({ lang: 'en-GB' }, 'class_name'), 'our class');
  assert.equal(packText({ lang: 'ko' }, 'nope'), undefined, '모르는 키는 undefined');
});

test('packText: 팩에 적힌 값이 우선하고, 빈 값은 기본값으로 떨어진다', () => {
  const p = { lang: 'ko', list_item: '{label}×{n}', list_empty: 'nobody', class_name: 'Room 3' };
  assert.equal(packText(p, 'list_item'), '{label}×{n}');
  assert.equal(packText(p, 'list_empty'), 'nobody');
  assert.equal(packText(p, 'class_name'), 'Room 3');
  assert.equal(packText({ lang: 'en', class_name: '' }, 'class_name'), 'our class', '빈 문자열은 덮어쓰지 않는다');
  assert.equal(packText({ lang: 'en', class_name: 0 }, 'class_name'), 'our class');
  assert.equal(packText({ lang: 'en', class_name: 5 }, 'class_name'), '5', '문자열이 아니면 String()으로');
  // storyVars 가 덮어쓴 값을 실제로 쓴다 / storyVars uses the overrides
  const pack = { ...twoChoice('en'), list_item: '{label}:{n}', list_empty: '-', class_name: 'Room 3' };
  let s = tally(newRoom('T', pack), 'weather', { rainy: 2 });
  const vars = storyVars(pack, s);
  assert.equal(vars.weather_list, '비:2');
  assert.equal(vars.body_list, '-');
  assert.equal(vars.class, 'Room 3');
});
