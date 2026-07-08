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
function faceTexture(img, { rot = 0, mirror = false } = {}) {
  const S = 512
  const cv = document.createElement('canvas'); cv.width = cv.height = S
  const c = cv.getContext('2d')
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

  return (
    <group ref={group} rotation={[Math.PI / 2, 0, 0]}>
      <mesh>
        <cylinderGeometry args={[1, 1, 0.14, 64]} />
        {/* Edge: metallic gold (standard material, no map). Faces: BASIC materials
            — the art's lighting is baked in, and MeshStandardMaterial+map hits a
            'uvundefined' shader failure under this three/R3F combo. Don't "fix"
            the faces back to standard. */}
        <meshStandardMaterial attach="material-0" color="#D9A93C" metalness={0.85} roughness={0.45} />
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
          tails: faceTexture(t, { rot: Math.PI / 2, mirror: true }),
        })
      } catch { /* plain gold coin fallback */ }
    })()
    return () => { dead = true }
  }, [])

  const dpr = useMemo(() => Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1), [])

  return (
    <div style={{ width: size, height: size }}>
      <Canvas dpr={dpr} camera={{ position: [0, 0, 3.8], fov: 42 }} gl={{ alpha: true, antialias: true }}>
        <StudioEnv />
        <ambientLight intensity={0.7} />
        <directionalLight position={[2.4, 3.5, 3]} intensity={1.3} />
        <directionalLight position={[-2.5, 1, 2]} intensity={0.4} color="#FFD9EC" />
        <Coin landed={landed} flipKey={flipKey} faces={faces} />
      </Canvas>
    </div>
  )
}
