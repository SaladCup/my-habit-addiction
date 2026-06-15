import { useEffect, useMemo, useRef, useState, Suspense } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Physics, RigidBody, BallCollider, TrimeshCollider, CuboidCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { PILE_POSITIONS, PILE_ROTATIONS } from './pilePositions.js'

// Real-time version of the Blender hero jar (blender/jar_glass.py): the rounded
// pink-glass jar with pearls + satin bow. Beads you've ALREADY seen are placed
// instantly at a baked settled pile (scripts/bake-pile.mjs) — so the jar looks
// identical every reload with no re-pour and no escapees. Only a NEWLY earned
// bead physically drops in and plunks onto the pile. Idles at ~zero cost: once
// the new bead settles, physics pauses and the canvas stops re-rendering.

// (radius, height) silhouette — same profile as the Blender jar, Y-up here.
const PROFILE = [
  [0.001, 0.0], [0.55, 0.0], [0.72, 0.05], [0.80, 0.16], [0.84, 0.45],
  [0.85, 0.95], [0.84, 1.28], [0.78, 1.50], [0.62, 1.66], [0.50, 1.74],
  [0.48, 1.82], [0.50, 1.90], [0.47, 1.93],
]
// EMPIRICALLY sized (scripts/jar-capacity-test.mjs, real rapier sim): at
// R=0.086 the jar holds 600 beads to the shoulder — so ~1 month of 6-8
// habits/day (~210) is ~1/3 of capacity, and the pile visibly grows for months.
const BEAD_R = 0.086
const MAX_BEADS = 600          // measured capacity; oldest beyond this are dropped (jar stays full)
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
// The app's slot colors are soft pastels — under the bright studio env they
// wash out, but over-deepening reads as opaque "playpen balls". Middle ground:
// modest saturation/darkness boost + a translucent marble body below.
function deepen(hex) {
  const c = new THREE.Color(hex)
  const hsl = {}
  c.getHSL(hsl)
  c.setHSL(hsl.h, Math.min(1, hsl.s * 1.25 + 0.04), Math.max(0.3, hsl.l * 0.85))
  return c
}
// soft pastel hue sweep for the RAINBOW wild-card bead (one tiny texture, ever)
let _rainbowTex = null
function rainbowTexture() {
  if (_rainbowTex) return _rainbowTex
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  // PURELY vertical sweep with the FULL spectrum compressed into the visible
  // band (v 0.15–0.85) — face-on you see every hue, not just the pale middle.
  // Vertical = color depends only on latitude, so the sphere's UV wrap edges
  // match exactly (any horizontal drift shows as a hard seam line).
  // True-rainbow stops: pastels washed to white through the marble glass.
  const grad = g.createLinearGradient(0, 0, 0, 64)
  const stops = ['#FF5C9E', '#FF9D4D', '#FFE34D', '#4DD97E', '#3FAFFF', '#8F6BFF', '#F060D0']
  stops.forEach((s, i) => grad.addColorStop(0.15 + 0.7 * (i / (stops.length - 1)), s))
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  _rainbowTex = new THREE.CanvasTexture(c)
  _rainbowTex.colorSpace = THREE.SRGBColorSpace
  return _rainbowTex
}

// glossy crystal marble base: light passes through (transmission), an
// opalescent film shifts color at glancing angles (iridescence), and a hard
// clearcoat gives the glassy highlight. Cost only while the pile is awake —
// physics + render pause when settled.
const MARBLE = {
  metalness: 0, roughness: 0.05,
  transmission: 0.55, thickness: 0.09, ior: 1.45,
  iridescence: 0.45, iridescenceIOR: 1.3, iridescenceThicknessRange: [120, 400],
  clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 0.8,
}
const beadMatCache = new Map()
function beadMat(hex, isGold, isRainbow) {
  const key = isGold ? 'g' : isRainbow ? 'r' : 'c' + hex
  if (!beadMatCache.has(key)) {
    beadMatCache.set(key, new THREE.MeshPhysicalMaterial(isGold
      ? { color: GOLD_HEX, metalness: 0.8, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.1 }
      : isRainbow
        // wild card: hue sweep + extra opalescence; less transmission so the
        // spectrum doesn't white out through the glass body
        ? { ...MARBLE, color: '#FFFFFF', map: rainbowTexture(), iridescence: 0.65, transmission: 0.3 }
        : { ...MARBLE, color: deepen(hex) }))
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
  // slightly more pink, and more matte / less env-reflection so the low-poly
  // bow's imperfect normals stop throwing bluish specular specks; double-sided
  // so any gaps left by the heavy decimation read as bow, not see-through holes.
  color: '#F58CB6', roughness: 0.52, clearcoat: 0.22, clearcoatRoughness: 0.3,
  sheen: 1, sheenColor: '#FFD9E8', envMapIntensity: 0.45, side: THREE.DoubleSide,
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

// Already-seen beads: rendered INSTANTLY at the baked settled pile (no physics,
// no pour). One fixed body carries all their colliders so a freshly-dropped bead
// still lands on top of the pile and plunks naturally.
function StaticPile({ beads }) {
  if (beads.length === 0) return null
  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        {beads.map((b, i) => {
          const p = PILE_POSITIONS[i]
          return p ? <BallCollider key={b.id} args={[BEAD_R]} position={p} /> : null
        })}
      </RigidBody>
      {beads.map((b, i) => {
        const p = PILE_POSITIONS[i]
        if (!p) return null
        return (
          <mesh key={b.id} geometry={beadGeo} material={beadMat(b.color, b.isGold, b.isRainbow)}
            position={p} quaternion={PILE_ROTATIONS[i] || [0, 0, 0, 1]} scale={BEAD_R} />
        )
      })}
    </>
  )
}

// A NEWLY earned bead: spawned just above the neck and dropped with real physics
// onto the static pile. Tight spawn + low bounce so it can't miss the jar.
function DropBead({ bead, register }) {
  const s = useMemo(() => {
    const h = idHash(bead.id, 0), h2 = idHash(bead.id, 7), h3 = idHash(bead.id, 13)
    return {
      // ±0.15 around centre, low over the neck → drops straight in (no rim bounce)
      pos: [(h - 0.5) * 0.30, 2.12 + h3 * 0.10, (h2 - 0.5) * 0.30],
      rot: [h * 6.28, h2 * 6.28, h3 * 6.28],
    }
  }, [bead.id])
  return (
    <RigidBody colliders={false} position={s.pos} rotation={s.rot} ccd
      ref={api => register(bead.id, api)}
      restitution={0.18} friction={0.6} linearDamping={0.4} angularDamping={0.85}>
      <BallCollider args={[BEAD_R]} />
      <mesh geometry={beadGeo} material={beadMat(bead.color, bead.isGold, bead.isRainbow)} scale={BEAD_R} />
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

function Scene({ staticBeads, newBeads, release, onWake, onSettled }) {
  // staticBeads: already-seen → instant baked pile. newBeads: earned since last
  // view → drop in. UNCONTROLLED (home): auto-drip one at a time. CONTROLLED
  // (`release` is a number, cash-in screen): drop exactly `release` of them, so
  // each marble lands the instant its PNG pops.
  const controlled = release != null
  const [autoReleased, setAutoReleased] = useState(0)
  const autoRef = useRef(0)
  const bodies = useRef(new Map())
  const register = useMemo(() => (id, api) => {
    if (api) bodies.current.set(id, api)
    else bodies.current.delete(id)
  }, [])
  useEffect(() => {
    if (controlled) return
    if (newBeads.length === autoRef.current) return
    onWake()
    const id = setInterval(() => {
      autoRef.current = Math.min(newBeads.length, autoRef.current + 1)
      setAutoReleased(autoRef.current)
      onWake()
      if (autoRef.current >= newBeads.length) clearInterval(id)
    }, 260)
    return () => clearInterval(id)
  }, [newBeads.length, onWake, controlled])

  const released = controlled ? Math.min(release, newBeads.length) : autoReleased
  // wake physics whenever a controlled drop is released (so the new marble falls)
  useEffect(() => { if (controlled && released > 0) onWake() }, [controlled, released, onWake])

  const droppers = newBeads.slice(0, released)
  return (
    <>
      <StudioEnv />
      <ambientLight intensity={0.45} />
      <directionalLight position={[2.5, 6, 4]} intensity={1.7} />
      <directionalLight position={[-3, 2, 2]} intensity={0.5} />
      <Jar />
      <Pearls />
      <Suspense fallback={null}><Bow /></Suspense>
      <StaticPile beads={staticBeads} />
      {droppers.map(b => <DropBead key={b.id} bead={b} register={register} />)}
      <SettleWatch bodies={bodies} busy={released < newBeads.length} onSettled={onSettled} />
    </>
  )
}

// beads: full jar contents [{ id, color, isGold, isRainbow }] oldest→newest.
// seenCount: how many of those have already been shown settled (persisted) — the
// rest drop in. onSeen: called once the new beads finish settling (persist seen).
// release: optional — when a number, drop exactly that many new beads (the
// cash-in screen drives this so each marble lands as its PNG pops). Omit on Home.
export default function BeadJar3D({ beads, seenCount = 0, onSeen, release, width = 150, height = 218 }) {
  const [active, setActive] = useState(true)
  const onWake = useMemo(() => () => setActive(true), [])
  const handleSettled = useMemo(() => () => { setActive(false); onSeen?.() }, [onSeen])

  // window the display to the newest MAX_BEADS (jar holds 600; older roll under)
  const win = beads.length > MAX_BEADS ? beads.slice(beads.length - MAX_BEADS) : beads
  const offset = beads.length - win.length
  // How many windowed beads were already seen — CAPTURED ONCE at mount, so
  // earning a bead mid-session only drops the NEW one (the pile never reshuffles).
  const [seenAtMount] = useState(() => Math.max(0, Math.min(win.length, seenCount - offset)))
  const staticBeads = win.slice(0, seenAtMount)
  const newBeads = win.slice(seenAtMount)

  return (
    <div style={{ width, height, pointerEvents: 'none' }}>
      <Canvas
        frameloop={active ? 'always' : 'demand'}
        camera={{ position: [0, 1.34, 5.2], fov: 30 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: 'transparent', pointerEvents: 'none' }}
        onCreated={({ gl, camera }) => {
          gl.domElement.style.pointerEvents = 'none'
          // frame the glass HIGH in the canvas: the bead-count label needs clear
          // air under the glass bottom, and beads spawning above the frame top
          // appear to fall in from behind the title art that overlaps the canvas
          camera.lookAt(0, 0.72, 0)
        }}>
        <Suspense fallback={null}>
          <Physics gravity={[0, -14, 0]} paused={!active} numSolverIterations={8} numAdditionalFrictionIterations={4}>
            <Scene staticBeads={staticBeads} newBeads={newBeads} release={release} onWake={onWake} onSettled={handleSettled} />
          </Physics>
        </Suspense>
      </Canvas>
    </div>
  )
}

useGLTF.preload('/models/bow_low.glb')
