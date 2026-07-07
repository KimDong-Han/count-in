import { useCallback, useEffect, useRef, useState } from "react";
import { usePdf } from "./usePdf";
import { useYouTube, extractId, ytErrMsg } from "./useYouTube";
import { playBeep, playStick } from "./sound";
import { parseTime, fmt } from "./time";
import { navigate } from "./router.js";

export default function App() {
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const ytHostRef = useRef(null);
  const ytInnerRef = useRef(null); // 유튜브 플레이어를 심는 imperative div
  const barRef = useRef(null);
  const clockRef = useRef(null);
  const flipHintRef = useRef(null); // 넘김 예고 배지 (rAF 루프에서 직접 갱신)
  const cueRowsRef = useRef(null);
  const kbWrapRef = useRef(null);

  const pdf = usePdf(canvasRef, stageRef);
  const yt = useYouTube();

  // ---- UI 상태 ----
  const [url, setUrl] = useState("");
  const [delay, setDelay] = useState(4);
  const [volume, setVolume] = useState(80);
  const [rate, setRate] = useState(1); // 재생 속도 0.5 | 0.75 | 1
  const [soundMode, setSoundMode] = useState("stick"); // 'stick' | 'beep' | 'off'
  const [flipMode, setFlipMode] = useState("cue"); // 'cue' | 'interval' | 'even'
  const [ivMin, setIvMin] = useState(0);
  const [ivSec, setIvSec] = useState(20);
  const [loopOn, setLoopOn] = useState(false);
  const [preLoad, setPreLoad] = useState(true); // 카운트다운 동안 미리 재생(버퍼) 준비
  const [cueText, setCueText] = useState([]); // 문자열 배열 (길이 total-1)
  const [armed, setArmed] = useState(false); // 시작 눌러 재생/준비 중
  const [isPlaying, setIsPlaying] = useState(false);
  const [countText, setCountText] = useState(null); // null=숨김, 숫자 or '▶'
  const [msg, setMsg] = useState({
    text: "악보 파일은 이 브라우저 안에서만 열려요. 어디로도 업로드되지 않아요.",
    kind: "ok",
  });
  const [tapCursor, setTapCursor] = useState(0); // 탭으로 기록할 다음 전환 index
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
  const [adv, setAdv] = useState(() => {
    // 세부 설정 펼침 여부 (기억)
    try {
      return localStorage.getItem("cin:ui:adv") === "1";
    } catch {
      return false;
    }
  });

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
  const ivRef = useRef({ m: 0, s: 20 });
  const armedRef = useRef(false);
  const tapCursorRef = useRef(0);
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
  const showToast = useCallback((text) => {
    toastIdRef.current += 1;
    setToast({ text, id: toastIdRef.current });
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 1400);
  }, []);

  // ---- 넘김 스케줄: pageTimes[k] = (k+1)번째 페이지를 띄울 곡 진행 시각(초) ----
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
    if (total > 1) {
      if (flipModeRef.current === "cue") {
        for (let i = 0; i < total - 1; i++) {
          const c = cuesRef.current[i];
          pt.push(c == null || isNaN(c) ? Infinity : c); // 미입력 = 자동으로 넘기지 않음(수동 대기)
        }
      } else if (flipModeRef.current === "even") {
        const dur = yt.getDuration();
        if (dur > 1) {
          const span = dur * 0.98;
          pt = [];
          for (let i = 0; i < total; i++) pt.push((span * i) / total);
        } else {
          const iv = intervalSec();
          pt = [];
          for (let i = 0; i < total; i++) pt.push(iv * i);
        }
      } else {
        const iv = intervalSec();
        pt = [];
        for (let i = 0; i < total; i++) pt.push(iv * i);
      }
    }
    pageTimesRef.current = pt;
  }, [yt]);

  // 곡 진행 위치를 따라가며 페이지 + 진행바 갱신
  const followLoop = useCallback(() => {
    if (!followRef.current) return;
    const t = yt.getTime() || 0;
    const dur = yt.getDuration() || 0;
    const pt = pageTimesRef.current;

    // 현재 시각에 해당하는 페이지
    let target = 1;
    for (let i = 0; i < pt.length; i++) {
      if (t + 0.12 >= pt[i]) target = i + 1;
      else break;
    }
    if (target !== pdf.pageNumRef.current) pdf.show(target);

    // 다음 넘김까지 진행바
    const cur = pdf.pageNumRef.current;
    const curStart = isFinite(pt[cur - 1]) ? pt[cur - 1] : 0;
    let nextAt = cur < pt.length ? pt[cur] : dur || curStart + 1;
    if (!isFinite(nextAt)) nextAt = dur || curStart + 1;
    const denom = Math.max(0.001, nextAt - curStart);
    const pct = Math.max(0, Math.min(100, ((t - curStart) / denom) * 100));
    if (barRef.current) barRef.current.style.width = pct + "%";
    if (clockRef.current)
      clockRef.current.textContent = dur ? fmt(t) + " / " + fmt(dur) : fmt(t);

    // 넘김 예고: 다음 넘김 3초 전부터 악보 위에 표시
    const fh = flipHintRef.current;
    if (fh) {
      const flipAt = cur < pt.length && isFinite(pt[cur]) ? pt[cur] : null;
      const remain = flipAt == null ? null : flipAt - t;
      if (remain != null && remain > 0 && remain <= 3) {
        fh.textContent = Math.ceil(remain) + "초 뒤 다음 쪽 ›";
        fh.classList.add("show");
      } else {
        fh.classList.remove("show");
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
  }, []);

  // ---- cue(페이지별 타이밍) 저장/불러오기 ----
  const cueKey = (id, total) => "cues:" + id + ":" + total;
  const saveCues = useCallback(
    (arr) => {
      const id = pendingIdRef.current || extractId(url);
      if (id && totalRef.current > 0) {
        try {
          localStorage.setItem(
            cueKey(id, totalRef.current),
            JSON.stringify(arr),
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

  // PDF 로드/URL 변경 시 cue 슬롯 크기 맞추고 저장된 타이밍 불러오기
  const syncCueSlots = useCallback(() => {
    const n = Math.max(0, totalRef.current - 1);
    let arr = new Array(n).fill("");
    const id = extractId(url);
    if (id && totalRef.current > 0) {
      try {
        const raw = localStorage.getItem(cueKey(id, totalRef.current));
        if (raw) {
          const s = JSON.parse(raw);
          if (Array.isArray(s))
            arr = arr.map((_, i) => (s[i] != null ? s[i] : ""));
        }
      } catch (e) {}
    }
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
  const nowAt = (i) => {
    if (!armedRef.current) return;
    const stamp = fmt(yt.getTime() || 0);
    setCueAt(i, stamp);
    setTapCursor(i + 1);
    showToast(i + 1 + "→" + (i + 2) + "쪽 넘김 " + stamp + " 저장");
  };
  const tap = () => {
    const idx = tapCursorRef.current;
    if (idx >= totalRef.current - 1) return;
    nowAt(idx);
  };
  const clearCues = () => {
    const arr = new Array(Math.max(0, totalRef.current - 1)).fill("");
    setCueText(arr);
    recomputeCues(arr);
    saveCues(arr);
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
    setSaveName("곡 " + (presets.length + 1));
    setSaveOpen(true);
  };
  const confirmSave = () => {
    const def = "곡 " + (presets.length + 1);
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
      cues: cueTextRef.current.slice(),
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
          JSON.stringify(preset.cues),
        );
      } catch (e) {}
    }
    setSaveOpen(false);
    // 저장 버튼 "✓ 저장됨" + 해당 칩 반짝임으로 피드백
    clearTimeout(savedTimerRef.current);
    setSavedFlash({ name: trimmed, chipId: preset.id });
    savedTimerRef.current = setTimeout(() => setSavedFlash(null), 1600);
    if (!extractId(url))
      setMsg({
        text:
          '"' +
          trimmed +
          '" 저장됨 · 유튜브 링크가 비어 있어서 링크는 저장되지 않았어요.',
        kind: "err",
      });
  };
  const loadPreset = (p) => {
    stopPlayback();
    setUrl(p.url ?? "");
    setDelay(p.delay ?? 4);
    setVolume(p.volume ?? 80);
    setRate(p.rate ?? 1);
    rateRef.current = p.rate ?? 1;
    setSoundMode(p.soundMode ?? "stick");
    soundModeRef.current = p.soundMode ?? "stick";
    setFlipMode(p.flipMode ?? "cue");
    flipModeRef.current = p.flipMode ?? "cue";
    setIvMin(p.ivMin ?? 0);
    setIvSec(p.ivSec ?? 20);
    ivRef.current = { m: p.ivMin ?? 0, s: p.ivSec ?? 20 };
    setLoopOn(!!p.loopOn);
    loopRef.current = !!p.loopOn;
    const pl = p.preLoad ?? true;
    setPreLoad(pl);
    preLoadRef.current = pl;
    const cues = Array.isArray(p.cues) ? p.cues.slice() : [];
    setCueText(cues);
    recomputeCues(cues);
    setTapCursor(0);
    // 같은 PDF를 다시 열었을 때도 복원되도록 cue 저장소에 반영
    const id = extractId(p.url);
    if (id && p.pageCount > 0) {
      try {
        localStorage.setItem(cueKey(id, p.pageCount), JSON.stringify(cues));
      } catch (e) {}
    }
    setMsg({
      text:
        '"' + p.name + '" 불러옴 · 악보 PDF를 열면 저장된 타이밍이 적용돼요.',
      kind: "ok",
    });
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
    setCueText([]);
    recomputeCues([]);
    setTapCursor(0);
    pdf.reset();
    setMsg({ text: "저장한 곡을 뺀 나머지를 초기화했어요.", kind: "ok" });
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
          setMsg({
            text: "반주가 끝났어요. 다시 시작하려면 시작을 눌러 주세요.",
            kind: "ok",
          });
        }
      }
    },
    [yt, pdf, stopFollowing],
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
    yt.stop();
  }, [yt]);

  const startFlow = useCallback(() => {
    setMsg({ text: "", kind: "ok" });
    if (totalRef.current === 0) {
      setMsg({ text: "먼저 악보 PDF를 불러와 주세요.", kind: "err" });
      return;
    }
    const id = extractId(url);
    if (!id) {
      setMsg({
        text: "유튜브 반주 링크를 확인해 주세요. 주소를 그대로 붙여넣으면 돼요.",
        kind: "err",
      });
      return;
    }
    if (!yt.apiReady) {
      setMsg({
        text: "플레이어를 준비 중이에요. 잠시 후 다시 눌러 주세요.",
        kind: "err",
      });
      return;
    }
    pendingIdRef.current = id;
    let secs = parseInt(delayRef.current, 10);
    if (isNaN(secs) || secs < 0) secs = 0;
    if (secs > 60) secs = 60;
    ensureAudio();
    setArmed(true);
    armedRef.current = true;
    yt.ensure(ytInnerRef.current, id, {
      onReady: () => {
        applyVolume();
        if (preLoadRef.current)
          primePlayer(id); // 미리 재생(버퍼) 준비
        else yt.cueById(id); // 준비만, 재생은 카운트 후에
        runCountdown(secs);
      },
      onState,
      onError: (code) => {
        cancelCountdown();
        setMsg({ text: ytErrMsg(code), kind: "err" });
      },
    });
  }, [
    url,
    yt,
    ensureAudio,
    applyVolume,
    primePlayer,
    runCountdown,
    onState,
    cancelCountdown,
  ]);

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

  // 이전/다음: 재생 중이면 반주도 해당 페이지 시작 지점으로 함께 이동
  const jump = useCallback(
    (delta) => {
      if (totalRef.current === 0) return;
      let target = Math.max(
        1,
        Math.min(totalRef.current, pdf.pageNumRef.current + delta),
      );
      const pt = pageTimesRef.current;
      if (armedRef.current && isFinite(pt[target - 1])) {
        yt.seek(pt[target - 1] || 0);
        pdf.show(target);
      } else {
        pdf.show(target);
      }
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
    yt.stop();
    pdf.show(1);
    if (barRef.current) barRef.current.style.width = "0%";
    if (clockRef.current) clockRef.current.textContent = "";
  }, [stopFollowing, yt, pdf]);

  // ---- PDF 파일 선택 ----
  const onFile = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = ""; // 같은 파일을 다시 선택해도 change가 오도록 비움 (초기화 후 재선택 대응)
    if (!f) return;
    stopPlayback();
    setMsg({ text: "악보 불러오는 중…", kind: "ok" });
    try {
      const n = await pdf.load(f);
      setMsg({
        text:
          "총 " +
          n +
          "페이지 · 유튜브 링크까지 넣고 시작을 누르면 반주에 맞춰 넘어가요.",
        kind: "ok",
      });
    } catch (err) {
      console.error("[pdf load]", err);
      let text;
      if (err && err.name === "PasswordException")
        text = "암호가 걸린 PDF예요. 암호를 푼 파일로 다시 시도해 주세요.";
      else if (err && err.name === "InvalidPDFException")
        text = "PDF 형식이 아니거나 파일이 손상됐어요.";
      else
        text =
          "PDF를 여는 데 실패했어요: " +
          (err && err.message ? err.message : err);
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
    showToast("볼륨 " + nv + "%");
  };
  // 숫자키: 해당 쪽으로 바로 이동 (재생 중엔 그 쪽에 설정된 시각이 있어야 반주도 따라가며 유지됨)
  const goToPage = (n) => {
    if (totalRef.current === 0) return;
    const target = Math.max(1, Math.min(totalRef.current, n));
    const pt = pageTimesRef.current;
    if (armedRef.current && isFinite(pt[target - 1])) {
      yt.seek(pt[target - 1] || 0);
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
    nudgeVolume,
    goToPage,
    overlayOpen: countText != null,
  };
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "INPUT") return;
      const h = kbRef.current;
      if (e.code === "Space") {
        e.preventDefault();
        if (h.overlayOpen) {
          h.cancelCountdown();
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
      } else if (e.code === "Enter") {
        if (totalRef.current > 0) setFocus((f) => !f);
      } else if (e.code === "Escape") {
        h.stopPlayback();
      } else {
        const m = e.code.match(/^(?:Digit|Numpad)([0-9])$/);
        if (m) {
          const d = parseInt(m[1], 10);
          if (d === 0)
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

  const playDisabled = !(pdf.total > 0 && yt.apiReady);
  const navDisabled = pdf.total === 0;
  const playLabel = armed && isPlaying ? "일시정지" : "시작";

  return (
    <div className={"app" + (focus ? " focus" : "")}>
      <aside className="sidebar">
        <header>
          <div className="eyebrowRow">
            <div className="eyebrow">Count-In</div>
            <a
              className="pageLink"
              href="/metronome"
              onClick={(e) => {
                e.preventDefault();
                navigate("/metronome");
              }}
            >
              🥁 메트로놈 ›
            </a>
          </div>
          <h1>
            타이밍 해두면 <span className="accent">타이밍 맞춰서</span> 넘어감.
          </h1>
          <p className="sub">
            유튜브 반주와 악보 PDF를 넣고, 페이지 넘길 시각을 정해두면 그 시각에
            넘어가요.
          </p>
        </header>

        <div className="presets">
          <div className="presetsHead">
            <span>저장한 곡</span>
          </div>
          {presets.length === 0 ? (
            <div className="presetsEmpty">
              설정을 저장하면 여기서 골라 불러올 수 있어요.
            </div>
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
                        p.url
                          ? "불러오기 · " + p.url
                          : "불러오기 · ⚠ 저장된 링크 없음"
                      }
                    >
                      {p.name}
                    </button>
                    <button
                      className="presetDel"
                      onClick={() => deletePreset(p.id)}
                      title="삭제"
                      aria-label={p.name + " 삭제"}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div className="presetsHint">
                악보파일 선택 하고 저장된 곡 클릭
              </div>
            </>
          )}
        </div>

        <div className="controls">
          <div className="group grow">
            <label htmlFor="url">① 유튜브 반주 링크</label>
            <input
              id="url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtu.be/... 또는 watch?v=..."
            />
          </div>

          <div className="group">
            <label>② 악보 파일</label>
            <label className="upload">
              <input type="file" accept="application/pdf" onChange={onFile} />
              <span>
                {pdf.total > 0
                  ? "📄 " + pdf.total + "쪽 불러옴"
                  : "📄 PDF 불러오기"}
              </span>
            </label>
          </div>

          <div className="group">
            <label htmlFor="delay">③ 시작</label>
            <div className="startRow">
              <div className="time-inputs">
                <input
                  id="delay"
                  type="number"
                  min="0"
                  max="60"
                  step="1"
                  value={delay}
                  onChange={(e) => setDelay(e.target.value)}
                />
                <span className="unit">초 세고</span>
              </div>
              <button
                className="btn startBtn"
                onClick={togglePlay}
                disabled={playDisabled}
                title={playDisabled ? "링크와 악보를 먼저 넣어 주세요" : ""}
              >
                {playLabel}
              </button>
            </div>
          </div>

          <button type="button" className="advToggle" onClick={toggleAdv}>
            <span>⚙ 세부 설정 — 넘김·볼륨·배속·소리</span>
            <span>{adv ? "▴" : "▾"}</span>
          </button>

          {adv && (
            <div className="advBody">
              <div className="group">
                <label>넘김 방식</label>
                <div className="seg">
                  {[
                    ["cue", "쪽마다 시각"],
                    ["interval", "일정 간격"],
                    ["even", "곡 길이 균등"],
                  ].map(([k, t]) => (
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
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {flipMode === "interval" && (
                <div className="group">
                  <label>페이지 간격</label>
                  <div className="time-inputs">
                    <input
                      type="number"
                      min="0"
                      max="999"
                      step="1"
                      value={ivMin}
                      onChange={(e) => setIvMin(e.target.value)}
                    />
                    <span className="unit">분</span>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      step="1"
                      value={ivSec}
                      onChange={(e) => setIvSec(e.target.value)}
                    />
                    <span className="unit">초</span>
                  </div>
                </div>
              )}

              <div className="group">
                <label htmlFor="vol">반주 볼륨</label>
                <div className="slider-row">
                  <span className="vol-icon">🔊</span>
                  <input
                    id="vol"
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={(e) => setVolume(parseInt(e.target.value, 10))}
                  />
                  <span className="vol-val">{volume}%</span>
                </div>
              </div>

              <div className="group">
                <label>재생 속도</label>
                <div className="seg">
                  {[
                    [0.5, "0.5배"],
                    [0.75, "0.75배"],
                    [1, "원속"],
                  ].map(([r, t]) => (
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
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="group">
                <label>카운트 소리</label>
                <div className="seg">
                  {[
                    ["stick", "탁탁"],
                    ["beep", "삑삑"],
                    ["off", "끄기"],
                  ].map(([k, t]) => (
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
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="group">
                <label>옵션</label>
                <label
                  className="switch-mini"
                  title="카운트다운 동안 반주를 음소거로 잠깐 돌려 버퍼링을 풀어두고 0:00으로 되감아둬요. 끄면 카운트 후 바로 재생돼요(맨 앞이 살짝 끊길 수 있어요)."
                >
                  <input
                    type="checkbox"
                    checked={preLoad}
                    onChange={(e) => setPreLoad(e.target.checked)}
                  />
                  <span className="box"></span>
                  <span>카운트 중 미리 재생 준비</span>
                </label>
                <label className="switch-mini">
                  <input
                    type="checkbox"
                    checked={loopOn}
                    onChange={(e) => setLoopOn(e.target.checked)}
                  />
                  <span className="box"></span>
                  <span>끝나면 처음부터 반복</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {flipMode === "cue" && pdf.total > 1 && (
          <div className="cuePanel">
            <div className="cueHead">
              <div className="cueDesc">
                <b>페이지 넘김 시각</b> — <code>0:45</code>처럼 입력하거나,
                반주를 들으며 <b>지금 넘김</b>(<kbd>M</kbd>)으로 찍어 두세요.
                저장돼요.
              </div>
              <div className="cueActions">
                <button
                  className="btn small"
                  onClick={tap}
                  disabled={!armed || tapCursor >= pdf.total - 1}
                >
                  🎯 지금 넘김
                  {armed && tapCursor < pdf.total - 1
                    ? ` (${tapCursor + 1}→${tapCursor + 2}쪽)`
                    : ""}
                </button>
                <button className="btn ghost small" onClick={clearCues}>
                  초기화
                </button>
              </div>
            </div>
            <div className="cueRows" ref={cueRowsRef}>
              {cueText.map((v, i) => (
                <div
                  className={
                    "cueRow" + (armed && i === tapCursor ? " hot" : "")
                  }
                  key={i}
                >
                  <span className="cueLabel">
                    {i + 1} → {i + 2}쪽
                  </span>
                  <input
                    type="text"
                    value={v}
                    placeholder="0:00"
                    onChange={(e) => setCueAt(i, e.target.value)}
                  />
                  <button
                    className="btn ghost tiny"
                    onClick={() => nowAt(i)}
                    disabled={!armed}
                  >
                    지금
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

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
                placeholder="곡 이름"
              />
              <button className="btn small" onClick={confirmSave}>
                저장
              </button>
              <button
                className="btn ghost small"
                onClick={() => setSaveOpen(false)}
              >
                취소
              </button>
            </div>
          ) : (
            <button
              className={"btn savePresetBtn" + (savedFlash ? " saved" : "")}
              onClick={openSave}
            >
              {savedFlash
                ? '✓ "' + savedFlash.name + '" 저장됨'
                : "💾 현재 설정 저장"}
            </button>
          )}
          <button
            className={"btn ghost resetAllBtn" + (confirmReset ? " arm" : "")}
            onClick={resetClick}
          >
            {confirmReset ? "한 번 더 누르면 초기화돼요" : "🧹 전체 초기화"}
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="navbar">
          <button className="btn" onClick={togglePlay} disabled={playDisabled}>
            {playLabel}
          </button>
          <button
            className="btn ghost"
            onClick={() => jump(-1)}
            disabled={navDisabled}
          >
            ‹ 이전
          </button>
          <button
            className="btn ghost"
            onClick={() => jump(1)}
            disabled={navDisabled}
          >
            다음 ›
          </button>
          <button
            className="btn ghost"
            onClick={stopPlayback}
            disabled={navDisabled}
          >
            처음으로
          </button>
          <button
            className="btn ghost"
            onClick={() => setFocus((f) => !f)}
            disabled={navDisabled}
          >
            {focus ? "↙ 설정 보기" : "⤢ 악보 크게"}
          </button>
          <span className="kbhint" ref={kbWrapRef}>
            <b>Space</b> 재생 · <b>←→</b> 페이지 · <b>M</b> 지금 넘김
            <button
              type="button"
              className="kbMore"
              title="단축키 전체 보기"
              aria-expanded={showKeys}
              onClick={() => setShowKeys((s) => !s)}
            >
              ?
            </button>
            {showKeys && (
              <div className="kbPop">
                <div className="kbPopTitle">단축키</div>
                {[
                  ["Space", "시작 · 일시정지"],
                  ["← →", "이전 · 다음 쪽"],
                  ["↑ ↓", "볼륨"],
                  ["M", "지금 넘김 (타이밍 찍기)"],
                  ["1~9", "해당 쪽으로 이동"],
                  ["Enter", "악보 크게 보기"],
                  ["0 · Esc", "처음으로"],
                ].map(([k, d]) => (
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
            <>
              <div className="big">🎼</div>
              <div>악보 PDF를 불러오면 여기에 표시돼요.</div>
            </>
          )}
          <canvas
            ref={canvasRef}
            style={{ display: pdf.total ? "block" : "none" }}
          ></canvas>
          <div className="flipHint" ref={flipHintRef}></div>
          {pdf.total > 0 && (
            <>
              <div
                className="tapZone left"
                title="이전 쪽"
                aria-hidden="true"
                onClick={() => jump(-1)}
              >
                <span>‹</span>
              </div>
              <div
                className="tapZone right"
                title="다음 쪽"
                aria-hidden="true"
                onClick={() => jump(1)}
              >
                <span>›</span>
              </div>
            </>
          )}
        </div>

        <div className={"msg " + msg.kind} role="status" aria-live="polite">
          {msg.text}
        </div>

        {toast && (
          <div className="toast" role="status" key={toast.id}>
            {toast.text}
          </div>
        )}
      </main>

      {pdf.total > 0 && (
        <div className="mobileBar">
          <button className="btn" onClick={togglePlay} disabled={playDisabled}>
            {playLabel}
          </button>
          <button className="btn ghost" onClick={() => jump(-1)}>
            ‹ 이전
          </button>
          <button className="btn ghost" onClick={() => jump(1)}>
            다음 ›
          </button>
          <span className="page-ind">
            <b>{pdf.pageNum}</b> / {pdf.total}
          </span>
        </div>
      )}

      <div className={"ytHost" + (armed ? " show" : "")} ref={ytHostRef}></div>

      {countText != null && (
        <div
          className="overlay show"
          role="alertdialog"
          aria-label="시작 카운트다운"
          aria-live="assertive"
        >
          <div className="get-ready">Get ready</div>
          {countText === "▶" ? (
            <div className="go">▶</div>
          ) : (
            <div className="count tick" key={countText}>
              {countText}
            </div>
          )}
          <button className="cancel" onClick={cancelCountdown}>
            취소
          </button>
        </div>
      )}
    </div>
  );
}
