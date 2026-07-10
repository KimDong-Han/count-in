// 한/영 UI 문구 사전. 값은 문자열·함수(치환)·JSX 셋 다 가능.
// 언어는 cin:lang에 기억, 없으면 브라우저 언어(한국어면 ko, 아니면 en).
const KEY = "cin:lang";

export function detectLang() {
  try {
    const s = localStorage.getItem(KEY);
    if (s === "ko" || s === "en") return s;
  } catch {}
  return (navigator.language || "ko").toLowerCase().startsWith("ko")
    ? "ko"
    : "en";
}
export function saveLang(l) {
  try {
    localStorage.setItem(KEY, l);
  } catch {}
}
// <html lang> + data-lang(언어별 CSS content용) 동기화
export function applyLangAttr(l) {
  document.documentElement.lang = l;
  document.documentElement.dataset.lang = l;
}

export const STR = {
  ko: {
    // 헤더
    themeToLight: "밝은 화면으로",
    themeToDark: "어두운 화면으로",
    langBtnTitle: "Switch to English",
    metronomeLink: "메트로놈 ›",
    headline: (
      <>
        타이밍 설정해두면 <span className="accent">맞춰서</span> 넘어감.
      </>
    ),
    subline:
      "유튜브 반주와 악보 PDF를 넣고, 페이지 넘길 시각을 정해두면 그 시각에 넘어가요.",
    importPreset: "프리셋 검색",
    searchPresetTitle: "곡 이름 검색",
    searchPresetPlaceholder: "곡 이름을 입력하세요",
    searchPresetHint: "공유된 프리셋을 곡 이름으로 찾아요.",
    searchBtn: "검색",
    searchResults: "검색 결과",
    noSearchResults: "일치하는 프리셋이 없어요.",
    loadShared: "불러오기",
    delShared: "삭제",
    delWrongPw: "비밀번호가 틀려요",
    delFail: "삭제에 실패했어요",
    searching: "검색 중…",
    shareLoadFail: "프리셋을 불러오지 못했어요.",
    searchLoadHint: "악보를 불러오면 타이밍이 자동 입력돼요",
    searchByLabel: "검색 기준",
    searchByName: "제목",
    searchBySinger: "가수",
    searchByUploader: "닉네임",
    shareModalTitle: "곡 공유하기",
    shareModalHint:
      "지금 설정한 유튜브 링크와 넘김 타이밍을 다른 사람도 검색해 쓸 수 있게 올려요.",
    shareNeedUrl: "먼저 ① 유튜브 링크를 입력해 주세요.",
    shareTitle: "곡 제목",
    shareTitlePh: "예: 고민중독",
    shareSinger: "가수",
    shareSingerPh: "검색에 쓰여요",
    shareUploader: "닉네임",
    shareUploaderPh: "올린 사람 표시",
    sharePw: "비밀번호(암호화 되어서 저장돼요)",
    sharePwPh: "수정·삭제할 때 필요",
    sharePwHint: "나중에 이 공유를 고치거나 지울 때 쓰는 암호예요.",
    shareSubmit: "공유하기",
    sharing: "올리는 중…",
    shareDoneMsg: (name) =>
      `'${name}' 공유 완료! 이제 프리셋 검색에서 찾을 수 있어요.`,
    shareEditBtn: "공유 수정",
    shareEditTitle: "공유 수정",
    shareEditHint:
      "불러온 공유를 지금 설정(링크·타이밍)으로 덮어써요. 비밀번호가 필요해요.",
    shareEditPwHint: "이 공유를 올릴 때 정한 비밀번호를 넣어 주세요.",
    shareUpdateSubmit: "덮어쓰기",
    shareUpdateDone: (name) => `'${name}' 수정 완료! 공유본이 바뀌었어요.`,
    shareFail: "공유에 실패했어요. 잠시 후 다시 시도해 주세요.",
    closeBtn: "닫기",
    pagesCount: (n) => `${n}페이지`,
    // ①②③
    step1: "① 유튜브 반주 링크",
    urlPlaceholder: "https://youtu.be/... 또는 watch?v=...",
    step2: "② 악보 파일 (없으면 영상만 크게 나와요)",
    pdfPick: "PDF 불러오기",
    pdfLoaded: (n) => n + "페이지 불러옴",
    pdfClearTitle: "악보 내리기 (재생 중이면 영상만 크게 나와요)",
    pdfClearAria: "악보 내리기",
    step3: "③ 시작",
    noWait: "바로 시작",
    noWaitTitle: "카운트다운 없이 바로 재생돼요.",
    secCount: "초 후",
    start: "시작",
    pause: "일시정지",
    startDisabledTitle: "유튜브 링크를 먼저 넣어 주세요",
    startFs: "전체화면",
    startFsTitle: "시작하면서 브라우저를 전체화면으로 바꿔요",
    volAria: "반주 볼륨",
    // cue 패널
    cueDescTune: (
      <>
        넘어갈 순간마다 <b>지금 넘김</b>을 눌러 주세요. 잘못 찍었으면{" "}
        <b>시크 바</b>로 되감아 그 줄부터 다시 찍을 수 있어요. <b>−·＋</b>는
        0.5초 미세 조정이에요.
      </>
    ),
    cueDescNormal: (
      <>
        <b>페이지 넘김 시각</b> — <code>0:45</code>처럼 입력하거나{" "}
        <b>지금 넘김</b>(<kbd>Shift</kbd>)으로 찍어요. 언제든 고칠 수 있어요.
      </>
    ),
    repeatToggle: "도돌이표가 있으면 체크",
    repeatToggleTitle:
      "켜면 타이밍 입력 중 음악을 잠깐 멈추고 이동할 페이지를 물어봐요.",
    tuneEnter: "들으면서 시간 설정",
    tuneEnterTitle: "3초 카운트다운 후 재생하며 넘김 시각을 찍는 모드예요",
    tuneEnterDisabledTitle: "링크와 악보를 먼저 넣어 주세요",
    tapNow: "지금 넘김",
    tapNowPages: (a, b) => ` (${a}→${b}페이지)`,
    clearBtn: "초기화",
    fromPageAria: "출발 페이지",
    toPageAria: "도착 페이지",
    cuePagePrefix: "",
    cuePageSuffix: "페이지",
    nowBtn: "지금",
    nudgeEarlier: "0.5초 앞당기기",
    nudgeLater: "0.5초 늦추기",
    delCueTitle: "이 넘김 삭제",
    delCueAria: (a, b) => a + "페이지에서 " + b + "페이지 넘김 삭제",
    addCue: "＋ 넘김 추가",
    // 세부 설정
    advToggle: "세부 설정 — 넘김·배속·소리",
    flipModeLabel: "넘김 방식",
    flipCueSeg: "페이지마다 설정",
    flipIntervalSeg: "일정 간격",
    intervalLabel: "페이지 간격",
    minUnit: "분",
    secUnit: "초",
    rateLabel: "재생 속도",
    rate05: "0.5배",
    rate075: "0.75배",
    rate1: "원속",
    countSound: "카운트 소리",
    soundStick: "탁탁",
    soundBeep: "삑삑",
    soundOff: "끄기",
    optionsLabel: "옵션",
    preload: "미리 재생",
    preloadTitle:
      "카운트다운 중 음소거로 미리 재생해 버퍼를 채운 뒤 0:00으로 되감아요. 끄면 첫 부분이 끊길 수 있어요.",
    loop: "반복",
    loopTitle: "반주가 끝나면 처음부터 다시 재생해요.",
    // 프리셋
    savedSongs: "저장한 곡",
    shareBtn: "내 타이밍 공유",
    presetsEmpty: "설정을 저장하면 여기서 골라 불러올 수 있어요.",
    presetsHint: "악보 파일을 연 뒤 저장한 곡을 눌러 주세요",
    presetLoadTitle: (url) => "불러오기 · " + url,
    presetNoLink: "불러오기 · ⚠ 저장된 링크 없음",
    presetDelTitle: "삭제",
    presetDelAria: (name) => name + " 삭제",
    songDefault: (n) => "곡 " + n,
    saveNamePh: "곡 이름",
    saveBtn: "저장",
    cancelBtn: "취소",
    savedFlash: (name) => '"' + name + '" 저장됨',
    savePreset: "현재 설정 저장",
    resetConfirm: "한 번 더 누르면 초기화돼요",
    resetAll: "전체 초기화",
    // 네비바·무대
    toHome: "처음으로",
    prevBtn: "‹ 이전",
    nextBtn: "다음 ›",
    fsBtn: "전체화면",
    fsExit: "전체화면 종료",
    fsTitle: "브라우저를 전체화면으로 — 자동 넘김은 그대로 돼요",
    fsExitTitle: "전체화면에서 나가요",
    focusOn: "악보 크게",
    focusOff: "설정 보기",
    kbhintLine: (
      <>
        <b>Space</b> 재생 · <b>←→</b> 페이지 · <b>Shift</b> 지금 넘김
      </>
    ),
    kbMoreTitle: "단축키 전체 보기",
    kbTitle: "단축키",
    kbRows: [
      ["Space", "시작 · 일시정지"],
      ["← →", "이전 · 다음 페이지"],
      ["↑ ↓", "볼륨"],
      ["Shift", "지금 넘김 (타이밍 찍기)"],
      ["Shift", "지금 넘김 (타이밍 입력 모드)"],
      ["1~9", "해당 페이지로 이동"],
      ["Enter", "악보 크게 보기"],
      ["0 · Esc", "처음으로"],
    ],
    emptyStage: "악보 PDF를 불러오면 여기에 표시돼요.",
    prevPage: "이전 페이지",
    nextPage: "다음 페이지",
    toPageCue: (n) => n + "페이지로",
    nextPageCue: "다음 페이지",
    flipHintText: (sec, jump) => sec + "초 뒤 " + jump + " ›",
    ytExpand: "반주 영상 펼치기",
    ytCollapse: "반주 영상 접기",
    // 시트·하단 바
    sheetTitle: "설정",
    sheetCloseAria: "설정 닫기",
    mbSet: "설정",
    mbSetAria: "설정 열기",
    // 타이밍 입력 바
    tuneBadge: "타이밍 입력",
    tuneListTitle: "찍은 타이밍 목록 보기·수정",
    tuneListAria: "타이밍 목록 열기",
    resume: "재생",
    done: "완료",
    seekAria: "재생 위치",
    tuneTapPickBelow: "아래에서 돌아갈 페이지를 골라 주세요",
    tuneTapAgainNext: (n) => `다시 누르면 다음 페이지(${n}페이지)로`,
    tuneTapLast: "마지막 페이지까지 왔어요 — 완료를 눌러 주세요",
    tuneTapPages: (a, b) => `지금 넘김 — ${a}→${b}페이지`,
    // "몇 페이지로?" 팝업
    pickAria: "몇 페이지로 넘어갈까요",
    pickTime: (t) => t + "에 찍음",
    pickTitle: "몇 페이지로 넘어갈까요?",
    pickNext: (n) => `다음 페이지 (${n}페이지)`,
    pickPagesAria: "이 페이지로 넘어가기",
    pickPageTitle: (n) => n + "페이지로",
    pickCancel: "취소 (기록 안 함)",
    // 카운트다운
    countdownAria: "시작 카운트다운",
    getReady: "준비하세요",
    cancel: "취소",
    // 안내·토스트
    privacyNote:
      "악보 파일은 이 브라우저 안에서만 열려요. 어디로도 업로드되지 않아요.",
    tooEarly: (a, b, tm) =>
      `${a}→${b}페이지 넘김(${tm})보다 빨라요 · 조금 더 지나서 찍어 주세요`,
    lastPageToast:
      "마지막 페이지예요 · 돌아가려면 페이지 번호 버튼을 눌러 주세요",
    turnSaved: (a, b, tm) => `${a}→${b}페이지 넘김 ${tm} 저장`,
    turnSavedCleared: (n) => ` · 순서가 꼬인 뒤 타이밍 ${n}개는 지웠어요`,
    turnSavedDropped: " · 이후 순서는 이어서 찍어 주세요",
    needTimeFirst: "먼저 시각을 찍거나 입력해 주세요",
    notBeforePrev: (tm) => `앞 넘김(${tm})보다 빨라질 수 없어요`,
    notAfterNext: (tm) => `뒤 넘김(${tm})보다 늦어질 수 없어요`,
    nudged: (a, b, tm) => `${a}→${b}페이지 넘김 ${tm}`,
    savedNoLink: (name) =>
      `"${name}" 저장됨 · 유튜브 링크가 없어 링크는 저장되지 않았어요.`,
    presetLoaded: (name) =>
      `"${name}" 불러옴 · 악보 PDF를 열면 저장된 타이밍이 적용돼요.`,
    resetDone: "저장한 곡을 뺀 나머지를 초기화했어요.",
    endedMsg: "반주가 끝났어요. 다시 시작하려면 시작을 눌러 주세요.",
    endedToast: "반주가 끝났어요 · 다시 들으려면 시작을 눌러 주세요",
    noPdfPlay: "악보 없이 반주만 재생해요. 악보 PDF는 언제든 불러올 수 있어요.",
    badLink: "유튜브 반주 링크를 확인해 주세요. 주소를 그대로 붙여넣으면 돼요.",
    badLinkToast:
      "유튜브 반주 링크를 확인해 주세요 · 설정에서 주소를 붙여넣으면 돼요",
    notReady: "플레이어를 준비 중이에요. 잠시 후 다시 눌러 주세요.",
    notReadyToast: "플레이어를 준비 중이에요 · 잠시 후 다시 눌러 주세요",
    tuneIntro:
      "반주를 들으며 페이지가 넘어갈 순간마다 '지금 넘김'(또는 Shift)을 눌러 주세요.",
    tuneDone: (n) =>
      `넘김 타이밍 ${n}개 저장됨 · 시작을 누르면 이 타이밍으로 연습할 수 있어요.`,
    pdfCleared: "악보를 내렸어요 · 다시 불러오면 타이밍도 복원돼요",
    pdfLoading: "악보 불러오는 중…",
    pdfLoadedMsg: (n) =>
      `총 ${n}페이지 · 유튜브 링크까지 넣고 시작을 누르면 반주에 맞춰 넘어가요.`,
    pdfPassword: "암호가 걸린 PDF예요. 암호를 푼 파일로 다시 시도해 주세요.",
    pdfInvalid: "PDF 형식이 아니거나 파일이 손상됐어요.",
    pdfFail: (m) => "PDF를 여는 데 실패했어요: " + m,
    volToast: (n) => "볼륨 " + n + "%",
    ytErr: (code) => {
      const codes = {
        2: "링크(동영상 ID)가 올바르지 않아요.",
        5: "이 동영상은 현재 플레이어에서 재생할 수 없어요.",
        100: "동영상을 찾을 수 없어요. 삭제되었거나 비공개일 수 있어요.",
        101: "게시자가 외부 재생을 막아둔 동영상이에요.",
        150: "게시자가 외부 재생을 막아둔 동영상이에요.",
        153: "재생 출처(referrer)를 확인하지 못했어요.",
      };
      return (
        (codes[code] || "재생 오류가 발생했어요 (코드 " + code + ").") +
        " 유튜브 링크가 공개 상태인지 확인해 주세요."
      );
    },
    // 메트로놈
    backLink: "‹ 연습 플레이어",
    mTitle: "Count-In · 온라인 메트로놈",
    mStart: "시작",
    mStop: "정지",
    tapTempo: "탭 템포",
    beatsLabel: "박자",
    beatNone: "없음",
    beatN: (n) => n + "박",
    accentLabel: "강세",
    accentDesc: "첫박을 다른 소리로",
    accentNeedBeats: " (박자 선택 시)",
    soundLabel: "소리",
    volumeLabel: "볼륨",
    mHint: (
      <>
        <b>Space</b> 시작·정지 · <b>↑↓</b> ±1 · <b>←→</b> ±5 · <b>T</b> 탭 템포
      </>
    ),
  },

  en: {
    themeToLight: "Light mode",
    themeToDark: "Dark mode",
    langBtnTitle: "한국어로 보기",
    metronomeLink: "Metronome ›",
    headline: (
      <>
        Set the times — pages turn <span className="accent">right on cue</span>.
      </>
    ),
    subline:
      "Add a YouTube backing track and a score PDF; pages turn at the times you set.",
    importPreset: "Search presets",
    searchPresetTitle: "Search by song name",
    searchPresetPlaceholder: "Enter a song name",
    searchPresetHint: "Find a shared preset by song name.",
    searchBtn: "Search",
    searchResults: "Search results",
    noSearchResults: "No matching presets found.",
    loadShared: "Load",
    delShared: "Delete",
    delWrongPw: "Wrong password",
    delFail: "Delete failed",
    searching: "Searching…",
    shareLoadFail: "Couldn't load the preset.",
    searchLoadHint: "Timing fills in once you open your sheet",
    searchByLabel: "Search by",
    searchByName: "Title",
    searchBySinger: "Artist",
    searchByUploader: "Uploader",
    shareModalTitle: "Share a song",
    shareModalHint:
      "Publish the YouTube link and page-turn timing you've set up so others can find and use it.",
    shareNeedUrl: "Enter a ① YouTube link first.",
    shareTitle: "Song title",
    shareTitlePh: "e.g. Sbeat it",
    shareSinger: "Artist",
    shareSingerPh: "used for search",
    shareUploader: "Nickname",
    shareUploaderPh: "shown as uploader",
    sharePw: "Password",
    sharePwPh: "needed to edit/delete",
    sharePwHint: "Used later to edit or delete this shared preset.",
    shareSubmit: "Share",
    sharing: "Uploading…",
    shareDoneMsg: (name) =>
      `'${name}' shared! You can now find it in preset search.`,
    shareEditBtn: "Edit share",
    shareEditTitle: "Edit shared preset",
    shareEditHint:
      "Overwrite the loaded shared preset with your current link & timing. Password required.",
    shareEditPwHint: "Enter the password you set when you shared this.",
    shareUpdateSubmit: "Overwrite",
    shareUpdateDone: (name) =>
      `'${name}' updated! The shared copy has changed.`,
    shareFail: "Sharing failed. Please try again in a moment.",
    closeBtn: "Close",
    pagesCount: (n) => `${n} pages`,
    step1: "① YouTube backing link",
    urlPlaceholder: "https://youtu.be/... or watch?v=...",
    step2: "② Score PDF (optional; video only if skipped)",
    pdfPick: "Open PDF",
    pdfLoaded: (n) => n + " pages loaded",
    pdfClearTitle: "Remove score (video goes full size while playing)",
    pdfClearAria: "Remove score",
    step3: "③ Start",
    noWait: "Instant",
    noWaitTitle: "Play immediately, no countdown.",
    secCount: "sec delay",
    start: "Start",
    pause: "Pause",
    startDisabledTitle: "Add a YouTube link first",
    startFs: "Fullscreen",
    startFsTitle: "Starts playback and enters fullscreen",
    volAria: "Volume",
    cueDescTune: (
      <>
        Tap <b>Turn now</b> at every page turn. Made a mistake?{" "}
        <b>Rewind with the seek bar</b> to retake that row. <b>−·＋</b>{" "}
        fine-tunes by 0.5s.
      </>
    ),
    cueDescNormal: (
      <>
        <b>Page-turn times</b> — type like <code>0:45</code>, or tap{" "}
        <b>Turn now</b> (<kbd>M</kbd>) while listening. Edit anytime.
      </>
    ),
    repeatToggle: "Has repeats",
    repeatToggleTitle:
      "When on, each tap in timing mode pauses the music and asks which page to jump to.",
    tuneEnter: "Set times by listening",
    tuneEnterTitle:
      "Starts after a 3-second countdown so you can tap each turn",
    tuneEnterDisabledTitle: "Add a link and a score first",
    tapNow: "Turn now",
    tapNowPages: (a, b) => ` (p.${a}→${b})`,
    clearBtn: "Reset",
    fromPageAria: "From page",
    toPageAria: "To page",
    cuePagePrefix: "Page",
    cuePageSuffix: "",
    nowBtn: "Now",
    nudgeEarlier: "0.5s earlier",
    nudgeLater: "0.5s later",
    delCueTitle: "Delete this turn",
    delCueAria: (a, b) => `Delete turn from page ${a} to ${b}`,
    addCue: "＋ Add turn",
    advToggle: "More settings — turns · speed · sound",
    flipModeLabel: "Page-turn mode",
    flipCueSeg: "Per-page times",
    flipIntervalSeg: "Fixed interval",
    intervalLabel: "Time per page",
    minUnit: "min",
    secUnit: "sec",
    rateLabel: "Speed",
    rate05: "0.5×",
    rate075: "0.75×",
    rate1: "1×",
    countSound: "Count sound",
    soundStick: "Sticks",
    soundBeep: "Beeps",
    soundOff: "Off",
    optionsLabel: "Options",
    preload: "Preload",
    preloadTitle:
      "Buffers the track muted during the countdown and rewinds to 0:00, so playback starts instantly.",
    loop: "Loop",
    loopTitle: "Replay from the beginning when the track ends.",
    savedSongs: "Saved songs",
    shareBtn: "Share",
    presetsEmpty: "Save your setup and reload it from here.",
    presetsHint: "Open the score PDF, then load a saved song",
    presetLoadTitle: (url) => "Load · " + url,
    presetNoLink: "Load · ⚠ no link saved",
    presetDelTitle: "Delete",
    presetDelAria: (name) => "Delete " + name,
    songDefault: (n) => "Song " + n,
    saveNamePh: "Song name",
    saveBtn: "Save",
    cancelBtn: "Cancel",
    savedFlash: (name) => `"${name}" saved`,
    savePreset: "Save current setup",
    resetConfirm: "Tap again to reset",
    resetAll: "Reset everything",
    toHome: "Back to start",
    prevBtn: "‹ Prev",
    nextBtn: "Next ›",
    fsBtn: "Fullscreen",
    fsExit: "Exit fullscreen",
    fsTitle: "Browser fullscreen — auto page turns keep working",
    fsExitTitle: "Leave fullscreen",
    focusOn: "Score only",
    focusOff: "Show controls",
    kbhintLine: (
      <>
        <b>Space</b> play · <b>←→</b> pages · <b>M</b> turn now
      </>
    ),
    kbMoreTitle: "All shortcuts",
    kbTitle: "Shortcuts",
    kbRows: [
      ["Space", "Start · pause"],
      ["← →", "Prev · next page"],
      ["↑ ↓", "Volume"],
      ["M", "Turn now (tap timing)"],
      ["Shift", "Turn now (timing mode)"],
      ["1~9", "Go to page"],
      ["Enter", "Score-only view"],
      ["0 · Esc", "Back to start"],
    ],
    emptyStage: "Open a score PDF to show it here.",
    prevPage: "Previous page",
    nextPage: "Next page",
    toPageCue: (n) => "to p." + n,
    nextPageCue: "next page",
    flipHintText: (sec, jump) => `${jump} in ${sec}s ›`,
    ytExpand: "Show the video",
    ytCollapse: "Hide the video",
    sheetTitle: "Settings",
    sheetCloseAria: "Close settings",
    mbSet: "Set up",
    mbSetAria: "Open settings",
    tuneBadge: "Timing mode",
    tuneListTitle: "View & edit tapped times",
    tuneListAria: "Open timing list",
    resume: "Play",
    done: "Done",
    seekAria: "Position",
    tuneTapPickBelow: "Choose a destination page below",
    tuneTapAgainNext: (n) => `Tap again → next page (p.${n})`,
    tuneTapLast: "Last page reached — tap Done",
    tuneTapPages: (a, b) => `Turn now — p.${a}→${b}`,
    pickAria: "Jump to which page",
    pickTime: (t) => "tapped at " + t,
    pickTitle: "Jump to which page?",
    pickNext: (n) => `Next page (p.${n})`,
    pickPagesAria: "Jump to this page",
    pickPageTitle: (n) => "To p." + n,
    pickCancel: "Cancel (don't record)",
    countdownAria: "Starting countdown",
    getReady: "Get ready",
    cancel: "Cancel",
    privacyNote: "Your score PDF stays in this browser — it is never uploaded.",
    tooEarly: (a, b, tm) =>
      `Earlier than the p.${a}→${b} turn (${tm}) · tap a bit later`,
    lastPageToast: "Last page — use a page number button to jump back",
    turnSaved: (a, b, tm) => `Turn p.${a}→${b} saved at ${tm}`,
    turnSavedCleared: (n) => ` · cleared ${n} later time(s)`,
    turnSavedDropped: " · keep tapping from here",
    needTimeFirst: "Tap or type a time first",
    notBeforePrev: (tm) => `Can't be earlier than the previous turn (${tm})`,
    notAfterNext: (tm) => `Can't be later than the next turn (${tm})`,
    nudged: (a, b, tm) => `Turn p.${a}→${b}: ${tm}`,
    savedNoLink: (name) => `"${name}" saved · no YouTube link was saved.`,
    presetLoaded: (name) =>
      `"${name}" loaded · open the score PDF to restore its times.`,
    resetDone: "Everything reset (saved songs kept).",
    endedMsg: "The track ended. Press Start to play again.",
    endedToast: "Track ended · press Start to replay",
    noPdfPlay: "Playing without a score. You can open a PDF anytime.",
    badLink: "Check the YouTube link — just paste the full URL.",
    badLinkToast: "Check the YouTube link · paste the URL in Settings",
    notReady: "The player is loading — try again in a moment.",
    notReadyToast: "Player is loading · try again in a moment",
    tuneIntro: "Listen along and tap 'Turn now' (or Shift) at every page turn.",
    tuneDone: (n) => `${n} turn time(s) saved · press Start to use them.`,
    pdfCleared: "Score removed · reopen it to restore the times",
    pdfLoading: "Loading score…",
    pdfLoadedMsg: (n) => `${n} pages · add a YouTube link and press Start.`,
    pdfPassword:
      "This PDF is password-protected. Remove the password and retry.",
    pdfInvalid: "Not a valid PDF, or the file is damaged.",
    pdfFail: (m) => "Couldn't open the PDF: " + m,
    volToast: (n) => "Volume " + n + "%",
    ytErr: (code) => {
      const codes = {
        2: "The link (video ID) is invalid.",
        5: "This video can't be played in the embedded player.",
        100: "Video not found — it may be deleted or private.",
        101: "The uploader has disabled external playback.",
        150: "The uploader has disabled external playback.",
        153: "YouTube couldn't verify this site's referrer.",
      };
      return (
        (codes[code] || `Playback error (code ${code}).`) +
        " Make sure the YouTube link is public."
      );
    },
    backLink: "‹ Practice player",
    mTitle: "Count-In · Online Metronome",
    mStart: "Start",
    mStop: "Stop",
    tapTempo: "Tap tempo",
    beatsLabel: "Beats",
    beatNone: "None",
    beatN: (n) => n + " beats",
    accentLabel: "Accent",
    accentDesc: "Different first beat",
    accentNeedBeats: " (pick beats first)",
    soundLabel: "Sound",
    volumeLabel: "Volume",
    mHint: (
      <>
        <b>Space</b> start/stop · <b>↑↓</b> ±1 · <b>←→</b> ±5 · <b>T</b> tap
      </>
    ),
  },
};
