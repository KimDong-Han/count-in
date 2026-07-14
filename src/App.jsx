import { useCallback, useEffect, useRef, useState } from "react";
import { usePdf } from "./usePdf";
import { useYouTube, extractId } from "./useYouTube";
import { playBeep, playStick } from "./sound";
import { parseTime, fmt, fmtCue } from "./time";
import { navigate } from "./router.js";
import { currentDark, setDark } from "./theme.js";
import { STR, detectLang, saveLang, applyLangAttr } from "./i18n.jsx";
import { CuePanel } from "./components/CuePanel.jsx";
import { PlaybackOverlays } from "./components/PlaybackOverlays.jsx";
import { SiteInfo } from "./components/SiteInfo.jsx";
import {
  searchSharedPresets,
  getSharedPreset,
  sharePreset,
  updateSharedPreset,
  deleteSharedPreset,
} from "./share.js";
import {
  Check,
  Drum,
  Eraser,
  FileText,
  Maximize,
  Maximize2,
  Minimize,
  Minimize2,
  Moon,
  Music,
  Pause,
  Play,
  Save,
  Settings2,
  Share2,
  Sun,
  Target,
  Timer,
  Volume2,
  X,
} from "lucide-react";

// 좁은 화면·세로 태블릿: 악보를 기본 화면으로 두고 설정을 하단 시트로 (styles.css 미디어 쿼리와 동일해야 함)
const SHEET_MQ =
  "(max-width:760px), (max-width:1080px) and (orientation:portrait)";

const guideDayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

export default function App() {
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const ytHostRef = useRef(null);
  const ytInnerRef = useRef(null); // 유튜브 플레이어를 심는 imperative div
  const barRef = useRef(null);
  const clockRef = useRef(null);
  const flipHintRef = useRef(null); // 넘김 예고 배지 (rAF 루프에서 직접 갱신)
  const flipCueRef = useRef(null); // 큰 카운트다운 (악보 오른쪽 여백, rAF 루프에서 직접 갱신)
  const cueRowsRef = useRef(null);
  const kbWrapRef = useRef(null);

  const pdf = usePdf(canvasRef, stageRef);
  const yt = useYouTube();

  // ---- UI 상태 ----
  const [url, setUrl] = useState("");
  const [firstRunDismissed, setFirstRunDismissed] = useState(() => {
    try {
      return localStorage.getItem("cin:first-run-guide-until") === guideDayKey();
    } catch {
      return false;
    }
  });
  const [delay, setDelay] = useState(4);
  const [volume, setVolume] = useState(80);
  const [rate, setRate] = useState(1); // 재생 속도 0.5 | 0.75 | 1
  const [soundMode, setSoundMode] = useState("stick"); // 'stick' | 'beep' | 'off'
  const [flipMode, setFlipMode] = useState("cue"); // 'cue' | 'interval'
  const [ivMin, setIvMin] = useState(0);
  const [ivSec, setIvSec] = useState(20);
  const [loopOn, setLoopOn] = useState(false);
  const [preLoad, setPreLoad] = useState(true); // 카운트다운 동안 미리 재생(버퍼) 준비
  const [noWait, setNoWait] = useState(false); // 카운트다운 없이 바로 시작
  const [cueText, setCueText] = useState([]); // 넘김 시각 문자열 배열 (길이 seq.length-1)
  const [seq, setSeq] = useState([]); // 연주 순서(쪽 번호 나열) — 도돌이표·다카포로 같은 쪽이 여러 번 나올 수 있음
  const [armed, setArmed] = useState(false); // 시작 눌러 재생/준비 중
  const [isPlaying, setIsPlaying] = useState(false);
  const [countText, setCountText] = useState(null); // null=숨김, 숫자 or '▶'
  const [msg, setMsg] = useState(() => ({ text: "", kind: "ok" }));
  const [tapCursor, setTapCursor] = useState(0); // 탭으로 기록할 다음 전환 index
  const [tuneMode, setTuneMode] = useState(false); // 타이밍 입력 모드 (카운트다운 없이 재생하며 찍기)
  // 도돌이표 있는 곡: 타이밍 입력 모드에서 찍을 때마다 몇 페이지로 갈지 물어봄 (기본 꺼짐)
  const [tuneRepeat, setTuneRepeat] = useState(false);
  const [darkMode, setDarkMode] = useState(currentDark); // 🌙/☀️ 토글 표시용
  const flipTheme = () => {
    setDark(!darkMode);
    setDarkMode(!darkMode);
  };
  // 한/영 전환 — cin:lang 기억, 기본은 브라우저 언어. followLoop(rAF)는 langRef로 읽는다.
  const [lang, setLang] = useState(detectLang);
  const langRef = useRef(lang);
  useEffect(() => {
    langRef.current = lang;
    applyLangAttr(lang);
  }, [lang]);
  const t = (key, ...args) => {
    const v = STR[lang][key] ?? STR.ko[key];
    return typeof v === "function" ? v(...args) : v;
  };
  const tr = t; // 지역변수 t(시각)와 겹치는 스코프용 별칭
  const flipLang = () => {
    const nl = lang === "ko" ? "en" : "ko";
    saveLang(nl);
    setLang(nl);
  };
  const [pendingTap, setPendingTap] = useState(null); // 도돌이표 곡에서 찍은 순간 {i, t} — 목적지 선택 대기
  const [focus, setFocus] = useState(false); // 집중 모드(컨트롤 숨김)
  const [presets, setPresets] = useState(() => {
    // 저장한 곡 프리셋 목록
    try {
      return JSON.parse(localStorage.getItem("cin:presets") || "[]");
    } catch {
      return [];
    }
  });
  const [toast, setToast] = useState(null); // 짧은 조작 피드백 {text,id}
  const [saveOpen, setSaveOpen] = useState(false); // 프리셋 저장 인라인 입력 열림
  const [saveName, setSaveName] = useState("");
  const [confirmReset, setConfirmReset] = useState(false); // 초기화 2단계 확인
  const [savedFlash, setSavedFlash] = useState(null); // 저장 직후 피드백 {name, chipId}
  const [showKeys, setShowKeys] = useState(false); // 단축키 전체 팝오버
  const [showPresetSearch, setShowPresetSearch] = useState(false);
  const [presetSearchQuery, setPresetSearchQuery] = useState("");
  const [presetSearchResults, setPresetSearchResults] = useState(null);
  const [presetSearchBusy, setPresetSearchBusy] = useState(false);
  const [presetSearchBy, setPresetSearchBy] = useState("name"); // name|singer|uploader
  // 공유 프리셋 검색 (API 연동, 서버 미연결 시 share.js가 데모로 폴백)
  const runPresetSearch = async () => {
    if (!presetSearchQuery.trim()) return;
    setPresetSearchBusy(true);
    try {
      setPresetSearchResults(
        await searchSharedPresets(presetSearchQuery, presetSearchBy),
      );
    } finally {
      setPresetSearchBusy(false);
    }
  };
  // 공유 프리셋 삭제 (검색 결과 카드에서, 아이템 비번 확인)
  const [deleteTarget, setDeleteTarget] = useState(null); // 삭제하려는 id
  const [deletePw, setDeletePw] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState("");
  const confirmDelete = async (id) => {
    if (!deletePw.trim()) return;
    setDeleteBusy(true);
    setDeleteErr("");
    try {
      await deleteSharedPreset(id, deletePw.trim());
      setPresetSearchResults((r) => (r ? r.filter((p) => p.id !== id) : r));
      setDeleteTarget(null);
      setDeletePw("");
    } catch (e) {
      setDeleteErr(
        e.message === "wrong-password" ? t("delWrongPw") : t("delFail"),
      );
    } finally {
      setDeleteBusy(false);
    }
  };
  // 검색 결과에서 하나 선택 → 블롭 받아서 loadPreset 적용 + 수정 대상으로 기억
  const loadSharedPreset = async (id) => {
    try {
      const blob = await getSharedPreset(id);
      loadPreset(blob); // loadedShareId를 null로 리셋함
      setLoadedShareId(id);
      setLoadedShareName(blob.name || "");
      setLoadedShareSinger(blob.singer || "");
      setShowPresetSearch(false);
    } catch (e) {
      setMsg({ text: t("shareLoadFail"), kind: "err" });
    }
  };
  // 공유 모달 — 로컬 저장곡이 아니라 "지금 설정한 것"을 그대로 올린다.
  // mode: "new"(새로 공유·POST) | "edit"(불러온 공유 덮어쓰기·PATCH)
  const [showShare, setShowShare] = useState(false);
  const [shareMode, setShareMode] = useState("new");
  const [shareTitle, setShareTitle] = useState("");
  const [shareSinger, setShareSinger] = useState("");
  const [shareUploader, setShareUploader] = useState("");
  const [sharePw, setSharePw] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [shareDone, setShareDone] = useState(null); // 성공 시 공유한 곡 이름
  // 불러온 공유 프리셋 추적 (수정 대상)
  const [loadedShareId, setLoadedShareId] = useState(null);
  const [loadedShareName, setLoadedShareName] = useState("");
  const [loadedShareSinger, setLoadedShareSinger] = useState("");
  const openShare = (mode = "new") => {
    setShareMode(mode);
    setShareTitle(mode === "edit" ? loadedShareName : "");
    setShareSinger(mode === "edit" ? loadedShareSinger : "");
    setShareUploader("");
    setSharePw("");
    setShareDone(null);
    setShowShare(true);
  };
  const shareValid =
    !!url.trim() &&
    !!shareTitle.trim() &&
    !!shareSinger.trim() &&
    !!sharePw.trim() &&
    (shareMode === "edit" || !!shareUploader.trim());
  const submitShare = async () => {
    if (!shareValid) return;
    setShareBusy(true);
    try {
      const payload = {
        song_name: shareTitle.trim(),
        singer: shareSinger.trim(),
        uploader_pw: sharePw.trim(),
        url,
        flip_mode: flipMode,
        ivMin,
        ivSec,
        cues: cueTextRef.current,
        seq: seqRef.current,
        total_page: pdf.total,
      };
      if (shareMode === "edit") {
        await updateSharedPreset(loadedShareId, payload);
        setLoadedShareName(shareTitle.trim());
        setLoadedShareSinger(shareSinger.trim());
      } else {
        await sharePreset({ ...payload, uploader: shareUploader.trim() });
      }
      setShareDone(shareTitle.trim());
    } catch (e) {
      setMsg({
        text: e.message === "wrong-password" ? t("delWrongPw") : t("shareFail"),
        kind: "err",
      });
    } finally {
      setShareBusy(false);
    }
  };
  const [adv, setAdv] = useState(() => {
    // 세부 설정 펼침 여부 (기억)
    try {
      return localStorage.getItem("cin:ui:adv") === "1";
    } catch {
      return false;
    }
  });
  // 시트 모드: 사이드바가 하단 시트로 바뀌는 좁은 화면·세로 태블릿
  const [sheetMode, setSheetMode] = useState(
    () => window.matchMedia(SHEET_MQ).matches,
  );
  // 처음 들어오면 설정부터 하도록 시트를 열어둔다 (시작하면 자동으로 닫힘)
  const [sheetOpen, setSheetOpen] = useState(
    () => window.matchMedia(SHEET_MQ).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(SHEET_MQ);
    const onChange = () => setSheetMode(mq.matches);
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);
  // 미니 반주 영상 접기: 악보를 가리지 않게 칩으로 축소 (소리는 계속) — 시트 모드에선 기본 접힘
  const [ytMin, setYtMin] = useState(
    () => window.matchMedia(SHEET_MQ).matches,
  );
  const sheetModeRef = useRef(sheetMode);
  useEffect(() => {
    sheetModeRef.current = sheetMode;
  }, [sheetMode]);
  // 브라우저 전체화면 (Fullscreen API) — 페이지 전체가 들어가므로 자동 넘김·하단 바 그대로 동작.
  // iPhone Safari 등 미지원 브라우저에선 버튼 자체를 숨긴다.
  const fsSupported = !!(
    document.documentElement.requestFullscreen ||
    document.documentElement.webkitRequestFullscreen
  );
  const [isFs, setIsFs] = useState(false);
  useEffect(() => {
    const onFs = () =>
      setIsFs(
        !!(document.fullscreenElement || document.webkitFullscreenElement),
      );
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("webkitfullscreenchange", onFs);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("webkitfullscreenchange", onFs);
    };
  }, []);
  const enterFs = () => {
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) return;
    const p = req.call(el);
    if (p && p.catch) p.catch(() => {}); // 기기 정책으로 거부돼도 조용히
  };
  const toggleFs = () => {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) exit.call(document);
    } else {
      enterFs();
    }
  };
  // 모바일 브라우저 주소창·툴바 때문에 100vh가 실제 보이는 높이보다 커서
  // 악보 하단이 고정 바 뒤로 가려지는 문제 — 실제 높이를 재서 --appvh로 공급
  useEffect(() => {
    const setVh = () =>
      document.documentElement.style.setProperty(
        "--appvh",
        window.innerHeight + "px",
      );
    setVh();
    window.addEventListener("resize", setVh);
    window.addEventListener("orientationchange", setVh);
    const vv = window.visualViewport;
    if (vv) vv.addEventListener("resize", setVh);
    return () => {
      window.removeEventListener("resize", setVh);
      window.removeEventListener("orientationchange", setVh);
      if (vv) vv.removeEventListener("resize", setVh);
    };
  }, []);

  // ---- 최신값을 rAF/콜백에서 읽기 위한 ref 미러 ----
  const totalRef = useRef(0);
  const flipModeRef = useRef(flipMode);
  const cuesRef = useRef([]); // parseTime 적용된 숫자 배열
  const cueTextRef = useRef([]);
  const volumeRef = useRef(volume);
  const rateRef = useRef(rate);
  const soundModeRef = useRef(soundMode);
  const loopRef = useRef(loopOn);
  const preLoadRef = useRef(preLoad);
  const noWaitRef = useRef(noWait);
  const ivRef = useRef({ m: 0, s: 20 });
  const seqRef = useRef([]); // 연주 순서 미러
  const syncCursorRef = useRef(null); // followLoop(rAF)에서 최신 syncCursor 호출용
  const schedSeqRef = useRef([]); // buildSchedule이 실제 쓴 순서 (cue 외 모드는 1..N)
  const stepRef = useRef(0); // 현재 연주 순서상 위치(스텝 인덱스)
  const armedRef = useRef(false);
  const tapCursorRef = useRef(0);
  const tuneModeRef = useRef(false);
  const tuneTimeRef = useRef(null); // 타이밍 입력 바의 시각 표시 (rAF에서 직접 갱신)
  const tuneSeekRef = useRef(null); // 타이밍 입력 바의 시크 바 (rAF에서 직접 갱신)
  const seekDragRef = useRef(false); // 시크 바 드래그 중엔 rAF 갱신 중지
  const delayRef = useRef(delay);
  const pageTimesRef = useRef([0]);
  const followRef = useRef(false);
  const rafRef = useRef(null);
  const audioRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const primeTimerRef = useRef(null);
  const pendingIdRef = useRef(null);
  const toastTimerRef = useRef(null);
  const toastIdRef = useRef(0);
  const resetTimerRef = useRef(null);
  const savedTimerRef = useRef(null);

  useEffect(() => {
    totalRef.current = pdf.total;
  }, [pdf.total]);
  useEffect(() => {
    flipModeRef.current = flipMode;
  }, [flipMode]);
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);
  useEffect(() => {
    rateRef.current = rate;
    if (armedRef.current) yt.setRate(rate);
  }, [rate]); // eslint-disable-line
  useEffect(() => {
    soundModeRef.current = soundMode;
  }, [soundMode]);
  useEffect(() => {
    loopRef.current = loopOn;
  }, [loopOn]);
  useEffect(() => {
    preLoadRef.current = preLoad;
  }, [preLoad]);
  useEffect(() => {
    noWaitRef.current = noWait;
  }, [noWait]);
  useEffect(() => {
    ivRef.current = { m: ivMin, s: ivSec };
  }, [ivMin, ivSec]);
  useEffect(() => {
    armedRef.current = armed;
  }, [armed]);
  useEffect(() => {
    tapCursorRef.current = tapCursor;
  }, [tapCursor]);
  useEffect(() => {
    delayRef.current = delay;
  }, [delay]);

  // 유튜브 플레이어용 imperative div를 최초 1회 생성 (React가 건드리지 않도록)
  useEffect(() => {
    if (ytHostRef.current && ytHostRef.current.childElementCount === 0) {
      const inner = document.createElement("div");
      inner.style.width = "100%";
      inner.style.height = "100%";
      ytHostRef.current.appendChild(inner);
      ytInnerRef.current = inner;
    }
  }, []);

  // ---- 사운드 ----
  const ensureAudio = useCallback(() => {
    if (!audioRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioRef.current = new AC();
    }
    if (audioRef.current && audioRef.current.state === "suspended")
      audioRef.current.resume();
  }, []);

  const tickSound = useCallback(
    (accent) => {
      if (soundModeRef.current === "off") return;
      ensureAudio();
      const ctx = audioRef.current;
      if (!ctx) return;
      if (soundModeRef.current === "stick")
        playStick(ctx, volumeRef.current, accent);
      else playBeep(ctx, volumeRef.current, accent);
    },
    [ensureAudio],
  );

  // ---- 짧은 조작 피드백 토스트 (집중 모드에서도 보임) ----
  const showToast = useCallback((text, ms) => {
    toastIdRef.current += 1;
    setToast({ text, id: toastIdRef.current });
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), ms || 1400);
  }, []);

  // ---- 넘김 스케줄: pageTimes[k] = 연주 순서 k번째 스텝(schedSeq[k]쪽)을 띄울 곡 진행 시각(초) ----
  const intervalSec = () => {
    let m = parseInt(ivRef.current.m, 10);
    if (isNaN(m) || m < 0) m = 0;
    let s = parseInt(ivRef.current.s, 10);
    if (isNaN(s) || s < 0) s = 0;
    let sec = m * 60 + s;
    if (sec < 1) sec = 1;
    return sec;
  };

  const buildSchedule = useCallback(() => {
    const total = totalRef.current;
    let pt = [0];
    let sq = [];
    for (let i = 1; i <= total; i++) sq.push(i); // 기본: 1..N 순서 (cue 외 모드)
    if (total > 1) {
      if (flipModeRef.current === "cue") {
        if (seqRef.current.length) sq = seqRef.current.slice();
        pt = [0];
        for (let i = 0; i < sq.length - 1; i++) {
          const c = cuesRef.current[i];
          pt.push(c == null || isNaN(c) ? Infinity : c); // 미입력 = 자동으로 넘기지 않음(수동 대기)
        }
      } else {
        const iv = intervalSec();
        pt = [];
        for (let i = 0; i < total; i++) pt.push(iv * i);
      }
    }
    pageTimesRef.current = pt;
    schedSeqRef.current = sq;
  }, [yt]);

  // 곡 진행 위치를 따라가며 페이지 + 진행바 갱신
  const followLoop = useCallback(() => {
    if (!followRef.current) return;
    const t = yt.getTime() || 0;
    const dur = yt.getDuration() || 0;
    const pt = pageTimesRef.current;

    // 현재 시각에 해당하는 연주 순서 스텝 → 그 스텝의 쪽 (도돌이표로 앞쪽일 수도 있음)
    let step = 0;
    for (let i = 0; i < pt.length; i++) {
      if (t + 0.12 >= pt[i]) step = i;
      else break;
    }
    stepRef.current = step;
    const targetPage = schedSeqRef.current[step] || 1;
    if (targetPage !== pdf.pageNumRef.current) pdf.show(targetPage);

    // 다음 넘김까지 진행바
    const cur = step;
    const curStart = isFinite(pt[cur]) ? pt[cur] : 0;
    let nextAt = cur + 1 < pt.length ? pt[cur + 1] : dur || curStart + 1;
    if (!isFinite(nextAt)) nextAt = dur || curStart + 1;
    const denom = Math.max(0.001, nextAt - curStart);
    const pct = Math.max(0, Math.min(100, ((t - curStart) / denom) * 100));
    if (barRef.current) barRef.current.style.width = pct + "%";
    if (clockRef.current)
      clockRef.current.textContent = dur ? fmt(t) + " / " + fmt(dur) : fmt(t);

    // 다음에 찍을 전환(커서)이 재생 위치를 따라가게 — 되감으면 그 줄부터 다시 찍힘
    syncCursorRef.current && syncCursorRef.current(t);

    // 타이밍 입력 모드: 하단 바의 시각·시크 바 갱신 (드래그 중엔 손대지 않음)
    if (tuneModeRef.current) {
      if (tuneTimeRef.current)
        tuneTimeRef.current.textContent = dur
          ? fmt(t) + " / " + fmt(dur)
          : fmt(t);
      const sk = tuneSeekRef.current;
      if (sk && dur && !seekDragRef.current) {
        sk.max = dur;
        sk.value = t;
      }
    }

    // 넘김 예고: 다음 넘김 3초 전부터 표시.
    // 악보 오른쪽 여백이 넉넉하면 큰 숫자 카운트다운, 좁으면(모바일·가로 악보) 우상단 작은 배지.
    const fh = flipHintRef.current;
    const fc = flipCueRef.current;
    if (fh && fc) {
      const flipAt =
        cur + 1 < pt.length && isFinite(pt[cur + 1]) ? pt[cur + 1] : null;
      const remain = flipAt == null ? null : flipAt - t;
      if (remain != null && remain > 0 && remain <= 3) {
        const sec = Math.ceil(remain);
        const L = STR[langRef.current] || STR.ko;
        // 도돌이표 등으로 다음 스텝이 '다음 페이지'이 아니면 목적지 쪽 번호로 안내
        const nextPg = schedSeqRef.current[cur + 1];
        const jumpTxt =
          nextPg != null && nextPg !== targetPage + 1
            ? L.toPageCue(nextPg)
            : L.nextPageCue;
        let gap = 0;
        if (stageRef.current && canvasRef.current) {
          gap =
            stageRef.current.getBoundingClientRect().right -
            canvasRef.current.getBoundingClientRect().right;
        }
        if (gap >= 110) {
          fc.style.width = gap + "px";
          const numEl = fc.firstElementChild;
          // 여백 폭에 비례하되 36~52px로 제한 — 눈에 띄면서 악보를 압도하지 않게
          numEl.style.fontSize =
            Math.round(Math.min(52, Math.max(36, gap * 0.3))) + "px";
          if (numEl.textContent !== String(sec)) {
            numEl.textContent = sec;
            numEl.classList.remove("pulse");
            void numEl.offsetWidth; // 리플로우로 펄스 애니메이션 재시작
            numEl.classList.add("pulse");
          }
          const lbl = fc.lastElementChild;
          if (lbl) lbl.textContent = jumpTxt + " ›";
          fc.classList.add("show");
          fh.classList.remove("show");
        } else {
          fh.textContent = L.flipHintText(sec, jumpTxt);
          fh.classList.add("show");
          fc.classList.remove("show");
        }
      } else {
        fh.classList.remove("show");
        fc.classList.remove("show");
      }
    }

    rafRef.current = requestAnimationFrame(followLoop);
  }, [yt, pdf]);

  const startFollowing = useCallback(() => {
    followRef.current = true;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    followLoop();
  }, [followLoop]);

  const stopFollowing = useCallback(() => {
    followRef.current = false;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (flipHintRef.current) flipHintRef.current.classList.remove("show");
    if (flipCueRef.current) flipCueRef.current.classList.remove("show");
  }, []);

  // ---- cue(연주 순서+타이밍) 저장/불러오기 ----
  // 저장 형식: {seq:[쪽 번호…], times:[…]} — 예전 형식(times 배열만)도 읽을 수 있음
  const cueKey = (id, total) => "cues:" + id + ":" + total;
  const linearSeq = (total) => {
    const sq = [];
    for (let i = 1; i <= total; i++) sq.push(i);
    return sq;
  };
  const saveCues = useCallback(
    (arr, sq) => {
      const id = pendingIdRef.current || extractId(url);
      if (id && totalRef.current > 0) {
        try {
          localStorage.setItem(
            cueKey(id, totalRef.current),
            JSON.stringify({ seq: sq || seqRef.current, times: arr }),
          );
        } catch (e) {}
      }
    },
    [url],
  );

  const recomputeCues = useCallback(
    (arr) => {
      cueTextRef.current = arr;
      cuesRef.current = arr.map(parseTime);
      buildSchedule();
    },
    [buildSchedule],
  );

  // PDF 로드/URL 변경 시 cue 슬롯 크기 맞추고 저장된 순서·타이밍 불러오기
  const syncCueSlots = useCallback(() => {
    const total = totalRef.current;
    let sq = linearSeq(total);
    let arr = new Array(Math.max(0, sq.length - 1)).fill("");
    const id = extractId(url);
    if (id && total > 0) {
      try {
        const raw = localStorage.getItem(cueKey(id, total));
        if (raw) {
          const s = JSON.parse(raw);
          if (Array.isArray(s)) {
            // 예전 형식: 타이밍 배열만 (순서는 1..N)
            arr = arr.map((_, i) => (s[i] != null ? s[i] : ""));
          } else if (
            s &&
            Array.isArray(s.seq) &&
            Array.isArray(s.times) &&
            s.seq.length >= 1 &&
            s.seq.every((p) => Number.isInteger(p) && p >= 1 && p <= total)
          ) {
            sq = s.seq.slice();
            arr = new Array(sq.length - 1)
              .fill("")
              .map((_, i) => (s.times[i] != null ? s.times[i] : ""));
          }
        }
      } catch (e) {}
    }
    setSeq(sq);
    seqRef.current = sq;
    setCueText(arr);
    recomputeCues(arr);
    setTapCursor(0);
  }, [url, recomputeCues]);

  useEffect(() => {
    totalRef.current = pdf.total;
    syncCueSlots();
  }, [pdf.total]); // eslint-disable-line
  useEffect(() => {
    if (pdf.total > 0) syncCueSlots();
  }, [url]); // eslint-disable-line

  const setCueAt = (i, val) => {
    setCueText((prev) => {
      const next = [...prev];
      next[i] = val;
      recomputeCues(next);
      saveCues(next);
      return next;
    });
  };
  // 전환 i의 시각을 기록(tAt이 있으면 그 시각, 없으면 지금). destPage를 주면 그 페이지로
  // 점프(도돌이표·다카포), 없으면 기존 순서의 다음 스텝(없으면 다음 페이지).
  const recordAt = (i, destPage, tAt) => {
    if (!armedRef.current) return;
    const from = seqRef.current[i];
    if (from == null) return;
    const t = tAt != null ? tAt : yt.getTime() || 0;
    // 앞쪽에 이미 찍힌 넘김보다 빠른 시각이면 순서가 꼬이므로 저장하지 않는다
    for (let k = i - 1; k >= 0; k--) {
      const p = cuesRef.current[k];
      if (p == null || !isFinite(p)) continue;
      if (t <= p) {
        showToast(
          tr("tooEarly", seqRef.current[k], seqRef.current[k + 1], fmtCue(p)),
          2600,
        );
        return;
      }
      break;
    }
    const dest =
      destPage != null
        ? destPage
        : seqRef.current[i + 1] != null
          ? seqRef.current[i + 1]
          : from + 1;
    if (dest > totalRef.current) {
      showToast(tr("lastPageToast"), 2600);
      return;
    }
    const stamp = fmtCue(t); // 0.1초 단위로 기록 (초 단위 절사보다 정확)
    let sq = seqRef.current;
    let next;
    let dropped = 0; // 목적지가 바뀌어 잘려나간 이후 스텝 수
    let cleared = 0; // 시각 순서가 꼬여 지운 뒤 타이밍 수
    if (sq[i + 1] !== dest) {
      dropped = Math.max(0, sq.length - (i + 2));
      sq = sq.slice(0, i + 1).concat([dest]);
      next = cueTextRef.current.slice(0, i);
      next[i] = stamp;
    } else {
      sq = sq.slice();
      next = [...cueTextRef.current];
      next[i] = stamp;
      // 새 시각보다 앞서게 된 뒤쪽 타이밍은 무효 — 지워서 이어서 다시 찍게 한다
      for (let k = i + 1; k < next.length; k++) {
        const v = parseTime(next[k]);
        if (v != null && isFinite(v) && v <= t) {
          next[k] = "";
          cleared++;
        }
      }
    }
    setSeq(sq);
    seqRef.current = sq;
    setCueText(next);
    recomputeCues(next);
    saveCues(next, sq);
    setTapCursor(i + 1);
    showToast(
      tr("turnSaved", from, dest, stamp) +
        (cleared
          ? tr("turnSavedCleared", cleared)
          : dropped
            ? tr("turnSavedDropped")
            : ""),
      cleared || dropped ? 2600 : 1400,
    );
  };
  const nowAt = (i) => recordAt(i, null);
  // 목적지 선택을 마치면(확정/취소) 멈춰둔 음악 재개
  const resumeAfterPick = () => {
    yt.play();
    startFollowing();
    setIsPlaying(true);
  };
  // 찍은 순간(pendingTap.t)으로 확정 기록 — destPage 없으면 다음 페이지
  const commitPending = (destPage) => {
    const p = pendingTap;
    setPendingTap(null);
    if (!p) return;
    if (seqRef.current.length <= 400) recordAt(p.i, destPage, p.t); // 폭주 방지
    resumeAfterPick();
  };
  const cancelPending = () => {
    setPendingTap(null);
    resumeAfterPick();
  };
  const tap = () => {
    const idx = tapCursorRef.current;
    if (seqRef.current[idx] == null) return;
    if (pendingTap) {
      // 목적지 선택 대기 중 🎯/M 재탭 = "다음 페이지" 확정 (시각은 처음 찍은 순간)
      commitPending(null);
      return;
    }
    if (tuneModeRef.current && tuneRepeat) {
      // 도돌이표 곡: 시각을 기록해 두고 음악을 멈춘 뒤 몇 페이지로 갈지 물어봄
      if (!armedRef.current) return;
      setPendingTap({ i: idx, t: yt.getTime() || 0 });
      yt.pause();
      stopFollowing();
      setIsPlaying(false);
      return;
    }
    recordAt(idx, null);
  };
  const toggleTuneRepeat = () => setTuneRepeat((r) => !r);

  // ---- 넘김 목록 수동 편집: 출발/도착 페이지 변경, 줄 추가·삭제 ----
  const setSeqAt = (idx, p) => {
    const sq = seqRef.current.slice();
    if (idx < 0 || idx >= sq.length) return;
    sq[idx] = p;
    setSeq(sq);
    seqRef.current = sq;
    recomputeCues(cueTextRef.current);
    saveCues(cueTextRef.current, sq);
  };
  const addCueRow = () => {
    const total = totalRef.current;
    if (!total) return;
    const sq = seqRef.current.length ? seqRef.current.slice() : [1];
    const last = sq[sq.length - 1];
    sq.push(last < total ? last + 1 : 1); // 마지막 쪽이면 처음으로(도돌이 가정)
    const next = [...cueTextRef.current, ""];
    setSeq(sq);
    seqRef.current = sq;
    setCueText(next);
    recomputeCues(next);
    saveCues(next, sq);
  };
  const removeCueRow = (i) => {
    const sq = seqRef.current.slice();
    if (i < 0 || i + 1 >= sq.length) return;
    sq.splice(i + 1, 1);
    const next = [...cueTextRef.current];
    next.splice(i, 1);
    setSeq(sq);
    seqRef.current = sq;
    setCueText(next);
    recomputeCues(next);
    saveCues(next, sq);
    if (tapCursorRef.current > next.length) setTapCursor(next.length);
  };
  // 커서(다음에 찍을 전환)를 재생 위치에 맞춘다 — 시크로 되감으면 그 지점의 줄이 자동으로 대상이 됨
  const cursorForTime = (t) => {
    const cs = cuesRef.current;
    const n = Math.max(0, seqRef.current.length - 1);
    for (let i = 0; i < n; i++) {
      const c = cs[i];
      if (c == null || !isFinite(c) || c > t + 0.05) return i;
    }
    return n;
  };
  const syncCursor = (t) => {
    const c = cursorForTime(t);
    if (c !== tapCursorRef.current) setTapCursor(c);
  };
  syncCursorRef.current = syncCursor;
  // 찍어둔 시각을 ±0.5초 미세 조정 (이웃 타이밍의 순서는 넘지 않게)
  const nudgeCue = (i, delta) => {
    const c = cuesRef.current[i];
    if (c == null || isNaN(c)) {
      showToast(t("needTimeFirst"));
      return;
    }
    const nv = Math.max(0, c + delta);
    for (let k = i - 1; k >= 0; k--) {
      const p = cuesRef.current[k];
      if (p == null || !isFinite(p)) continue;
      if (nv <= p) {
        showToast(t("notBeforePrev", fmtCue(p)), 2000);
        return;
      }
      break;
    }
    for (let k = i + 1; k < cuesRef.current.length; k++) {
      const n = cuesRef.current[k];
      if (n == null || !isFinite(n)) continue;
      if (nv >= n) {
        showToast(t("notAfterNext", fmtCue(n)), 2000);
        return;
      }
      break;
    }
    setCueAt(i, fmtCue(nv));
    showToast(t("nudged", seqRef.current[i], seqRef.current[i + 1], fmtCue(nv)));
  };
  const clearCues = () => {
    const sq = linearSeq(totalRef.current); // 순서도 1..N 기본으로
    setSeq(sq);
    seqRef.current = sq;
    const arr = new Array(Math.max(0, sq.length - 1)).fill("");
    setCueText(arr);
    recomputeCues(arr);
    saveCues(arr, sq);
    setTapCursor(0);
  };

  // 타이밍 찍는 중엔 다음 찍을 줄이 항상 보이게 스크롤
  useEffect(() => {
    if (!armedRef.current) return;
    const box = cueRowsRef.current;
    const el = box && box.children[tapCursor];
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
  }, [tapCursor]);

  // ---- 곡 프리셋(설정 통째로) 저장/불러오기 ----
  const persistPresets = (list) => {
    setPresets(list);
    try {
      localStorage.setItem("cin:presets", JSON.stringify(list));
    } catch {}
  };
  const openSave = () => {
    clearTimeout(savedTimerRef.current);
    setSavedFlash(null);
    setSaveName(t("songDefault", presets.length + 1));
    setSaveOpen(true);
  };
  const confirmSave = () => {
    const def = t("songDefault", presets.length + 1);
    const trimmed = saveName.trim() || def;
    const preset = {
      id: "p" + Date.now(),
      name: trimmed,
      url,
      delay,
      volume,
      rate,
      soundMode,
      flipMode,
      ivMin,
      ivSec,
      loopOn,
      preLoad,
      noWait,
      cues: cueTextRef.current.slice(),
      seq: seqRef.current.slice(), // 연주 순서 (도돌이표 포함)
      pageCount: pdf.total,
    };
    // 같은 이름이면 덮어쓰기
    const idx = presets.findIndex((p) => p.name === trimmed);
    const list =
      idx >= 0
        ? presets.map((p, i) => (i === idx ? preset : p))
        : [...presets, preset];
    persistPresets(list);
    // 해당 영상의 cue 저장소도 갱신해, 나중에 같은 PDF를 열면 자동 복원되게
    const id = extractId(url);
    if (id && pdf.total > 0) {
      try {
        localStorage.setItem(
          cueKey(id, pdf.total),
          JSON.stringify({ seq: preset.seq, times: preset.cues }),
        );
      } catch (e) {}
    }
    setSaveOpen(false);
    // 저장 버튼 "✓ 저장됨" + 해당 칩 반짝임으로 피드백
    clearTimeout(savedTimerRef.current);
    setSavedFlash({ name: trimmed, chipId: preset.id });
    savedTimerRef.current = setTimeout(() => setSavedFlash(null), 1600);
    if (!extractId(url))
      setMsg({ text: t("savedNoLink", trimmed), kind: "err" });
  };
  const loadPreset = (p) => {
    stopPlayback();
    setLoadedShareId(null); // 로컬 프리셋 로드면 공유 수정 대상 해제
    setUrl(p.url ?? "");
    setDelay(p.delay ?? 4);
    setVolume(p.volume ?? 80);
    setRate(p.rate ?? 1);
    rateRef.current = p.rate ?? 1;
    setSoundMode(p.soundMode ?? "stick");
    soundModeRef.current = p.soundMode ?? "stick";
    // 'even'(곡 길이 균등)은 없어진 모드 — 예전 프리셋은 일정 간격으로 대체
    const fm = p.flipMode === "even" ? "interval" : (p.flipMode ?? "cue");
    setFlipMode(fm);
    flipModeRef.current = fm;
    setIvMin(p.ivMin ?? 0);
    setIvSec(p.ivSec ?? 20);
    ivRef.current = { m: p.ivMin ?? 0, s: p.ivSec ?? 20 };
    setLoopOn(!!p.loopOn);
    loopRef.current = !!p.loopOn;
    const pl = p.preLoad ?? true;
    setPreLoad(pl);
    preLoadRef.current = pl;
    setNoWait(!!p.noWait);
    noWaitRef.current = !!p.noWait;
    const cues = Array.isArray(p.cues) ? p.cues.slice() : [];
    const sq =
      Array.isArray(p.seq) && p.seq.length
        ? p.seq.slice()
        : linearSeq(p.pageCount || 0); // 예전 프리셋: 순서 없음 → 1..N
    setSeq(sq);
    seqRef.current = sq;
    setCueText(cues);
    recomputeCues(cues);
    setTapCursor(0);
    // 같은 PDF를 다시 열었을 때도 복원되도록 cue 저장소에 반영
    const id = extractId(p.url);
    if (id && p.pageCount > 0) {
      try {
        localStorage.setItem(
          cueKey(id, p.pageCount),
          JSON.stringify({ seq: sq, times: cues }),
        );
      } catch (e) {}
    }
    setMsg({ text: t("presetLoaded", p.name), kind: "ok" });
  };
  const deletePreset = (id) => {
    persistPresets(presets.filter((p) => p.id !== id));
  };

  // 저장한 곡(프리셋)만 남기고 나머지 전부 기본값으로 초기화 — 버튼 두 번 눌러 확정
  const resetClick = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => setConfirmReset(false), 4000);
      return;
    }
    clearTimeout(resetTimerRef.current);
    setConfirmReset(false);
    doResetAll();
  };
  const doResetAll = () => {
    stopPlayback();
    setUrl("");
    setDelay(4);
    setVolume(80);
    setRate(1);
    rateRef.current = 1;
    setSoundMode("stick");
    soundModeRef.current = "stick";
    setFlipMode("cue");
    flipModeRef.current = "cue";
    setIvMin(0);
    setIvSec(20);
    ivRef.current = { m: 0, s: 20 };
    setLoopOn(false);
    loopRef.current = false;
    setPreLoad(true);
    preLoadRef.current = true;
    setNoWait(false);
    noWaitRef.current = false;
    setSeq([]);
    seqRef.current = [];
    setCueText([]);
    recomputeCues([]);
    setTapCursor(0);
    pdf.reset();
    setMsg({ text: t("resetDone"), kind: "ok" });
  };

  // ---- 재생 흐름 ----
  const applyVolume = useCallback(() => {
    yt.unMute();
    yt.setVolume(volumeRef.current);
  }, [yt]);
  useEffect(() => {
    if (armedRef.current) {
      yt.unMute();
      yt.setVolume(volume);
    }
  }, [volume]); // eslint-disable-line

  const primePlayer = useCallback(
    (id) => {
      if (primeTimerRef.current) clearTimeout(primeTimerRef.current);
      yt.mute();
      yt.loadVideoById(id); // 음소거 자동재생 → 버퍼/잠금 해제 + duration 확보
      primeTimerRef.current = setTimeout(() => {
        yt.pause();
        yt.seek(0);
        primeTimerRef.current = null;
      }, 400);
    },
    [yt],
  );

  const beginPlayback = useCallback(() => {
    if (primeTimerRef.current) {
      clearTimeout(primeTimerRef.current);
      primeTimerRef.current = null;
    }
    pdf.show(1);
    buildSchedule(); // duration 확보 후 스케줄 계산
    yt.seek(0);
    yt.unMute();
    yt.setVolume(volumeRef.current);
    yt.play();
    yt.setRate(rateRef.current);
    startFollowing();
  }, [pdf, buildSchedule, yt, startFollowing]);

  const runCountdown = useCallback(
    (secs) => {
      if (secs <= 0) {
        setCountText(null);
        beginPlayback();
        return;
      }
      setCountText(secs);
      tickSound(false);
      let rem = secs;
      countdownTimerRef.current = setInterval(() => {
        rem -= 1;
        if (rem <= 0) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
          setCountText("▶");
          tickSound(true);
          setTimeout(() => {
            setCountText(null);
            beginPlayback();
          }, 550);
          return;
        }
        setCountText(rem);
        tickSound(false);
      }, 1000);
    },
    [beginPlayback, tickSound],
  );

  const onState = useCallback(
    (data) => {
      const YT = window.YT;
      if (!YT) return;
      if (data === YT.PlayerState.PLAYING) setIsPlaying(true);
      else if (data === YT.PlayerState.PAUSED) setIsPlaying(false);
      else if (data === YT.PlayerState.ENDED) {
        if (loopRef.current) {
          yt.seek(0);
          yt.play();
          pdf.show(1);
        } else {
          stopFollowing();
          setIsPlaying(false);
          if (barRef.current) barRef.current.style.width = "100%";
          setMsg({ text: t("endedMsg"), kind: "ok" });
          // 시트 모드에선 하단 안내줄이 없으므로 토스트로
          if (sheetModeRef.current) showToast(t("endedToast"), 2600);
        }
      }
    },
    [yt, pdf, stopFollowing, showToast, lang], // eslint-disable-line
  );

  const cancelCountdown = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (primeTimerRef.current) {
      clearTimeout(primeTimerRef.current);
      primeTimerRef.current = null;
    }
    setCountText(null);
    setArmed(false);
    armedRef.current = false;
    setIsPlaying(false);
    setPendingTap(null);
    setTuneMode(false); // 타이밍 입력 모드 카운트다운 중 취소 시 모드도 해제
    tuneModeRef.current = false;
    yt.stop();
  }, [yt]);

  const startFlow = useCallback(
    (opts) => {
      const tune = !!(opts && opts.tune); // 타이밍 입력 모드: 항상 3초 카운트 (바로 시작 무시)
      const instant = !tune && (noWaitRef.current || (opts && opts.instant)); // 카운트다운 없이 즉시 재생
      setMsg({ text: "", kind: "ok" });
      if (totalRef.current === 0) {
        if (tune) return false; // 타이밍 입력은 악보가 있어야 의미 있음 (버튼도 숨겨져 있음)
        // 악보 없이 반주만: 무대에 영상을 크게 띄운다
        setMsg({ text: t("noPdfPlay"), kind: "ok" });
      }
      const id = extractId(url);
      if (!id) {
        setMsg({ text: t("badLink"), kind: "err" });
        // 시트 모드: 하단 안내줄이 없으므로 토스트로
        if (sheetModeRef.current) showToast(t("badLinkToast"), 2600);
        return false;
      }
      if (!yt.apiReady) {
        setMsg({ text: t("notReady"), kind: "err" });
        if (sheetModeRef.current) showToast(t("notReadyToast"), 2600);
        return false;
      }
      // 첫 실행 흐름을 실제로 시작했으면 다음 방문부터는 안내를 접어 둔다.
      setFirstRunDismissed(true);
      try {
        localStorage.setItem("cin:first-run-guide-until", guideDayKey());
      } catch {}
      pendingIdRef.current = id;
      let secs = parseInt(delayRef.current, 10);
      if (isNaN(secs) || secs < 0) secs = 0;
      if (secs > 60) secs = 60;
      if (instant) secs = 0;
      if (tune) secs = 3; // 찍을 준비 시간 — 미리재생(버퍼→0초 되감기)도 이 사이에 그대로 적용됨
      ensureAudio();
      setArmed(true);
      armedRef.current = true;
      setSheetOpen(false); // 시트 모드: 시작하면 설정 시트를 닫고 악보(영상) 화면으로
      yt.ensure(ytInnerRef.current, id, {
        onReady: () => {
          applyVolume();
          if (instant)
            yt.loadVideoById(id); // 로드와 동시에 재생 (cue 직후 play는 로딩 중이라 무시됨)
          else if (preLoadRef.current)
            primePlayer(id); // 미리 재생(버퍼) 준비
          else yt.cueById(id); // 준비만, 재생은 카운트 후에
          runCountdown(secs);
        },
        onState,
        onError: (code) => {
          cancelCountdown();
          setMsg({ text: t("ytErr", code), kind: "err" });
          if (sheetModeRef.current) showToast(t("ytErr", code), 2600);
        },
      });
      return true;
    },
    [
      url,
      yt,
      ensureAudio,
      applyVolume,
      primePlayer,
      runCountdown,
      onState,
      cancelCountdown,
      showToast,
      lang, // eslint-disable-line
    ],
  );

  const togglePlay = useCallback(() => {
    if (!armedRef.current) {
      startFlow();
      return;
    }
    const YT = window.YT;
    const st = yt.getState();
    if (YT && st === YT.PlayerState.PLAYING) {
      yt.pause();
      stopFollowing();
      setIsPlaying(false);
    } else {
      yt.play();
      startFollowing();
      setIsPlaying(true);
    }
  }, [startFlow, yt, stopFollowing, startFollowing]);

  // 이전/다음: 재생 중이면 연주 순서의 앞/뒤 스텝으로 (반주도 그 시점으로 이동)
  const jump = useCallback(
    (delta) => {
      if (totalRef.current === 0) return;
      const pt = pageTimesRef.current;
      const sq = schedSeqRef.current;
      if (armedRef.current && sq.length) {
        const s = Math.max(0, Math.min(sq.length - 1, stepRef.current + delta));
        if (isFinite(pt[s])) {
          yt.seek(pt[s] || 0);
          stepRef.current = s;
          pdf.show(sq[s]);
          return;
        }
      }
      const target = Math.max(
        1,
        Math.min(totalRef.current, pdf.pageNumRef.current + delta),
      );
      pdf.show(target);
    },
    [pdf, yt],
  );

  const stopPlayback = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (primeTimerRef.current) {
      clearTimeout(primeTimerRef.current);
      primeTimerRef.current = null;
    }
    stopFollowing();
    setCountText(null);
    setArmed(false);
    armedRef.current = false;
    setIsPlaying(false);
    setTapCursor(0);
    setPendingTap(null);
    setTuneMode(false);
    tuneModeRef.current = false;
    yt.stop();
    pdf.show(1);
    if (barRef.current) barRef.current.style.width = "0%";
    if (clockRef.current) clockRef.current.textContent = "";
  }, [stopFollowing, yt, pdf]);

  // ---- 타이밍 입력 모드: 3초 세고 재생하며 넘김 시각을 찍는다 ----
  const enterTune = useCallback(() => {
    setTapCursor(0);
    if (!startFlow({ tune: true })) return;
    setTuneMode(true);
    tuneModeRef.current = true;
    setMsg({ text: t("tuneIntro"), kind: "ok" });
  }, [startFlow, lang]); // eslint-disable-line

  const exitTune = useCallback(() => {
    const n = cueTextRef.current.filter((v) => v && String(v).trim()).length;
    stopPlayback(); // 타이밍 입력 모드 해제 포함
    setMsg({ text: t("tuneDone", n), kind: "ok" });
  }, [stopPlayback, lang]); // eslint-disable-line

  // 악보 내리기: 재생은 유지한 채 악보만 제거 → 영상 크게 모드로 전환 (타이밍 입력 중엔 모드 종료)
  const clearPdf = () => {
    if (tuneModeRef.current) stopPlayback();
    pdf.reset();
    showToast(t("pdfCleared"));
  };

  // ---- PDF 파일 선택 ----
  const onFile = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = ""; // 같은 파일을 다시 선택해도 change가 오도록 비움 (초기화 후 재선택 대응)
    if (!f) return;
    stopPlayback();
    setMsg({ text: t("pdfLoading"), kind: "ok" });
    try {
      const n = await pdf.load(f);
      setMsg({ text: t("pdfLoadedMsg", n), kind: "ok" });
    } catch (err) {
      console.error("[pdf load]", err);
      let text;
      if (err && err.name === "PasswordException") text = t("pdfPassword");
      else if (err && err.name === "InvalidPDFException")
        text = t("pdfInvalid");
      else text = t("pdfFail", err && err.message ? err.message : err);
      setMsg({ text, kind: "err" });
    }
  };

  // ↑↓ 볼륨 조절 (+토스트 피드백)
  const nudgeVolume = (delta) => {
    const nv = Math.max(0, Math.min(100, volumeRef.current + delta));
    volumeRef.current = nv;
    setVolume(nv);
    if (armedRef.current) {
      yt.unMute();
      yt.setVolume(nv);
    }
    showToast(t("volToast", nv));
  };
  // 숫자키: 해당 페이지로 바로 이동 (재생 중엔 연주 순서에서 그 쪽이 처음 나오는 지점으로 반주도 이동)
  const goToPage = (n) => {
    if (totalRef.current === 0) return;
    const target = Math.max(1, Math.min(totalRef.current, n));
    if (armedRef.current) {
      const pt = pageTimesRef.current;
      const sq = schedSeqRef.current;
      for (let k = 0; k < sq.length; k++) {
        if (sq[k] === target && isFinite(pt[k])) {
          yt.seek(pt[k] || 0);
          stepRef.current = k;
          break;
        }
      }
    }
    pdf.show(target);
  };

  // 세부 설정 펼침 상태 저장
  const toggleAdv = () =>
    setAdv((a) => {
      try {
        localStorage.setItem("cin:ui:adv", a ? "0" : "1");
      } catch {}
      return !a;
    });

  // 단축키 팝오버: 바깥 클릭으로 닫기
  useEffect(() => {
    if (!showKeys) return;
    const onDoc = (e) => {
      if (kbWrapRef.current && !kbWrapRef.current.contains(e.target))
        setShowKeys(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [showKeys]);

  // ---- 키보드 ----
  const kbRef = useRef({});
  kbRef.current = {
    togglePlay,
    jump,
    tap,
    stopPlayback,
    cancelCountdown,
    cancelPending,
    commitPending,
    nudgeVolume,
    goToPage,
    overlayOpen: countText != null,
    pendingOpen: pendingTap != null,
    tuneOpen: tuneMode,
    sheetMode,
    sheetOpen: sheetMode && sheetOpen,
    closeSheet: () => setSheetOpen(false),
  };
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "INPUT") return;
      const h = kbRef.current;
      if (e.code === "Space") {
        e.preventDefault();
        if (h.overlayOpen) {
          h.cancelCountdown();
        } else if (h.pendingOpen) {
          // 몇 페이지로 갈지 고르는 중 — 재생 토글 무시
        } else {
          h.togglePlay();
        }
      } else if (e.code === "ArrowRight") {
        h.jump(1);
      } else if (e.code === "ArrowLeft") {
        h.jump(-1);
      } else if (e.code === "ArrowUp") {
        e.preventDefault();
        h.nudgeVolume(5);
      } else if (e.code === "ArrowDown") {
        e.preventDefault();
        h.nudgeVolume(-5);
      } else if (e.code === "KeyM") {
        h.tap();
      } else if (e.key === "Shift" && !e.repeat) {
        if (h.tuneOpen) h.tap(); // 타이밍 입력 모드: Shift로도 찍기
      } else if (e.code === "Enter") {
        // 시트 모드에선 악보가 이미 기본 화면이라 집중 모드 불필요 (켜지면 시트가 안 열림)
        if (!h.sheetMode && totalRef.current > 0 && !h.pendingOpen)
          setFocus((f) => !f);
      } else if (e.code === "Escape") {
        if (h.sheetOpen) h.closeSheet();
        else if (h.pendingOpen) h.cancelPending();
        else h.stopPlayback();
      } else {
        const m = e.code.match(/^(?:Digit|Numpad)([0-9])$/);
        if (m) {
          const d = parseInt(m[1], 10);
          if (h.pendingOpen) {
            if (d >= 1 && d <= totalRef.current) h.commitPending(d); // 숫자키로 바로 선택
          } else if (d === 0)
            h.stopPlayback(); // 0 = 처음으로
          else h.goToPage(d); // 1~9 = 해당 쪽
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 스테이지 크기가 바뀔 때마다 현재 페이지를 다시 렌더 (창 크기·집중 모드·큐 패널 토글 등 모두 커버)
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === "undefined") return;
    let t = null;
    const ro = new ResizeObserver(() => {
      clearTimeout(t);
      t = setTimeout(() => pdf.renderPage(pdf.pageNumRef.current), 120);
    });
    ro.observe(stage);
    return () => {
      clearTimeout(t);
      ro.disconnect();
    };
  }, [pdf.renderPage]); // eslint-disable-line

  // 페이지 이동(#/metronome)으로 언마운트될 때 루프·타이머 정리
  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      if (primeTimerRef.current) clearTimeout(primeTimerRef.current);
      clearTimeout(toastTimerRef.current);
      clearTimeout(resetTimerRef.current);
      clearTimeout(savedTimerRef.current);
    },
    [],
  );

  const playDisabled = !yt.apiReady; // 악보 없이도 시작 가능 (영상만 크게 재생)
  const navDisabled = pdf.total === 0;
  const playLabel = armed && isPlaying ? t("pause") : t("start");
  const guideVisible = !firstRunDismissed && !armed;
  const dismissFirstRun = () => {
    setFirstRunDismissed(true);
    try {
      localStorage.setItem("cin:first-run-guide-until", guideDayKey());
    } catch {}
  };
  const guideCard = (className = "stageGuide") => (
    <section className={`firstRun ${className}`} aria-label={t("guideAria")}>
      <div className="firstRunHead">
        <div>
          <span className="firstRunKicker">{t("guideKicker")}</span>
          <h2>{t("guideTitle")}</h2>
        </div>
        <button type="button" className="guideDismiss" onClick={dismissFirstRun}>
          {t("guideDismiss")}
        </button>
      </div>
      <div className="guideSteps">
        {[1, 2, 3, 4].map((step) => {
          const helpText =
            step === 2
              ? t("guideNext2")
              : step === 3
                ? t("guideHelp3")
                : step === 4
                  ? t("guideHelp4")
                  : t("guideHelp1");
          return (
            <div
              key={step}
              className="guideStep"
            >
              <span className="guideDot">{step}</span>
              <span className="guideStepText">
                <b>{t(`guideStep${step}`)}</b>
                <small>{helpText}</small>
              </span>
            </div>
          );
        })}
      </div>
      <p className="guideNote"><span>✦</span> {t("guideNote")}</p>
    </section>
  );
  // 다음 탭이 기록할 전환: 어느 페이지에서 어느 페이지로 가는지 (순서 끝의 마지막 쪽이면 overflow)
  const curFrom = seq[tapCursor];
  const curDest =
    seq[tapCursor + 1] != null
      ? seq[tapCursor + 1]
      : curFrom != null
        ? curFrom + 1
        : null;
  const tapOverflow = curFrom == null || curDest == null || curDest > pdf.total;

  return (
    <>
    <div
      className={
        "app" +
        (focus ? " focus" : "") +
        (tuneMode ? " tune" : "") +
        (armed && pdf.total === 0 ? " video" : "") // 악보 없음: 무대에 영상 크게
      }
    >
      {sheetMode && sheetOpen && (
        <div
          className="sheetBackdrop"
          onClick={() => setSheetOpen(false)}
          aria-hidden="true"
        ></div>
      )}
      <aside className={"sidebar" + (sheetMode && sheetOpen ? " open" : "")}>
        <div className="sheetTop">
          <span>{t("sheetTitle")}</span>
          <a className="sheetMail" href="mailto:developer@count-in.com">
            developer@count-in.com
          </a>
          <button
            type="button"
            className="sheetClose"
            onClick={() => setSheetOpen(false)}
            aria-label={t("sheetCloseAria")}
          >
            <X size={17} />
          </button>
        </div>
        {sheetMode && msg.text ? (
          // 시트가 화면을 덮는 동안에도 안내·에러가 보이게 (본문 msg와 중복이라 스크린리더 제외)
          <div className={"msg sheetMsg " + msg.kind} aria-hidden="true">
            {msg.text}
          </div>
        ) : null}
        <header>
          <div className="eyebrowRow">
            <div className="eyebrow">Count-In</div>
            <span className="headLinks">
              <button
                type="button"
                className="pageLink themeBtn langBtn"
                onClick={flipLang}
                title={t("langBtnTitle")}
                aria-label={t("langBtnTitle")}
              >
                {lang === "ko" ? "EN" : "한"}
              </button>
              <button
                type="button"
                className="pageLink themeBtn"
                onClick={flipTheme}
                title={darkMode ? t("themeToLight") : t("themeToDark")}
                aria-label={darkMode ? t("themeToLight") : t("themeToDark")}
              >
                {darkMode ? <Sun size={13} /> : <Moon size={13} />}
              </button>
              <a
                className="pageLink"
                href="/metronome"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/metronome");
                }}
              >
                <Drum size={13} /> {t("metronomeLink")}
              </a>
            </span>
          </div>
          <h1>{t("headline")}</h1>
          <p className="sub">{t("subline")}</p>
        </header>

        <div className="controls">
          <div className="group grow">
            <div className="labelRow">
              <label htmlFor="url">{t("step1")}</label>
              <button
                type="button"
                className="btn ghost tiny presetImportBtn"
                onClick={() => {
                  setPresetSearchQuery("");
                  setPresetSearchResults(null);
                  setShowPresetSearch(true);
                }}
              >
                {t("importPreset")}
              </button>
            </div>
            <input
              id="url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t("urlPlaceholder")}
            />
          </div>

          <div className="group">
            <label>{t("step2")}</label>
            <div className="uploadRow">
              <label className="upload" id="pdf-picker">
                {/* accept 미지정 — 삼성 인터넷은 PDF accept가 있으면 카메라·갤러리만 띄운다
                    (태블릿은 데스크톱 모드 UA라 기기 감지도 불가). PDF 검증은 로드 단계에서 함. */}
                <input type="file" onChange={onFile} />
                <span>
                  <FileText size={15} />
                  {pdf.total > 0 ? t("pdfLoaded", pdf.total) : t("pdfPick")}
                </span>
              </label>
              {pdf.total > 0 && (
                <button
                  type="button"
                  className="pdfClear"
                  onClick={clearPdf}
                  title={t("pdfClearTitle")}
                  aria-label={t("pdfClearAria")}
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </div>

          <div className="group">
            <div className="labelRow">
              <label htmlFor="delay">{t("step3")}</label>
              <label
                className="switch-mini noWaitToggle"
                title={t("noWaitTitle")}
              >
                <input
                  type="checkbox"
                  checked={noWait}
                  onChange={(e) => setNoWait(e.target.checked)}
                />
                <span className="box"></span>
                <span>{t("noWait")}</span>
              </label>
            </div>
            <div className="startRow">
              <div className="time-inputs">
                <input
                  id="delay"
                  type="number"
                  min="0"
                  max="60"
                  step="1"
                  value={delay}
                  disabled={noWait}
                  onChange={(e) => setDelay(e.target.value)}
                />
                <span className="unit">{t("secCount")}</span>
              </div>
              <button
                id="start-button"
                className="btn startBtn"
                onClick={togglePlay}
                disabled={playDisabled}
                title={playDisabled ? t("startDisabledTitle") : ""}
              >
                {playLabel}
              </button>
              {/* 시작과 전체화면 시작을 한 줄에 배치 */}
              {fsSupported && !armed && (
                <button
                  className="btn ghost startFsBtn"
                  onClick={() => {
                    if (startFlow()) enterFs();
                  }}
                  disabled={playDisabled}
                  title={t("startFsTitle")}
                >
                  <Maximize size={14} /> {t("startFs")}
                </button>
              )}
            </div>
            <div className="slider-row">
              <span className="vol-icon">
                <Volume2 size={17} />
              </span>
              <input
                id="vol"
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => setVolume(parseInt(e.target.value, 10))}
                aria-label={t("volAria")}
              />
              <span className="vol-val">{volume}%</span>
            </div>
          </div>

        </div>

        {flipMode === "cue" && pdf.total > 1 && (
          <CuePanel
            t={t}
            total={pdf.total}
            cueText={cueText}
            seq={seq}
            armed={armed}
            tapCursor={tapCursor}
            tuneMode={tuneMode}
            tuneRepeat={tuneRepeat}
            playDisabled={playDisabled}
            tapOverflow={tapOverflow}
            curFrom={curFrom}
            curDest={curDest}
            cueRowsRef={cueRowsRef}
            onToggleRepeat={toggleTuneRepeat}
            onEnterTune={enterTune}
            onTap={tap}
            onClear={clearCues}
            onSetSequencePage={setSeqAt}
            onSetCue={setCueAt}
            onNudgeCue={nudgeCue}
            onNow={nowAt}
            onRemove={removeCueRow}
            onAdd={addCueRow}
          />
        )}

          <button type="button" className="advToggle" onClick={toggleAdv}>
            <span>
              <Settings2 size={13} /> {t("advToggle")}
            </span>
            <span>{adv ? "▴" : "▾"}</span>
          </button>

          {adv && (
            <div className="advBody">
              <div className="group">
                <label>{t("flipModeLabel")}</label>
                <div className="seg">
                  {[
                    ["cue", t("flipCueSeg")],
                    ["interval", t("flipIntervalSeg")],
                  ].map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      className={flipMode === k ? "active" : ""}
                      aria-pressed={flipMode === k}
                      onClick={() => {
                        setFlipMode(k);
                        flipModeRef.current = k;
                        buildSchedule();
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {flipMode === "interval" && (
                <div className="group">
                  <label>{t("intervalLabel")}</label>
                  <div className="time-inputs">
                    <input
                      type="number"
                      min="0"
                      max="999"
                      step="1"
                      value={ivMin}
                      onChange={(e) => setIvMin(e.target.value)}
                    />
                    <span className="unit">{t("minUnit")}</span>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      step="1"
                      value={ivSec}
                      onChange={(e) => setIvSec(e.target.value)}
                    />
                    <span className="unit">{t("secUnit")}</span>
                  </div>
                </div>
              )}

              <div className="group">
                <label>{t("rateLabel")}</label>
                <div className="seg">
                  {[
                    [0.5, t("rate05")],
                    [0.75, t("rate075")],
                    [1, t("rate1")],
                  ].map(([r, label]) => (
                    <button
                      key={r}
                      type="button"
                      className={rate === r ? "active" : ""}
                      aria-pressed={rate === r}
                      onClick={() => {
                        setRate(r);
                        rateRef.current = r;
                        yt.setRate(r);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="group">
                <label>{t("countSound")}</label>
                <div className="seg">
                  {[
                    ["stick", t("soundStick")],
                    ["beep", t("soundBeep")],
                    ["off", t("soundOff")],
                  ].map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      className={soundMode === k ? "active" : ""}
                      aria-pressed={soundMode === k}
                      onClick={() => {
                        setSoundMode(k);
                        soundModeRef.current = k;
                        if (k !== "off") tickSound(false);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="group">
                <label>{t("optionsLabel")}</label>
                <div className="optRow">
                  <label className="switch-mini" title={t("preloadTitle")}>
                    <input
                      type="checkbox"
                      checked={preLoad}
                      onChange={(e) => setPreLoad(e.target.checked)}
                    />
                    <span className="box"></span>
                    <span>{t("preload")}</span>
                  </label>
                  <label className="switch-mini" title={t("loopTitle")}>
                    <input
                      type="checkbox"
                      checked={loopOn}
                      onChange={(e) => setLoopOn(e.target.checked)}
                    />
                    <span className="box"></span>
                    <span>{t("loop")}</span>
                  </label>
                </div>
              </div>
            </div>
          )}

        <div className="presets">
          <div className="presetsHead">
            <span>{t("savedSongs")}</span>
          </div>
          {presets.length === 0 ? (
            <div className="presetsEmpty">{t("presetsEmpty")}</div>
          ) : (
            <>
              <div className="presetList">
                {presets.map((p) => (
                  <div
                    className={
                      "presetChip" +
                      (savedFlash && savedFlash.chipId === p.id ? " flash" : "")
                    }
                    key={p.id}
                  >
                    <button
                      className="presetLoad"
                      onClick={() => loadPreset(p)}
                      title={
                        p.url ? t("presetLoadTitle", p.url) : t("presetNoLink")
                      }
                    >
                      {p.name}
                    </button>
                    <button
                      className="presetDel"
                      onClick={() => deletePreset(p.id)}
                      title={t("presetDelTitle")}
                      aria-label={t("presetDelAria", p.name)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div className="presetsHint">{t("presetsHint")}</div>
            </>
          )}
        </div>

        <div className="sideActions">
          {saveOpen ? (
            <div className="saveRow">
              <input
                autoFocus
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmSave();
                  else if (e.key === "Escape") setSaveOpen(false);
                }}
                placeholder={t("saveNamePh")}
              />
              <button className="btn small" onClick={confirmSave}>
                {t("saveBtn")}
              </button>
              <button
                className="btn ghost small"
                onClick={() => setSaveOpen(false)}
              >
                {t("cancelBtn")}
              </button>
            </div>
          ) : (
            <button
              className={"btn tonal savePresetBtn" + (savedFlash ? " saved" : "")}
              onClick={openSave}
            >
              {savedFlash ? (
                <>
                  <Check size={14} /> {t("savedFlash", savedFlash.name)}
                </>
              ) : (
                <>
                  <Save size={14} /> {t("savePreset")}
                </>
              )}
            </button>
          )}
          <button
            className="btn ghost sharePresetBtn"
            onClick={() => openShare("new")}
          >
            <Share2 size={14} /> {t("shareBtn")}
          </button>
          {loadedShareId != null && (
            <button
              className="btn ghost shareEditBtn"
              onClick={() => openShare("edit")}
              title={t("shareEditTitle")}
            >
              <Share2 size={14} /> {t("shareEditBtn")}
            </button>
          )}
          <button
            className={"btn ghost resetAllBtn" + (confirmReset ? " arm" : "")}
            onClick={resetClick}
          >
            {confirmReset ? (
              t("resetConfirm")
            ) : (
              <>
                <Eraser size={13} /> {t("resetAll")}
              </>
            )}
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="navbar">
          <button
            className="btn navPlay"
            onClick={togglePlay}
            disabled={playDisabled}
          >
            {playLabel}
          </button>
          <button
            className="btn ghost navPrev"
            onClick={() => jump(-1)}
            disabled={navDisabled}
          >
            {t("prevBtn")}
          </button>
          <button
            className="btn ghost navNext"
            onClick={() => jump(1)}
            disabled={navDisabled}
          >
            {t("nextBtn")}
          </button>
          <button
            className="btn ghost"
            onClick={stopPlayback}
            disabled={navDisabled && !armed}
          >
            {t("toHome")}
          </button>
          {fsSupported && (
            <button
              className="btn ghost navFs"
              onClick={toggleFs}
              disabled={!armed && !isFs}
              title={isFs ? t("fsExitTitle") : t("fsTitle")}
            >
              {isFs ? (
                <>
                  <Minimize size={13} /> {t("fsExit")}
                </>
              ) : (
                <>
                  <Maximize size={13} /> {t("fsBtn")}
                </>
              )}
            </button>
          )}
          <button
            className="btn ghost navZoom"
            onClick={() => setFocus((f) => !f)}
            disabled={navDisabled}
          >
            {focus ? (
              <>
                <Minimize2 size={13} /> {t("focusOff")}
              </>
            ) : (
              <>
                <Maximize2 size={13} /> {t("focusOn")}
              </>
            )}
          </button>
          <span className="kbhint" ref={kbWrapRef}>
            {t("kbhintLine")}
            <button
              type="button"
              className="kbMore"
              title={t("kbMoreTitle")}
              aria-expanded={showKeys}
              onClick={() => setShowKeys((s) => !s)}
            >
              ?
            </button>
            {showKeys && (
              <div className="kbPop">
                <div className="kbPopTitle">{t("kbTitle")}</div>
                {t("kbRows").map(([k, d]) => (
                  <div className="kbRow" key={k}>
                    <kbd>{k}</kbd>
                    <span>{d}</span>
                  </div>
                ))}
              </div>
            )}
          </span>
          <div className="spacer"></div>
          <div className="page-ind">
            <b>{pdf.total ? pdf.pageNum : "–"}</b> / {pdf.total || "–"}
          </div>
          <div className="clock" ref={clockRef}></div>
        </div>

        <div className="progress">
          <div className="bar" ref={barRef}></div>
        </div>

        <div
          className={"stage" + (pdf.total === 0 ? " empty" : "")}
          ref={stageRef}
        >
          {pdf.total === 0 && (
            guideVisible ? (
              <>
                {guideCard()}
                <div className="emptyHint">{t("emptyStage")}</div>
              </>
            ) : (
              <>
                <div className="big">
                  <Music size={44} />
                </div>
                <div className="emptyHint">{t("emptyStage")}</div>
                <div className="privacyHint">{t("privacyNote")}</div>
              </>
            )
          )}
          <canvas
            ref={canvasRef}
            style={{ display: pdf.total ? "block" : "none" }}
          ></canvas>
          <div className="flipHint" ref={flipHintRef}></div>
          <div className="flipCue" ref={flipCueRef} aria-hidden="true">
            <div className="flipCueNum"></div>
            <div className="flipCueLabel">{t("nextPageCue")} ›</div>
          </div>
          {pdf.total > 0 && (
            <>
              <div
                className="tapZone left"
                title={t("prevPage")}
                aria-hidden="true"
                onClick={() => jump(-1)}
              >
                <span>‹</span>
              </div>
              <div
                className="tapZone right"
                title={t("nextPage")}
                aria-hidden="true"
                onClick={() => jump(1)}
              >
                <span>›</span>
              </div>
            </>
          )}
          {/* 유튜브 플레이어: 평소엔 우하단 미니, 악보 없이 재생하면(.app.video) 무대를 꽉 채움.
              상단 "반주" 띠(::before)를 탭하면 칩으로 접힘/펼침 — 악보를 가리지 않게 (소리는 유지).
              클릭은 띠에서만 잡힌다(영상 부분은 iframe이라 이 핸들러에 안 옴). */}
          <div
            className={
              "ytHost" +
              (armed ? " show" : "") +
              (ytMin && pdf.total > 0 ? " min" : "")
            }
            ref={ytHostRef}
            onClick={() => setYtMin((m) => !m)}
            title={ytMin ? t("ytExpand") : t("ytCollapse")}
          ></div>
        </div>

        <div className="footRow">
          <div className={"msg " + msg.kind} role="status" aria-live="polite">
            {msg.text}
          </div>
          <footer className="siteFoot">
            <a href="mailto:developer@count-in.com">developer@count-in.com</a>
          </footer>
        </div>

        {toast && (
          <div className="toast" role="status" key={toast.id}>
            {toast.text}
          </div>
        )}
      </main>

      {(sheetMode || pdf.total > 0 || armed) && !tuneMode && (
        <div className="mobileBar">
          {sheetMode && (
            <button
              className="btn ghost mbSet"
              onClick={() => setSheetOpen(true)}
              aria-label={t("mbSetAria")}
              aria-expanded={sheetOpen}
            >
              <Settings2 size={16} />
              <span className="mbSetTxt">{t("mbSet")}</span>
            </button>
          )}
          <button
            className="btn mbPlay"
            onClick={togglePlay}
            disabled={playDisabled}
          >
            {playLabel}
          </button>
          {pdf.total > 0 && (
            <>
              <button
                className="btn ghost mbNav"
                onClick={() => jump(-1)}
                aria-label={t("prevPage")}
              >
                ‹
              </button>
              <button
                className="btn ghost mbNav"
                onClick={() => jump(1)}
                aria-label={t("nextPage")}
              >
                ›
              </button>
              <span className="page-ind">
                <b>{pdf.pageNum}</b> / {pdf.total}
              </span>
            </>
          )}
          <span className="mbVol">
            <Volume2 size={15} />
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => setVolume(parseInt(e.target.value, 10))}
              aria-label={t("volAria")}
            />
          </span>
        </div>
      )}

      {tuneMode && (
        <div className="tuneBar">
          <div className="tuneRow1">
            <span className="tuneBadge">
              <Timer size={12} /> {t("tuneBadge")}
            </span>
            <span className="tuneTime" ref={tuneTimeRef}>
              0:00
            </span>
            <div className="spacer"></div>
            {sheetMode && (
              <button
                className="btn ghost small"
                onClick={() => setSheetOpen(true)}
                aria-label={t("tuneListAria")}
                title={t("tuneListTitle")}
              >
                <Settings2 size={13} />
              </button>
            )}
            <button className="btn ghost small" onClick={togglePlay}>
              {isPlaying ? (
                <>
                  <Pause size={13} /> {t("pause")}
                </>
              ) : (
                <>
                  <Play size={13} /> {t("resume")}
                </>
              )}
            </button>
            <button className="btn small" onClick={exitTune}>
              <Check size={13} /> {t("done")}
            </button>
          </div>
          <input
            className="tuneSeek"
            type="range"
            min="0"
            max="1"
            step="0.1"
            defaultValue="0"
            aria-label={t("seekAria")}
            ref={tuneSeekRef}
            onPointerDown={() => {
              seekDragRef.current = true;
            }}
            onPointerUp={() => {
              seekDragRef.current = false;
            }}
            onChange={(e) => {
              const to = parseFloat(e.target.value);
              if (!isFinite(to)) return;
              yt.seek(to);
              syncCursor(to); // 되감으면 그 지점의 줄부터 다시 찍히게
              if (tuneTimeRef.current) {
                const dur = yt.getDuration() || 0;
                tuneTimeRef.current.textContent = dur
                  ? fmt(to) + " / " + fmt(dur)
                  : fmt(to);
              }
            }}
          />
          <button
            className="btn tuneTap"
            onClick={tap}
            disabled={
              pendingTap ? tapOverflow : tuneRepeat ? false : tapOverflow
            }
          >
            {pendingTap ? (
              tapOverflow ? (
                <>
                  <Pause size={16} /> {t("tuneTapPickBelow")}
                </>
              ) : (
                <>
                  <Pause size={16} /> {t("tuneTapAgainNext", curDest)}
                </>
              )
            ) : tuneRepeat ? (
              <>
                <Target size={16} /> {t("tapNow")}
              </>
            ) : tapOverflow ? (
              <>
                <Check size={16} /> {t("tuneTapLast")}
              </>
            ) : (
              <>
                <Target size={16} /> {t("tuneTapPages", curFrom, curDest)}
              </>
            )}
          </button>
        </div>
      )}

      <PlaybackOverlays
        t={t}
        total={pdf.total}
        pendingTap={pendingTap}
        countText={countText}
        tapOverflow={tapOverflow}
        curFrom={curFrom}
        curDest={curDest}
        formatCue={fmtCue}
        onCommitPending={commitPending}
        onCancelPending={cancelPending}
        onCancelCountdown={cancelCountdown}
      />

      {showPresetSearch && (
        <div
          className="overlay show presetSearchOverlay"
          role="dialog"
          aria-modal="true"
          aria-label={t("searchPresetTitle")}
          onClick={() => setShowPresetSearch(false)}
        >
          <div className="presetSearchCard" onClick={(e) => e.stopPropagation()}>
            <div className="presetSearchTitle">{t("searchPresetTitle")}</div>
            <p className="presetSearchHint">{t("searchPresetHint")}</p>
            <div className="searchByRow">
              <select
                className="searchBySel"
                value={presetSearchBy}
                onChange={(e) => setPresetSearchBy(e.target.value)}
                aria-label={t("searchByLabel")}
              >
                <option value="name">{t("searchByName")}</option>
                <option value="singer">{t("searchBySinger")}</option>
                <option value="uploader">{t("searchByUploader")}</option>
              </select>
              <input
                autoFocus
                type="text"
                className="presetSearchInput"
                value={presetSearchQuery}
                onChange={(e) => setPresetSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") runPresetSearch();
                }}
                placeholder={t("searchPresetPlaceholder")}
              />
            </div>
            <div className="presetSearchActions">
              <button className="btn ghost small" onClick={() => setShowPresetSearch(false)}>
                {t("cancelBtn")}
              </button>
              <button
                className="btn small"
                disabled={!presetSearchQuery.trim() || presetSearchBusy}
                onClick={runPresetSearch}
              >
                {presetSearchBusy ? t("searching") : t("searchBtn")}
              </button>
            </div>
            {presetSearchResults && (
              <div className="presetSearchResults">
                <div className="presetSearchResultsTitle">
                  {t("searchResults")}
                  <span className="searchLoadHint">{t("searchLoadHint")}</span>
                </div>
                {presetSearchResults.length === 0 ? (
                  <div className="presetSearchEmpty">{t("noSearchResults")}</div>
                ) : (
                  presetSearchResults.map((preset) => (
                    <div className="sharedPresetRow" key={preset.id}>
                      <div className="sharedPresetInfo">
                        <strong>{preset.name}</strong>
                        <span>
                          {preset.singer ? preset.singer + " · " : ""}
                          {preset.author} · {t("pagesCount", preset.pages)}
                        </span>
                      </div>
                      {deleteTarget === preset.id ? (
                        <div className="delRow">
                          <input
                            autoFocus
                            type="password"
                            value={deletePw}
                            onChange={(e) => setDeletePw(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") confirmDelete(preset.id);
                            }}
                            placeholder={t("sharePwPh")}
                          />
                          <button
                            type="button"
                            className="btn tiny delConfirmBtn"
                            disabled={deleteBusy || !deletePw.trim()}
                            onClick={() => confirmDelete(preset.id)}
                          >
                            {t("delShared")}
                          </button>
                          <button
                            type="button"
                            className="btn ghost tiny"
                            onClick={() => {
                              setDeleteTarget(null);
                              setDeleteErr("");
                            }}
                          >
                            {t("cancelBtn")}
                          </button>
                          {deleteErr && <span className="delErr">{deleteErr}</span>}
                        </div>
                      ) : (
                        <div className="sharedPresetActions">
                          <button
                            type="button"
                            className="btn ghost tiny"
                            onClick={() => loadSharedPreset(preset.id)}
                          >
                            {t("loadShared")}
                          </button>
                          <button
                            type="button"
                            className="btn ghost tiny delShareBtn"
                            onClick={() => {
                              setDeleteTarget(preset.id);
                              setDeletePw("");
                              setDeleteErr("");
                            }}
                          >
                            {t("delShared")}
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {showShare && (
        <div
          className="overlay show presetSearchOverlay"
          role="dialog"
          aria-modal="true"
          aria-label={shareMode === "edit" ? t("shareEditTitle") : t("shareModalTitle")}
          onClick={() => setShowShare(false)}
        >
          <div className="presetSearchCard" onClick={(e) => e.stopPropagation()}>
            <div className="presetSearchTitle">
              {shareMode === "edit" ? t("shareEditTitle") : t("shareModalTitle")}
            </div>
            {shareDone != null ? (
              <>
                <p className="presetSearchHint">
                  {shareMode === "edit"
                    ? t("shareUpdateDone", shareDone)
                    : t("shareDoneMsg", shareDone)}
                </p>
                <div className="presetSearchActions">
                  <button className="btn small" onClick={() => setShowShare(false)}>
                    {t("closeBtn")}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="presetSearchHint">
                  {shareMode === "edit" ? t("shareEditHint") : t("shareModalHint")}
                </p>
                {!url.trim() && (
                  <div className="shareNeedUrl">{t("shareNeedUrl")}</div>
                )}
                <label className="shareField">
                  <span>{t("shareTitle")}</span>
                  <input
                    autoFocus
                    type="text"
                    className="presetSearchInput"
                    value={shareTitle}
                    onChange={(e) => setShareTitle(e.target.value)}
                    placeholder={t("shareTitlePh")}
                  />
                </label>
                <label className="shareField">
                  <span>{t("shareSinger")}</span>
                  <input
                    type="text"
                    className="presetSearchInput"
                    value={shareSinger}
                    onChange={(e) => setShareSinger(e.target.value)}
                    placeholder={t("shareSingerPh")}
                  />
                </label>
                {shareMode !== "edit" && (
                  <label className="shareField">
                    <span>{t("shareUploader")}</span>
                    <input
                      type="text"
                      className="presetSearchInput"
                      value={shareUploader}
                      onChange={(e) => setShareUploader(e.target.value)}
                      placeholder={t("shareUploaderPh")}
                    />
                  </label>
                )}
                <label className="shareField">
                  <span>{t("sharePw")}</span>
                  <input
                    type="password"
                    className="presetSearchInput"
                    value={sharePw}
                    onChange={(e) => setSharePw(e.target.value)}
                    placeholder={t("sharePwPh")}
                  />
                  <small className="shareHint">
                    {shareMode === "edit" ? t("shareEditPwHint") : t("sharePwHint")}
                  </small>
                </label>
                <div className="presetSearchActions">
                  <button className="btn ghost small" onClick={() => setShowShare(false)}>
                    {t("cancelBtn")}
                  </button>
                  <button
                    className="btn small"
                    disabled={!shareValid || shareBusy}
                    onClick={submitShare}
                  >
                    {shareBusy
                      ? t("sharing")
                      : shareMode === "edit"
                        ? t("shareUpdateSubmit")
                        : t("shareSubmit")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
    <SiteInfo lang={lang} />
    </>
  );
}
