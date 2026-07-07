import { useEffect, useState } from 'react'
import useStore from '../store/useStore'

// Returns { show, dismiss } for a first-visit Habit-Chan pop-in.
// Shows once per `key` — after dismiss() the key is persisted so it never shows again.
export function useFirstVisitPopIn(key) {
  const seen = useStore(s => s.firstVisitsSeen)
  const onboardingComplete = useStore(s => s.onboardingComplete)
  const markFirstVisit = useStore(s => s.markFirstVisit)
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Never stack a screen explainer on top of the intro chain (intro → nav tour
    // → RotBlock pitch) — those own the stage until onboarding completes.
    if (!onboardingComplete || seen.includes(key)) return
    // Show IMMEDIATELY (one frame so the screen paints behind her). The old
    // 700ms delay let a fast tap race Habit-Chan onto the next state — e.g. the
    // game-picker explainer losing to a quick SLOTS click and surfacing late.
    const t = setTimeout(() => setShow(true), 50)
    return () => clearTimeout(t)
  // `seen` deliberately NOT a dep — it updates via markFirstVisit below, which
  // would re-trigger the effect and double-fire the timer on every dismiss.
  // onboardingComplete IS one, so a popin arms right after the intro finishes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, onboardingComplete])

  function dismiss() {
    markFirstVisit(key)
    setShow(false)
  }

  return { show, dismiss }
}
