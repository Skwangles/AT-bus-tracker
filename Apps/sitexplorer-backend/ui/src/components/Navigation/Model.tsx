import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { GLTF } from 'three-stdlib'
import * as THREE from 'three'
type GLTFResult = GLTF & {
  nodes: {
    ['Node-Mesh']: THREE.Mesh
    ['Node-Mesh_1']: THREE.Mesh
  }
  materials: {
    mat8: THREE.MeshStandardMaterial
    mat23: THREE.MeshStandardMaterial
  }
  position: { x: number; y: number; z: number }
  onClick: (event) => void
}

const Model: React.FC<JSX.IntrinsicElements['group']> = (props) => {
  const refs = useRef<THREE.Group>(null)

  useFrame((state, delta) => {
    if (refs && refs.current && refs.current.rotation) {
      refs.current.rotation.y += delta
    }
  })

  const { nodes, materials } = useGLTF('/marker.glb') as GLTFResult
  return (
    <group {...props} dispose={null} ref={refs}>
      <mesh
        scale={3}
        geometry={nodes['Node-Mesh'].geometry}
        material={materials.mat8}
      />
      <mesh
        scale={3}
        geometry={nodes['Node-Mesh_1'].geometry}
        material={materials.mat23}
      />
    </group>
  )
}

useGLTF.preload('/marker.glb')

export default Model
