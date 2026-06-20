import { useState, useEffect } from 'react'

// Current time (ms), refreshed on an interval. Lets time-based UI (e.g. the
// Break Glass countdown) update over time WITHOUT calling Date.now() during
// render, which React flags as impure.
export default function useNow(intervalMs = 20000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
