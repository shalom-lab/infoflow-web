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
 */
export function ImageCountFilter({
  boundMin,
  boundMax,
  valueMin,
  valueMax,
  onChange,
}: Props) {
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
            min={loBound}
            max={hiBound}
            step={1}
            value={lo}
            onChange={(e) => setMin(Number(e.target.value))}
            aria-label="最少张数"
          />
          <input
            type="range"
            className="icf-thumb icf-thumb-max"
            min={loBound}
            max={hiBound}
            step={1}
            value={hi}
            onChange={(e) => setMax(Number(e.target.value))}
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
