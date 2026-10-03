import { useState, useRef, type ReactNode, type MouseEvent } from 'react'

interface TiltCardProps {
  children: ReactNode
  className?: string
  maxTilt?: number
  scale?: number
  glare?: boolean
}

export function TiltCard({
  children,
  className = '',
  maxTilt = 7,
  scale = 1.015,
  glare = true,
}: TiltCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState('')
  const [glareStyle, setGlareStyle] = useState({ opacity: 0, x: '50%', y: '50%' })

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current
    if (!card) return

    const rect = card.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const centerX = rect.width / 2
    const centerY = rect.height / 2

    // Normalize from -1 to 1
    const normX = (x - centerX) / centerX
    const normY = (y - centerY) / centerY

    const tiltX = -normY * maxTilt
    const tiltY = normX * maxTilt

    setTransform(`perspective(1000px) rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg) scale3d(${scale}, ${scale}, ${scale})`)

    if (glare) {
      setGlareStyle({
        opacity: 0.22,
        x: `${((x / rect.width) * 100).toFixed(1)}%`,
        y: `${((y / rect.height) * 100).toFixed(1)}%`,
      })
    }
  }

  const handleMouseLeave = () => {
    setTransform('perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)')
    setGlareStyle((prev) => ({ ...prev, opacity: 0 }))
  }

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform,
        transition: transform ? 'transform 0.12s ease-out' : 'transform 0.5s ease-out',
        transformStyle: 'preserve-3d',
      }}
      className={`relative will-change-transform ${className}`}
    >
      {children}
      {glare && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] overflow-hidden transition-opacity duration-300"
          style={{
            opacity: glareStyle.opacity,
            background: `radial-gradient(circle 320px at ${glareStyle.x} ${glareStyle.y}, rgba(255, 255, 255, 0.18), transparent 70%)`,
          }}
        />
      )}
    </div>
  )
}
