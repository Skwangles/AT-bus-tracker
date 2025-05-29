import { useThree } from "@react-three/fiber"
import { useEffect } from "react"
import * as THREE from "three"

interface CameraPositionGetterProps {
  setCameraRef: (camera: THREE.Camera) => void
}

const CameraPositionGetter: React.FC<CameraPositionGetterProps> = ({ setCameraRef }) => {
  const { camera } = useThree()

  useEffect(() => {
    setCameraRef(camera)
  }, [camera, setCameraRef])

  return null
}

export default CameraPositionGetter 