// Bake the 3D Plinko landing distribution ONCE, offline, with real rapier physics —
// then tune the bucket multipliers to that measured distribution so the game is REAL
// physics AND a known RTP. Uses the EXACT board geometry the in-app component renders
// (src/components/plinkoBoard.js).
//
//   node scripts/bake-plinko.mjs
import RAPIER from '@dimforge/rapier3d-compat'
import {
  ROWS, BUCKETS, GAP, PEG_R, BALL_R, REST, FRICTION, GRAV_Y,
  TOP_PEG_Y, BOTTOM_PEG_Y, SPAWN_Y, FLOOR_Y, HALF_W,
  pegPositions, dividerXs, bucketForX,
} from '../src/components/plinkoBoard.js'

const N = 20000          // drops to measure the distribution
const TARGET_RTP = 0.95
const STEPS_PER_BALL = 600
const Z_HALF = BALL_R + 0.06

await RAPIER.init()
const world = new RAPIER.World({ x: 0, y: GRAV_Y, z: 0 })
const fixed = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())

// pegs
for (const [x, y] of pegPositions()) {
  world.createCollider(RAPIER.ColliderDesc.ball(PEG_R).setTranslation(x, y, 0).setRestitution(REST).setFriction(FRICTION), fixed)
}
// side walls + thin front/back walls (keep the ball in the 2D plane)
world.createCollider(RAPIER.ColliderDesc.cuboid(0.2, 8, 1).setTranslation(-HALF_W - 0.2, TOP_PEG_Y - 4, 0).setRestitution(0.3), fixed)
world.createCollider(RAPIER.ColliderDesc.cuboid(0.2, 8, 1).setTranslation(HALF_W + 0.2, TOP_PEG_Y - 4, 0).setRestitution(0.3), fixed)
world.createCollider(RAPIER.ColliderDesc.cuboid(HALF_W + 1, 8, 0.2).setTranslation(0, TOP_PEG_Y - 4, -Z_HALF - 0.2), fixed)
world.createCollider(RAPIER.ColliderDesc.cuboid(HALF_W + 1, 8, 0.2).setTranslation(0, TOP_PEG_Y - 4, Z_HALF + 0.2), fixed)
// bucket dividers + floor
const dCenterY = (FLOOR_Y + BOTTOM_PEG_Y) / 2
const dHalfH = Math.abs(BOTTOM_PEG_Y - FLOOR_Y) / 2 + 0.1
for (const x of dividerXs()) {
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.03, dHalfH, Z_HALF).setTranslation(x, dCenterY, 0).setRestitution(0.2), fixed)
}
world.createCollider(RAPIER.ColliderDesc.cuboid(HALF_W + 1, 0.2, Z_HALF + 0.5).setTranslation(0, FLOOR_Y - 0.2, 0).setRestitution(0.1).setFriction(0.6), fixed)

// deterministic-ish PRNG so the bake is reproducible
let seed = 123456789
const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }

const counts = new Array(BUCKETS).fill(0)
for (let n = 0; n < N; n++) {
  const ball = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation((rand() - 0.5) * GAP * 0.5, SPAWN_Y, 0)
      .setLinearDamping(0.05).setAngularDamping(0.4).setCcdEnabled(true)
  )
  const col = world.createCollider(RAPIER.ColliderDesc.ball(BALL_R).setRestitution(REST).setFriction(FRICTION).setDensity(1.2), ball)
  for (let s = 0; s < STEPS_PER_BALL; s++) {
    world.step()
    const p = ball.translation()
    if (p.y <= FLOOR_Y + BALL_R + 0.02) { const v = ball.linvel(); if (Math.abs(v.x) < 0.05 && Math.abs(v.y) < 0.05) break }
  }
  counts[bucketForX(ball.translation().x)]++
  world.removeCollider(col, false)
  world.removeRigidBody(ball)
}

const P = counts.map(c => c / N)
// multiplier shape: rarer buckets pay more (sublinear), then scale to hit TARGET_RTP
const raw = P.map(p => p > 0 ? Math.pow(1 / p, 1.15) : 50)
const rtpRaw = P.reduce((s, p, i) => s + p * raw[i], 0)
const mult = raw.map(v => Math.max(0.2, Math.round((v * TARGET_RTP / rtpRaw) * 10) / 10))
const realized = P.reduce((s, p, i) => s + p * mult[i], 0)

console.log('Plinko bake —', N, 'drops,', BUCKETS, 'buckets')
console.log('distribution %:', P.map(p => (p * 100).toFixed(1)).join('  '))
console.log('multipliers  :', mult.map(m => m + 'x').join('  '))
console.log('realized RTP :', (realized * 100).toFixed(2) + '%  (target ' + (TARGET_RTP * 100) + '%)')
console.log('\nPaste into plinkoBoard.js:\nexport const BUCKET_MULTS = [' + mult.join(', ') + ']')
