// 한국어 UI 문자열 / Korean UI strings. 키는 화면별로 묶는다: common.* sync.* home.* teacher.* tv.* parent.*
// {var}는 t(key, vars)로 채운다. 수업팩 본문(대사·이야기)은 packs/<id>.ko.json에 있다.
export default {
  // 공통
  'common.appName': '이모렌 교실',
  'common.home': '처음으로',
  'common.errorTitle': '문제가 생겼어요',
  'common.copy': '복사',
  'common.copied': '복사됨',
  'common.copyHold': '길게 눌러 복사',
  'common.code': '코드',
  'common.codeLabel': '수업 코드',
  'common.minutes': '{n}분',
  'common.steps': '{n}단계',
  'common.language': '언어',
  'common.characterAlt': '{name} (임시 그림)',

  // 동기화 방식 이름
  'sync.local': '같은 브라우저 동기화',
  'sync.artifact': '클라우드 동기화',
  'sync.firebase': 'Firebase 동기화',

  // 홈
  'home.title': '이모렌 교실',
  'home.tagline': '강사 폰 한 대로 교실 TV와 AI 캐릭터가 함께 움직이는 15분 수업',
  'home.tv.title': '교실 TV',
  'home.tv.desc': '교실 TV(또는 큰 화면)에 연결된 브라우저에서 여세요. 수업 코드가 크게 뜹니다.',
  'home.tv.open': '교실 TV 열기',
  'home.teacher.title': '강사 폰',
  'home.teacher.desc': 'TV에 뜬 네 글자 코드를 넣으면 리모컨이 열립니다.',
  'home.teacher.open': '리모컨 열기',
  'home.teacher.new': '새 수업 만들기',
  'home.teacher.newCode': '새 수업 코드 {code}',
  'home.teacher.newHint': "교실 TV에서 {link}를 열거나 코드를 넣은 뒤, 여기서 '리모컨 열기'를 누르세요.",
  'home.teacher.thisLink': '이 링크',
  'home.teacher.packLabel': '수업팩 · 언어',
  'home.parent.title': '보호자 페이지',
  'home.parent.desc': '수업이 끝나면 반 전체의 마음 날씨와 오늘 이야기가 올라옵니다.',
  'home.parent.open': '열어 보기',
  'home.packs.title': '수업팩',
  'home.packs.loading': '불러오는 중…',
  'home.packs.hint': '수업팩은 <code>packs/&lt;id&gt;.&lt;lang&gt;.json</code> 한 장으로 수업 전체를 정의합니다. 코드를 건드리지 않고 JSON만 바꿔 새 수업을 만듭니다.',
  'home.demo.title': '10초 만에 보기',
  'home.demo.desc': '교실 TV와 강사 폰을 한 화면에 띄우고, 유령 선생님이 수업 한 회기를 대신 진행합니다. 기기 두 대가 없어도 됩니다.',
  'home.demo.open': '플레이그라운드 열기',
  'home.studio.open': '수업팩 스튜디오에서 새 수업 만들기',
  'home.foot': '아이 이름이나 개인 정보는 어디에도 저장하지 않습니다. 기록은 반 전체 숫자와 이야기뿐입니다.',

  // 강사 폰
  'teacher.title': '강사 리모컨 · {code}',
  'teacher.codeLabel': '수업 코드 {code}',
  'teacher.pause': '잠깐',
  'teacher.resume': '계속',
  'teacher.today': '오늘 수업',
  'teacher.tvCheck': 'TV 확인',
  'teacher.tvCheckDesc': "교실 TV에 코드 {code}가 떠 있고 '소리 켜기'를 눌렀으면 준비 끝. TV가 아직이면 TV에서 아래 링크를 여세요.",
  'teacher.tvLink': 'TV 링크',
  'teacher.materials': '준비물: {list}',
  'teacher.start': '수업 시작',
  'teacher.pausedTag': '일시정지 · TV 가림',
  'teacher.cue': '선생님 할 일',
  'teacher.prev': '이전',
  'teacher.respeak': '다시 말하기',
  'teacher.next': '다음 →',
  'teacher.finish': '수업 마치기',
  'teacher.notes': '반 메모 ({n})',
  'teacher.notesHint': '반 전체 분위기만 적어요. 아이 이름은 적지 않아요.',
  'teacher.notesPlaceholder': '예: 비 카드가 많아서 몸놀이를 길게 했다',
  'teacher.saveNote': '메모 저장',
  'teacher.minus': '{label} 하나 빼기',
  'teacher.plus': '{label} 하나 더하기',
  'teacher.total': '모두 {n}명',
  'teacher.confirm': '확정 → 캐릭터 반응',
  'teacher.reconfirm': '다시 확정 (캐릭터 반응)',
  'teacher.secLeft': '초 남음',
  'teacher.secTimer': '초 타이머',
  'teacher.timerStart': '타이머 시작',
  'teacher.timerRestart': '다시 시작',
  'teacher.doneTitle': '수업 끝!',
  'teacher.doneDesc': '오늘 「{title}」 기록이 정리됐어요. 반 전체 숫자와 이야기만 남습니다.',
  'teacher.parentPage': '보호자 페이지',
  'teacher.parentDesc': '이 링크를 반 단체방에 올리면 보호자가 오늘 이야기와 집에서 이어갈 질문을 볼 수 있어요.',
  'teacher.parentLink': '보호자 페이지 링크',
  'teacher.parentPreview': '보호자 페이지 미리 보기',
  'teacher.reset': '같은 코드로 새 수업 준비',

  // 교실 TV
  'tv.title': '이모렌 교실 TV · {code}',
  'tv.unlock': '🔊 소리 켜기',
  'tv.fullscreen': '⛶ 전체 화면',
  'tv.waitStep1': "① 아래 '소리 켜기'를 한 번 누르세요",
  'tv.waitStep2': '② 강사 폰에서 이 코드를 넣고 수업을 시작하세요',
  'tv.paused': '잠깐 쉬어요',
  'tv.doneTitle': '오늘 수업 끝!',
  'tv.doneSub': '보호자 페이지에 오늘 이야기가 올라갔어요.',
  'tv.outroDefault': '오늘 수업 끝! 고마워.',

  // 보호자 페이지
  'parent.title': '오늘 우리 반 이야기',
  'parent.noneTitle': '아직 수업 기록이 없어요',
  'parent.noneDesc': '코드 {code}로 시작한 수업이 없거나, 다른 기기에서 열린 수업이에요. 선생님이 보내 준 링크로 다시 열어 주세요.',
  'parent.liveTitle': '「{title}」 수업이 진행 중이에요',
  'parent.liveDesc': '수업이 끝나면 이 페이지에 오늘 우리 반 이야기가 올라와요. 페이지는 저절로 바뀝니다.',
  'parent.heading': '오늘 우리 반 「{title}」',
  'parent.joined': '{n}명이 함께했어요',
  'parent.homeTitle': '집에서 이어가기',
  'parent.noteDefault': '이 페이지에는 반 전체의 숫자와 이야기만 있어요.',

  // ---- v0.2: 기능마다 자기 구역 안에만 키를 넣는다 / each feature adds keys only inside its own block ----

  // demo.* — 플레이그라운드 #demo / playground
  // [end demo]

  // book.* — 오늘 우리 반 책 / class book
  // [end book]

  // qr.* — TV 대기 화면 QR / TV waiting-screen QR
  // [end qr]

  // studio.* — 수업팩 스튜디오 #studio / pack studio
  // [end studio]

  // record.* — 남는 기록 패널 / what-is-stored panel
  // [end record]

  // kiosk.* — 효과음·키오스크·시계 / sfx, kiosk, clock
  // [end kiosk]
};
