/** 张数 → 信号格点亮数（0–4）。满格 4 根 = 10 张；映射：ceil(n/10*4)，>10 仍为 4。 */
export function countSignalBars(n: number): number {
  if (n <= 0) return 0
  return Math.min(4, Math.ceil((n / 10) * 4))
}
