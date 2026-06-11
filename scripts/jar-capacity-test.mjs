// Empirical jar capacity test — drops beads into the EXACT BeadJar3D collider
// (same profile, inset, safety floor, bead radius, damping) with real rapier
// physics in Node, and reports pile height vs bead count + total capacity.
//
//   node scripts/jar-capacity-test.mjs [beadRadius]
//
// Outputs a height curve (count → settled pile top, world units) used to place
// milestone lines so "pile touches the line" === "count reached".
import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'

const BEAD_R = parseFloat(process.argv[2] || '0.072')
const PROFILE = [
  [0.001, 0.0], [0.55, 0.0], [0.72, 0.05], [0.80, 0.16], [0.84, 0.45],
  [0.85, 0.95], [0.84, 1.28], [0.78, 1.50], [0.62, 1.66], [0.50, 1.74],
  [0.48, 1.82], [0.50, 1.90], [0.47, 1.93],
]
const FULL_Y = 1.60          // "full" = pile reaches the shoulder taper
const MAX_TEST = 1100
const BATCH = 25             // record height every BATCH beads

await RAPIER.init()
const world = new RAPIER.World({ x: 0, y: -14, z: 0 })

// jar interior collider — identical construction to BeadJar3D's Jar()
const inner = PROFILE.map(([r, y]) => new THREE.Vector2(Math.max(0.001, r - 0.06), Math.max(y, 0.05)))
const collGeo = new THREE.LatheGeometry(inner, 24)
const fixed = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
world.createCollider(
  RAPIER.ColliderDesc.trimesh(
    new Float32Array(collGeo.attributes.position.array),
    new Uint32Array(collGeo.index.array),
  ).setFriction(0.5).setRestitution(0.1),
  fixed,
)
world.createCollider(RAPIER.ColliderDesc.cuboid(3, 0.25, 3).setTranslation(0, -0.27, 0), fixed)

// same id-hash spawn jitter as the app (deterministic)
function idHash(i, salt) {
  let h = 2166136261 ^ salt
  const s = 'bead_' + i
  for (let k = 0; k < s.length; k++) { h ^= s.charCodeAt(k); h = Math.imul(h, 16777619) }
  return ((h >>> 0) % 10000) / 10000
}

const bodies = []
function spawn(i) {
  const h = idHash(i, 0), h2 = idHash(i, 7), h3 = idHash(i, 13)
  const rb = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation((h - 0.5) * 0.44, 2.3 + h3 * 0.12, (h2 - 0.5) * 0.44)
      .setLinearDamping(0.35).setAngularDamping(0.8).setCcdEnabled(true)
  )
  world.createCollider(RAPIER.ColliderDesc.ball(BEAD_R).setFriction(0.55).setRestitution(0.3).setDensity(1), rb)
  bodies.push(rb)
}

function pileTop() {
  let top = 0
  for (const b of bodies) {
    const p = b.translation()
    // only count beads actually inside the jar footprint (not escapees)
    if (p.x * p.x + p.z * p.z < 1.0 && p.y > top) top = p.y
  }
  return top + BEAD_R
}
function escaped() {
  let n = 0
  for (const b of bodies) {
    const p = b.translation()
    if (p.y < -0.05 || p.x * p.x + p.z * p.z > 1.2) n++
  }
  return n
}

console.log(`bead R=${BEAD_R}  (jar inner belly r≈0.79, neck r≈0.42)`)
console.log('count\tpileTop\t%full')
const curve = []
let capacityAt = null
outer:
for (let n = 0; n < MAX_TEST; n += BATCH) {
  // pour BATCH beads, one every 5 steps (~12/s)
  for (let i = 0; i < BATCH; i++) {
    spawn(n + i)
    for (let s = 0; s < 5; s++) world.step()
  }
  // settle: step until pile is calm (or 360 steps ≈ 6s)
  for (let s = 0; s < 360; s++) world.step()
  const top = pileTop()
  curve.push([n + BATCH, +top.toFixed(3)])
  console.log(`${n + BATCH}\t${top.toFixed(3)}\t${Math.round((top / FULL_Y) * 100)}%`)
  if (top >= FULL_Y && capacityAt === null) {
    capacityAt = n + BATCH
    break outer
  }
}
console.log('\nESCAPED (fell out / through):', escaped())
console.log('CAPACITY (pile reaches shoulder y=1.60):', capacityAt ?? `>${MAX_TEST}`)
console.log('\nHEIGHT_CURVE =', JSON.stringify(curve))
