// "0:45", "1:40", "90", "1:02:03" 등을 초(seconds)로 변환. 빈 값이면 null.
export function parseTime(str){
  if(str == null) return null
  str = ('' + str).trim()
  if(!str) return null
  if(str.includes(':')){
    const parts = str.split(':').map(x => parseFloat(x))
    if(parts.some(n => isNaN(n))) return null
    return parts.reduce((acc, p) => acc * 60 + p, 0)
  }
  const v = parseFloat(str)
  return isNaN(v) ? null : v
}

// 초 → "m:ss"
export function fmt(sec){
  if(!isFinite(sec) || sec < 0) sec = 0
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return m + ':' + String(s).padStart(2, '0')
}
