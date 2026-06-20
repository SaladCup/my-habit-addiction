import { useRef, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrthographicCamera } from '@react-three/drei'
import { Physics, RigidBody, BallCollider, CuboidCollider } from '@react-three/rapier'
import {
  BUCKETS, BUCKET_MULTS, PEG_R, BALL_R, REST, FRICTION, GRAV_Y,
  TOP_PEG_Y, BOTTOM_PEG_Y, SPAWN_Y, FLOOR_Y, HALF_W,
  DIVIDER_HALF_W, DIVIDER_REST, DIVIDER_CAP_R, DIVIDER_CAP_REST, DIVIDER_CAP_FRICTION,
  pegPositions, dividerXs, bucketForX,
} from './plinkoBoard.js'

const Z_HALF = BALL_R + 0.06
const MID_Y = (SPAWN_Y + FLOOR_Y) / 2
const VIEW_Y = (TOP_PEG_Y + FLOOR_Y) / 2 - 0.3   // camera look-at: centers pegs+buckets
const BW = (HALF_W * 2) / BUCKETS
const bColor = m => m >= 2 ? 0xff6b6b : m >= 1.5 ? 0xf2933c : m >= 1 ? 0xf2c94c : m >= 0.7 ? 0xc8b4e0 : 0x8e7fb0

function Pegs() {
  const pegs = pegPositions()
  return (
    <RigidBody type="fixed" colliders={false}>
      {pegs.map(([x, y], i) => <BallCollider key={'c' + i} args={[PEG_R]} position={[x, y, 0]} restitution={REST} friction={FRICTION} />)}
      {pegs.map(([x, y], i) => (
        <mesh key={'m' + i} position={[x, y, 0]}>
          <sphereGeometry args={[PEG_R * 1.25, 16, 16]} />
          <meshStandardMaterial color="#FFFBEC" emissive="#FFCE6A" emissiveIntensity={0.85} roughness={0.35} toneMapped={false} />
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
      {/* colored bucket floors (visual — match the multiplier strip) */}
      {BUCKET_MULTS.map((m, i) => (
        <mesh key={'b' + i} position={[-HALF_W + BW * (i + 0.5), FLOOR_Y + 0.42, 0]}>
          <boxGeometry args={[BW * 0.9, 0.82, Z_HALF * 1.9]} />
          <meshStandardMaterial color={bColor(m)} emissive={bColor(m)} emissiveIntensity={0.85} toneMapped={false} />
        </mesh>
      ))}
      {/* bucket dividers (collider + gold post). A rounded ball cap on top means a marble
          can't balance on the flat edge — it rolls off into a bucket. */}
      {divs.map((x, i) => (
        <group key={i}>
          <CuboidCollider args={[DIVIDER_HALF_W, dHalfH, Z_HALF]} position={[x, dCenterY, 0]} restitution={DIVIDER_REST} />
          <BallCollider args={[DIVIDER_CAP_R]} position={[x, dCenterY + dHalfH, 0]} restitution={DIVIDER_CAP_REST} friction={DIVIDER_CAP_FRICTION} />
          <mesh position={[x, dCenterY, 0]}>
            <boxGeometry args={[0.09, dHalfH * 2, 0.16]} />
            <meshStandardMaterial color="#E0A800" emissive="#9A6A00" emissiveIntensity={0.3} />
          </mesh>
        </group>
      ))}
    </RigidBody>
  )
}

function Ball({ spawnX, onLand }) {
  const ref = useRef(null)
  const landed = useRef(false)
  const still = useRef(0)
  useFrame(() => {
    const rb = ref.current
    if (!rb || landed.current) return
    const p = rb.translation(), v = rb.linvel()
    const slow = Math.abs(v.x) < 0.15 && Math.abs(v.y) < 0.15
    // Only count "stillness" once the ball is BELOW the last peg row — i.e. committed to a
    // bucket column. A brief pause wedged in the pegs mid-board must NOT resolve the round
    // (that reported the WRONG hole); only down here is bucketForX(x) the column it fell into.
    const inBucketZone = p.y < BOTTOM_PEG_Y
    still.current = (slow && inBucketZone) ? still.current + 1 : 0
    // Settle when it comes to rest on the bucket floor, OR once it's sat still in the bucket
    // zone for ~0.4s (a marble balanced on a divider resolves into the bucket it's over).
    if ((slow && p.y <= FLOOR_Y + BALL_R + 0.16) || still.current > 24) {
      landed.current = true
      onLand(bucketForX(p.x))
    }
  })
  return (
    <RigidBody ref={ref} colliders={false} position={[spawnX, SPAWN_Y, 0]} ccd linearDamping={0.05} angularDamping={0.4}>
      <BallCollider args={[BALL_R]} restitution={REST} friction={FRICTION} density={1.2} />
      <mesh>
        <sphereGeometry args={[BALL_R * 1.15, 28, 28]} />
        <meshStandardMaterial color="#FFB3DC" emissive="#FF5AA0" emissiveIntensity={0.6} roughness={0.18} metalness={0.2} toneMapped={false} />
      </mesh>
    </RigidBody>
  )
}

// dropId: bump to drop a new ball. spawnX: per-drop horizontal jitter (drives the outcome).
// frameloop stays 'always' + physics always steps, so the marble falls smoothly (toggling
// the loop made the first step after a gap jump straight to the bottom — the "nothing
// happened" bug). Only one ball exists at a time (keyed by dropId), so the idle cost is tiny.
export default function Plinko3D({ dropId, spawnX, onLand }) {
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      frameloop="always"
      style={{ width: '100%', height: '100%' }}
    >
      <OrthographicCamera makeDefault position={[0, VIEW_Y, 12]} zoom={47} near={0.1} far={100} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[3, 6, 8]} intensity={1.4} />
      <directionalLight position={[-4, -2, 4]} intensity={0.4} />
      {/* dark board backdrop so pegs/ball pop */}
      <mesh position={[0, MID_Y, -0.6]}>
        <planeGeometry args={[HALF_W * 2 + 1.2, SPAWN_Y - FLOOR_Y + 2]} />
        <meshStandardMaterial color="#3A2B52" roughness={0.9} />
      </mesh>
      <Suspense fallback={null}>
        <Physics gravity={[0, GRAV_Y, 0]} timeStep={1 / 60} numSolverIterations={8}>
          <Pegs />
          <Statics />
          {/* key={dropId} so EACH drop is a FRESH Ball — without it the component persists
              and its `landed` ref stays true after the first drop, so every later ball never
              detects its landing (resolved only by the 5s safety net → always center bucket). */}
          {dropId > 0 && <Ball key={dropId} spawnX={spawnX} onLand={onLand} />}
        </Physics>
      </Suspense>
    </Canvas>
  )
}
