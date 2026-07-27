'use client'
import { useRef, useState, useEffect } from 'react'

interface SignatureCanvasProps {
  onSignatureChange: (dataUrl: string | null) => void
  height?: number
}

// Captures a hand-drawn signature via pointer events (works for mouse, touch,
// and pen) and exports it as a base64 PNG data URL through onSignatureChange.
export function SignatureCanvas({ onSignatureChange, height = 160 }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const hasStrokes = useRef(false)
  const [isEmpty, setIsEmpty] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const ratio = window.devicePixelRatio || 1
      canvas.width = rect.width * ratio
      canvas.height = rect.height * ratio
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.scale(ratio, ratio)
        ctx.lineWidth = 2
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.strokeStyle = '#0f172a'
      }
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.setPointerCapture(e.pointerId)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawing.current = true
    const { x, y } = getPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = getPos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    hasStrokes.current = true
  }

  function handlePointerUp() {
    if (!drawing.current) return
    drawing.current = false
    if (hasStrokes.current && canvasRef.current) {
      setIsEmpty(false)
      onSignatureChange(canvasRef.current.toDataURL('image/png'))
    }
  }

  function clear() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    hasStrokes.current = false
    setIsEmpty(true)
    onSignatureChange(null)
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        style={{ height, touchAction: 'none' }}
        className="w-full rounded-lg border-2 border-dashed border-slate-300 bg-white cursor-crosshair"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      <div className="flex items-center justify-between mt-1.5">
        <p className="text-xs text-gray-400">Dibuja tu firma arriba</p>
        <button type="button" onClick={clear} disabled={isEmpty} className="text-xs font-medium text-[#1B4965] hover:underline disabled:text-gray-300 disabled:no-underline">
          Borrar
        </button>
      </div>
    </div>
  )
}
