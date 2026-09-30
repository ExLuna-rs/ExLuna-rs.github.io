import * as THREE from 'three'

// Seeded RNG so the moon looks the same on every visit.
export function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let x = Math.imul(s ^ (s >>> 15), 1 | s)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

// 3D value noise sampled on the sphere: no seam, no pole pinch.
export function makeNoise(seed: number) {
  const r = rng(seed)
  const perm = new Uint8Array(512)
  const vals = new Float32Array(256)
  for (let i = 0; i < 256; i++) { perm[i] = i; vals[i] = r() }
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]] }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i]
  const h = (x: number, y: number, z: number) => vals[perm[perm[perm[x & 255] + (y & 255)] + (z & 255)]]
  const s = (t: number) => t * t * (3 - 2 * t)
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t
  const noise = (x: number, y: number, z: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z)
    const u = s(x - xi), v = s(y - yi), w = s(z - zi)
    return lerp(
      lerp(lerp(h(xi, yi, zi), h(xi + 1, yi, zi), u), lerp(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v),
      lerp(lerp(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), lerp(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v),
      w,
    )
  }
  return (x: number, y: number, z: number, oct = 4) => {
    let sum = 0, amp = 0.5, f = 1
    for (let o = 0; o < oct; o++) { sum += amp * noise(x * f, y * f, z * f); f *= 2.03; amp *= 0.5 }
    return sum
  }
}

function toTexture(canvas: HTMLCanvasElement, color = true) {
  const tex = new THREE.CanvasTexture(canvas)
  if (color) tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

// Rasterize a word into a 0/1 mask, to engrave it into the relief like moon.py does.
function wordMask(word: string, w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.font = `800 ${Math.floor(h * 0.8)}px ui-monospace, Menlo, monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(word, w / 2, h / 2)
  const data = ctx.getImageData(0, 0, w, h).data
  return (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : data[(y * w + x) * 4] / 255)
}

export function moonTextures(W = 1024, H = 512) {
  const noise = makeNoise(7)
  const r = rng(42)
  const height = new Float32Array(W * H)
  const albedo = new Float32Array(W * H)
  const dirs = new Float32Array(W * H * 3)

  for (let y = 0; y < H; y++) {
    const lat = (0.5 - (y + 0.5) / H) * Math.PI
    for (let x = 0; x < W; x++) {
      const lon = ((x + 0.5) / W) * Math.PI * 2
      const i = y * W + x
      const dx = Math.cos(lat) * Math.cos(lon), dy = Math.sin(lat), dz = Math.cos(lat) * Math.sin(lon)
      dirs[i * 3] = dx; dirs[i * 3 + 1] = dy; dirs[i * 3 + 2] = dz
      height[i] = noise(dx * 3, dy * 3, dz * 3, 5) * 0.35
      // Maria: large, low-frequency dark plains.
      const m = noise(dx * 1.2 + 9, dy * 1.2 + 3, dz * 1.2 + 5, 3)
      albedo[i] = 0.62 + noise(dx * 8, dy * 8, dz * 8, 3) * 0.25 - Math.max(0, m - 0.47) * 2.2
    }
  }

  // Craters: bowl + raised rim + bright ejecta for the young ones.
  const craters: Array<[number, number, number, number]> = []
  for (let k = 0; k < 260; k++) {
    const rad = Math.pow(r(), 3) * 0.16 + 0.012
    craters.push([r() * 2 - 1, r() * 2 - 1, rad, r()])
  }
  for (const [u, v, rad, age] of craters) {
    const lon = u * Math.PI, lat = Math.asin(v)
    const cx = Math.cos(lat) * Math.cos(lon), cy = Math.sin(lat), cz = Math.cos(lat) * Math.sin(lon)
    const reach = rad * 1.6
    const y0 = Math.max(0, Math.floor((0.5 - (lat + reach) / Math.PI) * H))
    const y1 = Math.min(H - 1, Math.ceil((0.5 - (lat - reach) / Math.PI) * H))
    const depth = rad * 1.4
    for (let y = y0; y <= y1; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x
        const dot = dirs[i * 3] * cx + dirs[i * 3 + 1] * cy + dirs[i * 3 + 2] * cz
        const d = Math.acos(Math.min(1, dot)) / rad
        if (d > 1.6) continue
        if (d < 1) height[i] -= (1 - d * d) * depth
        height[i] += Math.exp(-(((d - 1) / 0.18) ** 2)) * depth * 0.45
        if (age > 0.85) albedo[i] += Math.exp(-(((d - 1.1) / 0.35) ** 2)) * 0.25
      }
    }
  }

  // Easter egg: "ExLuna-rs" carved in a mare, just like moon.py hides it.
  const mw = 180, mh = 40
  const mask = wordMask('ExLuna-rs', mw, mh)
  const ox = Math.floor(W * 0.2), oy = Math.floor(H * 0.44)
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
    const m = mask(x, y)
    if (m > 0) height[(oy + y) * W + ox + x] -= m * 0.05
  }

  const color = document.createElement('canvas')
  const bump = document.createElement('canvas')
  color.width = bump.width = W
  color.height = bump.height = H
  const cctx = color.getContext('2d')!, bctx = bump.getContext('2d')!
  const cimg = cctx.createImageData(W, H), bimg = bctx.createImageData(W, H)
  let lo = Infinity, hi = -Infinity
  for (const v of height) { if (v < lo) lo = v; if (v > hi) hi = v }
  for (let i = 0; i < W * H; i++) {
    const hv = ((height[i] - lo) / (hi - lo)) * 255
    const a = Math.max(0.12, Math.min(1, albedo[i])) * 235
    cimg.data.set([a, a * 0.98, a * 0.95, 255], i * 4)
    bimg.data.set([hv, hv, hv, 255], i * 4)
  }
  cctx.putImageData(cimg, 0, 0)
  bctx.putImageData(bimg, 0, 0)
  return { map: toTexture(color), bump: toTexture(bump, false) }
}

export function bandedTexture(seed: number, palette: string[], W = 512, H = 256) {
  const noise = makeNoise(seed)
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(W, H)
  const cols = palette.map(p => new THREE.Color(p))
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const lon = (x / W) * Math.PI * 2, lat = (0.5 - y / H) * Math.PI
    const dx = Math.cos(lat) * Math.cos(lon), dy = Math.sin(lat), dz = Math.cos(lat) * Math.sin(lon)
    const turb = noise(dx * 4, dy * 4, dz * 4, 4)
    const band = (Math.sin(dy * 14 + turb * 5) * 0.5 + 0.5) * (cols.length - 1)
    const a = cols[Math.floor(band)], b = cols[Math.min(cols.length - 1, Math.floor(band) + 1)]
    const col = a.clone().lerp(b, band % 1)
    img.data.set([col.r * 255, col.g * 255, col.b * 255, 255], (y * W + x) * 4)
  }
  ctx.putImageData(img, 0, 0)
  return toTexture(c)
}

export function ringTexture(seed: number, W = 512) {
  const r = rng(seed)
  const c = document.createElement('canvas')
  c.width = W; c.height = 4
  const ctx = c.getContext('2d')!
  for (let x = 0; x < W; x++) {
    const t = x / W
    const gap = t > 0.55 && t < 0.6 ? 0.05 : 1 // Cassini-like division
    const a = (0.35 + r() * 0.65) * gap * Math.sin(t * Math.PI) ** 0.4
    ctx.fillStyle = `rgba(255,240,215,${a.toFixed(3)})`
    ctx.fillRect(x, 0, 1, 4)
  }
  return toTexture(c)
}
