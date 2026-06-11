import { useEffect, useMemo, useRef, useState, Suspense } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Physics, RigidBody, BallCollider, TrimeshCollider, CuboidCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

// Real-time version of the Blender hero jar (blender/jar_glass.py): the rounded
// pink-glass jar with pearls + satin bow, where every bead you earn physically
// drops in, plunks, and piles up. On mount the current jar refills quickly;
// when a new bead is earned just that one falls. Idles at ~zero cost: once the
// pile settles, physics pauses and the canvas stops re-rendering.

// (radius, height) silhouette — same profile as the Blender jar, Y-up here.
const PROFILE = [
  [0.001, 0.0], [0.55, 0.0], [0.72, 0.05], [0.80, 0.16], [0.84, 0.45],
  [0.85, 0.95], [0.84, 1.28], [0.78, 1.50], [0.62, 1.66], [0.50, 1.74],
  [0.48, 1.82], [0.50, 1.90], [0.47, 1.93],
]
const BEAD_R = 0.095
const MAX_BEADS = 220          // physics bodies cap (oldest beads beyond this are dropped)
const GOLD_HEX = '#F5C04A'

function profR(y) {
  if (y <= PROFILE[0][1]) return PROFILE[0][0]
  for (let i = 0; i < PROFILE.length - 1; i++) {
    const [r0, y0] = PROFILE[i], [r1, y1] = PROFILE[i + 1]
    if (y >= y0 && y <= y1) return y1 === y0 ? r0 : r0 + (r1 - r0) * ((y - y0) / (y1 - y0))
  }
  return PROFILE[PROFILE.length - 1][0]
}

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

// ---- shared geometries/materials (module-level: one of each, ever) ----
const beadGeo = new THREE.SphereGeometry(1, 20, 14)
const pearlGeo = new THREE.SphereGeometry(1, 16, 12)
// The app's slot colors are soft pastels — under the bright studio env +
// clearcoat they wash out against the white sunburst. Deepen: boost saturation,
// pull lightness down. Works for any custom slot color picked in Settings.
function deepen(hex) {
  const c = new THREE.Color(hex)
  const hsl = {}
  c.getHSL(hsl)
  c.setHSL(hsl.h, Math.min(1, hsl.s * 1.55 + 0.06), Math.max(0.18, hsl.l * 0.72))
  return c
}
const beadMatCache = new Map()
function beadMat(hex, isGold) {
  const key = (isGold ? 'g' : 'c') + hex
  if (!beadMatCache.has(key)) {
    beadMatCache.set(key, new THREE.MeshPhysicalMaterial(isGold
      ? { color: GOLD_HEX, metalness: 0.8, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.1 }
      : { color: deepen(hex), metalness: 0, roughness: 0.09, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 0.7 }))
  }
  return beadMatCache.get(key)
}
const pearlMat = new THREE.MeshPhysicalMaterial({
  color: '#F4F0EE', roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.8,
})
const glassMat = new THREE.MeshPhysicalMaterial({
  // thinner film than v1 (0.34 washed the beads behind it toward white)
  color: '#FFB9D0', transparent: true, opacity: 0.22, roughness: 0.05,
  clearcoat: 1, clearcoatRoughness: 0.03, side: THREE.DoubleSide,
  depthWrite: false, envMapIntensity: 1.4,
})
const satinMat = new THREE.MeshPhysicalMaterial({
  color: '#F9A8C5', roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.18,
  sheen: 1, sheenColor: '#FFD9E8', envMapIntensity: 0.9,
})

function Jar() {
  const { glassGeo, collVerts, collIndices } = useMemo(() => {
    const pts = PROFILE.map(([r, y]) => new THREE.Vector2(r, y))
    const glassGeo = new THREE.LatheGeometry(pts, 48)
    // collider: the INTERIOR surface (inset by glass wall), incl. bottom disc
    const inner = PROFILE.map(([r, y]) => new THREE.Vector2(Math.max(0.001, r - 0.06), Math.max(y, 0.05)))
    const collGeo = new THREE.LatheGeometry(inner, 24)
    return {
      glassGeo,
      collVerts: collGeo.attributes.position.array,
      // rapier wants Uint32 indices; three uses Uint16 for small geometries
      collIndices: new Uint32Array(collGeo.index.array),
    }
  }, [])
  return (
    <>
      {/* beads render first; glass draws over them with alpha (renderOrder) */}
      <mesh geometry={glassGeo} material={glassMat} renderOrder={3} />
      <RigidBody type="fixed" colliders={false}>
        <TrimeshCollider args={[collVerts, collIndices]} friction={0.5} restitution={0.1} />
        {/* primitive safety floor under the jar — a bead can never fall off-world */}
        <CuboidCollider args={[3, 0.25, 3]} position={[0, -0.27, 0]} />
      </RigidBody>
    </>
  )
}

function Pearls() {
  const ring = useMemo(() => {
    const y = 1.79, pr = 0.052
    const ringR = profR(y) + pr * 0.8
    const n = Math.round((2 * Math.PI * ringR) / (pr * 2.05))
    return Array.from({ length: n }, (_, i) => {
      const a = (2 * Math.PI * i) / n
      return [ringR * Math.cos(a), y, ringR * Math.sin(a)]
    // leave a gap at the front (+Z) where the bow sits
    }).filter(([x, , z]) => !(z > 0 && Math.abs(Math.atan2(x, z)) < 0.55))
  }, [])
  return ring.map((p, i) => (
    <mesh key={i} geometry={pearlGeo} material={pearlMat} position={p} scale={0.052} />
  ))
}

function Bow() {
  const { scene } = useGLTF('/models/bow_low.glb')
  const bow = useMemo(() => {
    const c = scene.clone(true)
    c.traverse(o => { if (o.isMesh) { o.material = satinMat; o.castShadow = false } })
    return c
  }, [scene])
  // GLB is ~0.53 wide, facing +Z. Sits PROUD of the neck glass (front surface
  // ~z=0.52 at this height) like the approved Blender placement — z=0.46 buried
  // its back half inside the jar wall.
  return <primitive object={bow} position={[0, 1.72, 0.60]} scale={1.15} rotation={[0.30, 0, 0]} />
}

// deterministic hash of the bead's id → stable spawn pose no matter where the
// bead sits in the array (index-based seeds teleported settled beads whenever
// the render window slid past MAX_BEADS)
function idHash(str, salt) {
  let h = 2166136261 ^ salt
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return ((h >>> 0) % 10000) / 10000          // 0..1
}

function Bead({ bead, register }) {
  const s = useMemo(() => {
    const h = idHash(bead.id, 0), h2 = idHash(bead.id, 7), h3 = idHash(bead.id, 13)
    return {
      // ±0.22 keeps every drop radially inside the neck opening (~0.33 usable);
      // wider jitter bounced beads off the rim and OUT of the jar
      pos: [(h - 0.5) * 0.44, 2.3 + h3 * 0.12, (h2 - 0.5) * 0.44],
      rot: [h * 6.28, h2 * 6.28, h3 * 6.28],
    }
  }, [bead.id])
  return (
    <RigidBody colliders={false} position={s.pos} rotation={s.rot} ccd
      ref={api => register(bead.id, api)}
      restitution={0.3} friction={0.55} linearDamping={0.35} angularDamping={0.8}>
      <BallCollider args={[BEAD_R]} />
      <mesh geometry={beadGeo} material={beadMat(bead.color, bead.isGold)} scale={BEAD_R} />
    </RigidBody>
  )
}

// Pause physics + rendering only when the pile has REALLY settled (all bodies
// asleep) — a wall-clock timer can freeze beads mid-air if the tab is throttled.
function SettleWatch({ bodies, busy, onSettled }) {
  const tick = useRef(0)
  useFrame(() => {
    if (busy) return
    if ((tick.current = (tick.current + 1) % 30) !== 0) return
    let all = true
    bodies.current.forEach(api => { if (api && !api.isSleeping()) all = false })
    if (all) onSettled()        // empty jar settles too — else it renders forever
  })
  return null
}

function Scene({ beads, onWake, onSettled }) {
  // `released` counts beads ever dropped into the scene (this mount). The spawn
  // window is the last MAX_BEADS of those — so cash-ins keep plunking past the
  // cap (a capped-length prop deadlocked: length stopped changing at the cap).
  const [released, setReleased] = useState(0)
  const releasedRef = useRef(0)
  const bodies = useRef(new Map())
  const register = useMemo(() => (id, api) => {
    if (api) bodies.current.set(id, api)
    else bodies.current.delete(id)
  }, [])
  useEffect(() => {
    if (beads.length < releasedRef.current) {       // jar emptied (reset)
      releasedRef.current = 0; setReleased(0); bodies.current.clear()
    }
    if (beads.length === releasedRef.current) return
    const initialFill = releasedRef.current === 0 && beads.length > 1
    const interval = initialFill ? 34 : 240
    onWake()
    const id = setInterval(() => {
      releasedRef.current = Math.min(beads.length, releasedRef.current + 1)
      setReleased(releasedRef.current)
      onWake()
      if (releasedRef.current >= beads.length) clearInterval(id)
    }, interval)
    return () => clearInterval(id)
  }, [beads.length, onWake])

  const visible = beads.slice(Math.max(0, released - MAX_BEADS), released)
  return (
    <>
      <StudioEnv />
      <ambientLight intensity={0.45} />
      <directionalLight position={[2.5, 6, 4]} intensity={1.7} />
      <directionalLight position={[-3, 2, 2]} intensity={0.5} />
      <Jar />
      <Pearls />
      <Suspense fallback={null}><Bow /></Suspense>
      {visible.map(b => <Bead key={b.id} bead={b} register={register} />)}
      <SettleWatch bodies={bodies} busy={released < beads.length} onSettled={onSettled} />
    </>
  )
}

// beads: full jar contents [{ id, color, isGold }] oldest→newest (uncapped —
// Scene windows the physics bodies to the newest MAX_BEADS itself)
export default function BeadJar3D({ beads, width = 150, height = 218 }) {
  const [active, setActive] = useState(true)
  const onWake = useMemo(() => () => setActive(true), [])
  const onSettled = useMemo(() => () => setActive(false), [])

  return (
    <div style={{ width, height, pointerEvents: 'none' }}>
      <Canvas
        frameloop={active ? 'always' : 'demand'}
        camera={{ position: [0, 1.42, 5.2], fov: 30 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: 'transparent', pointerEvents: 'none' }}
        onCreated={({ gl, camera }) => {
          gl.domElement.style.pointerEvents = 'none'
          camera.lookAt(0, 0.92, 0)
        }}>
        <Suspense fallback={null}>
          <Physics gravity={[0, -14, 0]} paused={!active} numSolverIterations={8} numAdditionalFrictionIterations={4}>
            <Scene beads={beads} onWake={onWake} onSettled={onSettled} />
          </Physics>
        </Suspense>
      </Canvas>
    </div>
  )
}

useGLTF.preload('/models/bow_low.glb')
