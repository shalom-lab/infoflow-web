import type { MouseEvent } from 'react'

interface Props {
  label: string
  onClick?: (e: MouseEvent) => void
  active?: boolean
}

export function TagCapsule({ label, onClick, active }: Props) {
  const Tag = onClick ? 'button' : 'span'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`tag-capsule${active ? ' active' : ''}${onClick ? ' clickable' : ''}`}
      onClick={onClick}
    >
      {label}
    </Tag>
  )
}
