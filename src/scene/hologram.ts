import * as THREE from 'three'

// A portrait projected above the Moon. holo.png packs three channels:
// R = contrast-boosted luma, G = depth, B = silhouette mask.

const vert = /* glsl */ `
  uniform sampler2D tHolo;
  uniform float uDepth;
  uniform float uTime;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    vUv = uv;
    vec3 p = position;
    p.z += texture2D(tHolo, uv).g * uDepth;
    // Occasional horizontal glitch slices.
    float band = floor(uv.y * 36.0);
    float tick = floor(uTime * 7.0);
    if (hash(vec2(band, tick)) > 0.965) p.x += (hash(vec2(tick, band)) - 0.5) * 0.25;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

const frag = /* glsl */ `
  uniform sampler2D tHolo;
  uniform float uTime;
  uniform float uReveal;
  uniform vec3 uColor;
  varying vec2 vUv;
  float hash(float x) { return fract(sin(x * 91.3458) * 47453.5453); }
  void main() {
    vec3 t = texture2D(tHolo, vUv).rgb;
    if (t.b < 0.35 || vUv.y > uReveal) discard;
    float l = smoothstep(0.12, 0.95, t.r);
    float sweep = smoothstep(0.03, 0.0, abs(vUv.y - fract(uTime * 0.22)));
    float front = smoothstep(0.035, 0.0, uReveal - vUv.y) * step(uReveal, 0.999);
    float flicker = 0.93 + 0.07 * sin(uTime * 37.0) * step(0.9, hash(floor(uTime * 9.0)));
    vec3 col = mix(uColor, vec3(1.0), 0.35) * (l * flicker * 0.62 + 0.04 + sweep * 0.12 + front * 0.5);
    gl_FragColor = vec4(col, 1.0);
  }
`

const beamFrag = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    float a = pow(vUv.y, 1.6) * 0.22 * uOpacity;
    a *= 0.75 + 0.25 * sin(vUv.y * 40.0 - uTime * 6.0);
    gl_FragColor = vec4(uColor * a, 1.0);
  }
`

export class Hologram {
  readonly group = new THREE.Group()
  private portrait: THREE.Mesh
  private beam: THREE.Mesh
  private mat: THREE.ShaderMaterial
  private beamMat: THREE.ShaderMaterial
  private reveal = 0
  private target = 0
  readonly center: THREE.Vector3

  constructor(base: THREE.Vector3, height = 2.8) {
    const tex = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}holo.png`)
    tex.colorSpace = THREE.NoColorSpace
    const color = new THREE.Color('#9fe8ff')

    this.mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      side: THREE.DoubleSide,
      uniforms: { tHolo: { value: tex }, uDepth: { value: 0.55 }, uTime: { value: 0 }, uReveal: { value: 0 }, uColor: { value: color } },
    })
    this.portrait = new THREE.Mesh(new THREE.PlaneGeometry(height, height, 160, 160), this.mat)
    this.portrait.position.y = height / 2 + 0.35
    this.group.add(this.portrait)

    // Light cone from the projector on the surface up to the portrait.
    this.beamMat = new THREE.ShaderMaterial({
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: beamFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uColor: { value: color } },
    })
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(height * 0.42, 0.06, 0.5, 48, 1, true), this.beamMat)
    this.beam.position.y = 0.25
    this.group.add(this.beam)

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 8, 32), new THREE.MeshBasicMaterial({ color: 0x9fe8ff }))
    ring.rotation.x = Math.PI / 2
    this.group.add(ring)

    this.group.position.copy(base)
    this.group.visible = false
    // Aim at the face, which sits in the upper part of the portrait.
    this.center = base.clone().add(new THREE.Vector3(0, height * 0.64 + 0.35, 0))
  }

  get shown() { return this.target > 0 }

  show() { this.target = 1; this.group.visible = true }
  hide() { this.target = 0 }

  update(dt: number, time: number, camera: THREE.Camera) {
    const speed = this.target ? 0.55 : 2.5
    this.reveal += Math.sign(this.target - this.reveal) * Math.min(Math.abs(this.target - this.reveal), dt * speed)
    if (!this.target && this.reveal <= 0) this.group.visible = false
    if (!this.group.visible) return

    // Face the camera (yaw only) with a slow sway, so the depth relief shows.
    const yaw = Math.atan2(camera.position.x - this.group.position.x, camera.position.z - this.group.position.z)
    this.group.rotation.y = yaw + Math.sin(time * 0.5) * 0.2

    this.mat.uniforms.uTime.value = time
    this.mat.uniforms.uReveal.value = this.reveal * 1.02
    this.beamMat.uniforms.uTime.value = time
    this.beamMat.uniforms.uOpacity.value = this.reveal
  }
}
