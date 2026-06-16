import { useRef, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Physics, RigidBody, BallCollider, CuboidCollider } from '@react-three/rapier'
import {
  PEG_R, BALL_R, REST, FRICTION, GRAV_Y,
  TOP_PEG_Y, BOTTOM_PEG_Y, SPAWN_Y, FLOOR_Y, HALF_W,
  pegPositions, dividerXs, bucketForX,
} from './plinkoBoard.js'

const Z_HALF = BALL_R + 0.06
const MID_Y = (SPAWN_Y + FLOOR_Y) / 2

function Pegs() {
  const pegs = pegPositions()
  return (
    <RigidBody type="fixed" colliders={false}>
      {pegs.map(([x, y], i) => <BallCollider key={'c' + i} args={[PEG_R]} position={[x, y, 0]} restitution={REST} friction={FRICTION} />)}
      {pegs.map(([x, y], i) => (
        <mesh key={'m' + i} position={[x, y, 0]}>
          <sphereGeometry args={[PEG_R, 14, 14]} />
          <meshStandardMaterial color="#FFF6E0" emissive="#FFD98A" emissiveIntensity={0.45} roughness={0.4} />
        </mesh>
      ))}
    </RigidBody>
  )
}

function Statics() {
  const divs = dividerXs()
  const dCenterY = (FLOOR_Y + BOTTOM_PEG_Y) / 2
  const dHalfH = Math.abs(BOTTOM_PEG_Y - FLOOR_Y) / 2 + 0.1
  return (
    <RigidBody type="fixed" colliders={false}>
      {/* containment: sides + thin front/back slab keeps it 2D */}
      <CuboidCollider args={[0.2, 8, 1]} position={[-HALF_W - 0.2, TOP_PEG_Y - 4, 0]} restitution={0.3} />
      <CuboidCollider args={[0.2, 8, 1]} position={[HALF_W + 0.2, TOP_PEG_Y - 4, 0]} restitution={0.3} />
      <CuboidCollider args={[HALF_W + 1, 8, 0.2]} position={[0, TOP_PEG_Y - 4, -Z_HALF - 0.2]} />
      <CuboidCollider args={[HALF_W + 1, 8, 0.2]} position={[0, TOP_PEG_Y - 4, Z_HALF + 0.2]} />
      <CuboidCollider args={[HALF_W + 1, 0.2, Z_HALF + 0.5]} position={[0, FLOOR_Y - 0.2, 0]} restitution={0.1} friction={0.6} />
      {/* bucket dividers (collider + slim gold post) */}
      {divs.map((x, i) => (
        <group key={i}>
          <CuboidCollider args={[0.03, dHalfH, Z_HALF]} position={[x, dCenterY, 0]} restitution={0.2} />
          <mesh position={[x, dCenterY, 0]}>
            <boxGeometry args={[0.06, dHalfH * 2, 0.12]} />
            <meshStandardMaterial color="#E0A800" emissive="#9A6A00" emissiveIntensity={0.25} />
          </mesh>
        </group>
      ))}
    </RigidBody>
  )
}

function Ball({ dropId, spawnX, onLand }) {
  const ref = useRef(null)
  const landed = useRef(false)
  useFrame(() => {
    const rb = ref.current
    if (!rb || landed.current) return
    const p = rb.translation(), v = rb.linvel()
    if (p.y <= FLOOR_Y + BALL_R + 0.12 && Math.abs(v.x) < 0.12 && Math.abs(v.y) < 0.12) {
      landed.current = true
      onLand(bucketForX(p.x))
    }
  })
  return (
    <RigidBody ref={ref} key={dropId} colliders={false} position={[spawnX, SPAWN_Y, 0]} ccd linearDamping={0.05} angularDamping={0.4}>
      <BallCollider args={[BALL_R]} restitution={REST} friction={FRICTION} density={1.2} />
      <mesh>
        <sphereGeometry args={[BALL_R, 24, 24]} />
        <meshStandardMaterial color="#FF8FC6" emissive="#E0508F" emissiveIntensity={0.25} roughness={0.25} metalness={0.1} />
      </mesh>
    </RigidBody>
  )
}

// dropId: bump to drop a new ball. spawnX: per-drop horizontal jitter (drives the outcome).
export default function Plinko3D({ dropId, spawnX, onLand, active }) {
  return (
    <Canvas
      orthographic
      camera={{ position: [0, MID_Y, 12], zoom: 42, near: 0.1, far: 100 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      frameloop={active ? 'always' : 'demand'}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 6, 8]} intensity={1.4} />
      <directionalLight position={[-4, -2, 4]} intensity={0.4} />
      {/* dark board backdrop so pegs/ball pop */}
      <mesh position={[0, MID_Y, -0.6]}>
        <planeGeometry args={[HALF_W * 2 + 1.2, SPAWN_Y - FLOOR_Y + 2]} />
        <meshStandardMaterial color="#3A2B52" roughness={0.9} />
      </mesh>
      <Suspense fallback={null}>
        <Physics gravity={[0, GRAV_Y, 0]} paused={!active} numSolverIterations={8}>
          <Pegs />
          <Statics />
          {dropId > 0 && <Ball dropId={dropId} spawnX={spawnX} onLand={onLand} />}
        </Physics>
      </Suspense>
    </Canvas>
  )
}
