import { useState } from 'react'

interface Props {
  /** Data-driven lower bound (at least 1). */
  boundMin: number
  /** Data-driven upper bound (max image_count in dataset). */
  boundMax: number
  valueMin: number
  valueMax: number
  onChange: (min: number, max: number) => void
}

/**
 * Dual-thumb range slider for filtering by effect-image count.
 * Hidden when boundMax <= boundMin (e.g. no images >= min in the dataset).
 *
 * Overlapping thumbs: when min==max, only min← / max→ can open the range.
 * Fixed CSS z-index left max always on top and blocked dragging the lower
 * thumb at the right edge — boost the reachable thumb dynamically.
 */
export function ImageCountFilter({
  boundMin,
  boundMax,
  valueMin,
  valueMax,
  onChange,
}: Props) {
  /** Last thumb the user grabbed; used when thumbs are apart. */
  const [activeThumb, setActiveThumb] = useState<'min' | 'max'>('max')

  const loBound = Math.max(1, boundMin)
  const hiBound = Math.max(loBound, boundMax)
  if (hiBound <= loBound) return null

  const lo = Math.min(Math.max(valueMin, loBound), hiBound)
  const hi = Math.min(Math.max(valueMax, lo), hiBound)

  const span = hiBound - loBound || 1
  const leftPct = ((lo - loBound) / span) * 100
  const rightPct = ((hi - loBound) / span) * 100

  const setMin = (raw: number) => {
    const next = Math.min(Math.max(raw, loBound), hi)
    onChange(next, hi)
  }
  const setMax = (raw: number) => {
    const next = Math.max(Math.min(raw, hiBound), lo)
    onChange(lo, next)
  }

  // When thumbs coincide, only min← or max→ can open the range.
  // Prefer the thumb that can still move: at upper bound → min on top;
  // at lower bound → max on top; otherwise last active.
  let minZ = 3
  let maxZ = 4
  if (lo === hi) {
    if (lo === loBound) {
      maxZ = 5
    } else {
      // includes min==max==hiBound (screenshot deadlock) and mid-track equal
      minZ = 5
    }
  } else if (activeThumb === 'min') {
    minZ = 5
  } else {
    maxZ = 5
  }

  return (
    <div className="sidebar-section image-count-filter" aria-label="按效果图张数筛选">
      <div className="sidebar-section-title">张数</div>
      <div className="sidebar-section-body icf-controls">
        <span className="icf-val" aria-hidden>
          {lo}
        </span>
        <div className="icf-slider">
          <div className="icf-track" aria-hidden>
            <div
              className="icf-range"
              style={{ left: `${leftPct}%`, width: `${rightPct - leftPct}%` }}
            />
          </div>
          <input
            type="range"
            className="icf-thumb icf-thumb-min"
            style={{ zIndex: minZ }}
            min={loBound}
            max={hiBound}
            step={1}
            value={lo}
            onChange={(e) => setMin(Number(e.target.value))}
            onPointerDown={() => setActiveThumb('min')}
            aria-label="最少张数"
          />
          <input
            type="range"
            className="icf-thumb icf-thumb-max"
            style={{ zIndex: maxZ }}
            min={loBound}
            max={hiBound}
            step={1}
            value={hi}
            onChange={(e) => setMax(Number(e.target.value))}
            onPointerDown={() => setActiveThumb('max')}
            aria-label="最多张数"
          />
        </div>
        <span className="icf-val" aria-hidden>
          {hi}
        </span>
      </div>
    </div>
  )
}
