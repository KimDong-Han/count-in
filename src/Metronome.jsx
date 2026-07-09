import { useCallback, useEffect, useRef, useState } from "react";
import { playBeep, playStick } from "./sound";
import { navigate } from "./router.js";
import { currentDark, setDark } from "./theme.js";
import { STR, detectLang, saveLang, applyLangAttr } from "./i18n.jsx";
import { Hand, Moon, Sun } from "lucide-react";

// 별도 페이지(#/metronome)의 메트로놈.
// 타이밍은 setInterval이 아니라 Web Audio 룩어헤드 스케줄러로:
// 25ms마다 깨어나 앞으로 0.12초 안에 울릴 틱을 AudioContext 시계에 예약해
// 탭 전환·렉에도 박자가 밀리지 않는다.
const LS_KEY = "cin:metro";
const BPM_MIN = 30;
const BPM_MAX = 240;
const clampBpm = (b) => Math.max(BPM_MIN, Math.min(BPM_MAX, b));

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "{}");
  } catch {
    return {};
  }
}

export default function Metronome() {
  const saved = useRef(loadSettings()).current;
  const [bpm, setBpm] = useState(clampBpm(saved.bpm ?? 100));
  const [beats, setBeats] = useState(saved.beats ?? 4); // 한 마디 박 수 (1=강세 없음)
  const [soundMode, setSoundMode] = useState(saved.soundMode ?? "stick");
  const [volume, setVolume] = useState(saved.volume ?? 80);
  const [accentOn, setAccentOn] = useState(saved.accentOn ?? true); // 첫박 강세
  const [running, setRunning] = useState(false);
  const [beatVis, setBeatVis] = useState(-1); // 현재 반짝일 박 (0-based)
  const [darkMode, setDarkMode] = useState(currentDark); // 🌙/☀️ 토글 표시용
  const flipTheme = () => {
    setDark(!darkMode);
    setDarkMode(!darkMode);
  };
  // 한/영 전환 (App.jsx와 같은 패턴 — cin:lang 공유)
  const [lang, setLang] = useState(detectLang);
  useEffect(() => {
    applyLangAttr(lang);
  }, [lang]);
  const t = (key, ...args) => {
    const v = STR[lang][key] ?? STR.ko[key];
    return typeof v === "function" ? v(...args) : v;
  };
  const flipLang = () => {
    const nl = lang === "ko" ? "en" : "ko";
    saveLang(nl);
    setLang(nl);
  };

  // 스케줄러 루프에서 최신값을 읽기 위한 ref 미러 (App.jsx와 같은 패턴)
  const bpmRef = useRef(bpm);
  const beatsRef = useRef(beats);
  const soundRef = useRef(soundMode);
  const volRef = useRef(volume);
  const accentRef = useRef(accentOn);
  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);
  useEffect(() => {
    beatsRef.current = beats;
  }, [beats]);
  useEffect(() => {
    soundRef.current = soundMode;
  }, [soundMode]);
  useEffect(() => {
    volRef.current = volume;
  }, [volume]);
  useEffect(() => {
    accentRef.current = accentOn;
  }, [accentOn]);

  // 설정 저장
  useEffect(() => {
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({ bpm, beats, soundMode, volume, accentOn }),
      );
    } catch {}
  }, [bpm, beats, soundMode, volume, accentOn]);

  const ctxRef = useRef(null);
  const timerRef = useRef(null);
  const nextTimeRef = useRef(0);
  const beatCountRef = useRef(0);
  const visTimersRef = useRef([]);
  const tapsRef = useRef([]);

  const ensureCtx = () => {
    if (!ctxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctxRef.current = new AC();
    }
    if (ctxRef.current && ctxRef.current.state === "suspended")
      ctxRef.current.resume();
    return ctxRef.current;
  };

  const scheduleAhead = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    while (nextTimeRef.current < ctx.currentTime + 0.12) {
      const beat = beatCountRef.current;
      const accent =
        accentRef.current && beatsRef.current > 1 && beat === 0;
      const fn = soundRef.current === "beep" ? playBeep : playStick;
      fn(ctx, volRef.current, accent, nextTimeRef.current);
      // 소리 시각에 맞춰 점 표시도 갱신
      const delay = Math.max(0, (nextTimeRef.current - ctx.currentTime) * 1000);
      visTimersRef.current.push(setTimeout(() => setBeatVis(beat), delay));
      if (visTimersRef.current.length > 16)
        visTimersRef.current = visTimersRef.current.slice(-8);
      nextTimeRef.current += 60 / bpmRef.current;
      beatCountRef.current = (beat + 1) % beatsRef.current;
    }
  }, []);

  const start = useCallback(() => {
    const ctx = ensureCtx();
    if (!ctx) return;
    nextTimeRef.current = ctx.currentTime + 0.08;
    beatCountRef.current = 0;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(scheduleAhead, 25);
    scheduleAhead();
    setRunning(true);
  }, [scheduleAhead]);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    visTimersRef.current.forEach(clearTimeout);
    visTimersRef.current = [];
    setRunning(false);
    setBeatVis(-1);
  }, []);

  const toggle = useCallback(() => {
    if (timerRef.current) stop();
    else start();
  }, [start, stop]);

  useEffect(() => () => stop(), [stop]); // 페이지 이탈 시 정리

  const nudge = (d) => setBpm((b) => clampBpm(b + d));

  // 탭 템포: 최근 2초 내 탭 간격 평균으로 BPM 산출
  const tap = () => {
    const now = performance.now();
    const taps = tapsRef.current.filter((t) => now - t < 2000);
    taps.push(now);
    tapsRef.current = taps.slice(-6);
    if (tapsRef.current.length >= 2) {
      const arr = tapsRef.current;
      const avg = (arr[arr.length - 1] - arr[0]) / (arr.length - 1);
      setBpm(clampBpm(Math.round(60000 / avg)));
    }
  };

  // 키보드: Space 시작/정지 · ↑↓ ±1 · ←→ ±5 · T 탭 · Esc 정지
  const kbRef = useRef({});
  kbRef.current = { toggle, stop, tap };
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "INPUT") return;
      const h = kbRef.current;
      if (e.code === "Space") {
        e.preventDefault();
        h.toggle();
      } else if (e.code === "ArrowUp") {
        e.preventDefault();
        nudge(1);
      } else if (e.code === "ArrowDown") {
        e.preventDefault();
        nudge(-1);
      } else if (e.code === "ArrowRight") {
        nudge(5);
      } else if (e.code === "ArrowLeft") {
        nudge(-5);
      } else if (e.code === "KeyT") {
        h.tap();
      } else if (e.code === "Escape") {
        h.stop();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="metro">
      <div className="metroTop">
        <a
          className="pageLink"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate("/");
          }}
        >
          {t("backLink")}
        </a>
        <span className="headLinks">
          <h1 className="eyebrow">{t("mTitle")}</h1>
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
        </span>
      </div>

      <div className="metroCard">
        <div className="bpmBig" aria-live="off">
          <span className="bpmNum">{bpm}</span>
          <span className="bpmUnit">BPM</span>
        </div>

        <div className="beatDots" aria-hidden="true">
          {Array.from({ length: beats }, (_, i) => (
            <span
              key={i}
              className={
                "dot" +
                (i === beatVis ? " on" : "") +
                (i === 0 && beats > 1 && accentOn ? " accent" : "")
              }
            ></span>
          ))}
        </div>

        <div className="metroRow bpmCtl">
          <button className="btn ghost small" onClick={() => nudge(-5)}>
            −5
          </button>
          <button className="btn ghost small" onClick={() => nudge(-1)}>
            −1
          </button>
          <input
            type="range"
            min={BPM_MIN}
            max={BPM_MAX}
            value={bpm}
            aria-label="BPM"
            onChange={(e) => setBpm(clampBpm(parseInt(e.target.value, 10)))}
          />
          <button className="btn ghost small" onClick={() => nudge(1)}>
            +1
          </button>
          <button className="btn ghost small" onClick={() => nudge(5)}>
            +5
          </button>
        </div>

        <div className="metroRow mainCtl">
          <button
            className={"btn metroStart" + (running ? " running" : "")}
            onClick={toggle}
          >
            {running ? t("mStop") : t("mStart")}
          </button>
          <button className="btn ghost tapBtn" onClick={tap}>
            <Hand size={15} /> {t("tapTempo")} <kbd>T</kbd>
          </button>
        </div>

        <div className="metroRow">
          <label>{t("beatsLabel")}</label>
          <div className="seg">
            {[1, 2, 3, 4, 6].map((n) => (
              <button
                key={n}
                type="button"
                className={beats === n ? "active" : ""}
                aria-pressed={beats === n}
                onClick={() => {
                  setBeats(n);
                  beatsRef.current = n;
                  if (beatCountRef.current >= n) beatCountRef.current = 0;
                }}
              >
                {n === 1 ? t("beatNone") : t("beatN", n)}
              </button>
            ))}
          </div>
        </div>

        <div className="metroRow">
          <label>{t("accentLabel")}</label>
          <label className="switch-mini">
            <input
              type="checkbox"
              checked={accentOn}
              disabled={beats === 1}
              onChange={(e) => setAccentOn(e.target.checked)}
            />
            <span className="box"></span>
            <span>
              {t("accentDesc")}
              {beats === 1 ? t("accentNeedBeats") : ""}
            </span>
          </label>
        </div>

        <div className="metroRow">
          <label>{t("soundLabel")}</label>
          <div className="seg">
            {[
              ["stick", t("soundStick")],
              ["beep", t("soundBeep")],
            ].map(([k, label]) => (
              <button
                key={k}
                type="button"
                className={soundMode === k ? "active" : ""}
                aria-pressed={soundMode === k}
                onClick={() => setSoundMode(k)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="metroRow">
          <label htmlFor="mvol">{t("volumeLabel")}</label>
          <div className="slider-row">
            <input
              id="mvol"
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => setVolume(parseInt(e.target.value, 10))}
            />
            <span className="vol-val">{volume}%</span>
          </div>
        </div>
      </div>

      <div className="kbhint metroHint">{t("mHint")}</div>

      <footer className="siteFoot">
        <a href="mailto:devkim1030@gmail.com">devkim1030@gmail.com</a>
      </footer>
    </div>
  );
}
