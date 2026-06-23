import { useEffect, useState } from 'react'
import useStore from '../store/useStore'

// Returns { show, dismiss } for a first-visit Habit-Chan pop-in.
// Shows once per `key` — after dismiss() the key is persisted so it never shows again.
// A short delay lets the screen render before the overlay appears.
export function useFirstVisitPopIn(key) {
  const seen = useStore(s => s.firstVisitsSeen)
  const markFirstVisit = useStore(s => s.markFirstVisit)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (seen.includes(key)) return
    const t = setTimeout(() => setShow(true), 700)
    return () => clearTimeout(t)
  // Only run on mount — seen may update via markFirstVisit below, which would
  // re-trigger the effect and double-fire the timer on every dismiss.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  function dismiss() {
    markFirstVisit(key)
    setShow(false)
  }

  return { show, dismiss }
}
