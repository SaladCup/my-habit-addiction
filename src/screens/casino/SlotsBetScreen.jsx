import CasinoSlotMachine from '../../components/CasinoSlotMachine'

// The casino slots — now the SAME machine as the reward "bead" slots (5×3 reels,
// 21 paylines, wilds, ring-and-line win reveals, theater mode), just with betting.
// Everything lives in CasinoSlotMachine; this route only mounts it.
// (The old match-3 cabinet lives on in components/CasinoSlots.jsx, unused.)
export default function SlotsBetScreen() {
  return <CasinoSlotMachine />
}
