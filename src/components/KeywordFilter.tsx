interface Props {
  keywords: string[]
  selected: string[]
  onToggle: (kw: string) => void
  onClear: () => void
}

export function KeywordFilter({
  keywords,
  selected,
  onToggle,
  onClear,
}: Props) {
  if (keywords.length === 0 && selected.length === 0) return null

  const selectedSet = new Set(selected)

  return (
    <div className="keyword-filter" aria-label="口令筛选">
      <button
        type="button"
        className={`kw-chip${selected.length === 0 ? ' active' : ''}`}
        onClick={onClear}
      >
        全部
      </button>
      {keywords.map((kw) => (
        <button
          key={kw}
          type="button"
          className={`kw-chip${selectedSet.has(kw) ? ' active' : ''}`}
          onClick={() => onToggle(kw)}
        >
          {kw}
        </button>
      ))}
    </div>
  )
}
