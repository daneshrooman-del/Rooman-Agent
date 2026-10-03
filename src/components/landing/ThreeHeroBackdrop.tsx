import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export function ThreeHeroBackdrop() {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000)
    camera.position.z = 400

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    container.appendChild(renderer.domElement)

    // Grid of interactive particles
    const particleCount = 400
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(particleCount * 3)
    const scales = new Float32Array(particleCount)
    const colors = new Float32Array(particleCount * 3)

    const color1 = new THREE.Color('#8f7cff') // purple accent
    const color2 = new THREE.Color('#4361ee') // blue
    const color3 = new THREE.Color('#a855f7') // violet

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 1200
      positions[i * 3 + 1] = (Math.random() - 0.5) * 800
      positions[i * 3 + 2] = (Math.random() - 0.5) * 600

      scales[i] = Math.random() * 2.5 + 1

      const choice = Math.random()
      const c = choice < 0.4 ? color1 : choice < 0.8 ? color2 : color3
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    // Particle texture
    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 32
    const ctx = canvas.getContext('2d')
    if (ctx) {
      const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)')
      grad.addColorStop(0.3, 'rgba(160, 140, 255, 0.7)')
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, 32, 32)
    }
    const texture = new THREE.CanvasTexture(canvas)

    const material = new THREE.PointsMaterial({
      size: 16,
      map: texture,
      vertexColors: true,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })

    const pointCloud = new THREE.Points(geometry, material)
    scene.add(pointCloud)

    // Mouse responsiveness
    let mouseX = 0
    let mouseY = 0
    let targetX = 0
    let targetY = 0

    const handleMouseMove = (e: MouseEvent) => {
      const halfW = window.innerWidth / 2
      const halfH = window.innerHeight / 2
      mouseX = (e.clientX - halfW) * 0.15
      mouseY = (e.clientY - halfH) * 0.15
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })

    const handleResize = () => {
      if (!container) return
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }

    window.addEventListener('resize', handleResize)

    let reqId: number
    const clock = new THREE.Clock()

    const animate = () => {
      reqId = requestAnimationFrame(animate)
      const elapsed = clock.getElapsedTime()

      targetX += (mouseX - targetX) * 0.05
      targetY += (mouseY - targetY) * 0.05

      pointCloud.rotation.y = elapsed * 0.03 + targetX * 0.001
      pointCloud.rotation.x = Math.sin(elapsed * 0.02) * 0.05 + targetY * 0.001

      const pos = geometry.attributes.position.array as Float32Array
      for (let i = 0; i < particleCount; i++) {
        // Subtle organic undulation
        const ix = i * 3
        pos[ix + 1] += Math.sin(elapsed * 1.5 + i) * 0.2
      }
      geometry.attributes.position.needsUpdate = true

      renderer.render(scene, camera)
    }

    animate()

    return () => {
      cancelAnimationFrame(reqId)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('resize', handleResize)
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
      geometry.dispose()
      material.dispose()
      texture.dispose()
      renderer.dispose()
    }
  }, [])

  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-60 transition-opacity duration-1000"
    />
  )
}
