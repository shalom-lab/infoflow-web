interface Props {
  months: string[]
  selected: string | null
  onSelect: (month: string | null) => void
}

/** Display `2026-10` as `2026年10月`. */
export function formatMonthLabel(ym: string): string {
  const m = ym.match(/^(\d{4})-(\d{2})$/)
  if (!m) return ym
  const month = Number(m[2])
  if (!month || month > 12) return ym
  return `${m[1]}年${month}月`
}

export function MonthFilter({ months, selected, onSelect }: Props) {
  if (months.length === 0) return null

  return (
    <aside className="month-filter" aria-label="年月筛选">
      <div className="month-filter-label">年月</div>
      <button
        type="button"
        className={`month-chip${selected == null ? ' active' : ''}`}
        onClick={() => onSelect(null)}
      >
        全部
      </button>
      {months.map((ym) => (
        <button
          key={ym}
          type="button"
          className={`month-chip${selected === ym ? ' active' : ''}`}
          onClick={() => onSelect(selected === ym ? null : ym)}
        >
          {formatMonthLabel(ym)}
        </button>
      ))}
    </aside>
  )
}
