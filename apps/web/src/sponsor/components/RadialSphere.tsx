import { useEffect, useRef } from 'react'

/* ---------------------------------------------------------------------
 * RadialSphere — an animated harmonograph rosette for the hero.
 * ---------------------------------------------------------------------
 * A single continuous strand traced from a harmonograph: two detuned
 * sinusoids per axis. The near-integer frequency ratios give a symmetric,
 * many-lobed rosette; the slight detuning makes each loop precess so the
 * strand overlaps itself into a dense, intricate lacework. A green gradient
 * runs along the strand for depth. Nothing rotates rigidly — a slow phase
 * drift keeps the whole figure alive and morphing.
 *
 * No dependencies (canvas + rAF). Segments are binned by their position
 * along the strand so the frame draws in a handful of coloured strokes.
 * Honours prefers-reduced-motion (static figure) and pauses when hidden.
 * The parent supplies size/placement via `className`; the canvas fills it.
 * ------------------------------------------------------------------- */

const N = 9200 // points along the strand
const TMAX = 220 // parameter range (≈ many precessing loops → lacework)
const DT = TMAX / N

// Harmonograph: x = sin(FX1·t+PX1) + AX2·sin(FX2·t+PX2), likewise for y.
// Integer-ish frequency ratios set the lobe pattern; the small detuning on
// the second term of each axis is what fills the figure into dense lacework.
const FX1 = 2
const FX2 = 7.02
const PX1 = 0
const PX2 = 0
const AX2 = 0.8
const FY1 = 7
const FY2 = 2.02
const PY1 = Math.PI / 2
const PY2 = Math.PI / 2
const AY2 = 0.8
const MAXAMP = 1.85 // ≈ max reach of x/y, for scaling to the canvas

const MORPH = 0.00022 // phase drift per ms — keeps it lively, never rests
const BINS = 16 // colour bins along the strand
// Green gradient endpoints (deep → bright) walked along the strand.
const C0 = [4, 64, 38]
const C1 = [45, 176, 104]

export default function RadialSphere({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Pre-bake the per-bin colour strings.
    const binColor: string[] = []
    for (let b = 0; b < BINS; b++) {
      const f = b / (BINS - 1)
      const r = Math.round(C0[0] + (C1[0] - C0[0]) * f)
      const g = Math.round(C0[1] + (C1[1] - C0[1]) * f)
      const bl = Math.round(C0[2] + (C1[2] - C0[2]) * f)
      binColor.push(`rgb(${r},${g},${bl})`)
    }
    const buckets: number[][] = Array.from({ length: BINS }, () => [])

    let dpr = 1
    let cx = 0
    let cy = 0
    let scale = 1

    const draw = (tMs: number) => {
      const cw = canvas.width
      const ch = canvas.height
      ctx.clearRect(0, 0, cw, ch)
      ctx.lineWidth = Math.max(0.5, 0.6 * dpr)
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.globalAlpha = 0.32

      const d = tMs * MORPH

      for (let b = 0; b < BINS; b++) buckets[b].length = 0

      let ppx = 0
      let ppy = 0
      for (let i = 0; i < N; i++) {
        const t = i * DT
        const x =
          Math.sin(FX1 * t + PX1) + AX2 * Math.sin(FX2 * t + PX2 + d)
        const y =
          Math.sin(FY1 * t + PY1) + AY2 * Math.sin(FY2 * t + PY2 - d)
        const sx = cx + x * scale
        const sy = cy + y * scale
        if (i > 0) {
          let bin = ((i / N) * BINS) | 0
          if (bin >= BINS) bin = BINS - 1
          buckets[bin].push(ppx, ppy, sx, sy)
        }
        ppx = sx
        ppy = sy
      }

      for (let b = 0; b < BINS; b++) {
        const bucket = buckets[b]
        if (bucket.length === 0) continue
        ctx.strokeStyle = binColor[b]
        ctx.beginPath()
        for (let k = 0; k < bucket.length; k += 4) {
          ctx.moveTo(bucket[k], bucket[k + 1])
          ctx.lineTo(bucket[k + 2], bucket[k + 3])
        }
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
      cx = canvas.width * 0.58
      cy = canvas.height * 0.5
      scale = Math.min(canvas.height * 0.5, canvas.width * 0.62) / MAXAMP
      if (reduce) draw(3000)
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    let raf = 0
    let last = 0
    let elapsed = 0
    const frame = (now: number) => {
      if (last === 0) last = now
      const dt = Math.min(now - last, 60)
      last = now
      elapsed += dt
      draw(elapsed)
      raf = requestAnimationFrame(frame)
    }

    if (reduce) draw(3000)
    else raf = requestAnimationFrame(frame)

    const onVis = () => {
      if (document.hidden) {
        if (raf) {
          cancelAnimationFrame(raf)
          raf = 0
        }
      } else if (!reduce && !raf) {
        last = 0
        raf = requestAnimationFrame(frame)
      }
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      if (raf) cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  return (
    <div className={`pointer-events-none ${className}`} aria-hidden>
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  )
}
