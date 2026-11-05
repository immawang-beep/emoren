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
  'parent.print': '인쇄하기',

  // ---- v0.2: 기능마다 자기 구역 안에만 키를 넣는다 / each feature adds keys only inside its own block ----

  // demo.* — 플레이그라운드 #demo / playground
  'demo.title': '플레이그라운드',
  'demo.subtitle': '왼쪽은 교실 TV, 오른쪽은 강사 폰이에요. 둘 다 이 브라우저 안에서 같은 수업 코드로 움직여요.',
  'demo.tvLabel': '교실 TV',
  'demo.phoneLabel': '강사 폰',
  'demo.packLabel': '수업팩',
  'demo.ghostRun': '유령 선생님 시작',
  'demo.ghostStop': '직접 하기',
  'demo.ghostIdle': '유령 선생님이 준비됐어요. 누르면 수업 한 회기를 혼자 진행해요. 폰을 직접 누르면 언제든 멈춰요.',
  'demo.ghostRunning': '유령 선생님이 진행 중 · {step}',
  'demo.ghostStopped': '유령 선생님이 멈췄어요. 이제 폰을 직접 눌러 진행해 보세요.',
  'demo.ghostDone': '수업 한 회기가 끝났어요. 보호자 페이지를 열어 보거나, 새 코드로 다시 볼 수 있어요.',
  'demo.family': '보호자 페이지 열기',
  'demo.replay': '새 코드로 다시 보기',
  'demo.hint': '실제 수업에서는 TV와 폰이 다른 기기예요. 이 화면은 전체 흐름을 한눈에 보기 위한 것이에요.',
  // [end demo]

  // book.* — 오늘 우리 반 책 / class book
  'book.coverLine': '오늘 우리 반이 만든 「{title}」 책이에요.',
  'book.choiceLine': '{prompt} {list}, 이렇게 대답했어요.',
  'book.activityLine': '{title}, 몸으로 함께 했어요.',
  'book.backLine': '우리 반이 함께 만들었어요.',
  'book.pageNo': '{n} / {total}',
  'book.prevPage': '← 이전 쪽',
  'book.nextPage': '다음 쪽 →',
  'book.autoHint': '쪽은 캐릭터가 읽는 동안 저절로 넘어가요. 이전·다음 쪽 버튼으로 직접 넘길 수도 있어요.',
  'book.familyTitle': '오늘 우리 반 책',
  // [end book]

  // qr.* — TV 대기 화면 QR / TV waiting-screen QR
  'qr.scan': '폰으로 찍으면 리모컨이 열려요',
  'qr.alt': '강사 폰 리모컨 링크 QR, 수업 코드 {code}',
  // [end qr]

  // studio.* — 수업팩 스튜디오 #studio / pack studio
  'studio.soonTitle': '수업팩 스튜디오 — 준비 중',
  'studio.soonDesc': '코드 없이 수업팩을 만드는 화면은 다음 판(v0.2.1)에 들어갑니다. 지금은 packs/ID.LANG.json을 복사해서 만들고 npm run packs:check로 확인하세요.',
  'studio.soonFormat': '수업팩 형식 문서 보기',
  // [end studio]

  // record.* — 남는 기록 패널 / what-is-stored panel
  'record.title': '남는 기록',
  'record.intro': '아이 이름·사진·목소리·개인 선택은 어디에도 없어요. 이 방에 남는 건 아래가 전부예요.',
  'record.counts': '반 전체 숫자',
  'record.notes': '반 메모',
  'record.story': '오늘 이야기',
  'record.times': '시간',
  'record.startedAt': '시작',
  'record.endedAt': '끝',
  'record.notYet': '아직',
  'record.raw': '원본 JSON 보기',
  'record.erase': '모두 지우기',
  'record.eraseArmed': '정말 지울까요? 다시 누르면 지워져요',
  'record.erased': '지웠어요. 같은 코드로 새 수업을 준비했어요.',
  'record.pack': '수업팩',
  'record.sync': '동기화',
  'record.empty': '아직 아무것도 없어요',
  'record.none': '메모 없음',
  // [end record]

  // kiosk.* — 효과음·키오스크·시계 / sfx, kiosk, clock
  'tv.sfxOn': '효과음 켜짐',
  'tv.sfxOff': '효과음 꺼짐',
  'tv.kioskHint': '화면을 두 번 누르면 전체 화면',
  // [end kiosk]
};
