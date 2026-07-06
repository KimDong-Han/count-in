// 카운트다운 효과음 (Web Audio). delayed-play.html에서 그대로 가져옴.

// "삑" 비프. accent=마지막 GO 톤(더 높고 길게)
export function playBeep(ctx, vol, accent){
  const t = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = accent ? 1320 : 880
  const level = Math.max((vol / 100) * 0.5, 0.0002)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(level, t + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + (accent ? 0.32 : 0.16))
  osc.connect(gain).connect(ctx.destination)
  osc.start(t)
  osc.stop(t + (accent ? 0.34 : 0.18))
}

// 드럼스틱 "딱" — 노이즈 크랙 + 짧은 톤
export function playStick(ctx, vol, accent){
  const t = ctx.currentTime
  const level = (vol / 100) * 0.9
  const dur = 0.06
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for(let i = 0; i < data.length; i++){
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2)
  }
  const noise = ctx.createBufferSource()
  noise.buffer = buffer
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = accent ? 2600 : 2000
  bp.Q.value = 1.2
  const ng = ctx.createGain()
  ng.gain.setValueAtTime(Math.max(level, 0.0002), t)
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
  noise.connect(bp).connect(ng).connect(ctx.destination)
  noise.start(t)
  noise.stop(t + dur)

  const osc = ctx.createOscillator()
  const og = ctx.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(accent ? 900 : 700, t)
  osc.frequency.exponentialRampToValueAtTime(accent ? 500 : 380, t + 0.03)
  og.gain.setValueAtTime(Math.max(level * 0.6, 0.0002), t)
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
  osc.connect(og).connect(ctx.destination)
  osc.start(t)
  osc.stop(t + 0.06)
}
