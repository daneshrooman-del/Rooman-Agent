import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { Volume2, VolumeX } from 'lucide-react'
import { AVATAR_OPTIONS } from '../HeroShowcase'

/* The three avatars in the hero. Dev uses his still-head take (dev_intro.still.mp4). */
const AVATARS = [
  ...AVATAR_OPTIONS.filter((a) => a.id !== 'dev'),
  ...AVATAR_OPTIONS.filter((a) => a.id === 'dev').map((a) => ({
    ...a,
    video: '/avatars/clips/dev_intro.still.mp4',
    rest: '/avatars/clips/dev_rest.still.jpg',
  })),
]

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

/* A rounded rectangle: either textured (an avatar) or a flat colour, optionally hollow (an outline). */
const FRAG = /* glsl */ `
uniform sampler2D map;
uniform float useMap;
uniform vec3 color;
uniform vec2 size;
uniform float radius;
uniform float opacity;
uniform float border;
uniform vec3 borderColor;
uniform float hollow;
varying vec2 vUv;
float sdRound(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
void main() {
  vec2 p = (vUv - 0.5) * size;
  float d = sdRound(p, size * 0.5, radius);
  float aa = 0.006;
  float inside = 1.0 - smoothstep(-aa, aa, d);
  float edge = border > 0.0 ? smoothstep(-border - aa, -border + aa, d) : 0.0;
  vec4 c = useMap > 0.5 ? texture2D(map, vUv) : vec4(color, 1.0);
  c.rgb = mix(c.rgb, borderColor, edge);
  float a = hollow > 0.5 ? inside * edge : inside;
  gl_FragColor = vec4(c.rgb, a * opacity);
  #include <colorspace_fragment>
}`

const W = 1.6
const H = 2.0

function roundedMaterial(opts: { map?: THREE.Texture; color?: string; radius?: number; border?: number; borderColor?: string; hollow?: boolean; opacity?: number; size?: [number, number] }) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    uniforms: {
      map: { value: opts.map ?? null },
      useMap: { value: opts.map ? 1 : 0 },
      color: { value: new THREE.Color(opts.color ?? 'white') },
      size: { value: new THREE.Vector2(...(opts.size ?? [W, H])) },
      radius: { value: opts.radius ?? 0.12 },
      opacity: { value: opts.opacity ?? 1 },
      border: { value: opts.border ?? 0 },
      borderColor: { value: new THREE.Color(opts.borderColor ?? 'black') },
      hollow: { value: opts.hollow ? 1 : 0 },
    },
  })
}

function shadowTexture() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 320
  const g = c.getContext('2d')!
  g.filter = 'blur(22px)'
  g.fillStyle = 'rgba(29,58,154,0.45)'
  g.beginPath()
  g.roundRect(48, 52, 160, 220, 18)
  g.fill()
  return new THREE.CanvasTexture(c)
}

/* Where each avatar panel sits: the front slot, and one behind to the right. */
/* Where each avatar panel sits: front centre, back right, back left. */
const SLOTS = [
  { pos: new THREE.Vector3(0.05, -0.02, 0), rotY: 0.08, scale: 1 },
  { pos: new THREE.Vector3(1.25, 0.3, -1.5), rotY: -0.42, scale: 0.8 },
  { pos: new THREE.Vector3(-1.4, 0.18, -1.6), rotY: 0.42, scale: 0.8 },
]

function webglOk() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

export function HeroStage() {
  const hostRef = useRef<HTMLDivElement>(null)
  const soundRef = useRef<HTMLButtonElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videosRef = useRef<HTMLVideoElement[]>([])
  const apiRef = useRef<{ setActive: (i: number) => void; render: () => void } | null>(null)
  const [active, setActive] = useState(0)
  const [muted, setMuted] = useState(true)
  const [gl] = useState(webglOk)

  /* ---- three.js scene (built once) ---- */
  useEffect(() => {
    if (!gl) return
    const host = hostRef.current!
    const canvas = canvasRef.current!
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // theme colours come from the landing page's CSS tokens (studio.css)
    const token = (name: string, fallback: string) => getComputedStyle(host).getPropertyValue(name).trim() || fallback
    const INK = token('--ink', '#1D3A9A')

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50)
    camera.position.set(0, 0, 5.5)
    const root = new THREE.Group()
    scene.add(root)


    // One panel per avatar: the real lip-synced clip (or its rest frame with reduced motion).
    const shadowTex = shadowTexture()
    const panelMats: THREE.ShaderMaterial[] = []
    const panels = AVATARS.map((a, i) => {
      let tex: THREE.Texture
      if (reduced) {
        tex = new THREE.TextureLoader().load(a.rest ?? a.image, () => renderOnce())
      } else {
        const v = document.createElement('video')
        v.src = a.video ?? ''
        v.muted = true
        v.loop = true
        v.playsInline = true
        v.crossOrigin = 'anonymous'
        v.preload = 'auto'
        v.poster = a.rest ?? a.image
        videosRef.current[i] = v
        // show the still portrait until the video has a frame, then switch to the live video
        tex = new THREE.TextureLoader().load(a.rest ?? a.image, () => renderOnce())
        const videoTex = new THREE.VideoTexture(v)
        videoTex.colorSpace = THREE.SRGBColorSpace
        v.addEventListener(
          'loadeddata',
          () => {
            const mat = panelMats[i]
            if (!mat) return
            mat.uniforms.map.value.dispose()
            mat.uniforms.map.value = videoTex
          },
          { once: true },
        )
      }
      tex.colorSpace = THREE.SRGBColorSpace
      const group = new THREE.Group()
      const shadow = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.3, H * 1.3), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.55 }))
      shadow.position.set(0.12, -0.16, -0.06)
      const mat = roundedMaterial({ map: tex, border: 0.012, borderColor: INK })
      panelMats[i] = mat
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat)
      mesh.userData.index = i
      group.add(shadow, mesh)
      root.add(group)
      return { group, mesh }
    })

    // Place panels in their slots; a switch tweens them over ~0.9 s.
    let activeIdx = 0
    // the active avatar takes the front slot; the others fill the back slots in order
    const slotOf = (i: number) => (i === activeIdx ? 0 : 1 + panels.map((_, j) => j).filter((j) => j !== activeIdx).indexOf(i))
    const targets: (typeof SLOTS)[number][] = []
    panels.forEach((_, i) => (targets[i] = SLOTS[slotOf(i)]))
    panels.forEach((p, i) => {
      const s = targets[i]
      p.group.position.copy(s.pos)
      p.group.rotation.y = s.rotY
      p.group.scale.setScalar(s.scale)
    })

    let pointerX = 0
    let pointerY = 0
    let tiltX = 0
    let tiltY = 0
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const r = host.getBoundingClientRect()
      pointerX = ((e.clientX - r.left) / r.width - 0.5) * 2
      pointerY = ((e.clientY - r.top) / r.height - 0.5) * 2
      if (reduced) {
        tiltX = pointerY
        tiltY = pointerX
        renderOnce()
      }
    }
    const onLeave = () => {
      pointerX = pointerY = 0
    }
    window.addEventListener('pointermove', onPointer, { passive: true })
    host.addEventListener('pointerleave', onLeave)

    // Click a panel to bring it to the front
    const ray = new THREE.Raycaster()
    const onClick = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect()
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera)
      const hit = ray.intersectObjects(panels.map((p) => p.mesh))[0]
      if (hit) setActive(hit.object.userData.index as number)
    }
    canvas.addEventListener('click', onClick)

    const resize = () => {
      const r = host.getBoundingClientRect()
      renderer.setSize(r.width, r.height, false)
      camera.aspect = r.width / r.height
      // keep the composition in frame on narrow screens
      // closer on wide screens so the cards fill the stage; further back on narrow ones so all three fit
      camera.position.z = r.width / r.height < 1.05 ? 6.9 : 5.5
      camera.updateProjectionMatrix()
      renderOnce()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(host)

    let raf = 0
    let last = performance.now()
    let t = 0
    let onScreen = true
    const running = () => !reduced && onScreen && !document.hidden

    function step(dt: number) {
      t += dt
      const k = Math.min(1, dt * 4)
      tiltX += (pointerY - tiltX) * k
      tiltY += (pointerX - tiltY) * k
      // scroll: the stage leans back slightly as the hero leaves the screen
      const top = host.getBoundingClientRect().top
      const scroll = Math.max(0, Math.min(1, -top / (host.offsetHeight || 1)))
      root.rotation.x = tiltX * 0.12 + scroll * 0.35
      root.rotation.y = tiltY * 0.22
      root.position.y = reduced ? 0 : Math.sin(t * 0.7) * 0.05
      const kk = Math.min(1, dt * 5)
      panels.forEach((p, i) => {
        const s = targets[i]
        p.group.position.lerp(s.pos, kk)
        p.group.rotation.y += (s.rotY - p.group.rotation.y) * kk
        const sc = p.group.scale.x + (s.scale - p.group.scale.x) * kk
        p.group.scale.setScalar(sc)
        p.mesh.renderOrder = i === activeIdx ? 3 : 1
      })
      // keep the sound button pinned to the front card's bottom-right corner
      const btn = soundRef.current
      const front = panels[activeIdx]?.mesh
      if (btn && front) {
        root.updateMatrixWorld()
        const v = new THREE.Vector3(W / 2, -H / 2, 0).applyMatrix4(front.matrixWorld).project(camera)
        const r = host.getBoundingClientRect()
        btn.style.left = `${((v.x + 1) / 2) * r.width}px`
        btn.style.top = `${((1 - v.y) / 2) * r.height}px`
        btn.style.opacity = '1'
      }
      renderer.render(scene, camera)
    }
    function frameLoop(now: number) {
      raf = 0
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      step(dt)
      if (running()) raf = requestAnimationFrame(frameLoop)
    }
    function wake() {
      if (!raf && running()) {
        last = performance.now()
        raf = requestAnimationFrame(frameLoop)
      }
    }
    function renderOnce() {
      if (raf) return
      // settle tweens fully when not animating
      requestAnimationFrame(() => step(reduced ? 1 : 0.016))
    }

    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting
      videosRef.current.forEach((v) => {
        if (onScreen) v.play().catch(() => {})
        else v.pause()
      })
      wake()
    })
    io.observe(host)
    const onVis = () => {
      videosRef.current.forEach((v) => {
        if (document.hidden) v.pause()
        else v.play().catch(() => {})
      })
      wake()
    }
    document.addEventListener('visibilitychange', onVis)

    apiRef.current = {
      setActive(i: number) {
        activeIdx = i
        panels.forEach((_, j) => (targets[j] = SLOTS[slotOf(j)]))
        videosRef.current.forEach((v, j) => {
          if (!v) return
          if (j === i) {
            v.currentTime = 0
          } else {
            v.muted = true
          }
          v.play().catch(() => {})
        })
        if (reduced) renderOnce()
        else wake()
      },
      render: renderOnce,
    }
    if (!reduced) videosRef.current.forEach((v) => v.play().catch(() => {}))
    resize()
    wake()

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
      window.removeEventListener('pointermove', onPointer)
      host.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('click', onClick)
      document.removeEventListener('visibilitychange', onVis)
      videosRef.current.forEach((v) => {
        v.pause()
        v.removeAttribute('src')
        v.load()
      })
      videosRef.current = []
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        m.geometry?.dispose()
        const mat = m.material as THREE.Material & { uniforms?: { map?: { value: THREE.Texture | null } }; map?: THREE.Texture }
        mat?.uniforms?.map?.value?.dispose()
        mat?.map?.dispose()
        mat?.dispose?.()
      })
      renderer.dispose()
      apiRef.current = null
    }
  }, [gl])

  useEffect(() => {
    apiRef.current?.setActive(active)
    videosRef.current.forEach((v, i) => v && (v.muted = i !== active || muted))
  }, [active, muted])

  const avatar = AVATARS[active]

  return (
    <figure className="relative">
      <div ref={hostRef} className="relative aspect-[1/1.05] w-full lg:aspect-[1.15/1]">
        {gl ? (
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={`${avatar.name}, an AI avatar, speaking. Other avatars stand behind in 3D; click one to bring it forward.`}
            className="absolute inset-0 size-full cursor-pointer"
          />
        ) : (
          <div className="absolute inset-[6%] overflow-hidden rounded-[22px] border border-[var(--ink)]">
            <video key={avatar.id} src={avatar.video} poster={avatar.rest} autoPlay muted={muted} loop playsInline className="size-full object-cover" />
          </div>
        )}
        {/* Sound toggle, on the avatar: follows the front card's corner in 3D (fixed corner without WebGL) */}
        <button
          ref={soundRef}
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
          style={gl ? { opacity: 0 } : { left: '94%', top: '94%' }}
          className="absolute z-10 grid size-10 -translate-x-[calc(100%+12px)] -translate-y-[calc(100%+12px)] place-items-center rounded-full border border-[var(--border)] bg-[var(--bg)]/95 text-[var(--ink)] shadow-[0_6px_18px_-8px_rgba(29,58,154,0.5)] transition-opacity hover:border-[var(--ink)]"
        >
          {muted ? <VolumeX className="size-[18px]" aria-hidden /> : <Volume2 className="size-[18px]" aria-hidden />}
        </button>
      </div>
    </figure>
  )
}
