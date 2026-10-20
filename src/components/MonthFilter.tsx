interface Props {
  months: string[]
  selected: string | null
  onSelect: (month: string | null) => void
  /** Facet counts per YYYY-MM (other filters applied, month excluded). */
  counts: Record<string, number>
  /** 「全部」= total under other filters (prompt cards). */
  total: number
}

/** Display `2026-10` as `2026年10月`. */
export function formatMonthLabel(ym: string): string {
  const m = ym.match(/^(\d{4})-(\d{2})$/)
  if (!m) return ym
  const month = Number(m[2])
  if (!month || month > 12) return ym
  return `${m[1]}年${month}月`
}

export function MonthFilter({
  months,
  selected,
  onSelect,
  counts,
  total,
}: Props) {
  if (months.length === 0) return null

  return (
    <div className="sidebar-section month-filter" aria-label="年月筛选">
      <div className="sidebar-section-title">年月</div>
      <div className="sidebar-section-body month-filter-list">
        <button
          type="button"
          className={`month-chip${selected == null ? ' active' : ''}`}
          onClick={() => onSelect(null)}
        >
          <span className="month-chip-label">全部</span>
          <span className="month-chip-count">{total}</span>
        </button>
        {months.map((ym) => (
          <button
            key={ym}
            type="button"
            className={`month-chip${selected === ym ? ' active' : ''}`}
            onClick={() => onSelect(selected === ym ? null : ym)}
          >
            <span className="month-chip-label">{formatMonthLabel(ym)}</span>
            <span className="month-chip-count">{counts[ym] ?? 0}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
