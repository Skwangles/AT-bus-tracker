import React, { useState, useRef, useCallback } from 'react'

interface SelectionBoxProps {
  onSelectionChange: (selectedIds: Set<string>) => void
  children: React.ReactNode
  className?: string
}

interface SelectionRect {
  startX: number
  startY: number
  endX: number
  endY: number
}

const SelectionBox: React.FC<SelectionBoxProps> = ({
  onSelectionChange,
  children,
  className = ''
}) => {
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const getSelectionBounds = useCallback(() => {
    if (!selectionRect) return null

    const left = Math.min(selectionRect.startX, selectionRect.endX)
    const top = Math.min(selectionRect.startY, selectionRect.endY)
    const right = Math.max(selectionRect.startX, selectionRect.endX)
    const bottom = Math.max(selectionRect.startY, selectionRect.endY)

    return { left, top, right, bottom }
  }, [selectionRect])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start selection if it's a left click and not on a point
    if (e.button !== 0 || (e.target as HTMLElement).closest('[data-point-id]')) {
      return
    }

    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return

    const startX = e.clientX - rect.left
    const startY = e.clientY - rect.top

    setIsSelecting(true)
    setSelectionRect({ startX, startY, endX: startX, endY: startY })
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isSelecting || !containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const currentX = e.clientX - rect.left
    const currentY = e.clientY - rect.top

    setSelectionRect(prev => prev ? {
      ...prev,
      endX: currentX,
      endY: currentY
    } : null)
  }, [isSelecting])

  const handleMouseUp = useCallback(() => {
    if (!isSelecting) return

    setIsSelecting(false)
    
    const bounds = getSelectionBounds()
    if (!bounds || !containerRef.current) {
      setSelectionRect(null)
      return
    }

    // Find all points within the selection bounds
    const points = containerRef.current.querySelectorAll('[data-point-id]')
    const newSelectedIds = new Set<string>()

    points.forEach(point => {
      const pointElement = point as HTMLElement
      const pointRect = pointElement.getBoundingClientRect()
      const containerRect = containerRef.current!.getBoundingClientRect()

      const pointX = pointRect.left - containerRect.left + pointRect.width / 2
      const pointY = pointRect.top - containerRect.top + pointRect.height / 2

      if (pointX >= bounds.left && pointX <= bounds.right &&
          pointY >= bounds.top && pointY <= bounds.bottom) {
        const pointId = pointElement.getAttribute('data-point-id')
        if (pointId) {
          newSelectedIds.add(pointId)
        }
      }
    })

    onSelectionChange(newSelectedIds)
    setSelectionRect(null)
  }, [isSelecting, getSelectionBounds, onSelectionChange])

  const getSelectionBoxStyle = () => {
    if (!selectionRect) return { display: 'none' }

    const bounds = getSelectionBounds()
    if (!bounds) return { display: 'none' }

    return {
      position: 'absolute' as const,
      left: bounds.left,
      top: bounds.top,
      width: bounds.right - bounds.left,
      height: bounds.bottom - bounds.top,
      border: '2px dashed #007bff',
      backgroundColor: 'rgba(0, 123, 255, 0.1)',
      pointerEvents: 'none' as const,
      zIndex: 1000
    }
  }

  return (
    <div
      ref={containerRef}
      className={`selection-container ${className}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ position: 'relative', userSelect: 'none' }}
    >
      {children}
      
      {isSelecting && (
        <div style={getSelectionBoxStyle()} />
      )}

      <style>{`
        .selection-container {
          position: relative;
          user-select: none;
        }

        .selection-container * {
          user-select: none;
        }

        .selection-container[data-selecting="true"] {
          cursor: crosshair;
        }
      `}</style>
    </div>
  )
}

export default SelectionBox 