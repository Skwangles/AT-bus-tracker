import { useThree } from '@react-three/fiber'
import { useRef, useEffect } from 'react'
import { Euler } from 'three'
import { HotspotObj, MoveDirectionType } from '../../types'
import * as THREE from 'three'
import { moveDirection } from '../../utils/moveDirection'
import { toast } from 'react-toastify'

interface CameraRotationControlsProps {
  hotspots: HotspotObj[]
  setCurrentId: (id: string) => void
  camRotation: React.MutableRefObject<{ yaw: number; pitch: number }>
  isCreatingPoint?: boolean // New prop to disable WASD controls during point creation
}

const CameraRotationControls: React.FC<CameraRotationControlsProps> = ({
  hotspots,
  setCurrentId,
  camRotation,
  isCreatingPoint = false, // Default to false
}) => {
  const { camera, gl } = useThree()
  const hotspotsRef = useRef(hotspots)

  useEffect(() => {
    hotspotsRef.current = hotspots
  }, [hotspots])

  const controlsRef = useRef({
    isMouseDown: false,
    startX: 0,
    startY: 0,
    rotationSpeed: 0.002,
    initialPitch: camRotation.current['pitch'],
    initialYaw: camRotation.current['yaw'],
    euler: new Euler(
      camRotation.current['pitch'] ?? 0,
      camRotation.current['yaw'] ?? 0,
      0,
      'YXZ'
    ), // Initialize Euler with initial rotation
  })

  const DEFAULT_SPEED = 0.01
  const INTERVAL_TIMEOUT = 5
  const speed = useRef(DEFAULT_SPEED)
  const speedIntervalUpDown = useRef<NodeJS.Timeout>()
  const speedIntervalLeftRight = useRef<NodeJS.Timeout>()
  const keyDown = useRef<string>('')

  const protectFromFlippingPitch = (nextX) => {
    // Limit pitch to avoid flipping
    return Math.max(-Math.PI / 2, Math.min(Math.PI / 2, nextX))
  }

  useEffect(() => {
    camera.rotation.copy(controlsRef.current.euler)
  }, [camera])

  const cancelUpDownInterval = () => {
    clearInterval(speedIntervalUpDown.current)
  }

  const cancelLeftRightInterval = () => {
    clearInterval(speedIntervalLeftRight.current)
  }

  const cancelInterval = () => {
    cancelLeftRightInterval()
    cancelUpDownInterval()
    speed.current = DEFAULT_SPEED
  }

  const actionMoveDirection = (
    direction: MoveDirectionType,
    camera: THREE.Camera,
    hotspots: HotspotObj[]
  ) => {
    const id = moveDirection(direction, camera, hotspots)
    if (id) {
      setCurrentId(id)
    } else {
      toast.warn('No point found in the given direction (WASD keys)')
    }
  }

  const handleKeyDown = (event) => {
    // Skip if creating a point - disable WASD controls
    if (isCreatingPoint) {
      return
    }

    // Moves camera left or right based on arrow keys
    // Slowly increases speed as key is held down
    // Then set the interval to move the camera as long as the key is held down
    console.log('keyDown', event.key, keyDown.current)
    const validKeys = [
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'w',
      's',
      'a',
      'd',
    ]
    if (!validKeys.includes(event.key)) return

    const isUpDown = event.key == 'ArrowUp' || event.key == 'ArrowDown'
    const isCurrentKeyUpDown =
      keyDown.current == 'ArrowUp' || keyDown.current == 'ArrowDown'

    if (isUpDown == isCurrentKeyUpDown && keyDown.current != event.key) {
      if (isUpDown) {
        cancelUpDownInterval()
      } else {
        cancelLeftRightInterval()
      }
    }

    keyDown.current = event.key

    if (event.key === 'ArrowLeft') {
      cancelLeftRightInterval()
      speedIntervalLeftRight.current = setInterval(() => {
        camera.rotation.y += speed.current
        camRotation.current = {
          yaw: camera.rotation.y,
          pitch: camera.rotation.x,
        }
      }, INTERVAL_TIMEOUT)
    } else if (event.key === 'ArrowRight') {
      cancelLeftRightInterval()
      speedIntervalLeftRight.current = setInterval(() => {
        camera.rotation.y -= speed.current
        camRotation.current = {
          yaw: camera.rotation.y,
          pitch: camera.rotation.x,
        }
      }, INTERVAL_TIMEOUT)
    } else if (event.key === 'ArrowUp') {
      cancelUpDownInterval()
      speedIntervalUpDown.current = setInterval(() => {
        camera.rotation.x = protectFromFlippingPitch(
          camera.rotation.x + speed.current
        )
        camRotation.current = {
          yaw: camera.rotation.y,
          pitch: camera.rotation.x,
        }
      }, INTERVAL_TIMEOUT)
    } else if (event.key === 'ArrowDown') {
      cancelUpDownInterval()
      speedIntervalUpDown.current = setInterval(() => {
        camera.rotation.x = protectFromFlippingPitch(
          camera.rotation.x - speed.current
        )
        camRotation.current = {
          yaw: camera.rotation.y,
          pitch: camera.rotation.x,
        }
      }, INTERVAL_TIMEOUT)
    }
    // WASD movements on moveDirection
    else if (event.key === 'w') {
      actionMoveDirection(
        MoveDirectionType.Forward,
        camera,
        hotspotsRef.current
      )
    } else if (event.key === 's') {
      actionMoveDirection(
        MoveDirectionType.Backward,
        camera,
        hotspotsRef.current
      )
    } else if (event.key === 'a') {
      actionMoveDirection(MoveDirectionType.Left, camera, hotspotsRef.current)
    } else if (event.key === 'd') {
      actionMoveDirection(MoveDirectionType.Right, camera, hotspotsRef.current)
    } else {
      cancelInterval()
    }
  }

  const handleKeyUp = (event) => {
    console.log('keyUp', event.key, keyDown.current)
    if (event.key === keyDown.current) {
      cancelInterval()
    }
  }

  useEffect(() => {
    // Keyboard controls
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      cancelInterval()
    }
  }, [isCreatingPoint]) // Add isCreatingPoint to dependencies to update event handlers

  useEffect(() => {
    const handleMouseDown = (event) => {
      cancelInterval()
      controlsRef.current.isMouseDown = true
      controlsRef.current.startX = event.clientX
      controlsRef.current.startY = event.clientY
    }

    const handleMouseUp = () => {
      controlsRef.current.isMouseDown = false
    }

    const handleMouseLeave = () => {
      controlsRef.current.isMouseDown = false
    }

    const handleTouchStart = (event) => {
      cancelInterval()
      controlsRef.current.isMouseDown = true
      controlsRef.current.startX = event.touches[0].clientX
      controlsRef.current.startY = event.touches[0].clientY
    }

    const handleMouseMove = (event) => {
      if (!controlsRef.current.isMouseDown) return

      const currentX = event.clientX
      const currentY = event.clientY
      const deltaX = currentX - controlsRef.current.startX
      const deltaY = currentY - controlsRef.current.startY

      controlsRef.current.startX = currentX
      controlsRef.current.startY = currentY

      // Update Euler rotation
      controlsRef.current.euler.y += deltaX * controlsRef.current.rotationSpeed
      controlsRef.current.euler.x += deltaY * controlsRef.current.rotationSpeed

      // Limit pitch to avoid flipping
      controlsRef.current.euler.x = protectFromFlippingPitch(
        controlsRef.current.euler.x
      )

      camera.rotation.copy(controlsRef.current.euler)
      camRotation.current = {
        yaw: controlsRef.current.euler.y,
        pitch: controlsRef.current.euler.x,
      }
    }

    const handleTouchMove = (event) => {
      if (!controlsRef.current.isMouseDown || event.touches.length !== 1) return

      const currentX = event.touches[0].clientX
      const currentY = event.touches[0].clientY
      const deltaX = currentX - controlsRef.current.startX
      const deltaY = currentY - controlsRef.current.startY

      controlsRef.current.startX = currentX
      controlsRef.current.startY = currentY

      // Update Euler rotation
      controlsRef.current.euler.y += deltaX * controlsRef.current.rotationSpeed
      controlsRef.current.euler.x += deltaY * controlsRef.current.rotationSpeed

      // Limit pitch to avoid flipping
      controlsRef.current.euler.x = Math.max(
        -Math.PI / 2,
        Math.min(Math.PI / 2, controlsRef.current.euler.x)
      )

      camera.rotation.copy(controlsRef.current.euler)
      camRotation.current = {
        yaw: controlsRef.current.euler.y,
        pitch: controlsRef.current.euler.x,
      }
    }

    const handleTouchEnd = () => {
      controlsRef.current.isMouseDown = false
    }

    // Mouse controls
    gl.domElement.addEventListener('mousedown', handleMouseDown)
    gl.domElement.addEventListener('mousemove', handleMouseMove)
    gl.domElement.addEventListener('mouseup', handleMouseUp)
    gl.domElement.addEventListener('mouseleave', handleMouseLeave)

    // Touch controls
    gl.domElement.addEventListener('touchstart', handleTouchStart)
    gl.domElement.addEventListener('touchmove', handleTouchMove)
    gl.domElement.addEventListener('touchend', handleTouchEnd)
    gl.domElement.addEventListener('touchcancel', handleTouchEnd)

    return () => {
      gl.domElement.removeEventListener('mousedown', handleMouseDown)
      gl.domElement.removeEventListener('mousemove', handleMouseMove)
      gl.domElement.removeEventListener('mouseup', handleMouseUp)
      gl.domElement.removeEventListener('mouseleave', handleMouseLeave)

      gl.domElement.removeEventListener('touchstart', handleTouchStart)
      gl.domElement.removeEventListener('touchmove', handleTouchMove)
      gl.domElement.removeEventListener('touchend', handleTouchEnd)
      gl.domElement.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [camera, gl.domElement])

  return null
}

export default CameraRotationControls
