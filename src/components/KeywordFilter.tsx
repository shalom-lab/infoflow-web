interface Props {
  keywords: string[]
  selected: string | null
  onSelect: (kw: string | null) => void
}

export function KeywordFilter({ keywords, selected, onSelect }: Props) {
  if (keywords.length === 0) return null

  return (
    <div className="keyword-filter" aria-label="关键词筛选">
      <button
        type="button"
        className={`kw-chip${selected == null ? ' active' : ''}`}
        onClick={() => onSelect(null)}
      >
        全部
      </button>
      {keywords.map((kw) => (
        <button
          key={kw}
          type="button"
          className={`kw-chip${selected === kw ? ' active' : ''}`}
          onClick={() => onSelect(selected === kw ? null : kw)}
        >
          {kw}
        </button>
      ))}
    </div>
  )
}
