// English UI strings. Keys are grouped by view: common.* sync.* home.* teacher.* tv.* parent.*
// {var} is filled by t(key, vars); a key ending in _one is used when vars.n === 1.
// Lesson pack text (lines, story) lives in packs/<id>.en.json, not here.
export default {
  // common
  'common.appName': 'Emoren Classroom',
  'common.home': 'Home',
  'common.errorTitle': 'Something went wrong',
  'common.copy': 'Copy',
  'common.copied': 'Copied',
  'common.copyHold': 'Press and hold to copy',
  'common.code': 'Code',
  'common.codeLabel': 'Lesson code',
  'common.minutes': '{n} min',
  'common.steps': '{n} steps',
  'common.language': 'Language',
  'common.characterAlt': '{name} (placeholder art)',

  // sync adapter names
  'sync.local': 'Same-browser sync',
  'sync.artifact': 'Cloud sync',
  'sync.firebase': 'Firebase sync',

  // home
  'home.title': 'Emoren Classroom',
  'home.tagline': 'One teacher phone runs the classroom TV and an AI character for a 15-minute lesson',
  'home.tv.title': 'Classroom TV',
  'home.tv.desc': 'Open this on the browser connected to the classroom TV (or any big screen). A lesson code appears in large type.',
  'home.tv.open': 'Open classroom TV',
  'home.teacher.title': 'Teacher phone',
  'home.teacher.desc': 'Enter the four-letter code shown on the TV to open the remote.',
  'home.teacher.open': 'Open remote',
  'home.teacher.new': 'New lesson',
  'home.teacher.newCode': 'New lesson code {code}',
  'home.teacher.newHint': "On the classroom TV, open {link} or enter the code, then tap 'Open remote' here.",
  'home.teacher.thisLink': 'this link',
  'home.teacher.packLabel': 'Lesson pack · language',
  'home.parent.title': 'Family page',
  'home.parent.desc': "When the lesson ends, the whole class's mood weather and today's story appear here.",
  'home.parent.open': 'Open',
  'home.packs.title': 'Lesson packs',
  'home.packs.loading': 'Loading…',
  'home.packs.hint': 'A lesson pack is one <code>packs/&lt;id&gt;.&lt;lang&gt;.json</code> file that defines the whole lesson. Make a new lesson by editing JSON, not code.',
  'home.demo.title': 'See it in 10 seconds',
  'home.demo.desc': 'The classroom TV and the teacher phone side by side on one screen, with a ghost teacher running a whole lesson. No second device needed.',
  'home.demo.open': 'Open the playground',
  'home.studio.open': 'Make a new lesson in the pack studio',
  'home.foot': "No child's name or personal information is stored anywhere. Only class totals and the class story are kept.",

  // teacher phone
  'teacher.title': 'Teacher remote · {code}',
  'teacher.codeLabel': 'Lesson code {code}',
  'teacher.pause': 'Pause',
  'teacher.resume': 'Resume',
  'teacher.today': "Today's lesson",
  'teacher.tvCheck': 'Check the TV',
  'teacher.tvCheckDesc': "If the classroom TV shows code {code} and 'Turn on sound' has been tapped, you're ready. If the TV isn't up yet, open the link below on it.",
  'teacher.tvLink': 'TV link',
  'teacher.materials': 'Materials: {list}',
  'teacher.start': 'Start lesson',
  'teacher.pausedTag': 'Paused · TV covered',
  'teacher.cue': "Teacher's cue",
  'teacher.prev': 'Back',
  'teacher.respeak': 'Say it again',
  'teacher.next': 'Next →',
  'teacher.finish': 'Finish lesson',
  'teacher.notes': 'Class notes ({n})',
  'teacher.notesHint': "Notes are about the whole class. Don't write children's names.",
  'teacher.notesPlaceholder': 'e.g. Lots of rainy cards today, so we stretched the movement game',
  'teacher.saveNote': 'Save note',
  'teacher.minus': 'Remove one {label}',
  'teacher.plus': 'Add one {label}',
  'teacher.total': '{n} in all',
  'teacher.confirm': 'Confirm → character responds',
  'teacher.reconfirm': 'Confirm again (character responds)',
  'teacher.secLeft': 's left',
  'teacher.secTimer': 's timer',
  'teacher.timerStart': 'Start timer',
  'teacher.timerRestart': 'Restart',
  'teacher.doneTitle': 'Lesson done!',
  'teacher.doneDesc': "Today's \"{title}\" record is ready. Only class totals and the story are kept.",
  'teacher.parentPage': 'Family page',
  'teacher.parentDesc': "Share this link with families so they can read today's story and the questions to keep going at home.",
  'teacher.parentLink': 'Family page link',
  'teacher.parentPreview': 'Preview family page',
  'teacher.reset': 'Set up a new lesson with this code',

  // classroom TV
  'tv.title': 'Emoren Classroom TV · {code}',
  'tv.unlock': '🔊 Turn on sound',
  'tv.fullscreen': '⛶ Full screen',
  'tv.waitStep1': "① Tap 'Turn on sound' below once",
  'tv.waitStep2': '② Enter this code on the teacher phone and start the lesson',
  'tv.paused': 'Break time',
  'tv.doneTitle': "That's all for today!",
  'tv.doneSub': "Today's story is on the family page.",
  'tv.outroDefault': "That's all for today! Thank you.",

  // family page
  'parent.title': 'Our Class Today',
  'parent.noneTitle': 'No lesson record yet',
  'parent.noneDesc': 'No lesson was started with code {code}, or it was opened on another device. Please open the link your teacher sent again.',
  'parent.liveTitle': '"{title}" is in progress',
  'parent.liveDesc': "When the lesson ends, today's class story appears here. The page updates by itself.",
  'parent.heading': 'Our class today: "{title}"',
  'parent.joined': '{n} children joined',
  'parent.joined_one': '1 child joined',
  'parent.homeTitle': 'Keep it going at home',
  'parent.noteDefault': 'This page shows only class totals and the class story.',
  'parent.print': 'Print',

  // ---- v0.2: 기능마다 자기 구역 안에만 키를 넣는다 / each feature adds keys only inside its own block ----

  // demo.* — 플레이그라운드 #demo / playground
  'demo.title': 'Playground',
  'demo.subtitle': 'Left: the classroom TV. Right: the teacher phone. Both run in this browser on the same lesson code.',
  'demo.tvLabel': 'Classroom TV',
  'demo.phoneLabel': 'Teacher phone',
  'demo.packLabel': 'Lesson pack',
  'demo.ghostRun': 'Run the ghost teacher',
  'demo.ghostStop': 'Take over',
  'demo.ghostIdle': 'The ghost teacher is ready. Press it to run a whole lesson by itself; any tap on the phone stops it.',
  'demo.ghostRunning': 'Ghost teacher running · {step}',
  'demo.ghostStopped': 'Ghost teacher stopped. The phone is yours now.',
  'demo.ghostDone': 'The lesson is done. Open the family page, or replay with a fresh code.',
  'demo.family': 'Open family page',
  'demo.replay': 'Replay with a new code',
  'demo.hint': 'In a real classroom the TV and the phone are separate devices. This screen just shows the whole flow at once.',
  // [end demo]

  // book.* — 오늘 우리 반 책 / class book
  'book.coverLine': 'Here is the "{title}" book our class made today.',
  'book.choiceLine': '{prompt} Our answers: {list}.',
  'book.activityLine': 'We did {title} together.',
  'book.backLine': 'Our class made this together.',
  'book.pageNo': '{n} / {total}',
  'book.prevPage': '← Previous page',
  'book.nextPage': 'Next page →',
  'book.autoHint': 'Pages turn by themselves while the character reads. You can also turn them with these buttons.',
  'book.familyTitle': 'Our Class Book',
  // [end book]

  // qr.* — TV 대기 화면 QR / TV waiting-screen QR
  'qr.scan': 'Scan with your phone to open the remote',
  'qr.alt': 'QR code of the teacher-phone link, lesson code {code}',
  // [end qr]

  // studio.* — 수업팩 스튜디오 #studio / pack studio
  'studio.soonTitle': 'Lesson pack studio — in progress',
  'studio.soonDesc': 'The no-code pack editor ships in the next release (v0.2.1). For now, copy packs/ID.LANG.json and check it with npm run packs:check.',
  'studio.soonFormat': 'Read the pack format',
  // [end studio]

  // record.* — 남는 기록 패널 / what-is-stored panel
  'record.title': 'What this room stores',
  'record.intro': "No child's name, photo, voice or individual choice is anywhere in here. What you see below is everything.",
  'record.counts': 'Class totals',
  'record.notes': 'Class notes',
  'record.story': "Today's story",
  'record.times': 'Times',
  'record.startedAt': 'Started',
  'record.endedAt': 'Ended',
  'record.notYet': 'not yet',
  'record.raw': 'Show raw JSON',
  'record.erase': 'Erase everything',
  'record.eraseArmed': 'Erase for real? Tap again',
  'record.erased': 'Erased. A fresh lesson is ready with the same code.',
  'record.pack': 'Lesson pack',
  'record.sync': 'Sync',
  'record.empty': 'Nothing yet',
  'record.none': 'No notes',
  // [end record]

  // kiosk.* — 효과음·키오스크·시계 / sfx, kiosk, clock
  'tv.sfxOn': 'Sound effects on',
  'tv.sfxOff': 'Sound effects off',
  'tv.kioskHint': 'Double-tap for full screen',
  // [end kiosk]
};
