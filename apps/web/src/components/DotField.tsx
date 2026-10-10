import { useEffect, useRef } from 'react'

/**
 * Morphing dot field — the hero's ambient motion.
 *
 * A large pool of black/grey particles opens as a field of flowing curved
 * lines, then continuously reshapes itself between three hackathon scenes,
 * each drawn as a filled silhouette (volumetric body masses, not stick
 * figures) and sampled into a dense point cloud, tweened with a
 * mid-transition "billow" so the dots dissolve into dust and reassemble:
 *
 *   0. flowing curved lines (the resting state)
 *   1. a person hunched at a laptop
 *   2. people at a whiteboard, one pointing with a pointer
 *   3. code being written in an editor
 *
 * Canvas-based, DPR-aware, resize-safe, and static (single frame) when
 * the visitor prefers reduced motion. No external assets.
 */

// Mainly black, shading down through dark greys. Weighted hard toward the
// dark end so the field reads as ink. (No brand colour — kept monochrome.)
const SHADES = ['0,0,0', '34,34,34', '72,72,72', '112,112,112']
const SHADE_WEIGHTS = [0.55, 0.27, 0.12, 0.06]

// Normalized space every scene is drawn in, then mapped onto the screen.
const SCENE_W = 1000
const SCENE_H = 620

// Timeline (ms).
const INTRO = 2200 // dust → curves on load
const MORPH = 2100 // scene → next scene

const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

// Smoothstep clamped to [0,1].
const smooth01 = (u: number) => {
  const c = u < 0 ? 0 : u > 1 ? 1 : u
  return c * c * (3 - 2 * c)
}

const pickShade = () => {
  let r = Math.random()
  for (let i = 0; i < SHADE_WEIGHTS.length; i++) {
    r -= SHADE_WEIGHTS[i]
    if (r <= 0) return i
  }
  return 0
}

/* ---------------- scene drawing (normalized 1000×620, black) ------------- */

type G = CanvasRenderingContext2D

// A filled, round-capped limb — gives body parts real volume.
const capsule = (g: G, x1: number, y1: number, x2: number, y2: number, w: number) => {
  g.lineWidth = w
  g.beginPath()
  g.moveTo(x1, y1)
  g.lineTo(x2, y2)
  g.stroke()
}
const oval = (g: G, cx: number, cy: number, rx: number, ry: number, rot = 0) => {
  g.beginPath()
  g.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2)
  g.fill()
}

// Scene 1 — a person sitting upright at a desk, profile facing left,
// forearms resting on the desk, working on a laptop. Drawn facing right,
// then mirrored about the composition's centre so it stays in place.
function drawLaptop(g: G) {
  const axis = 731 // centre of the composition's x-range (540–922)
  g.save()
  g.translate(axis, 0)
  g.scale(-1, 1)
  g.translate(-axis, 0)
  // --- desk (a real, taller table: top + front legs) ---
  capsule(g, 556, 388, 906, 388, 16) // desk top
  capsule(g, 592, 396, 592, 564, 12) // front-left leg
  capsule(g, 888, 396, 888, 564, 12) // front-right leg
  capsule(g, 540, 566, 922, 566, 9) // floor line
  // --- chair ---
  capsule(g, 566, 256, 566, 450, 13) // backrest
  capsule(g, 566, 450, 652, 450, 14) // seat
  // --- person, seated upright, facing right ---
  oval(g, 620, 186, 26, 32) // hair (back of head)
  oval(g, 636, 198, 41, 49) // head
  oval(g, 672, 206, 12, 14) // brow / nose (faces right, toward the desk)
  capsule(g, 636, 240, 642, 270, 26) // neck
  capsule(g, 642, 274, 656, 444, 88) // torso (upright, slight lean)
  oval(g, 652, 448, 42, 34) // hip / seat
  capsule(g, 652, 450, 760, 458, 50) // thigh (under the desk)
  capsule(g, 760, 458, 772, 560, 42) // lower leg
  capsule(g, 772, 560, 812, 564, 24) // foot
  capsule(g, 662, 296, 702, 356, 38) // upper arm (down)
  capsule(g, 702, 356, 792, 382, 28) // forearm (forward onto desk)
  oval(g, 798, 384, 17, 12) // hand
  // --- laptop on the desk in front of the hands ---
  g.beginPath()
  g.moveTo(758, 388)
  g.lineTo(866, 388)
  g.lineTo(852, 374)
  g.lineTo(770, 374)
  g.closePath()
  g.fill() // keyboard base
  g.lineWidth = 12
  g.beginPath()
  g.moveTo(770, 374)
  g.lineTo(786, 320)
  g.lineTo(862, 320)
  g.lineTo(852, 374)
  g.stroke() // screen, facing the person
  g.restore()
}

// Scene 2 — a whiteboard with a diagram; two people, one pointing.
function drawWhiteboard(g: G) {
  g.lineWidth = 14
  g.beginPath()
  g.roundRect(372, 80, 392, 256, 12)
  g.stroke()
  capsule(g, 372, 352, 764, 352, 13) // marker tray
  // diagram
  g.lineWidth = 9
  g.strokeRect(420, 128, 112, 66)
  g.strokeRect(616, 128, 112, 66)
  capsule(g, 532, 161, 616, 161, 9) // arrow shaft
  capsule(g, 616, 161, 600, 152, 7) // arrowhead
  capsule(g, 616, 161, 600, 170, 7)
  g.strokeRect(518, 232, 112, 58)
  capsule(g, 476, 194, 574, 232, 9) // connectors to lower box
  capsule(g, 672, 194, 574, 232, 9)

  // person A — pointing, standing, facing left
  oval(g, 792, 132, 40, 48) // head
  oval(g, 774, 122, 24, 30) // hair
  capsule(g, 792, 176, 794, 206, 26) // neck
  capsule(g, 794, 210, 800, 388, 86) // torso
  oval(g, 800, 392, 46, 36) // hips
  capsule(g, 786, 396, 770, 548, 44) // left leg
  capsule(g, 812, 396, 830, 548, 44) // right leg
  capsule(g, 764, 546, 738, 556, 24) // feet
  capsule(g, 830, 546, 856, 556, 24)
  capsule(g, 772, 250, 706, 232, 36) // raised upper arm
  capsule(g, 706, 232, 646, 214, 28) // forearm
  oval(g, 642, 212, 16, 13) // hand
  capsule(g, 642, 212, 556, 176, 8) // pointer, tip on the board

  // person B — observing, standing behind, facing left
  oval(g, 906, 168, 34, 42) // head
  oval(g, 892, 160, 22, 26) // hair
  capsule(g, 906, 206, 906, 232, 22) // neck
  capsule(g, 906, 236, 912, 386, 74) // torso
  oval(g, 912, 390, 40, 32) // hips
  capsule(g, 900, 394, 890, 540, 40) // left leg
  capsule(g, 918, 394, 934, 540, 40) // right leg
  capsule(g, 886, 538, 862, 548, 22) // feet
  capsule(g, 934, 538, 958, 548, 22)
  capsule(g, 892, 268, 884, 372, 30) // arm at side

  capsule(g, 300, 556, 972, 556, 13) // floor
}

// Scene 3 — a coding workstation: a monitor showing code, on a stand, with
// a keyboard and mouse on the desk in front of it.
function drawCode(g: G) {
  g.save()
  g.translate(52, 0) // nudge the setup a little to the right

  // --- monitor (the code screen) ---
  g.lineWidth = 12
  g.beginPath()
  g.roundRect(392, 92, 476, 300, 16)
  g.stroke()
  capsule(g, 392, 148, 868, 148, 10) // title bar
  oval(g, 424, 120, 7, 7) // traffic lights
  oval(g, 448, 120, 7, 7)
  oval(g, 472, 120, 7, 7)

  // code token rows
  const rows: [number, number][][] = [
    [[440, 522], [540, 726], [744, 812]],
    [[478, 552], [572, 800]],
    [[478, 544], [564, 706], [726, 812]],
    [[518, 626], [646, 800]],
    [[478, 552]],
    [[478, 592], [612, 764]],
    [[440, 488]],
  ]
  const y0 = 186
  const lh = 29
  rows.forEach((segs, i) => {
    const y = y0 + i * lh
    capsule(g, 414, y - 10, 414, y + 5, 6) // line-number tick
    for (const [x1, x2] of segs) capsule(g, x1, y, x2, y, 13)
  })
  g.fillRect(812, y0 + 3 * lh - 11, 11, 24) // cursor

  // --- monitor stand ---
  capsule(g, 630, 392, 630, 430, 22) // neck
  oval(g, 630, 437, 54, 13) // base, seen at an angle

  // --- desk front edge ---
  capsule(g, 420, 548, 908, 548, 11)

  // --- keyboard (lying flat on the desk, in perspective) ---
  const BL: [number, number] = [502, 486]
  const BR: [number, number] = [760, 486]
  const FL: [number, number] = [464, 532]
  const FR: [number, number] = [798, 532]
  // point on the keyboard plane: c across (0..1), r into the depth (0 back → 1 front)
  const kpt = (c: number, r: number): [number, number] => {
    const y = BL[1] + (FL[1] - BL[1]) * r
    const lx = BL[0] + (FL[0] - BL[0]) * r
    const rx = BR[0] + (FR[0] - BR[0]) * r
    return [lx + (rx - lx) * c, y]
  }
  g.lineWidth = 9
  g.beginPath()
  g.moveTo(BL[0], BL[1])
  g.lineTo(BR[0], BR[1])
  g.lineTo(FR[0], FR[1])
  g.lineTo(FL[0], FL[1])
  g.closePath()
  g.stroke()
  // keys — rows widen and drop toward the viewer
  for (const r of [0.24, 0.52, 0.8]) {
    for (let k = 0; k < 11; k++) {
      const c = 0.06 + k * 0.083
      const [x1, y1] = kpt(c, r)
      const [x2] = kpt(c + 0.045, r)
      capsule(g, x1, y1, x2, y1, 6)
    }
  }
  const [sx1, sy] = kpt(0.3, 0.97)
  const [sx2] = kpt(0.7, 0.97)
  capsule(g, sx1, sy, sx2, sy, 7) // spacebar

  // --- mouse (angled on the desk, right of the keyboard) ---
  g.lineWidth = 9
  g.beginPath()
  g.ellipse(832, 506, 20, 30, -0.32, 0, Math.PI * 2)
  g.stroke()
  capsule(g, 821, 479, 828, 501, 5) // button split

  g.restore()
}

// Scene 4 — the actual code on the screen: a few short, bold lines of real
// code text. A dedicated scene, so every dot packs onto the glyphs and the
// characters stay legible (with a blinking-style cursor at the end).
function drawCodeText(g: G) {
  const lines = [
    'function ship() {',
    '  while (awake) {',
    '    build(idea);',
    '  }',
    '  return launch();',
    '}',
  ]
  g.font = 'bold 46px "JetBrains Mono", ui-monospace, monospace'
  g.textBaseline = 'alphabetic'
  const x0 = 434
  const y0 = 176
  const lh = 60
  lines.forEach((ln, i) => g.fillText(ln, x0, y0 + i * lh))
  // cursor at the end of the "return" line
  const cw = g.measureText(lines[4]).width
  g.fillRect(x0 + cw + 8, y0 + 4 * lh - 34, 15, 40)
}

// Campus photos, edge-stippled from the real images (loaded at runtime).
// crop = [sx, sy, sw, sh] as fractions — tightens onto the subject so the
// dots concentrate on the building / statue instead of sky and plaza.
const CAMPUS: {
  src: string
  crop: [number, number, number, number]
  contain?: boolean
  alignX?: number // horizontal placement when contained (0 left … 1 right)
  silhouette?: boolean // isolate the dark subject from a lighter background
}[] = [
  { src: '/campus/building.jpg', crop: [0.05, 0.28, 0.92, 0.7] },
  // tight crop on the figure + pedestal, contained and pushed to the right so
  // it stands clear of the left copy; silhouette mode isolates the dark bronze
  // figure from the building behind it
  {
    src: '/campus/statue.jpg',
    crop: [0.48, 0.17, 0.3, 0.78], // figure + coat + pedestal (colour isolates it)
    contain: true,
    alignX: 0.82,
    silhouette: true,
  },
]
// The scenes, in the order they appear (looping). `hold` is the dwell time
// (ms) on each. Reorder these lines to change the sequence.
type SceneDef = { hold: number } & (
  | { kind: 'curves' }
  | { kind: 'draw'; fn: (g: G) => void }
  | { kind: 'image'; img: number } // index into CAMPUS
)
const SCENES: SceneDef[] = [
  { kind: 'curves', hold: 3200 },
  { kind: 'image', img: 0, hold: 2700 }, // GMU building
  { kind: 'draw', fn: drawLaptop, hold: 2100 },
  { kind: 'draw', fn: drawWhiteboard, hold: 2100 },
  { kind: 'draw', fn: drawCode, hold: 2100 }, // monitor / keyboard / mouse
  { kind: 'draw', fn: drawCodeText, hold: 2900 }, // readable code text
  { kind: 'image', img: 1, hold: 2700 }, // George Mason statue
]
const SCENE_COUNT = SCENES.length

/** Sample a loaded image into `n` points, weighted by darkness so the subject
 *  fills in with dots and the bright sky stays mostly empty (tonal stipple). */
function sampleImage(
  img: HTMLImageElement,
  n: number,
  crop: [number, number, number, number],
  contain = false,
  alignX = 0.5,
  silhouette = false,
): Float32Array {
  const out = new Float32Array(n * 2)
  const c = document.createElement('canvas')
  c.width = SCENE_W
  c.height = SCENE_H
  const g = c.getContext('2d', { willReadFrequently: true })
  if (!g || !img.width || !img.height) {
    for (let i = 0; i < n; i++) {
      out[i * 2] = Math.random()
      out[i * 2 + 1] = Math.random()
    }
    return out
  }
  // crop to the subject, then cover-fit that region into the scene box
  const cx = crop[0] * img.width
  const cy = crop[1] * img.height
  const cw = crop[2] * img.width
  const ch = crop[3] * img.height
  const s = contain
    ? Math.min(SCENE_W / cw, SCENE_H / ch) // fit the whole subject in
    : Math.max(SCENE_W / cw, SCENE_H / ch) // cover the box
  const dw = cw * s
  const dh = ch * s
  const drawX = (SCENE_W - dw) * alignX
  const drawY = (SCENE_H - dh) / 2
  g.fillStyle = '#fff'
  g.fillRect(0, 0, SCENE_W, SCENE_H)
  g.drawImage(img, cx, cy, cw, ch, drawX, drawY, dw, dh)
  const data = g.getImageData(0, 0, SCENE_W, SCENE_H).data

  // Silhouette isolation: a soft elliptical mask around the centred figure so
  // dots keep to it and fade out over the surrounding background.
  const mcx = drawX + dw / 2
  const mcy = drawY + dh / 2
  const mrx = dw * 0.5
  const mry = dh * 0.72

  // Grayscale buffer, then weight by edge strength (structure) plus a little
  // fill for dark solids — edges make the subject readable at low dot counts.
  const gray = new Float32Array(SCENE_W * SCENE_H)
  for (let p = 0; p < gray.length; p++) {
    const i = p * 4
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }
  const stride = 1
  const T = 22 // edges below this are mostly foliage/texture — suppress them
  const weight = (x: number, y: number) => {
    if (x <= 1 || y <= 1 || x >= SCENE_W - 2 || y >= SCENE_H - 2) return 0
    const p = y * SCENE_W + x
    // a wider gradient responds to structural edges (rooflines, window grids,
    // the tower, the statue's outline) more than to fine leaf texture
    const edge =
      Math.abs(gray[p + 2] - gray[p - 2]) +
      Math.abs(gray[p + 2 * SCENE_W] - gray[p - 2 * SCENE_W])
    const dark = (255 - gray[p]) / 255
    if (silhouette) {
      const ax = (x - mcx) / mrx
      const ay = (y - mcy) / mry
      const d2 = ax * ax + ay * ay
      if (d2 >= 1) return 0 // outside the figure region → drop the background
      const mask = d2 < 0.66 ? 1 : 1 - (d2 - 0.66) / 0.34
      // Isolate by COLOUR: the bronze figure (and brick base) are warm, while
      // the tree behind is green and the sky is blue — grayscale can't tell
      // them apart, but R/G/B can. Favour warm, non-green pixels.
      const i = p * 4
      const r = data[i]
      const gch = data[i + 1]
      const bch = data[i + 2]
      const warm = r - bch // bronze/brick: warm (+); sky: cold (−)
      const green = gch - (r + bch) / 2 // foliage: (+)
      const bronze = Math.max(0, warm - Math.max(0, green) * 1.7)
      // edge detail only on the figure itself, so tree edges don't leak in
      return (bronze * 1.3 + (bronze > 8 && edge > 30 ? edge * 0.4 : 0)) * mask
    }
    const structural = edge > T ? edge : edge * 0.12
    // fill dark solids (the bronze statue, deep shadow) so they read as mass
    return structural + (dark > 0.44 ? (dark - 0.44) * 40 : 0)
  }
  let sum = 0
  for (let y = 0; y < SCENE_H; y += stride)
    for (let x = 0; x < SCENE_W; x += stride) sum += weight(x, y)
  if (sum <= 0) {
    for (let i = 0; i < n; i++) {
      out[i * 2] = Math.random()
      out[i * 2 + 1] = Math.random()
    }
    return out
  }
  // place ~n dots proportional to each cell's darkness
  const scale = n / sum
  let k = 0
  for (let y = 0; y < SCENE_H && k < n; y += stride) {
    for (let x = 0; x < SCENE_W && k < n; x += stride) {
      let cnt = weight(x, y) * scale
      let whole = Math.floor(cnt)
      if (Math.random() < cnt - whole) whole++
      for (let j = 0; j < whole && k < n; j++) {
        out[k * 2] = (x + (Math.random() - 0.5) * stride * 2) / SCENE_W
        out[k * 2 + 1] = (y + (Math.random() - 0.5) * stride * 2) / SCENE_H
        k++
      }
    }
  }
  while (k < n) {
    out[k * 2] = Math.random()
    out[k * 2 + 1] = Math.random()
    k++
  }
  return out
}

/** Scene 0 — flowing curved lines, generated analytically (full-bleed).
 *  Fewer, denser streamlines that bow together like a smooth flow field. */
function genCurves(n: number): Float32Array {
  const out = new Float32Array(n * 2)
  const lines = 46
  const per = Math.max(2, Math.floor(n / lines))
  let k = 0
  for (let li = 0; li < lines && k < n; li++) {
    const t = li / (lines - 1)
    const baseX = -0.05 + t * 1.1
    // A coherent flow: neighbouring lines bow the same way, more toward centre.
    const swirl = 0.09 * Math.sin(t * Math.PI) + 0.03
    for (let p = 0; p < per && k < n; p++) {
      const y = p / (per - 1)
      const x =
        baseX +
        swirl * Math.sin(y * Math.PI * 0.9 + t * Math.PI * 1.4) +
        0.02 * Math.sin(y * Math.PI * 2.6 + t * 6.0)
      out[k * 2] = x
      out[k * 2 + 1] = y * 1.06 - 0.03
      k++
    }
  }
  while (k < n) {
    out[k * 2] = Math.random()
    out[k * 2 + 1] = Math.random()
    k++
  }
  return out
}

/** Draw a scene offscreen, then sample dark pixels into exactly `n` points. */
function sampleScene(draw: (g: G) => void, n: number): Float32Array {
  const c = document.createElement('canvas')
  c.width = SCENE_W
  c.height = SCENE_H
  const g = c.getContext('2d', { willReadFrequently: true })
  const out = new Float32Array(n * 2)
  if (!g) {
    for (let i = 0; i < n; i++) {
      out[i * 2] = Math.random()
      out[i * 2 + 1] = Math.random()
    }
    return out
  }
  g.fillStyle = '#fff'
  g.fillRect(0, 0, SCENE_W, SCENE_H)
  g.fillStyle = '#000'
  g.strokeStyle = '#000'
  g.lineCap = 'round'
  g.lineJoin = 'round'
  draw(g)

  const data = g.getImageData(0, 0, SCENE_W, SCENE_H).data
  const pts: number[] = []
  const stride = 2
  for (let y = 0; y < SCENE_H; y += stride) {
    for (let x = 0; x < SCENE_W; x += stride) {
      if (data[(y * SCENE_W + x) * 4] < 128) pts.push(x / SCENE_W, y / SCENE_H)
    }
  }
  const found = pts.length / 2
  if (found === 0) {
    for (let i = 0; i < n; i++) {
      out[i * 2] = Math.random()
      out[i * 2 + 1] = Math.random()
    }
    return out
  }
  for (let i = 0; i < n; i++) {
    const j = Math.floor(Math.random() * found) * 2
    out[i * 2] = pts[j]
    out[i * 2 + 1] = pts[j + 1]
  }
  return out
}

export default function DotField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let width = 0
    let height = 0
    let n = 0
    let raf = 0
    let alive = true
    const start = performance.now()
    // Campus photos load asynchronously; their scenes fill in once ready.
    const campusImgs: (HTMLImageElement | null)[] = CAMPUS.map(() => null)

    let scenesNorm: Float32Array[] = []
    let scenesScreen: Float32Array[] = []
    let scatter = new Float32Array(0)
    let dispScale = 60

    let dirX = new Float32Array(0)
    let dirY = new Float32Array(0)
    let amp = new Float32Array(0)
    let phase = new Float32Array(0)
    let rad = new Float32Array(0)
    let baseAlpha = new Float32Array(0)
    let shade = new Uint8Array(0)
    let wanderR = new Float32Array(0) // how far a dot drifts out while held
    let wanderF = new Float32Array(0) // and how fast
    let px = new Float32Array(0)
    let py = new Float32Array(0)
    let pa = new Float32Array(0)

    // Precomputed loop: alternating hold / morph segments across the scenes.
    type Seg = { t0: number; t1: number; morph: boolean; a: number; b: number }
    let segs: Seg[] = []
    let loopLen = 0
    const buildTimeline = () => {
      segs = []
      let acc = 0
      for (let s = 0; s < SCENE_COUNT; s++) {
        const hold = SCENES[s].hold
        segs.push({ t0: acc, t1: acc + hold, morph: false, a: s, b: s })
        acc += hold
        segs.push({ t0: acc, t1: acc + MORPH, morph: true, a: s, b: (s + 1) % SCENE_COUNT })
        acc += MORPH
      }
      loopLen = acc
    }

    const countFor = (w: number, h: number) => {
      const cap = w < 640 ? 8000 : 18000
      return Math.max(3200, Math.min(cap, Math.round((w * h) / 72)))
    }

    const initParticles = () => {
      dirX = new Float32Array(n)
      dirY = new Float32Array(n)
      amp = new Float32Array(n)
      phase = new Float32Array(n)
      rad = new Float32Array(n)
      baseAlpha = new Float32Array(n)
      shade = new Uint8Array(n)
      wanderR = new Float32Array(n)
      wanderF = new Float32Array(n)
      px = new Float32Array(n)
      py = new Float32Array(n)
      pa = new Float32Array(n)
      // The field reads too faint on small screens, so give each dot a little
      // more opacity and size on mobile only (same <640 breakpoint as the count).
      const mobile = width < 640
      const alphaBoost = mobile ? 1.18 : 1
      const radBoost = mobile ? 1.22 : 1
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2
        dirX[i] = Math.cos(a)
        dirY[i] = Math.sin(a)
        amp[i] = 0.35 + Math.random() * 0.95
        phase[i] = Math.random() * Math.PI * 2
        rad[i] = (1.15 + Math.random() * 1.35) * radBoost
        baseAlpha[i] = Math.min(1, (0.66 + Math.random() * 0.34) * alphaBoost)
        shade[i] = pickShade()
        // ~11% of dots break away and drift out while a scene is held;
        // the rest just breathe in place so the shape stays intact.
        const wander = Math.random() < 0.11
        wanderR[i] = wander ? 22 + Math.random() * 44 : 1.4 + Math.random() * 3.2
        wanderF[i] = 0.25 + Math.random() * 0.55
      }
    }

    const sampleScenes = () => {
      scenesNorm = SCENES.map((s) => {
        if (s.kind === 'draw') return sampleScene(s.fn, n)
        if (s.kind === 'image') {
          const img = campusImgs[s.img]
          const c = CAMPUS[s.img]
          // fall back to curves until the photo loads
          return img
            ? sampleImage(img, n, c.crop, c.contain, c.alignX, c.silhouette)
            : genCurves(n)
        }
        return genCurves(n)
      })
    }

    const mapToScreen = () => {
      const sceneAspect = SCENE_W / SCENE_H
      let boxW: number
      let boxH: number
      if (width / height >= sceneAspect) {
        boxH = height
        boxW = height * sceneAspect
      } else {
        boxW = width
        boxH = width / sceneAspect
      }
      const boxX = (width - boxW) / 2
      const boxY = (height - boxH) / 2
      dispScale = boxH * 0.14

      scenesScreen = scenesNorm.map((norm) => {
        const s = new Float32Array(n * 2)
        for (let i = 0; i < n; i++) {
          s[i * 2] = boxX + norm[i * 2] * boxW
          s[i * 2 + 1] = boxY + norm[i * 2 + 1] * boxH
        }
        return s
      })

      scatter = new Float32Array(n * 2)
      for (let i = 0; i < n; i++) {
        scatter[i * 2] = Math.random() * width
        scatter[i * 2 + 1] = Math.random() * height
      }
    }

    const seed = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const next = countFor(width, height)
      if (next !== n) {
        n = next
        initParticles()
        sampleScenes()
      }
      mapToScreen()
    }

    type Phase =
      | { hold: Float32Array; hp: number }
      | { from: Float32Array; to: Float32Array; m: number }
    const phaseAt = (tt: number): Phase => {
      if (tt < INTRO) return { from: scatter, to: scenesScreen[0], m: tt / INTRO }
      const local = (tt - INTRO) % loopLen
      for (const s of segs) {
        if (local < s.t1) {
          if (!s.morph)
            return { hold: scenesScreen[s.a], hp: (local - s.t0) / (s.t1 - s.t0) }
          return {
            from: scenesScreen[s.a],
            to: scenesScreen[s.b],
            m: (local - s.t0) / (s.t1 - s.t0),
          }
        }
      }
      return { hold: scenesScreen[0], hp: 0.5 }
    }

    const paint = () => {
      ctx.clearRect(0, 0, width, height)
      for (let s = 0; s < SHADES.length; s++) {
        ctx.fillStyle = `rgb(${SHADES[s]})`
        for (let i = 0; i < n; i++) {
          if (shade[i] !== s) continue
          ctx.globalAlpha = pa[i]
          const r = rad[i]
          ctx.fillRect(px[i] - r / 2, py[i] - r / 2, r, r)
        }
      }
      ctx.globalAlpha = 1
    }

    const frame = (now: number) => {
      const tt = now - start
      const t = tt / 1000
      const ph = phaseAt(tt)
      // Ease the wander in from zero at both ends of a hold so dots settle
      // into (and leave) the static shape seamlessly instead of snapping.
      const env =
        'hold' in ph ? smooth01(ph.hp / 0.18) * smooth01((1 - ph.hp) / 0.18) : 0
      // Fade dots that sit under the left-hand copy so text stays legible.
      const textStart = width * 0.29
      const textEdge = width * 0.46
      const textSpan = textEdge - textStart

      for (let i = 0; i < n; i++) {
        let x: number
        let y: number
        let af: number
        if ('hold' in ph) {
          const A = ph.hold
          // Drift out along the dot's own vector and ease back — most dots
          // barely move (breathing); a few travel far and twinkle out.
          const out =
            wanderR[i] * (0.5 - 0.5 * Math.cos(t * wanderF[i] + phase[i])) * env
          x = A[i * 2] + dirX[i] * out
          y = A[i * 2 + 1] + dirY[i] * out
          af = out > 8 ? Math.max(0.35, 1 - (out - 8) / 80) : 1
        } else {
          const e = easeInOut(ph.m)
          const bulge = Math.sin(Math.PI * ph.m)
          const ax = ph.from[i * 2]
          const ay = ph.from[i * 2 + 1]
          const off = amp[i] * dispScale * bulge
          x = ax + (ph.to[i * 2] - ax) * e + dirX[i] * off
          y = ay + (ph.to[i * 2 + 1] - ay) * e + dirY[i] * off
          af = 1 - 0.32 * bulge
        }
        px[i] = x
        py[i] = y
        let a = baseAlpha[i] * af * (0.86 + 0.14 * Math.sin(t * 0.9 + phase[i]))
        if (x < textEdge) {
          a *= x <= textStart ? 0.5 : 0.5 + 0.5 * ((x - textStart) / textSpan)
        }
        pa[i] = a
      }

      paint()
      raf = requestAnimationFrame(frame)
    }

    const drawStatic = (idx = 0) => {
      const A = scenesScreen[idx]
      const textStart = width * 0.29
      const textEdge = width * 0.46
      const textSpan = textEdge - textStart
      for (let i = 0; i < n; i++) {
        const x = A[i * 2]
        px[i] = x
        py[i] = A[i * 2 + 1]
        let a = baseAlpha[i]
        if (x < textEdge) {
          a *= x <= textStart ? 0.5 : 0.5 + 0.5 * ((x - textStart) / textSpan)
        }
        pa[i] = a
      }
      paint()
    }

    buildTimeline()
    seed()
    if (reduce) drawStatic()
    else raf = requestAnimationFrame(frame)

    if ('fonts' in document) {
      document.fonts.ready.then(() => {
        if (!alive) return
        sampleScenes()
        mapToScreen()
        if (reduce) drawStatic()
      })
    }

    // Load the campus photos; re-sample their scenes once each is ready.
    CAMPUS.forEach((cfg, i) => {
      const im = new Image()
      im.onload = () => {
        if (!alive) return
        campusImgs[i] = im
        sampleScenes()
        mapToScreen()
        if (reduce) drawStatic()
      }
      im.src = cfg.src
    })

    let resizeTimer = 0
    const onResize = () => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(() => {
        seed()
        if (reduce) drawStatic()
      }, 150)
    }
    window.addEventListener('resize', onResize)

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      window.clearTimeout(resizeTimer)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  )
}
