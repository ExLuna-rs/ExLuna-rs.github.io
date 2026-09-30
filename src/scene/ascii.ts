import * as THREE from 'three'

// Same ramp as moon.py, dark -> bright.
export const RAMP = " .'`:-~=+*o#%&@"

const vert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`

const frag = /* glsl */ `
  uniform sampler2D tScene;
  uniform sampler2D tGlyphs;
  uniform vec2 uResolution;
  uniform vec2 uCell;
  uniform float uCount;
  uniform vec3 uTint;
  uniform float uColorMix;
  uniform float uEnabled;
  uniform float uTime;
  varying vec2 vUv;

  float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

  void main() {
    vec3 raw = texture2D(tScene, vUv).rgb;
    if (uEnabled < 0.5) { gl_FragColor = vec4(raw, 1.0); return; }

    vec2 px = vUv * uResolution;
    vec2 cell = floor(px / uCell);
    vec2 texel = uCell / uResolution;
    vec2 base = cell * texel;

    // 4-tap average per cell keeps thin features (stars, ring edges) alive.
    vec3 c = texture2D(tScene, base + texel * vec2(0.25, 0.25)).rgb
           + texture2D(tScene, base + texel * vec2(0.75, 0.25)).rgb
           + texture2D(tScene, base + texel * vec2(0.25, 0.75)).rgb
           + texture2D(tScene, base + texel * vec2(0.75, 0.75)).rgb;
    c *= 0.25;
    vec3 peak = texture2D(tScene, base + texel * 0.5).rgb;
    c = max(c, peak * 0.85);

    float l = clamp(pow(luma(c) * 1.9, 0.72), 0.0, 0.999);
    float idx = floor(l * uCount);
    vec2 local = fract(px / uCell);
    float g = texture2D(tGlyphs, vec2((idx + local.x) / uCount, local.y)).r;

    vec3 hue = c / max(max(c.r, max(c.g, c.b)), 1e-3);
    vec3 col = mix(uTint, hue, uColorMix) * (0.45 + 0.75 * l) * g;

    // Faint scanlines + vignette, CRT without the headache.
    float scan = 0.94 + 0.06 * sin(px.y * 3.14159 / uCell.y * 2.0 + uTime * 2.0);
    vec2 v = vUv - 0.5;
    float vig = smoothstep(0.85, 0.2, length(v));
    gl_FragColor = vec4(col * scan * (0.55 + 0.45 * vig), 1.0);
  }
`

export class AsciiPass {
  readonly target: THREE.WebGLRenderTarget
  private scene = new THREE.Scene()
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private material: THREE.ShaderMaterial
  private glyphs?: THREE.CanvasTexture
  private cssCell = { w: 8, h: 14 }
  private dpr = 1

  constructor() {
    this.target = new THREE.WebGLRenderTarget(1, 1, { samples: 0, type: THREE.HalfFloatType })
    this.material = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tScene: { value: this.target.texture },
        tGlyphs: { value: null },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uCell: { value: new THREE.Vector2(8, 14) },
        uCount: { value: RAMP.length },
        uTint: { value: new THREE.Color('#3ee6c1') },
        uColorMix: { value: 0.3 },
        uEnabled: { value: 1 },
        uTime: { value: 0 },
      },
    })
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material))
  }

  get enabled() { return this.material.uniforms.uEnabled.value > 0.5 }
  set enabled(on: boolean) { this.material.uniforms.uEnabled.value = on ? 1 : 0 }
  get cellSize() { return this.cssCell.w }

  setTint(hex: string) { (this.material.uniforms.uTint.value as THREE.Color).set(hex) }
  setColorMix(v: number) { this.material.uniforms.uColorMix.value = v }

  setCellSize(w: number) {
    this.cssCell = { w, h: Math.round(w * 1.75) }
    this.buildAtlas()
  }

  setSize(w: number, h: number, dpr: number) {
    this.dpr = dpr
    this.target.setSize(Math.floor(w * dpr), Math.floor(h * dpr))
    this.material.uniforms.uResolution.value.set(Math.floor(w * dpr), Math.floor(h * dpr))
    this.buildAtlas()
  }

  private buildAtlas() {
    const cw = Math.round(this.cssCell.w * this.dpr)
    const ch = Math.round(this.cssCell.h * this.dpr)
    const canvas = document.createElement('canvas')
    canvas.width = cw * RAMP.length
    canvas.height = ch
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `600 ${Math.round(ch * 0.82)}px "JetBrains Mono", ui-monospace, Menlo, monospace`
    for (let i = 0; i < RAMP.length; i++) ctx.fillText(RAMP[i], i * cw + cw / 2, ch / 2 + ch * 0.04)

    this.glyphs?.dispose()
    this.glyphs = new THREE.CanvasTexture(canvas)
    this.glyphs.minFilter = THREE.NearestFilter
    this.glyphs.magFilter = THREE.NearestFilter
    this.glyphs.generateMipmaps = false
    this.material.uniforms.tGlyphs.value = this.glyphs
    this.material.uniforms.uCell.value.set(cw, ch)
  }

  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, time: number) {
    this.material.uniforms.uTime.value = time
    renderer.setRenderTarget(this.target)
    renderer.render(scene, camera)
    renderer.setRenderTarget(null)
    renderer.render(this.scene, this.camera)
  }
}
