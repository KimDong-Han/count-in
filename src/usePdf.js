import { useCallback, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
// Vite 표준 워커 임포트. ?url + workerSrc 방식은 pdfjs-dist v3(ESM exports 없음)에서
// 워커 인스턴스화가 어긋나는 일이 있어, ?worker 로 직접 Worker를 만들어 붙인다.
import PdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.js?worker'

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfjsWorker()

export function usePdf(canvasRef, stageRef){
  const pdfRef = useRef(null)
  const renderTaskRef = useRef(null)
  const pageNumRef = useRef(1)
  const [total, setTotal] = useState(0)
  const [pageNum, setPageNum] = useState(1)

  const renderPage = useCallback(async (num) => {
    const pdf = pdfRef.current
    if(!pdf) return
    if(renderTaskRef.current){ try{ renderTaskRef.current.cancel() }catch(e){} }
    const page = await pdf.getPage(num)
    const stage = stageRef.current
    const canvas = canvasRef.current
    if(!canvas) return
    const containerW = (stage ? stage.clientWidth : 900) - 32
    const containerH = (stage ? stage.clientHeight : 600) - 32
    const base = page.getViewport({ scale: 1 })
    const dpr = window.devicePixelRatio || 1
    // 가로·세로 둘 다 스테이지 안에 들어오도록 맞춤 (한 화면에 한 방에)
    const scale = Math.max(0.1, Math.min(containerW / base.width, containerH / base.height))
    const viewport = page.getViewport({ scale: scale * dpr })
    canvas.width = viewport.width
    canvas.height = viewport.height
    canvas.style.width = (viewport.width / dpr) + 'px'
    canvas.style.height = (viewport.height / dpr) + 'px'
    const ctx = canvas.getContext('2d')
    renderTaskRef.current = page.render({ canvasContext: ctx, viewport })
    try{ await renderTaskRef.current.promise }catch(e){ /* cancelled */ }
  }, [canvasRef, stageRef])

  const load = useCallback(async (file) => {
    const buf = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise
    // 이전 문서를 정리해 워커 메모리 누수 방지 (로드 성공 후에만 — 실패 시 기존 문서 유지)
    if(renderTaskRef.current){ try{ renderTaskRef.current.cancel() }catch(e){} }
    if(pdfRef.current){ try{ pdfRef.current.destroy() }catch(e){} }
    pdfRef.current = pdf
    setTotal(pdf.numPages)
    pageNumRef.current = 1
    setPageNum(1)
    await renderPage(1)
    return pdf.numPages
  }, [renderPage])

  const show = useCallback((num) => {
    const pdf = pdfRef.current
    if(!pdf) return
    num = Math.max(1, Math.min(pdf.numPages, num))
    if(num === pageNumRef.current) return
    pageNumRef.current = num
    setPageNum(num)
    renderPage(num)
  }, [renderPage])

  const reset = useCallback(() => {
    if(renderTaskRef.current){ try{ renderTaskRef.current.cancel() }catch(e){} }
    if(pdfRef.current){ try{ pdfRef.current.destroy() }catch(e){} }
    pdfRef.current = null
    pageNumRef.current = 1
    setTotal(0)
    setPageNum(1)
    const canvas = canvasRef.current
    if(canvas){
      const ctx = canvas.getContext('2d')
      if(ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [canvasRef])

  return { total, pageNum, pageNumRef, load, show, renderPage, reset, pdfRef }
}
