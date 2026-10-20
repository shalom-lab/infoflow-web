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
  if (boundMax <= boundMin) return null

  const span = boundMax - boundMin || 1
  const leftPct = ((valueMin - boundMin) / span) * 100
  const rightPct = ((valueMax - boundMin) / span) * 100

  const setMin = (raw: number) => {
    const next = Math.min(raw, valueMax)
    onChange(next, valueMax)
  }
  const setMax = (raw: number) => {
    const next = Math.max(raw, valueMin)
    onChange(valueMin, next)
  }

  return (
    <div className="image-count-filter" aria-label="按效果图张数筛选">
      <span className="icf-label">张数</span>
      <span className="icf-val" aria-hidden>
        {valueMin}
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
          min={boundMin}
          max={boundMax}
          step={1}
          value={valueMin}
          onChange={(e) => setMin(Number(e.target.value))}
          aria-label="最少张数"
        />
        <input
          type="range"
          className="icf-thumb icf-thumb-max"
          min={boundMin}
          max={boundMax}
          step={1}
          value={valueMax}
          onChange={(e) => setMax(Number(e.target.value))}
          aria-label="最多张数"
        />
      </div>
      <span className="icf-val" aria-hidden>
        {valueMax}
      </span>
    </div>
  )
}
