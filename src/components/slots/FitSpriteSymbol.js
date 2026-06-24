import { Sprite, BlurFilter } from 'pixi.js'
import { gsap } from 'gsap'
import { ReelSymbol } from 'pixi-reels'

/**
 * A pixi-reels symbol that letterbox-fits its texture into the cell (preserving
 * aspect — our AI art isn't all square) and shows a real-time motion blur while
 * the reel spins. This is the canonical "blur-on-spin" production pattern, but
 * driven by a live BlurFilter instead of pre-rendered blur textures (we don't
 * have those yet — placeholder art).
 *
 * Copy-into-game-code class, per pixi-reels docs. ~70 lines.
 */
export class FitSpriteSymbol extends ReelSymbol {
  constructor(options) {
    super()
    this._textures = options.textures
    this._fitPad = options.fitPad ?? 0.86      // leave a little breathing room in the cell
    this._cellW = 0
    this._cellH = 0
    this._baseScale = 1
    this._blurred = false
    this._winTween = null

    this._sprite = new Sprite()
    this._sprite.anchor.set(0.5)
    this.view.addChild(this._sprite)

    // Vertical-ish motion blur. Cheap for 5 reels; wrapped so a filter hiccup
    // never blanks the symbol.
    try {
      this._blur = new BlurFilter({ strength: 7, quality: 2 })
    } catch {
      this._blur = null
    }
  }

  onActivate(symbolId) {
    const tex = this._textures[symbolId]
    if (tex) {
      this._sprite.texture = tex
      this._fit()
    }
  }

  onDeactivate() {
    this._killWinTween()
    this.setBlurred(false)
    this._sprite.scale.set(this._baseScale)
  }

  /** Letterbox-fit the current texture into the cell, centered. */
  _fit() {
    const tex = this._sprite.texture
    if (!tex || !this._cellW) return
    const tw = tex.width || tex.source?.width || this._cellW
    const th = tex.height || tex.source?.height || this._cellH
    this._baseScale = Math.min(this._cellW / tw, this._cellH / th) * this._fitPad
    this._sprite.scale.set(this._baseScale)
    this._sprite.x = this._cellW / 2
    this._sprite.y = this._cellH / 2
  }

  /** Engine calls this with the cell size. */
  resize(w, h) {
    this._cellW = w
    this._cellH = h
    this._fit()
  }

  setBlurred(on) {
    if (this._blurred === on || !this._blur) return
    this._blurred = on
    this._sprite.filters = on ? [this._blur] : []
  }

  async playWin() {
    this._killWinTween()
    const hi = this._baseScale * 1.16
    return new Promise((resolve) => {
      this._winTween = gsap.to(this._sprite.scale, {
        x: hi, y: hi, duration: 0.16, yoyo: true, repeat: 1,
        ease: 'power2.inOut', onComplete: resolve,
      })
    })
  }

  stopAnimation() {
    this._killWinTween()
    this._sprite.scale.set(this._baseScale)
  }

  onDestroy() {
    this._killWinTween()
  }

  _killWinTween() {
    if (this._winTween) { this._winTween.kill(); this._winTween = null }
  }
}
