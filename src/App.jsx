import { useCallback, useEffect, useRef, useState } from 'react'
import { usePdf } from './usePdf'
import { useYouTube, extractId, ytErrMsg } from './useYouTube'
import { playBeep, playStick } from './sound'
import { parseTime, fmt } from './time'

export default function App(){
  const canvasRef = useRef(null)
  const stageRef = useRef(null)
  const ytHostRef = useRef(null)
  const ytInnerRef = useRef(null)   // 유튜브 플레이어를 심는 imperative div
  const barRef = useRef(null)
  const clockRef = useRef(null)

  const pdf = usePdf(canvasRef, stageRef)
  const yt = useYouTube()

  // ---- UI 상태 ----
  const [url, setUrl] = useState('')
  const [delay, setDelay] = useState(4)
  const [volume, setVolume] = useState(80)
  const [soundMode, setSoundMode] = useState('stick')     // 'stick' | 'beep' | 'off'
  const [flipMode, setFlipMode] = useState('cue')          // 'cue' | 'interval' | 'even'
  const [ivMin, setIvMin] = useState(0)
  const [ivSec, setIvSec] = useState(20)
  const [loopOn, setLoopOn] = useState(false)
  const [cueText, setCueText] = useState([])               // 문자열 배열 (길이 total-1)
  const [armed, setArmed] = useState(false)                // 시작 눌러 재생/준비 중
  const [isPlaying, setIsPlaying] = useState(false)
  const [countText, setCountText] = useState(null)         // null=숨김, 숫자 or '▶'
  const [msg, setMsg] = useState({ text: '악보 파일은 이 브라우저 안에서만 열려요. 어디로도 업로드되지 않아요.', kind: 'ok' })
  const [tapCursor, setTapCursor] = useState(0)            // 탭으로 기록할 다음 전환 index
  const [focus, setFocus] = useState(false)                // 집중 모드(컨트롤 숨김)
  const [presets, setPresets] = useState(() => {           // 저장한 곡 프리셋 목록
    try { return JSON.parse(localStorage.getItem('cin:presets') || '[]') } catch { return [] }
  })

  // ---- 최신값을 rAF/콜백에서 읽기 위한 ref 미러 ----
  const totalRef = useRef(0)
  const flipModeRef = useRef(flipMode)
  const cuesRef = useRef([])          // parseTime 적용된 숫자 배열
  const cueTextRef = useRef([])
  const volumeRef = useRef(volume)
  const soundModeRef = useRef(soundMode)
  const loopRef = useRef(loopOn)
  const ivRef = useRef({ m: 0, s: 20 })
  const armedRef = useRef(false)
  const tapCursorRef = useRef(0)
  const delayRef = useRef(delay)
  const pageTimesRef = useRef([0])
  const followRef = useRef(false)
  const rafRef = useRef(null)
  const audioRef = useRef(null)
  const countdownTimerRef = useRef(null)
  const primeTimerRef = useRef(null)
  const pendingIdRef = useRef(null)

  useEffect(() => { totalRef.current = pdf.total }, [pdf.total])
  useEffect(() => { flipModeRef.current = flipMode }, [flipMode])
  useEffect(() => { volumeRef.current = volume }, [volume])
  useEffect(() => { soundModeRef.current = soundMode }, [soundMode])
  useEffect(() => { loopRef.current = loopOn }, [loopOn])
  useEffect(() => { ivRef.current = { m: ivMin, s: ivSec } }, [ivMin, ivSec])
  useEffect(() => { armedRef.current = armed }, [armed])
  useEffect(() => { tapCursorRef.current = tapCursor }, [tapCursor])
  useEffect(() => { delayRef.current = delay }, [delay])

  // 유튜브 플레이어용 imperative div를 최초 1회 생성 (React가 건드리지 않도록)
  useEffect(() => {
    if(ytHostRef.current && ytHostRef.current.childElementCount === 0){
      const inner = document.createElement('div')
      inner.style.width = '100%'
      inner.style.height = '100%'
      ytHostRef.current.appendChild(inner)
      ytInnerRef.current = inner
    }
  }, [])

  // ---- 사운드 ----
  const ensureAudio = useCallback(() => {
    if(!audioRef.current){
      const AC = window.AudioContext || window.webkitAudioContext
      if(AC) audioRef.current = new AC()
    }
    if(audioRef.current && audioRef.current.state === 'suspended') audioRef.current.resume()
  }, [])

  const tickSound = useCallback((accent) => {
    if(soundModeRef.current === 'off') return
    ensureAudio()
    const ctx = audioRef.current
    if(!ctx) return
    if(soundModeRef.current === 'stick') playStick(ctx, volumeRef.current, accent)
    else playBeep(ctx, volumeRef.current, accent)
  }, [ensureAudio])

  // ---- 넘김 스케줄: pageTimes[k] = (k+1)번째 페이지를 띄울 곡 진행 시각(초) ----
  const intervalSec = () => {
    let m = parseInt(ivRef.current.m, 10); if(isNaN(m) || m < 0) m = 0
    let s = parseInt(ivRef.current.s, 10); if(isNaN(s) || s < 0) s = 0
    let sec = m * 60 + s
    if(sec < 1) sec = 1
    return sec
  }

  const buildSchedule = useCallback(() => {
    const total = totalRef.current
    let pt = [0]
    if(total > 1){
      if(flipModeRef.current === 'cue'){
        for(let i = 0; i < total - 1; i++){
          const c = cuesRef.current[i]
          pt.push((c == null || isNaN(c)) ? Infinity : c)   // 미입력 = 자동으로 넘기지 않음(수동 대기)
        }
      } else if(flipModeRef.current === 'even'){
        const dur = yt.getDuration()
        if(dur > 1){
          const span = dur * 0.98
          pt = []
          for(let i = 0; i < total; i++) pt.push(span * i / total)
        } else {
          const iv = intervalSec(); pt = []
          for(let i = 0; i < total; i++) pt.push(iv * i)
        }
      } else {
        const iv = intervalSec(); pt = []
        for(let i = 0; i < total; i++) pt.push(iv * i)
      }
    }
    pageTimesRef.current = pt
  }, [yt])

  // 곡 진행 위치를 따라가며 페이지 + 진행바 갱신
  const followLoop = useCallback(() => {
    if(!followRef.current) return
    const t = yt.getTime() || 0
    const dur = yt.getDuration() || 0
    const pt = pageTimesRef.current

    // 현재 시각에 해당하는 페이지
    let target = 1
    for(let i = 0; i < pt.length; i++){ if(t + 0.12 >= pt[i]) target = i + 1; else break }
    if(target !== pdf.pageNumRef.current) pdf.show(target)

    // 다음 넘김까지 진행바
    const cur = pdf.pageNumRef.current
    const curStart = isFinite(pt[cur - 1]) ? pt[cur - 1] : 0
    let nextAt = cur < pt.length ? pt[cur] : (dur || curStart + 1)
    if(!isFinite(nextAt)) nextAt = dur || curStart + 1
    const denom = Math.max(0.001, nextAt - curStart)
    const pct = Math.max(0, Math.min(100, (t - curStart) / denom * 100))
    if(barRef.current) barRef.current.style.width = pct + '%'
    if(clockRef.current) clockRef.current.textContent = dur ? (fmt(t) + ' / ' + fmt(dur)) : fmt(t)

    rafRef.current = requestAnimationFrame(followLoop)
  }, [yt, pdf])

  const startFollowing = useCallback(() => {
    followRef.current = true
    if(rafRef.current) cancelAnimationFrame(rafRef.current)
    followLoop()
  }, [followLoop])

  const stopFollowing = useCallback(() => {
    followRef.current = false
    if(rafRef.current){ cancelAnimationFrame(rafRef.current); rafRef.current = null }
  }, [])

  // ---- cue(페이지별 타이밍) 저장/불러오기 ----
  const cueKey = (id, total) => 'cues:' + id + ':' + total
  const saveCues = useCallback((arr) => {
    const id = pendingIdRef.current || extractId(url)
    if(id && totalRef.current > 0){
      try{ localStorage.setItem(cueKey(id, totalRef.current), JSON.stringify(arr)) }catch(e){}
    }
  }, [url])

  const recomputeCues = useCallback((arr) => {
    cueTextRef.current = arr
    cuesRef.current = arr.map(parseTime)
    buildSchedule()
  }, [buildSchedule])

  // PDF 로드/URL 변경 시 cue 슬롯 크기 맞추고 저장된 타이밍 불러오기
  const syncCueSlots = useCallback(() => {
    const n = Math.max(0, totalRef.current - 1)
    let arr = new Array(n).fill('')
    const id = extractId(url)
    if(id && totalRef.current > 0){
      try{
        const raw = localStorage.getItem(cueKey(id, totalRef.current))
        if(raw){
          const s = JSON.parse(raw)
          if(Array.isArray(s)) arr = arr.map((_, i) => (s[i] != null ? s[i] : ''))
        }
      }catch(e){}
    }
    setCueText(arr)
    recomputeCues(arr)
    setTapCursor(0)
  }, [url, recomputeCues])

  useEffect(() => { totalRef.current = pdf.total; syncCueSlots() }, [pdf.total])   // eslint-disable-line
  useEffect(() => { if(pdf.total > 0) syncCueSlots() }, [url])                      // eslint-disable-line

  const setCueAt = (i, val) => {
    setCueText(prev => {
      const next = [...prev]
      next[i] = val
      recomputeCues(next)
      saveCues(next)
      return next
    })
  }
  const nowAt = (i) => {
    if(!armedRef.current) return
    setCueAt(i, fmt(yt.getTime() || 0))
    setTapCursor(i + 1)
  }
  const tap = () => {
    const idx = tapCursorRef.current
    if(idx >= totalRef.current - 1) return
    nowAt(idx)
  }
  const clearCues = () => {
    const arr = new Array(Math.max(0, totalRef.current - 1)).fill('')
    setCueText(arr)
    recomputeCues(arr)
    saveCues(arr)
    setTapCursor(0)
  }

  // ---- 곡 프리셋(설정 통째로) 저장/불러오기 ----
  const persistPresets = (list) => {
    setPresets(list)
    try { localStorage.setItem('cin:presets', JSON.stringify(list)) } catch {}
  }
  const savePreset = () => {
    const def = '곡 ' + (presets.length + 1)
    const name = window.prompt('저장할 곡 이름을 입력하세요.', def)
    if(name == null) return
    const trimmed = name.trim() || def
    const preset = {
      id: 'p' + Date.now(),
      name: trimmed,
      url, delay, volume, soundMode, flipMode, ivMin, ivSec, loopOn,
      cues: cueTextRef.current.slice(),
      pageCount: pdf.total,
    }
    // 같은 이름이면 덮어쓰기
    const idx = presets.findIndex(p => p.name === trimmed)
    const list = idx >= 0 ? presets.map((p, i) => (i === idx ? preset : p)) : [...presets, preset]
    persistPresets(list)
    // 해당 영상의 cue 저장소도 갱신해, 나중에 같은 PDF를 열면 자동 복원되게
    const id = extractId(url)
    if(id && pdf.total > 0){ try{ localStorage.setItem(cueKey(id, pdf.total), JSON.stringify(preset.cues)) }catch(e){} }
    setMsg({ text: '"' + trimmed + '" 설정을 저장했어요.', kind: 'ok' })
  }
  const loadPreset = (p) => {
    stopPlayback()
    setUrl(p.url ?? '')
    setDelay(p.delay ?? 4)
    setVolume(p.volume ?? 80)
    setSoundMode(p.soundMode ?? 'stick'); soundModeRef.current = p.soundMode ?? 'stick'
    setFlipMode(p.flipMode ?? 'cue'); flipModeRef.current = p.flipMode ?? 'cue'
    setIvMin(p.ivMin ?? 0); setIvSec(p.ivSec ?? 20); ivRef.current = { m: p.ivMin ?? 0, s: p.ivSec ?? 20 }
    setLoopOn(!!p.loopOn); loopRef.current = !!p.loopOn
    const cues = Array.isArray(p.cues) ? p.cues.slice() : []
    setCueText(cues); recomputeCues(cues); setTapCursor(0)
    // 같은 PDF를 다시 열었을 때도 복원되도록 cue 저장소에 반영
    const id = extractId(p.url)
    if(id && p.pageCount > 0){ try{ localStorage.setItem(cueKey(id, p.pageCount), JSON.stringify(cues)) }catch(e){} }
    setMsg({ text: '"' + p.name + '" 불러옴 · 악보 PDF를 열면 저장된 타이밍이 적용돼요.', kind: 'ok' })
  }
  const deletePreset = (id) => {
    persistPresets(presets.filter(p => p.id !== id))
  }

  // ---- 재생 흐름 ----
  const applyVolume = useCallback(() => { yt.unMute(); yt.setVolume(volumeRef.current) }, [yt])
  useEffect(() => { if(armedRef.current){ yt.unMute(); yt.setVolume(volume) } }, [volume]) // eslint-disable-line

  const primePlayer = useCallback((id) => {
    if(primeTimerRef.current) clearTimeout(primeTimerRef.current)
    yt.mute()
    yt.loadVideoById(id)          // 음소거 자동재생 → 버퍼/잠금 해제 + duration 확보
    primeTimerRef.current = setTimeout(() => {
      yt.pause(); yt.seek(0)
      primeTimerRef.current = null
    }, 400)
  }, [yt])

  const beginPlayback = useCallback(() => {
    if(primeTimerRef.current){ clearTimeout(primeTimerRef.current); primeTimerRef.current = null }
    pdf.show(1)
    buildSchedule()               // duration 확보 후 스케줄 계산
    yt.seek(0); yt.unMute(); yt.setVolume(volumeRef.current); yt.play()
    startFollowing()
  }, [pdf, buildSchedule, yt, startFollowing])

  const runCountdown = useCallback((secs) => {
    if(secs <= 0){ setCountText(null); beginPlayback(); return }
    setCountText(secs)
    tickSound(false)
    let rem = secs
    countdownTimerRef.current = setInterval(() => {
      rem -= 1
      if(rem <= 0){
        clearInterval(countdownTimerRef.current); countdownTimerRef.current = null
        setCountText('▶'); tickSound(true)
        setTimeout(() => { setCountText(null); beginPlayback() }, 550)
        return
      }
      setCountText(rem); tickSound(false)
    }, 1000)
  }, [beginPlayback, tickSound])

  const onState = useCallback((data) => {
    const YT = window.YT
    if(!YT) return
    if(data === YT.PlayerState.PLAYING) setIsPlaying(true)
    else if(data === YT.PlayerState.PAUSED) setIsPlaying(false)
    else if(data === YT.PlayerState.ENDED){
      if(loopRef.current){ yt.seek(0); yt.play(); pdf.show(1) }
      else {
        stopFollowing(); setIsPlaying(false)
        if(barRef.current) barRef.current.style.width = '100%'
        setMsg({ text: '반주가 끝났어요. 다시 시작하려면 시작을 눌러 주세요.', kind: 'ok' })
      }
    }
  }, [yt, pdf, stopFollowing])

  const cancelCountdown = useCallback(() => {
    if(countdownTimerRef.current){ clearInterval(countdownTimerRef.current); countdownTimerRef.current = null }
    if(primeTimerRef.current){ clearTimeout(primeTimerRef.current); primeTimerRef.current = null }
    setCountText(null)
    setArmed(false); armedRef.current = false
    setIsPlaying(false)
    yt.stop()
  }, [yt])

  const startFlow = useCallback(() => {
    setMsg({ text: '', kind: 'ok' })
    if(totalRef.current === 0){ setMsg({ text: '먼저 악보 PDF를 불러와 주세요.', kind: 'err' }); return }
    const id = extractId(url)
    if(!id){ setMsg({ text: '유튜브 반주 링크를 확인해 주세요. 주소를 그대로 붙여넣으면 돼요.', kind: 'err' }); return }
    if(!yt.apiReady){ setMsg({ text: '플레이어를 준비 중이에요. 잠시 후 다시 눌러 주세요.', kind: 'err' }); return }
    pendingIdRef.current = id
    let secs = parseInt(delayRef.current, 10)
    if(isNaN(secs) || secs < 0) secs = 0
    if(secs > 60) secs = 60
    ensureAudio()
    setArmed(true); armedRef.current = true
    yt.ensure(ytInnerRef.current, id, {
      onReady: () => { applyVolume(); primePlayer(id); runCountdown(secs) },
      onState,
      onError: (code) => { cancelCountdown(); setMsg({ text: ytErrMsg(code), kind: 'err' }) },
    })
  }, [url, yt, ensureAudio, applyVolume, primePlayer, runCountdown, onState, cancelCountdown])

  const togglePlay = useCallback(() => {
    if(!armedRef.current){ startFlow(); return }
    const YT = window.YT
    const st = yt.getState()
    if(YT && st === YT.PlayerState.PLAYING){ yt.pause(); stopFollowing(); setIsPlaying(false) }
    else { yt.play(); startFollowing(); setIsPlaying(true) }
  }, [startFlow, yt, stopFollowing, startFollowing])

  // 이전/다음: 재생 중이면 반주도 해당 페이지 시작 지점으로 함께 이동
  const jump = useCallback((delta) => {
    if(totalRef.current === 0) return
    let target = Math.max(1, Math.min(totalRef.current, pdf.pageNumRef.current + delta))
    const pt = pageTimesRef.current
    if(armedRef.current && isFinite(pt[target - 1])){
      yt.seek(pt[target - 1] || 0)
      pdf.show(target)
    } else {
      pdf.show(target)
    }
  }, [pdf, yt])

  const stopPlayback = useCallback(() => {
    if(countdownTimerRef.current){ clearInterval(countdownTimerRef.current); countdownTimerRef.current = null }
    if(primeTimerRef.current){ clearTimeout(primeTimerRef.current); primeTimerRef.current = null }
    stopFollowing()
    setCountText(null)
    setArmed(false); armedRef.current = false
    setIsPlaying(false)
    setTapCursor(0)
    yt.stop()
    pdf.show(1)
    if(barRef.current) barRef.current.style.width = '0%'
    if(clockRef.current) clockRef.current.textContent = ''
  }, [stopFollowing, yt, pdf])

  // ---- PDF 파일 선택 ----
  const onFile = async (e) => {
    const f = e.target.files && e.target.files[0]
    if(!f) return
    stopPlayback()
    setMsg({ text: '악보 불러오는 중…', kind: 'ok' })
    try{
      const n = await pdf.load(f)
      setMsg({ text: '총 ' + n + '페이지 · 유튜브 링크까지 넣고 시작을 누르면 반주에 맞춰 넘어가요.', kind: 'ok' })
    }catch(err){
      console.error('[pdf load]', err)
      let text
      if(err && err.name === 'PasswordException') text = '암호가 걸린 PDF예요. 암호를 푼 파일로 다시 시도해 주세요.'
      else if(err && err.name === 'InvalidPDFException') text = 'PDF 형식이 아니거나 파일이 손상됐어요.'
      else text = 'PDF를 여는 데 실패했어요: ' + (err && err.message ? err.message : err)
      setMsg({ text, kind: 'err' })
    }
  }

  // ---- 키보드 ----
  const kbRef = useRef({})
  kbRef.current = { togglePlay, jump, tap, stopPlayback, cancelCountdown, overlayOpen: countText != null }
  useEffect(() => {
    const onKey = (e) => {
      if(e.target.tagName === 'INPUT') return
      const h = kbRef.current
      if(e.code === 'Space'){ e.preventDefault(); if(h.overlayOpen){ h.cancelCountdown() } else { h.togglePlay() } }
      else if(e.code === 'ArrowRight'){ h.jump(1) }
      else if(e.code === 'ArrowLeft'){ h.jump(-1) }
      else if(e.code === 'KeyM'){ h.tap() }
      else if(e.code === 'Escape'){ h.stopPlayback() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // 스테이지 크기가 바뀔 때마다 현재 페이지를 다시 렌더 (창 크기·집중 모드·큐 패널 토글 등 모두 커버)
  useEffect(() => {
    const stage = stageRef.current
    if(!stage || typeof ResizeObserver === 'undefined') return
    let t = null
    const ro = new ResizeObserver(() => {
      clearTimeout(t)
      t = setTimeout(() => pdf.renderPage(pdf.pageNumRef.current), 120)
    })
    ro.observe(stage)
    return () => { clearTimeout(t); ro.disconnect() }
  }, [pdf.renderPage])   // eslint-disable-line

  const playDisabled = !(pdf.total > 0 && yt.apiReady)
  const navDisabled = pdf.total === 0
  const playLabel = armed && isPlaying ? '일시정지' : '시작'

  return (
    <div className={'app' + (focus ? ' focus' : '')}>
      <aside className="sidebar">
        <header>
          <div className="eyebrow">Count-In</div>
          <h1>반주에 맞춰 <span className="accent">저절로</span> 넘어가는 악보</h1>
          <p className="sub">유튜브 반주와 악보 PDF를 넣고, 각 쪽 넘길 시각을 정해두면 그 시각에 딱딱 넘어가요.</p>
        </header>

        <div className="presets">
          <div className="presetsHead">
            <span>저장한 곡</span>
          </div>
          {presets.length === 0
            ? <div className="presetsEmpty">설정을 저장하면 여기서 골라 불러올 수 있어요.</div>
            : (
              <>
                <div className="presetList">
                  {presets.map(p => (
                    <div className="presetChip" key={p.id}>
                      <button className="presetLoad" onClick={() => loadPreset(p)} title="불러오기">{p.name}</button>
                      <button className="presetDel" onClick={() => deletePreset(p.id)} title="삭제">×</button>
                    </div>
                  ))}
                </div>
                <div className="presetsHint">곡을 선택하고 악보 파일을 불러와 주세요.</div>
              </>
            )}
        </div>

        <div className="controls">
          <div className="group grow">
            <label htmlFor="url">유튜브 반주 링크</label>
            <input id="url" type="text" value={url} onChange={e => setUrl(e.target.value)}
                   placeholder="https://youtu.be/... 또는 watch?v=..." />
          </div>

          <div className="group">
            <label>악보 파일</label>
            <label className="upload">
              <input type="file" accept="application/pdf" onChange={onFile} />
              <span>{pdf.total > 0 ? '📄 ' + pdf.total + '쪽 불러옴' : '📄 PDF 불러오기'}</span>
            </label>
          </div>

          <div className="group">
            <label htmlFor="delay">시작 전 대기</label>
            <div className="time-inputs">
              <input id="delay" type="number" min="0" max="60" step="1" value={delay}
                     onChange={e => setDelay(e.target.value)} />
              <span className="unit">초</span>
              <button className="btn small savePresetBtn" onClick={savePreset}>💾 현재 설정 저장</button>
            </div>
          </div>

          <div className="group">
            <label>넘김 방식</label>
            <div className="seg">
              {[['cue', '쪽마다 시각'], ['interval', '일정 간격'], ['even', '곡 길이 균등']].map(([k, t]) => (
                <button key={k} type="button" className={flipMode === k ? 'active' : ''}
                        onClick={() => { setFlipMode(k); flipModeRef.current = k; buildSchedule() }}>{t}</button>
              ))}
            </div>
          </div>

          {flipMode === 'interval' && (
            <div className="group">
              <label>페이지 간격</label>
              <div className="time-inputs">
                <input type="number" min="0" max="999" step="1" value={ivMin} onChange={e => setIvMin(e.target.value)} />
                <span className="unit">분</span>
                <input type="number" min="0" max="59" step="1" value={ivSec} onChange={e => setIvSec(e.target.value)} />
                <span className="unit">초</span>
              </div>
            </div>
          )}

          <div className="group">
            <label htmlFor="vol">반주 볼륨</label>
            <div className="slider-row">
              <span className="vol-icon">🔊</span>
              <input id="vol" type="range" min="0" max="100" value={volume}
                     onChange={e => setVolume(parseInt(e.target.value, 10))} />
              <span className="vol-val">{volume}%</span>
            </div>
          </div>

          <div className="group">
            <label>카운트 소리</label>
            <div className="seg">
              {[['stick', '딱딱'], ['beep', '삑삑'], ['off', '끄기']].map(([k, t]) => (
                <button key={k} type="button" className={soundMode === k ? 'active' : ''}
                        onClick={() => { setSoundMode(k); soundModeRef.current = k; if(k !== 'off') tickSound(false) }}>{t}</button>
              ))}
            </div>
          </div>

          <div className="group">
            <label>옵션</label>
            <label className="switch-mini">
              <input type="checkbox" checked={loopOn} onChange={e => setLoopOn(e.target.checked)} />
              <span className="box"></span>
              <span>끝나면 처음부터 반복</span>
            </label>
          </div>
        </div>

        {flipMode === 'cue' && pdf.total > 1 && (
          <div className="cuePanel">
            <div className="cueHead">
              <div className="cueDesc">
                <b>페이지 넘김 시각</b> — <code>0:45</code>처럼 입력하거나, 반주를 들으며 <b>지금 넘김</b>(<kbd>M</kbd>)으로 찍어 두세요. 저장돼요.
              </div>
              <div className="cueActions">
                <button className="btn small" onClick={tap} disabled={!armed || tapCursor >= pdf.total - 1}>
                  🎯 지금 넘김{armed && tapCursor < pdf.total - 1 ? ` (${tapCursor + 1}→${tapCursor + 2}쪽)` : ''}
                </button>
                <button className="btn ghost small" onClick={clearCues}>초기화</button>
              </div>
            </div>
            <div className="cueRows">
              {cueText.map((v, i) => (
                <div className={'cueRow' + (armed && i === tapCursor ? ' hot' : '')} key={i}>
                  <span className="cueLabel">{i + 1} → {i + 2}쪽</span>
                  <input type="text" value={v} placeholder="0:00" onChange={e => setCueAt(i, e.target.value)} />
                  <button className="btn ghost tiny" onClick={() => nowAt(i)} disabled={!armed}>지금</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>

      <main className="main">
        <div className="navbar">
          <button className="btn" onClick={togglePlay} disabled={playDisabled}>{playLabel}</button>
          <button className="btn ghost" onClick={() => jump(-1)} disabled={navDisabled}>‹ 이전</button>
          <button className="btn ghost" onClick={() => jump(1)} disabled={navDisabled}>다음 ›</button>
          <button className="btn ghost" onClick={stopPlayback} disabled={navDisabled}>처음으로</button>
          <button className="btn ghost" onClick={() => setFocus(f => !f)} disabled={navDisabled}>
            {focus ? '↙ 설정 보기' : '⤢ 악보 크게'}
          </button>
          <div className="spacer"></div>
          <div className="page-ind"><b>{pdf.total ? pdf.pageNum : '–'}</b> / {pdf.total || '–'}</div>
          <div className="clock" ref={clockRef}></div>
        </div>

        <div className="progress"><div className="bar" ref={barRef}></div></div>

        <div className={'stage' + (pdf.total === 0 ? ' empty' : '')} ref={stageRef}>
          {pdf.total === 0 && (<><div className="big">🎼</div><div>악보 PDF를 불러오면 여기에 표시돼요.</div></>)}
          <canvas ref={canvasRef} style={{ display: pdf.total ? 'block' : 'none' }}></canvas>
        </div>


        <div className={'msg ' + msg.kind}>{msg.text}</div>
      </main>

      <div className={'ytHost' + (armed ? ' show' : '')} ref={ytHostRef}></div>

      {countText != null && (
        <div className="overlay show">
          <div className="get-ready">Get ready</div>
          {countText === '▶'
            ? <div className="go">▶</div>
            : <div className="count tick" key={countText}>{countText}</div>}
          <button className="cancel" onClick={cancelCountdown}>취소</button>
        </div>
      )}
    </div>
  )
}
