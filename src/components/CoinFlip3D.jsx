import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

// ── The 3D coin for Coin Flip ─────────────────────────────────────────────────
// Lauren's pre-embossed coin faces (public/coin/heads.png = Habit-Chan portrait,
// tails.png = the jar's bow) mapped straight onto a gold cylinder. The flip spins
// the coin end-over-end with a hop and lands on the already-decided face.

const FACE_ART = { heads: '/coin/heads.png', tails: '/coin/tails.png' }

// Gold is METAL — without an environment map a metallic material reflects
// nothing and renders near-black. Same trick as the bead jar: a generated
// RoomEnvironment (no network fetch, CSP-safe in the packaged app).
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

// WebGL contexts CAN be lost on a real machine (GPU sleep, driver reset, OS
// lock/unlock, too many tabs/windows) — without this, a lost context leaves the
// canvas permanently blank/gray. preventDefault() on the loss event is what
// tells the browser to actually attempt automatic restoration; three.js/R3F
// re-uploads textures & materials once 'webglcontextrestored' fires. We also
// force an immediate redraw on restore — if the flip animation already finished
// (dur=0, nothing scheduling new frames), nothing would otherwise repaint it.
function ContextGuard() {
  const { gl, invalidate } = useThree()
  useEffect(() => {
    const canvas = gl.domElement
    const onLost = (e) => e.preventDefault()
    const onRestored = () => invalidate()
    canvas.addEventListener('webglcontextlost', onLost, false)
    canvas.addEventListener('webglcontextrestored', onRestored, false)
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost, false)
      canvas.removeEventListener('webglcontextrestored', onRestored, false)
    }
  }, [gl, invalidate])
  return null
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// Draw a face onto a square canvas with an orientation fix: the cylinder-cap UVs
// don't put "image up" at "screen up" (and the bottom cap is seen from its back,
// so it also needs a horizontal mirror). Values tuned visually.
//
// The source art (Lauren's coin PNGs) has a TRANSPARENT margin around the
// circular medallion — MeshBasicMaterial ignores alpha unless the material is
// marked transparent, so those see-through pixels rendered as solid BLACK (the
// canvas's default fill). Fix: paint the same gold the cylinder's edge uses
// UNDER the art first, so the margin blends into the rim instead of going black.
const GOLD_UNDER = ['#F6DE8F', '#F2C94C', '#B5872A']   // light → mid → shadow, radial
function faceTexture(img, { rot = 0, mirror = false } = {}) {
  const S = 512
  const cv = document.createElement('canvas'); cv.width = cv.height = S
  const c = cv.getContext('2d')
  const g = c.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S * 0.5)
  g.addColorStop(0, GOLD_UNDER[0]); g.addColorStop(0.6, GOLD_UNDER[1]); g.addColorStop(1, GOLD_UNDER[2])
  c.fillStyle = g; c.fillRect(0, 0, S, S)
  c.translate(S / 2, S / 2)
  if (mirror) c.scale(-1, 1)
  c.rotate(rot)
  c.translate(-S / 2, -S / 2)
  c.drawImage(img, 0, 0, S, S)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  tex.channel = 0   // paranoia: 'uvundefined' shader errors mean a map without a UV channel
  return tex
}

// Reeded-edge illusion via a bump map: a tight vertical stripe pattern repeated
// many times around the cylinder's circumference (its side UV wraps u = theta).
// A real ridged silhouette would need custom edge geometry; this bump-mapped
// version reads convincingly under directional light and is much cheaper.
let _ridgeTex = null
function ridgeBumpTexture() {
  if (_ridgeTex) return _ridgeTex
  const W = 256, H = 32
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H
  const c = cv.getContext('2d')
  const stripes = 10   // repeats per texture tile; combined with repeat.x below
  const w = W / stripes
  for (let i = 0; i < stripes; i++) {
    const g = c.createLinearGradient(i * w, 0, (i + 1) * w, 0)
    g.addColorStop(0, '#111'); g.addColorStop(0.5, '#fff'); g.addColorStop(1, '#111')
    c.fillStyle = g; c.fillRect(i * w, 0, w, H)
  }
  const tex = new THREE.CanvasTexture(cv)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(9, 1)   // 9 tiles × 10 stripes = 90 ridges around the coin
  _ridgeTex = tex
  return tex
}

function Coin({ landed, flipKey, faces }) {
  const group = useRef(null)
  // rest pose: cap toward the camera. heads = +Y cap → rotation.x = PI/2;
  // tails adds a half turn so the bottom cap faces the viewer.
  const anim = useRef({ from: Math.PI / 2, to: Math.PI / 2, t0: 0, dur: 0 })

  useEffect(() => {
    if (!group.current) return
    const cur = anim.current.to
    const targetFace = landed === 'heads' ? 0 : Math.PI
    // spin 3 full end-over-end turns, then settle on the decided face
    const base = Math.ceil((cur - Math.PI / 2) / (Math.PI * 2)) * Math.PI * 2 + Math.PI / 2
    anim.current = { from: cur, to: base + Math.PI * 6 + targetFace, t0: performance.now(), dur: flipKey ? 950 : 0 }
  }, [flipKey, landed])

  useFrame(() => {
    const g = group.current
    if (!g) return
    const { from, to, t0, dur } = anim.current
    const t = dur ? Math.min(1, (performance.now() - t0) / dur) : 1
    const e = 1 - Math.pow(1 - t, 3)   // ease-out cubic
    g.rotation.x = from + (to - from) * e
    g.position.y = Math.sin(Math.PI * Math.min(t, 1)) * 0.55   // the hop
    g.rotation.z = Math.sin(e * Math.PI * 2) * 0.07            // slight wobble
  })

  const ridgeTex = useMemo(() => ridgeBumpTexture(), [])

  return (
    <group ref={group} rotation={[Math.PI / 2, 0, 0]}>
      <mesh>
        {/* 96 radial segments (was 64) — enough facets for the ridge bump map's
            lighting response to read as a reeded edge, not a smooth cylinder. */}
        <cylinderGeometry args={[1, 1, 0.14, 96]} />
        {/* Edge: metallic gold + a repeating stripe BUMP MAP around the
            circumference (cylinder side UV u = theta) — reads as a real reeded
            coin edge under directional light. Faces: BASIC materials — the art's
            lighting is baked in, and MeshStandardMaterial+map hits a
            'uvundefined' shader failure under this three/R3F combo. Don't "fix"
            the faces back to standard. */}
        <meshStandardMaterial attach="material-0" color="#D9A93C" metalness={0.85} roughness={0.4}
          bumpMap={ridgeTex} bumpScale={0.012} />
        <meshBasicMaterial attach="material-1" map={faces?.heads} color={faces ? '#FFFFFF' : '#F2C94C'} />
        <meshBasicMaterial attach="material-2" map={faces?.tails} color={faces ? '#FFFFFF' : '#E0B23E'} />
      </mesh>
    </group>
  )
}

export default function CoinFlip3D({ landed = 'heads', flipKey = 0, size = 176 }) {
  const [faces, setFaces] = useState(null)

  useEffect(() => {
    let dead = false
    ;(async () => {
      try {
        const [h, t] = await Promise.all([loadImage(FACE_ART.heads), loadImage(FACE_ART.tails)])
        if (!dead) setFaces({
          heads: faceTexture(h, { rot: -Math.PI / 2 }),
          // was reported upside-down: +180° from the previous rotation
          tails: faceTexture(t, { rot: -Math.PI / 2, mirror: true }),
        })
      } catch { /* plain gold coin fallback */ }
    })()
    return () => { dead = true }
  }, [])

  const dpr = useMemo(() => Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1), [])

  return (
    <div style={{ width: size, height: size }}>
      <Canvas dpr={dpr} camera={{ position: [0, 0, 3.8], fov: 42 }} gl={{ alpha: true, antialias: true }}>
        <ContextGuard />
        <StudioEnv />
        <ambientLight intensity={0.7} />
        <directionalLight position={[2.4, 3.5, 3]} intensity={1.3} />
        <directionalLight position={[-2.5, 1, 2]} intensity={0.4} color="#FFD9EC" />
        <Coin landed={landed} flipKey={flipKey} faces={faces} />
      </Canvas>
    </div>
  )
}
