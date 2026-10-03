import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

interface ThreeOrbProps {
  className?: string
  progress?: number
  interactive?: boolean
}

export function ThreeOrb({ className = '', progress = 72, interactive = true }: ThreeOrbProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isInteracting, setIsInteracting] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const width = container.clientWidth || 240
    const height = container.clientHeight || 240

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
    camera.position.z = 4.4

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    // Main 3D Group for Drag Rotation
    const orbGroup = new THREE.Group()
    scene.add(orbGroup)

    // 2. Inner Glowing Core Sphere with Custom Shader Material for Iridescent Ripples
    const innerGeo = new THREE.SphereGeometry(1.08, 48, 48)
    const innerMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColorA: { value: new THREE.Color(0x7a63ff) }, // Violet
        uColorB: { value: new THREE.Color(0x38bdf8) }, // Cyan
        uColorC: { value: new THREE.Color(0xd946ef) }, // Magenta
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        uniform float uTime;

        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;

          // Organic pulsating vertex ripple displacement
          float wave = sin(position.x * 3.5 + uTime * 2.5) * cos(position.y * 3.5 + uTime * 2.0) * 0.045;
          vec3 newPos = position + normal * wave;

          gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        uniform float uTime;
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        uniform vec3 uColorC;

        void main() {
          // Fresnel rim lighting
          vec3 viewDir = normalize(-vPosition);
          float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 2.2);

          // Dynamic iridescent plasma blending
          float mixWave = sin(vPosition.y * 2.5 + uTime * 1.8) * 0.5 + 0.5;
          float mixWave2 = cos(vPosition.x * 2.5 + uTime * 1.4) * 0.5 + 0.5;

          vec3 baseColor = mix(uColorA, uColorB, mixWave);
          baseColor = mix(baseColor, uColorC, mixWave2 * 0.5);

          vec3 finalColor = baseColor + fresnel * 0.85;
          gl_FragColor = vec4(finalColor, 0.92);
        }
      `,
      transparent: true,
      blending: THREE.NormalBlending,
    })
    const innerMesh = new THREE.Mesh(innerGeo, innerMat)
    orbGroup.add(innerMesh)

    // 3. Outer Holographic Wireframe Cage
    const outerGeo = new THREE.IcosahedronGeometry(1.36, 4)
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0xc4b5fd,
      wireframe: true,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
    })
    const outerMesh = new THREE.Mesh(outerGeo, outerMat)
    orbGroup.add(outerMesh)

    // 4. Dual Counter-Rotating Gyroscopic Energy Rings
    const ringGeo = new THREE.TorusGeometry(1.72, 0.02, 16, 120)
    const ringMat1 = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
    })
    const ring1 = new THREE.Mesh(ringGeo, ringMat1)
    ring1.rotation.x = Math.PI / 2.8
    ring1.rotation.y = Math.PI / 5
    orbGroup.add(ring1)

    const ringMat2 = new THREE.MeshBasicMaterial({
      color: 0x60a5fa,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    })
    const ring2 = new THREE.Mesh(ringGeo, ringMat2)
    ring2.rotation.x = -Math.PI / 3.2
    ring2.rotation.y = Math.PI / 3.8
    ring2.scale.set(0.92, 0.92, 0.92)
    orbGroup.add(ring2)

    // 5. Swirling Particle Spiral & Energy Sparks
    const particleCount = 280
    const particleGeo = new THREE.BufferGeometry()
    const positions = new Float32Array(particleCount * 3)
    const colors = new Float32Array(particleCount * 3)
    const initialRadii = new Float32Array(particleCount)
    const angles = new Float32Array(particleCount)
    const speeds = new Float32Array(particleCount)

    const pColorViolet = new THREE.Color(0xb3a2ff)
    const pColorCyan = new THREE.Color(0x38bdf8)
    const pColorPink = new THREE.Color(0xf472b6)

    for (let i = 0; i < particleCount; i++) {
      const radius = 1.35 + Math.random() * 1.1
      initialRadii[i] = radius
      angles[i] = Math.random() * Math.PI * 2
      speeds[i] = 0.4 + Math.random() * 0.8

      const phi = Math.acos(Math.random() * 2 - 1)
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(angles[i])
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(angles[i])
      positions[i * 3 + 2] = radius * Math.cos(phi)

      const rand = Math.random()
      const c = rand < 0.45 ? pColorViolet : rand < 0.8 ? pColorCyan : pColorPink
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    // Particle circular glowing texture
    const pCanvas = document.createElement('canvas')
    pCanvas.width = 32
    pCanvas.height = 32
    const pCtx = pCanvas.getContext('2d')
    if (pCtx) {
      const grad = pCtx.createRadialGradient(16, 16, 0, 16, 16, 16)
      grad.addColorStop(0, 'rgba(255,255,255,1)')
      grad.addColorStop(0.3, 'rgba(180,150,255,0.8)')
      grad.addColorStop(1, 'rgba(0,0,0,0)')
      pCtx.fillStyle = grad
      pCtx.fillRect(0, 0, 32, 32)
    }
    const pTexture = new THREE.CanvasTexture(pCanvas)

    const particleMat = new THREE.PointsMaterial({
      size: 0.075,
      map: pTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const particleCloud = new THREE.Points(particleGeo, particleMat)
    orbGroup.add(particleCloud)

    // 6. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
    scene.add(ambientLight)

    const topLight = new THREE.PointLight(0xa78bfa, 2.8, 30)
    topLight.position.set(4, 5, 4)
    scene.add(topLight)

    const blueLight = new THREE.PointLight(0x38bdf8, 2.2, 30)
    blueLight.position.set(-4, -3, 3)
    scene.add(blueLight)

    // 7. Interactive Click-and-Drag Rotation with Inertia
    let isDragging = false
    let prevMouseX = 0
    let prevMouseY = 0
    let velocityX = 0
    let velocityY = 0
    const damping = 0.94 // Inertia damping friction

    const onPointerDown = (e: PointerEvent) => {
      if (!interactive) return
      isDragging = true
      setIsInteracting(true)
      prevMouseX = e.clientX
      prevMouseY = e.clientY
      velocityX = 0
      velocityY = 0
      container.setPointerCapture(e.pointerId)
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!interactive) return
      if (isDragging) {
        const deltaX = e.clientX - prevMouseX
        const deltaY = e.clientY - prevMouseY
        prevMouseX = e.clientX
        prevMouseY = e.clientY

        // Update rotation directly
        orbGroup.rotation.y += deltaX * 0.012
        orbGroup.rotation.x += deltaY * 0.012

        // Store velocity for inertia
        velocityX = deltaX * 0.012
        velocityY = deltaY * 0.012
      }
    }

    const onPointerUp = (e: PointerEvent) => {
      if (!interactive) return
      isDragging = false
      setIsInteracting(false)
      try {
        container.releasePointerCapture(e.pointerId)
      } catch {
        /* already released */
      }
    }

    container.addEventListener('pointerdown', onPointerDown)
    container.addEventListener('pointermove', onPointerMove)
    container.addEventListener('pointerup', onPointerUp)
    container.addEventListener('pointercancel', onPointerUp)

    // Resize Observer
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect
        if (w > 0 && h > 0) {
          camera.aspect = w / h
          camera.updateProjectionMatrix()
          renderer.setSize(w, h)
        }
      }
    })
    ro.observe(container)

    // Animation Loop
    let animationFrameId: number
    const clock = new THREE.Clock()

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate)
      const elapsed = clock.getElapsedTime()

      // Update shader uniform
      innerMat.uniforms.uTime.value = elapsed

      // Apply Inertia physics when released
      if (!isDragging) {
        orbGroup.rotation.y += velocityX
        orbGroup.rotation.x += velocityY

        // Friction damping
        velocityX *= damping
        velocityY *= damping

        // Ambient gentle spin when settled
        orbGroup.rotation.y += 0.005
        orbGroup.rotation.x = THREE.MathUtils.lerp(orbGroup.rotation.x, Math.sin(elapsed * 0.4) * 0.1, 0.03)
      }

      // Gyro rings internal spin
      ring1.rotation.z = elapsed * 0.4
      ring2.rotation.z = -elapsed * 0.32

      // Outer holographic shell counter-rotation
      outerMesh.rotation.y = -elapsed * 0.15
      outerMesh.rotation.x = Math.cos(elapsed * 0.25) * 0.15

      // Orbit particles around sphere
      const posArr = particleGeo.attributes.position.array as Float32Array
      for (let i = 0; i < particleCount; i++) {
        angles[i] += speeds[i] * 0.015
        const r = initialRadii[i] + Math.sin(elapsed * 2.0 + i) * 0.08
        const ix = i * 3
        posArr[ix] = r * Math.cos(angles[i])
        posArr[ix + 1] = r * Math.sin(angles[i] * 0.8)
      }
      particleGeo.attributes.position.needsUpdate = true

      renderer.render(scene, camera)
    }

    animate()

    return () => {
      cancelAnimationFrame(animationFrameId)
      ro.disconnect()
      container.removeEventListener('pointerdown', onPointerDown)
      container.removeEventListener('pointermove', onPointerMove)
      container.removeEventListener('pointerup', onPointerUp)
      container.removeEventListener('pointercancel', onPointerUp)
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
      innerGeo.dispose()
      innerMat.dispose()
      outerGeo.dispose()
      outerMat.dispose()
      ringGeo.dispose()
      ringMat1.dispose()
      ringMat2.dispose()
      particleGeo.dispose()
      particleMat.dispose()
      pTexture.dispose()
      renderer.dispose()
    }
  }, [interactive])

  return (
    <div className={`relative flex flex-col items-center justify-center select-none ${className}`}>
      {/* 3D Canvas Container */}
      <div
        ref={containerRef}
        className={`size-[210px] sm:size-[230px] touch-none cursor-grab active:cursor-grabbing transition-transform ${
          isInteracting ? 'scale-105' : 'hover:scale-[1.02]'
        }`}
        title="Click & drag to rotate 3D orb"
      />

      {/* Center 72% Glowing Badge Overlay */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center justify-center">
          <span className="text-[28px] sm:text-[30px] font-bold tracking-tight text-white drop-shadow-[0_0_20px_rgba(168,133,255,1)]">
            {progress}%
          </span>
          <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-accent drop-shadow-[0_0_10px_rgba(143,124,255,0.8)]">
            Synthesizing
          </span>
        </div>
      </div>

      {/* Interactive Helper Hint */}
      <div className="mt-0.5 text-[10px] font-mono text-fg-subtle flex items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
        <span className="inline-block size-1.5 rounded-full bg-accent animate-ping" />
        <span>Click & drag 360° to rotate</span>
      </div>
    </div>
  )
}
