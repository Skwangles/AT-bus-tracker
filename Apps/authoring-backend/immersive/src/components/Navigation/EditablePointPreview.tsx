import React, { useRef, useEffect } from 'react'
import { TransformControls } from '@react-three/drei'
import { useThree, useFrame } from '@react-three/fiber'
import { ThreeNumbersArray } from '../../types'
import * as THREE from 'three'
import { SPHERE_SIZE } from '../../consts'

interface EditablePointPreviewProps {
  position: ThreeNumbersArray
  onPositionChange: (newPosition: ThreeNumbersArray) => void
}

const EditablePointPreview: React.FC<EditablePointPreviewProps> = ({
  position,
  onPositionChange,
}) => {
  const meshRef = useRef<THREE.Mesh>(null)
  const transformRef = useRef(null)
  const { camera, gl } = useThree()
  const isDraggingRef = useRef(false)

  // Update position when the transform controls are used and
  // disable camera rotation during dragging
  useEffect(() => {
    if (transformRef.current) {
      const handleDraggingChanged = (event: { value: boolean }) => {
        // When dragging starts/ends, this event fires with event.value = true/false
        const domElement = gl.domElement
        isDraggingRef.current = event.value

        if (event.value) {
          // Dragging started - disable camera controls
          domElement.style.pointerEvents = 'none'
        } else {
          // Dragging ended - re-enable camera controls
          domElement.style.pointerEvents = 'auto'
        }
      }

      const controls = transformRef.current as unknown as {
        addEventListener: (
          event: string,
          callback: (event: { value: boolean }) => void
        ) => void
        removeEventListener: (
          event: string,
          callback: (event: { value: boolean }) => void
        ) => void
      }

      controls.addEventListener('dragging-changed', handleDraggingChanged)
      return () => {
        controls.removeEventListener('dragging-changed', handleDraggingChanged)
      }
    }
  }, [gl])

  // Use useFrame to continuously update position during rendering
  useFrame(() => {
    if (meshRef.current) {
      const newPos = meshRef.current.position.toArray() as ThreeNumbersArray
      onPositionChange(newPos)
    }
  })

  return (
    <>
      {/* Preview sphere */}
      <mesh ref={meshRef} position={position} castShadow>
        <sphereGeometry args={[SPHERE_SIZE * 1.5, 32, 32]} />
        <meshStandardMaterial color="#00FF00" transparent opacity={0.7} />
      </mesh>

      {/* Transform controls - locked to translate mode */}
      <TransformControls
        ref={transformRef}
        object={meshRef.current || undefined}
        mode="translate"
        size={0.75}
        camera={camera}
        translationSnap={0.5} // Optional: snap to 0.5 unit increments for more precise positioning
      />
    </>
  )
}

export default EditablePointPreview
