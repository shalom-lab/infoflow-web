interface Props {
  value: string
  onChange: (v: string) => void
  count: number
  total: number
}

export function SearchBar({ value, onChange, count, total }: Props) {
  return (
    <div className="search-container" role="search">
      <div className="search-input-wrap">
        <span className="search-icon" aria-hidden>
          ⌕
        </span>
        <input
          className="search-input"
          type="search"
          placeholder="搜索标题 / 关键词 / 提示词正文…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          aria-label="搜索提示词"
        />
        {value && (
          <button
            type="button"
            className="clear-search"
            onClick={() => onChange('')}
            aria-label="清除搜索"
          >
            ×
          </button>
        )}
      </div>
      <span className="result-count" aria-live="polite">
        {count === total ? `${total} 条` : `${count} / ${total}`}
      </span>
    </div>
  )
}
