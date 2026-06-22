// RotBlock content script — a thin ticker.
// While this page is the focused tab, it pings the background every ~5s so the
// background can drain coins for time spent here (and block late if you run out).
// All the decisions live in the background; this just keeps time honest per-page.
(function () {
  if (window.top !== window) return   // top frame only
  const DT = 5
  function tick() {
    if (document.visibilityState !== 'visible') return
    try { chrome.runtime.sendMessage({ type: 'tick', url: location.href, dt: DT }) } catch (e) { /* extension reloaded */ }
  }
  tick()
  setInterval(tick, DT * 1000)
})()
