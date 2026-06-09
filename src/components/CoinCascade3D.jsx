import { useEffect, useMemo, useState, useRef, Suspense } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { Physics, RigidBody, CylinderCollider, CuboidCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

// Real 3D physics coin shower. Each coin is a flat low-poly cylinder (a disk)
// whose face detail (rings + heart) comes from a NORMAL MAP — so the relief is
// smooth and sharp, the geometry is tiny (fast for a screenful), and one shared
// light + reflection environment lights every coin consistently. They tumble,
// show their edges, and stack like real coins.

const COIN_S = 0.6          // coin radius (world units)
const GOLD = '#F0C04B'

function StudioEnv() {
  const { scene, gl } = useThree()
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = envTex
    return () => { envTex.dispose(); pmrem.dispose() }
  }, [scene, gl])
  return null
}

function useCoin() {
  const normal = useTexture('/ui/coin_normal.png')
  return useMemo(() => {
    normal.colorSpace = THREE.NoColorSpace      // raw normal data, not sRGB
    normal.anisotropy = 4
    const geo = new THREE.CylinderGeometry(1, 1, 0.17, 64, 1)   // groups: 0 side, 1 top, 2 bottom
    const cap = new THREE.MeshStandardMaterial({ color: GOLD, metalness: 1, roughness: 0.3, normalMap: normal, envMapIntensity: 1.15 })
    cap.normalScale.set(1.6, 1.6)               // flip a sign here if the heart reads as pushed-in
    const edge = new THREE.MeshStandardMaterial({ color: GOLD, metalness: 1, roughness: 0.34, envMapIntensity: 1.15 })
    return { geo, mats: [edge, cap, cap], radius: COIN_S, halfH: 0.085 * COIN_S }
  }, [normal])
}

const WAVE_SPEED = 2.2   // cannon sweep speed (rad/s) — a left↔right↔left wave ~every 2.9s

function Coin({ coin, bw, bh, idx, interval }) {
  // an invisible cannon ABOVE the screen sweeps left↔right and fires one coin at
  // a time. Each coin's spawn x follows the sweep; it shoots out in the sweep
  // direction + downward, so the stream waves across as it pours.
  const s = useMemo(() => {
    const phase = (idx * interval / 1000) * WAVE_SPEED
    const f = ((phase / (2 * Math.PI)) % 1 + 1) % 1      // 0..1 through one sweep cycle
    const cannonX = (f < 0.5 ? 4 * f - 1 : 3 - 4 * f) * bw * 0.98   // TRIANGLE → even speed, no edge dwell
    const dir = f < 0.5 ? 1 : -1                          // current sweep direction
    return {
      pos: [cannonX, bh + 2.6, (Math.random() - 0.5) * 1.0],
      lin: [dir * 3.5 + (Math.random() - 0.5) * 1.4, -2.5 - Math.random() * 2, (Math.random() - 0.5) * 1.0],
      ang: [(Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8],
      rot: [Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28],
    }
  }, [idx, interval, bw, bh])
  return (
    <RigidBody colliders={false} position={s.pos} rotation={s.rot}
      linearVelocity={s.lin} angularVelocity={s.ang}
      restitution={0.04} friction={0.95} angularDamping={0.7} linearDamping={0.06}>
      <CylinderCollider args={[coin.halfH, coin.radius]} />
      <mesh geometry={coin.geo} material={coin.mats} scale={COIN_S} />
    </RigidBody>
  )
}

function OrthoFit({ bh }) {
  const { camera, size } = useThree()
  useEffect(() => {
    camera.zoom = size.height / (2 * bh)
    camera.position.set(0, 0, 40)
    camera.updateProjectionMatrix()
  }, [camera, size, bh])
  return null
}

function Scene({ count, bw, bh }) {
  const coin = useCoin()
  // ONE coin at a time. Slow + distinct for small wins; for big wins the rate
  // tightens so it still finishes in a few seconds (and reads as a pour).
  const interval = useMemo(() => Math.max(24, Math.min(110, Math.round(5200 / count))), [count])
  const [n, setN] = useState(0)
  useEffect(() => {
    let i = 0
    const id = setInterval(() => { i += 1; setN(Math.min(count, i)); if (i >= count) clearInterval(id) }, interval)
    return () => clearInterval(id)
  }, [count, interval])

  return (
    <>
      <StudioEnv />
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 9, 7]} intensity={2.4} />
      <directionalLight position={[-5, 3, 4]} intensity={0.7} />
      <Physics gravity={[0, -24, 0]} numSolverIterations={10} numAdditionalFrictionIterations={6}>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[bw + 2, 0.5, 4]} position={[0, -bh - 0.5, 0]} />
          <CuboidCollider args={[0.5, bh * 2, 4]} position={[-bw - 0.5, 0, 0]} />
          <CuboidCollider args={[0.5, bh * 2, 4]} position={[bw + 0.5, 0, 0]} />
          <CuboidCollider args={[bw + 2, bh * 2, 0.5]} position={[0, 0, -1.6]} />
          <CuboidCollider args={[bw + 2, bh * 2, 0.5]} position={[0, 0, 1.6]} />
        </RigidBody>
        {Array.from({ length: n }).map((_, i) => <Coin key={i} idx={i} interval={interval} coin={coin} bw={bw} bh={bh} />)}
      </Physics>
    </>
  )
}

export default function CoinCascade3D({ count = 60, onDone }) {
  const ref = useRef(null)
  const [box, setBox] = useState(null)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const aspect = (el.clientWidth || 1) / (el.clientHeight || 1)
    const bh = 9
    setBox({ bw: bh * aspect, bh })
    if (onDone) { const t = setTimeout(onDone, 8000); return () => clearTimeout(t) }
  }, [])
  return (
    // absolute/inset:0 — anchors to the nearest positioned ancestor. The host
    // screen must NOT wrap this in a position:relative box, or the floor (canvas
    // bottom) won't reach the real bottom of the visible area. On RewardScreen
    // it anchors to .screen so coins settle at the true card bottom.
    <div ref={ref} style={{ position: 'absolute', inset: 0, zIndex: 40, pointerEvents: 'none' }}>
      {box && (
        <Canvas orthographic camera={{ position: [0, 0, 40], near: 0.1, far: 200 }}
          gl={{ alpha: true, antialias: true }} style={{ background: 'transparent', pointerEvents: 'none' }}
          onCreated={({ gl }) => { gl.domElement.style.pointerEvents = 'none' }}>
          <Suspense fallback={null}>
            <OrthoFit bh={box.bh} />
            <Scene count={count} bw={box.bw} bh={box.bh} />
          </Suspense>
        </Canvas>
      )}
    </div>
  )
}

useTexture.preload('/ui/coin_normal.png')
