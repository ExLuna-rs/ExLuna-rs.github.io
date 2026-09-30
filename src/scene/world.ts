import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { projects, type BodyKind } from '../content'
import { AsciiPass } from './ascii'
import { Hologram } from './hologram'
import { bandedTexture, makeNoise, moonTextures, ringTexture } from './textures'

export interface Body {
  id: string
  name: string
  kind: BodyKind
  radius: number
  object: THREE.Object3D
  spin: number
}

const SUN = new THREE.Vector3(1, 0.35, 0.55).normalize()

// Layout of the system, index 0 is home (the Moon).
const PLACEMENT: Record<string, { pos: [number, number, number]; radius: number }> = {
  luna: { pos: [0, 0, 0], radius: 2 },
  'g-lib': { pos: [-30, -4, -18], radius: 2.6 },
  herdr: { pos: [12, -5, 26], radius: 1.4 },
  'ascii-cosmos': { pos: [26, 3, -30], radius: 3.4 },
}

// New repos get a deterministic slot on an outer golden-angle spiral.
function autoPlacement(seed: number, index: number) {
  const a = index * 2.39996 + 0.7
  const d = 38 + index * 7
  return {
    pos: [Math.cos(a) * d, ((seed % 17) - 8) * 0.9, Math.sin(a) * d] as [number, number, number],
    radius: 1.3 + (seed % 100) / 100 * 1.4,
  }
}

const PALETTES = [
  ['#1d3b6e', '#3f7fbf', '#9fd3f0', '#2b5c99', '#d8f0ff'],
  ['#5b2a1e', '#c0643b', '#f0b27a', '#8e3b24', '#ffe0c2'],
  ['#1f4a2c', '#4f9a5c', '#b8e0a0', '#2e6b3a', '#e8ffd8'],
  ['#3a1f5c', '#7b4fb0', '#d0b0f0', '#553080', '#f0e0ff'],
]

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

export class World {
  readonly renderer: THREE.WebGLRenderer
  readonly camera = new THREE.PerspectiveCamera(45, 1, 0.05, 2000)
  readonly scene = new THREE.Scene()
  readonly ascii = new AsciiPass()
  readonly controls: OrbitControls
  readonly bodies: Body[] = []
  current = 0
  fps = 60
  aboutMode = false
  private userCell = 8
  readonly hologram = new Hologram(new THREE.Vector3(0, 1.97, 0))
  private shift = 0

  private timer = new THREE.Timer()
  private flight?: { from: THREE.Vector3; ctrl: THREE.Vector3; to: THREE.Vector3; tFrom: THREE.Vector3; tTo: THREE.Vector3; t: number; dur: number; index: number }
  private nudge = { yaw: 0, pitch: 0, zoom: 0 }
  private listeners = { arrive: new Set<(i: number) => void>(), depart: new Set<(i: number) => void>() }
  private frameHooks = new Set<() => void>()

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
    this.renderer.setClearColor(0x000000)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true
    this.controls.enablePan = false
    this.controls.rotateSpeed = 0.6
    this.controls.autoRotate = !reducedMotion
    this.controls.autoRotateSpeed = 0.35

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.05))
    const sun = new THREE.DirectionalLight(0xfff4e6, 4.5)
    sun.position.copy(SUN).multiplyScalar(100)
    this.scene.add(sun)

    this.addStars()
    this.addBody('luna', 'Luna', 'moon')
    this.scene.add(this.hologram.group)
    projects.forEach((p, i) => this.addBody(p.id, p.name, p.kind, p.seed ?? i))

    const home = this.bodies[0]
    this.camera.position.copy(this.viewpoint(home))
    this.controls.target.copy(home.object.position)
    this.applyLimits(home)

    this.resize()
    addEventListener('resize', () => this.resize())
    this.loop()
  }

  on(evt: 'arrive' | 'depart', fn: (i: number) => void) { this.listeners[evt].add(fn) }
  onFrame(fn: () => void) { this.frameHooks.add(fn) }
  get flying() { return !!this.flight }

  indexOf(id: string) { return this.bodies.findIndex(b => b.id === id) }

  // Shift the framing left by `px` so the target isn't hidden behind the terminal.
  setShift(px: number) {
    this.shift = px
    this.resize()
  }

  goto(index: number) {
    const body = this.bodies[(index + this.bodies.length) % this.bodies.length]
    if (this.aboutMode) this.ascii.setCellSize(this.userCell)
    this.aboutMode = false
    this.hologram.hide()
    this.fly(this.bodies.indexOf(body), this.viewpoint(body), body.object.position.clone())
  }

  // Fly above the Moon and project the portrait hologram.
  showAbout() {
    // Finer glyphs while the portrait is up: faces need resolution.
    if (!this.aboutMode) { this.userCell = this.ascii.cellSize; this.ascii.setCellSize(Math.min(this.userCell, 5)) }
    this.aboutMode = true
    const dir = new THREE.Vector3().subVectors(this.viewpoint(this.bodies[0]), this.bodies[0].object.position).normalize()
    dir.y = 0.12
    const to = this.hologram.center.clone().add(dir.normalize().multiplyScalar(3.5))
    this.fly(0, to, this.hologram.center.clone())
    this.hologram.show()
  }

  private fly(idx: number, to: THREE.Vector3, target: THREE.Vector3) {
    const from = this.camera.position.clone()
    const dist = from.distanceTo(to)
    const mid = from.clone().lerp(to, 0.5)
    const lift = new THREE.Vector3().subVectors(to, from).cross(new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(dist * 0.18)
    mid.add(lift).add(new THREE.Vector3(0, dist * 0.08, 0))
    this.flight = {
      from, ctrl: mid, to,
      tFrom: this.controls.target.clone(), tTo: target,
      t: 0, dur: reducedMotion ? 0.35 : THREE.MathUtils.clamp(dist / 22, 1.4, 3.2), index: idx,
    }
    this.controls.enabled = false
    this.listeners.depart.forEach(fn => fn(idx))
  }

  // Keyboard-driven camera moves (vim h/l/+/-), smoothed in the loop.
  push(yaw: number, pitch: number, zoom = 0) {
    this.nudge.yaw += yaw
    this.nudge.pitch += pitch
    this.nudge.zoom += zoom
  }

  pick(clientX: number, clientY: number): number {
    const ndc = new THREE.Vector2((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1)
    const ray = new THREE.Raycaster()
    ray.setFromCamera(ndc, this.camera)
    // Generous hit spheres: in ASCII, precision clicking is no fun.
    let best = -1, bestDist = Infinity
    this.bodies.forEach((b, i) => {
      const hit = ray.ray.intersectSphere(new THREE.Sphere(b.object.position, b.radius * 1.5), new THREE.Vector3())
      if (hit) { const d = hit.distanceTo(this.camera.position); if (d < bestDist) { bestDist = d; best = i } }
    })
    return best
  }

  // Screen position of a body for HTML labels; null when behind the camera.
  project(i: number): { x: number; y: number; r: number } | null {
    const b = this.bodies[i]
    const p = b.object.position.clone().project(this.camera)
    if (p.z > 1) return null
    const edge = b.object.position.clone().add(this.camera.up.clone().multiplyScalar(b.radius)).project(this.camera)
    return {
      x: (p.x * 0.5 + 0.5) * innerWidth,
      y: (-p.y * 0.5 + 0.5) * innerHeight,
      r: Math.abs(edge.y - p.y) * 0.5 * innerHeight,
    }
  }

  private viewpoint(b: Body) {
    const dir = SUN.clone().multiplyScalar(0.55).add(new THREE.Vector3(-0.55, 0.22, 0.75)).normalize()
    return b.object.position.clone().add(dir.multiplyScalar(b.radius * (b.kind === 'ringed' ? 6.8 : b.kind === 'station' ? 4.4 : 3.6)))
  }

  private applyLimits(b: Body) {
    this.controls.minDistance = b.radius * 1.6
    this.controls.maxDistance = b.radius * 12
  }

  private addStars() {
    const r = makeNoise(3)
    const n = 2600
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u)
      const d = 600 + r(i, 0, 0) * 200
      pos.set([s * Math.cos(th) * d, u * d, s * Math.sin(th) * d], i * 3)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    this.scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false })))
  }

  private addBody(id: string, name: string, kind: BodyKind, seed = 0) {
    const { pos, radius } = PLACEMENT[id] ?? autoPlacement(seed, this.bodies.length)
    const group = new THREE.Group()
    group.position.set(...pos)
    let spin = 0.02

    if (kind === 'moon') {
      const { map, bump } = moonTextures()
      const mat = new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 6, roughness: 1, metalness: 0 })
      group.add(new THREE.Mesh(new THREE.SphereGeometry(radius, 128, 96), mat))
      spin = 0.015
    } else if (kind === 'ringed') {
      const planet = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 96, 64),
        new THREE.MeshStandardMaterial({ map: bandedTexture(11, ['#8a6f4a', '#d9c39a', '#b89668', '#efe2c0', '#a07f55']), roughness: 1 }),
      )
      group.add(planet)
      const inner = radius * 1.35, outer = radius * 2.35
      const ringGeo = new THREE.RingGeometry(inner, outer, 180, 1)
      const uv = ringGeo.attributes.uv as THREE.BufferAttribute
      const p = ringGeo.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < uv.count; i++) {
        const d = Math.hypot(p.getX(i), p.getY(i))
        uv.setXY(i, (d - inner) / (outer - inner), 0.5)
      }
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({
        map: ringTexture(5), transparent: true, side: THREE.DoubleSide, roughness: 1, depthWrite: false,
      }))
      ring.rotation.x = -Math.PI / 2 + 0.42
      ring.rotation.y = 0.18
      group.add(ring)
      spin = 0.05
    } else if (kind === 'banded') {
      group.add(new THREE.Mesh(
        new THREE.SphereGeometry(radius, 96, 64),
        new THREE.MeshStandardMaterial({ map: bandedTexture(23 + seed, PALETTES[seed % PALETTES.length]), roughness: 0.9 }),
      ))
      spin = 0.08
    } else if (kind === 'station') {
      // A satellite made of tiled panes, a nod to terminal layouts.
      const mat = new THREE.MeshStandardMaterial({ color: 0xd8e2e8, roughness: 0.5, metalness: 0.6 })
      const panes: Array<[number, number, number, number]> = [[-1, 0.5, 1.9, 0.9], [-1, -0.5, 1.9, 0.9], [1, 0, 1.9, 1.9]]
      const core = new THREE.Group()
      for (const [x, y, w, h] of panes) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w * 0.47, h * 0.47, 0.06), mat)
        m.position.set(x * 0.5, y * 0.5, 0)
        core.add(m)
      }
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.9, 24), mat)
      hub.rotation.x = Math.PI / 2
      core.add(hub)
      for (const s of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.02), new THREE.MeshStandardMaterial({ color: 0x6f8aa0, roughness: 0.3, metalness: 0.8 }))
        wing.position.set(s * 1.85, 0, 0)
        core.add(wing)
      }
      core.scale.setScalar(radius * 0.9)
      core.rotation.set(0.4, 0.6, 0.2)
      group.add(core)
      spin = 0.25
    } else {
      // Rocky: a lumpy asteroid.
      const geo = new THREE.IcosahedronGeometry(radius, 5)
      const n = makeNoise(9 + seed)
      const p = geo.attributes.position as THREE.BufferAttribute
      const v = new THREE.Vector3()
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).normalize()
        const k = 0.7 + n(v.x * 2 + 5, v.y * 2 + 5, v.z * 2 + 5, 4) * 0.6
        p.setXYZ(i, v.x * radius * k, v.y * radius * k * 0.85, v.z * radius * k)
      }
      geo.computeVertexNormals()
      group.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xb0a89c, roughness: 1, flatShading: true })))
      spin = 0.12
    }

    this.scene.add(group)
    this.bodies.push({ id, name, kind, radius, object: group, spin })
  }

  private resize() {
    const dpr = Math.min(devicePixelRatio, 2)
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(innerWidth, innerHeight, false)
    this.camera.aspect = innerWidth / innerHeight
    if (this.shift) this.camera.setViewOffset(innerWidth, innerHeight, this.shift, 0, innerWidth, innerHeight)
    else this.camera.clearViewOffset()
    this.camera.updateProjectionMatrix()
    this.ascii.setSize(innerWidth, innerHeight, dpr)
  }

  private loop = () => {
    requestAnimationFrame(this.loop)
    this.timer.update()
    const dt = Math.min(this.timer.getDelta(), 0.1)
    const time = this.timer.getElapsed()
    this.fps += (1 / Math.max(dt, 1e-3) - this.fps) * 0.05

    for (const b of this.bodies) if (!reducedMotion) b.object.rotation.y += b.spin * dt
    this.hologram.update(dt, time, this.camera)

    if (this.flight) {
      const f = this.flight
      f.t = Math.min(1, f.t + dt / f.dur)
      const e = easeInOut(f.t)
      const a = f.from.clone().lerp(f.ctrl, e), b = f.ctrl.clone().lerp(f.to, e)
      this.camera.position.copy(a.lerp(b, e))
      this.controls.target.copy(f.tFrom.clone().lerp(f.tTo, easeInOut(Math.min(1, f.t * 1.4))))
      this.camera.lookAt(this.controls.target)
      if (f.t >= 1) {
        this.flight = undefined
        this.current = f.index
        this.applyLimits(this.bodies[f.index])
        this.controls.enabled = true
        this.listeners.arrive.forEach(fn => fn(f.index))
      }
    } else {
      const k = Math.min(1, dt * 6)
      const dy = this.nudge.yaw * k, dp = this.nudge.pitch * k, dz = this.nudge.zoom * k
      this.nudge.yaw -= dy; this.nudge.pitch -= dp; this.nudge.zoom -= dz
      if (Math.abs(dy) + Math.abs(dp) + Math.abs(dz) > 1e-5) {
        const off = this.camera.position.clone().sub(this.controls.target)
        const sph = new THREE.Spherical().setFromVector3(off)
        sph.theta += dy
        sph.phi = THREE.MathUtils.clamp(sph.phi + dp, 0.15, Math.PI - 0.15)
        sph.radius = THREE.MathUtils.clamp(sph.radius * (1 + dz), this.controls.minDistance, this.controls.maxDistance)
        this.camera.position.copy(this.controls.target).add(off.setFromSpherical(sph))
      }
      this.controls.update()
    }

    this.ascii.render(this.renderer, this.scene, this.camera, time)
    this.frameHooks.forEach(fn => fn())
  }
}
