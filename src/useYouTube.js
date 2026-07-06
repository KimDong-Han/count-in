import { useCallback, useEffect, useRef, useState } from 'react'

// 유튜브 IFrame API를 한 번만 로드
let apiPromise = null
function loadYT(){
  if(apiPromise) return apiPromise
  apiPromise = new Promise((resolve) => {
    if(window.YT && window.YT.Player){ resolve(window.YT); return }
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => { if(prev) prev(); resolve(window.YT) }
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
  })
  return apiPromise
}

// 링크/ID에서 11자리 유튜브 영상 ID 추출 (delayed-play.html 로직)
export function extractId(raw){
  if(!raw) return null
  raw = raw.trim()
  if(/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw
  try{
    const u = new URL(raw)
    if(u.hostname.includes('youtu.be')) return u.pathname.slice(1, 12) || null
    if(u.searchParams.get('v')) return u.searchParams.get('v')
    const m = u.pathname.match(/\/(embed|shorts|live)\/([a-zA-Z0-9_-]{11})/)
    if(m) return m[2]
  }catch(e){ /* not a URL */ }
  const m = raw.match(/[a-zA-Z0-9_-]{11}/)
  return m ? m[0] : null
}

export function ytErrMsg(code){
  const codes = {
    2: '링크(동영상 ID)가 올바르지 않아요.',
    5: '이 동영상은 현재 플레이어에서 재생할 수 없어요.',
    100: '동영상을 찾을 수 없어요. 삭제되었거나 비공개일 수 있어요.',
    101: '게시자가 외부 재생을 막아둔 동영상이에요.',
    150: '게시자가 외부 재생을 막아둔 동영상이에요.',
    153: '재생 출처(referrer)를 확인하지 못했어요.',
  }
  return (codes[code] || ('재생 오류가 발생했어요 (코드 ' + code + ').')) +
    ' 유튜브 링크가 공개 상태인지 확인해 주세요.'
}

export function useYouTube(){
  const playerRef = useRef(null)
  const handlersRef = useRef({})
  const [apiReady, setApiReady] = useState(false)

  useEffect(() => {
    let mounted = true
    loadYT().then(() => { if(mounted) setApiReady(true) })
    return () => { mounted = false }
  }, [])

  // el: 플레이어를 심을 DOM 엘리먼트. 최초 1회만 생성.
  const ensure = useCallback((el, videoId, handlers) => {
    handlersRef.current = handlers || {}
    if(playerRef.current){
      handlersRef.current.onReady && handlersRef.current.onReady()
      return
    }
    const vars = { rel: 0, playsinline: 1, modestbranding: 1, controls: 1 }
    if(location.origin && location.origin !== 'null') vars.origin = location.origin
    playerRef.current = new window.YT.Player(el, {
      videoId,
      host: 'https://www.youtube-nocookie.com',
      playerVars: vars,
      events: {
        onReady: () => handlersRef.current.onReady && handlersRef.current.onReady(),
        onStateChange: (e) => handlersRef.current.onState && handlersRef.current.onState(e.data),
        onError: (e) => handlersRef.current.onError && handlersRef.current.onError(e.data),
      },
    })
  }, [])

  const call = (fn, ...args) => {
    const p = playerRef.current
    if(p && typeof p[fn] === 'function'){ try{ return p[fn](...args) }catch(e){} }
  }

  return {
    apiReady,
    ensure,
    play: useCallback(() => call('playVideo'), []),
    pause: useCallback(() => call('pauseVideo'), []),
    stop: useCallback(() => call('stopVideo'), []),
    seek: useCallback((t) => call('seekTo', t, true), []),
    mute: useCallback(() => call('mute'), []),
    unMute: useCallback(() => call('unMute'), []),
    setVolume: useCallback((v) => call('setVolume', v), []),
    setRate: useCallback((r) => call('setPlaybackRate', r), []),
    loadVideoById: useCallback((id) => call('loadVideoById', id), []),
    cueById: useCallback((id) => call('cueVideoById', id), []),
    getTime: useCallback(() => call('getCurrentTime') || 0, []),
    getDuration: useCallback(() => call('getDuration') || 0, []),
    getState: useCallback(() => {
      const p = playerRef.current
      return p && p.getPlayerState ? p.getPlayerState() : -1
    }, []),
  }
}
